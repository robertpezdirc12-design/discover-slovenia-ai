import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildOrderCheckoutLineItems,
  checkoutExpiresAt,
  checkoutExpiresAtUnix,
} from "@/lib/marketplace-checkout";
import {
  getStripeClient,
  isStripeConfigured,
  isStripeDemo,
  releasePendingOrder,
  sweepExpiredPendingOrders,
} from "@/lib/marketplace-checkout-server";
import { canRequestCancellation } from "@/lib/marketplace-types";

export const dynamic = "force-dynamic";

/**
 * /api/checkout — B2C checkout lastne tržnice (rekonstrukcija issue #20 FAZA 2).
 *
 * Telo: { slug, qty, visitorKey? } (gost checkout dovoljen — visitorKey je
 * UUID iz localStorage "dai:visitor-key").
 *
 * Tok (fail-closed):
 *  1. plačila niso konfigurirana (brez STRIPE_SECRET_KEY in brez
 *     DSA_DEMO_PAYMENTS=1) → 503 "Plačila niso konfigurirana.";
 *  2. validacija (slug obstaja+aktiven → 404; qty 1–10 → 400);
 *  3. ATOMARNA pending rezervacija v transakciji:
 *     - dedup: odprto (pending, ne poteklo) naročilo istega uporabnika/
 *       gosta z istim izdelkom → 409;
 *     - dekrement zaloge S pogojem zaloga >= qty (P2025 → 409) +
 *       saleCount increment + vrstica naročila s snapshotom imena/cene;
 *  4a. STRIPE_SECRET_KEY → Stripe Checkout Session (mode "payment",
 *      metadata {kind:"marketplace_order", orderId}, expires_at +60 min,
 *      success/cancel URL na /trznica?placilo=…) → { url };
 *      napaka seje → KOMPENZACIJA releasePendingOrder + 503;
 *  4b. sicer DSA_DEMO_PAYMENTS=1 → DEMO veja: naročilo takoj "paid" z
 *      demo:true → { demo:true, orderId, visitorKey, status:"paid" }
 *      (izrecno označeno — brez prave bremenitve);
 *  4c. sicer → 503 (toča 1 že prej ujame; varnostna mreža s sprostitvijo).
 */

const MIN_QTY = 1;
const MAX_QTY = 10;
/** Gostov ključ: UUID oblika (8–64 znakov A–Za–z0–9-). */
const VISITOR_KEY_RE = /^[A-Za-z0-9-]{8,64}$/;

class CheckoutError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Javni izvor za success/cancel URL (glava zahteve > notranji naslov). */
function resolveOrigin(req: Request): string {
  const headerOrigin = req.headers.get("origin");
  if (headerOrigin) return headerOrigin;
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  // 1 ── FAIL-CLOSED: brez Stripe ključa in brez demo načina ne prodajamo.
  if (!isStripeConfigured() && !isStripeDemo()) {
    return NextResponse.json(
      { error: "Plačila niso konfigurirana." },
      { status: 503 }
    );
  }

  // 2 ── validacija zahteve
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Neveljavno telo zahteve (pričakovan JSON)." },
      { status: 400 }
    );
  }
  const { slug, qty, visitorKey } = (body ?? {}) as {
    slug?: unknown;
    qty?: unknown;
    visitorKey?: unknown;
  };

  if (typeof slug !== "string" || slug.trim().length === 0) {
    return NextResponse.json(
      { error: "Manjka slug izdelka." },
      { status: 400 }
    );
  }
  const quantity = typeof qty === "number" ? qty : Number(qty);
  if (
    !Number.isInteger(quantity) ||
    quantity < MIN_QTY ||
    quantity > MAX_QTY
  ) {
    return NextResponse.json(
      { error: `Količina mora biti celo število med ${MIN_QTY} in ${MAX_QTY}.` },
      { status: 400 }
    );
  }

  // Identiteta kupca: prijavljen uporabnik (močnejša) ali gostov visitorKey.
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  let guestKey: string | null = null;
  if (!userId) {
    guestKey =
      typeof visitorKey === "string" && VISITOR_KEY_RE.test(visitorKey)
        ? visitorKey
        : randomUUID();
  }

  // Izdelek: mora obstajati in biti aktiven.
  const product = await db.product.findUnique({ where: { slug } });
  if (!product || !product.active) {
    return NextResponse.json(
      { error: "Izdelek ne obstaja ali ni aktiven." },
      { status: 404 }
    );
  }

  // Oportunistično sprostimo že potekle pending rezervacije (varnostna
  // mreža za izgubljene webhook dogodke) — best-effort, ne blokira nakupa.
  try {
    await sweepExpiredPendingOrders();
  } catch (err) {
    console.error("[api/checkout] pometenje poteklih naročil ni uspelo:", err);
  }

  // 3 ── ATOMARNA pending rezervacija (transakcija)
  let order;
  try {
    order = await db.$transaction(
      async (tx) => {
        const now = new Date();
        // Dedup: SAMO odprta (pending, še ne potekla) naročila istega
        // kupca z istim izdelkom. Plačano naročilo je zaključen nakup —
        // ponovni nakup je novo naročilo (kanon izvirnika).
        const dupWhere: Prisma.OrderWhereInput = {
          status: "pending",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          items: { some: { productId: product.id } },
        };
        if (userId) {
          dupWhere.userId = userId;
        } else {
          dupWhere.visitorKey = guestKey;
        }
        const dup = await tx.order.findFirst({
          where: dupWhere,
          select: { id: true },
        });
        if (dup) {
          throw new CheckoutError(
            409,
            "Za ta izdelek že imate odprto (nedokončano) naročilo."
          );
        }

        // Dekrement zaloga S pogojem zaloga >= qty + saleCount increment.
        // Premalo zaloge → pogoj update-a ne zadene → P2025 → 409
        // (zaloga nikoli ne pade pod nič).
        try {
          await tx.product.update({
            where: { id: product.id, active: true, stock: { gte: quantity } },
            data: {
              stock: { decrement: quantity },
              saleCount: { increment: quantity },
            },
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2025"
          ) {
            throw new CheckoutError(
              409,
              "Zaloge ni več na voljo za ta izdelek."
            );
          }
          throw err;
        }

        // Pending naročilo s snapshotom imena/cene (vrstica je resnica).
        return tx.order.create({
          data: {
            userId,
            visitorKey: userId ? null : guestKey,
            status: "pending",
            totalCents: product.priceCents * quantity,
            expiresAt: checkoutExpiresAt(),
            items: {
              create: {
                productId: product.id,
                nameSnapshot: product.name,
                priceCentsSnapshot: product.priceCents,
                qty: quantity,
              },
            },
          },
          include: { items: true },
        });
      },
      { timeout: 15_000 }
    );
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/checkout] rezervacija ni uspela:", err);
    return NextResponse.json(
      { error: "Naročila ni bilo mogoče ustvariti." },
      { status: 500 }
    );
  }

  // 4a ── PRAVA Stripe veja
  if (isStripeConfigured()) {
    const stripe = getStripeClient();
    if (!stripe) {
      // Ključ je izginil med preverbo in klicem — kompenzacija + fail-closed.
      await releasePendingOrder(order.id, "cancelled");
      return NextResponse.json(
        { error: "Plačila niso konfigurirana." },
        { status: 503 }
      );
    }
    try {
      const origin = resolveOrigin(req);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: buildOrderCheckoutLineItems(
          order.items.map((item) => ({
            name: item.nameSnapshot,
            unitAmountCents: item.priceCentsSnapshot,
            qty: item.qty,
          }))
        ),
        metadata: { kind: "marketplace_order", orderId: order.id },
        expires_at: checkoutExpiresAtUnix(),
        success_url: `${origin}/trznica?placilo=uspeh&order=${order.id}`,
        cancel_url: `${origin}/trznica?placilo=preklic`,
      });
      if (!session.url || !session.id) {
        throw new Error("Stripe ni vrnil URL/ID seje.");
      }
      await db.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });
      return NextResponse.json({
        url: session.url,
        visitorKey: userId ? null : guestKey,
      });
    } catch (err) {
      console.error("[api/checkout] Stripe seja ni uspela:", err);
      // KOMPENZACIJA: sprostimo rezervacijo, da zaloga ne pušča.
      try {
        await releasePendingOrder(order.id, "cancelled");
      } catch (releaseErr) {
        console.error(
          "[api/checkout] kompenzacija (sprostitev) ni uspela:",
          releaseErr
        );
      }
      return NextResponse.json(
        { error: "Plačilna seja ni bila ustvarjena. Poskusite znova." },
        { status: 503 }
      );
    }
  }

  // 4b ── DEMO veja (DSA_DEMO_PAYMENTS=1): takoj "paid", IZRECNO demo.
  if (isStripeDemo()) {
    const paidAt = new Date();
    const paid = await db.order.update({
      where: { id: order.id },
      data: { status: "paid", demo: true, paidAt },
    });
    // Revizijska sled (P0-E §11): plačilo (demo) je dogodek, viden lastniku.
    try {
      await db.auditLog.create({
        data: {
          actorType: "system",
          action: paid.demo ? "order.paid_demo" : "order.paid",
          entityType: "order",
          entityId: paid.id,
          meta: JSON.stringify({
            totalCents: paid.totalCents,
            demo: paid.demo,
            userId,
            visitorKey: userId ? null : guestKey,
          }),
        },
      });
    } catch (err) {
      console.error("[api/checkout] auditLog (demo paid) ni uspel:", err);
    }
    return NextResponse.json({
      demo: true,
      orderId: paid.id,
      visitorKey: userId ? null : guestKey,
      status: paid.status,
    });
  }

  // 4c ── varnostna mreža (nezadostna konfiguracija po rezervaciji).
  await releasePendingOrder(order.id, "cancelled");
  return NextResponse.json(
    { error: "Plačila niso konfigurirana." },
    { status: 503 }
  );
}

// ── PATCH: ZAHTEVEK KUPCA PO PREKLICU (P0-E §11 — customer state) ──────────

/**
 * PATCH { orderId, visitorKey? } — kupec ZAPOŠE za preklic/povratek.
 *
 * ISKRENOSTNI kanon (marketplace-types.ts):
 *  - zahtevek NE povzroči povratila sam — povratek teče pri plačilnem
 *    ponudniku (Stripe); zahtevek je VIDEN lastniku v skrbniškem pregledu;
 *  - dovoljen SAMO na lastnem naročilu (userId seje ali visitorKey gosta)
 *    in SAMO na plačanem naročilu (pending/expired/cancelled → odklon);
 *  - idempotenca: ponovni zahtevek istega naročila ne ustvari novega vnosa
 *    (vrne 409 z odkrito napako; že obstoječi zahtevek se NE prepiše).
 */
export async function PATCH(req: Request) {
  let body: { orderId?: unknown; visitorKey?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljavno telo zahtevka (JSON)." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return NextResponse.json({ error: "Manjka orderId naročila." }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const visitorKey =
    typeof body.visitorKey === "string" && body.visitorKey.trim() !== ""
      ? body.visitorKey.trim()
      : null;
  if (!userId && !visitorKey) {
    return NextResponse.json(
      { error: "Manjka identiteta (prijava ali visitorKey)." },
      { status: 401 }
    );
  }

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ error: "Naročilo ne obstaja." }, { status: 404 });
  }

  // Lastništvo: prijavljen uporabnik ALI gost z istim visitorKeyjem.
  const isOwner =
    (userId !== null && order.userId === userId) ||
    (visitorKey !== null && order.visitorKey === visitorKey);
  if (!isOwner) {
    return NextResponse.json(
      { error: "To ni tvoje naročilo." },
      { status: 403 }
    );
  }

  const check = canRequestCancellation({
    status: order.status,
    cancellationRequestedAt: order.cancellationRequestedAt,
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 409 });
  }

  const requestedAt = new Date();
  const updated = await db.order.update({
    where: { id: order.id },
    data: { cancellationRequestedAt: requestedAt },
  });

  // Revizijska sled (P0-E §11).
  try {
    await db.auditLog.create({
      data: {
        actorType: "customer",
        actorId: userId ?? visitorKey ?? null,
        action: "order.cancellation_requested",
        entityType: "order",
        entityId: order.id,
        meta: JSON.stringify({
          orderStatus: order.status,
          demo: order.demo,
          totalCents: order.totalCents,
        }),
      },
    });
  } catch (err) {
    console.error("[api/checkout] auditLog (cancellation) ni uspel:", err);
  }

  return NextResponse.json({
    success: true,
    orderId: updated.id,
    cancellationRequestedAt: requestedAt.toISOString(),
    honest: true,
    message:
      "Zahtevek je podan. POVRATILO ne steče samodejno — obravnava ga lastnik tržnice pri plačilnem ponudniku.",
  });
}
