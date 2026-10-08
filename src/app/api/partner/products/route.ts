import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getPartnerContext, getSessionContext } from "@/lib/partner-session";
import {
  canActorTransitionListing,
  isListingStatus,
  statusAfterContentEdit,
  transitionAuditAction,
  validateListingContent,
  type ListingStatus,
} from "@/lib/listing-moderation";
import { validateGeoPin } from "@/lib/geo-bbox";

/**
 * /api/partner/products — portal partnerja (P0-H §22, B2B tržnica).
 *
 *  GET   → lastni izdelki (VSI statusi) + statistika naročil/preklicev,
 *          ki se tičejo partnerjevih izdelkov (vidljivost partnerja).
 *  POST  → ustvari OSNUTEK (draft) — vsebina + geo pin validirana;
 *          partner NIKOLI ne objavi samega sebe (§22 moderacija).
 *  PATCH → urejanje vsebine (statusna sprememba po pravilu ponovne
 *          moderacije: published/pending → pending, rejected/draft → draft)
 *          + dejanji "submit" (draft/rejected → pending) in
 *          "withdraw" (pending/published → draft).
 *
 * Vrata: brez seje → 401; brez vloge partner → 403 (iskreno).
 * AuditLog na vsakem dejanju; tujega vnosa ni mogoče niti prebrati
 * prek te poti (IDOR: query vedno dodatno filtrira ownerId).
 */

export const dynamic = "force-dynamic";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function allowRequest(key: string, now: number): boolean {
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (rateBuckets.size > 5_000) {
      for (const [k, v] of rateBuckets) {
        if (now >= v.resetAt) rateBuckets.delete(k);
      }
    }
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT;
}

/** ASCII slug iz imena (čšž → csz) + kratka pripona ob trku. */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length >= 2 ? base : "izdelek";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const existing = await db.product.findUnique({ where: { slug: base } });
  if (!existing) return base;
  return `${base}-${randomBytes(3).toString("hex")}`;
}

// ── GET: lastni izdelki + statistika naročil ───────────────────────────────

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json(
      { error: "Najprej se prijavi — partnerjev portal je za registrirane račune." },
      { status: 401 }
    );
  }
  const ctx = await getPartnerContext();
  if (!ctx) {
    return NextResponse.json(
      { error: "Ta portal je za partnerje. Račun še ni odobren kot partner." },
      { status: 403 }
    );
  }

  try {
    const products = await db.product.findMany({
      where: { ownerId: ctx.userId },
      orderBy: { createdAt: "desc" },
    });
    const productIds = products.map((p) => p.id);

    const items = productIds.length
      ? await db.orderItem.findMany({
          where: { productId: { in: productIds } },
          select: {
            productId: true,
            qty: true,
            order: {
              select: {
                status: true,
                paidAt: true,
                cancellationRequestedAt: true,
              },
            },
          },
        })
      : [];

    const stats = new Map<
      string,
      { sold: number; pendingOrders: number; cancellations: number }
    >();
    for (const p of products) stats.set(p.id, { sold: 0, pendingOrders: 0, cancellations: 0 });
    for (const it of items) {
      const s = stats.get(it.productId);
      if (!s) continue;
      if (it.order.status === "paid") {
        s.sold += it.qty;
        if (it.order.cancellationRequestedAt) s.cancellations += 1;
      } else if (it.order.status === "pending") {
        s.pendingOrders += 1;
      }
    }

    let soldTotal = 0;
    let cancellationsTotal = 0;
    const rows = products.map((p) => {
      const s = stats.get(p.id) ?? { sold: 0, pendingOrders: 0, cancellations: 0 };
      soldTotal += s.sold;
      cancellationsTotal += s.cancellations;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        kind: p.kind,
        stock: p.stock,
        saleCount: p.saleCount,
        status: p.status,
        lat: p.lat,
        lng: p.lng,
        submittedAt: p.submittedAt?.toISOString() ?? null,
        reviewedAt: p.reviewedAt?.toISOString() ?? null,
        rejectionReason: p.rejectionReason,
        stats: s,
      };
    });

    return NextResponse.json({
      products: rows,
      totals: { sold: soldTotal, cancellations: cancellationsTotal, listings: rows.length },
    });
  } catch (err) {
    console.error("[api/partner/products] GET napaka:", err);
    return NextResponse.json({ error: "Portal trenutno ni dosegljiv." }, { status: 500 });
  }
}

// ── POST: ustvari osnutek ──────────────────────────────────────────────────

interface CreateBody {
  name?: unknown;
  description?: unknown;
  priceCents?: unknown;
  stock?: unknown;
  kind?: unknown;
  lat?: unknown;
  lng?: unknown;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(ip, Date.now())) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json(
      { error: "Najprej se prijavi — partnerjev portal je za registrirane račune." },
      { status: 401 }
    );
  }
  const ctx = await getPartnerContext();
  if (!ctx) {
    return NextResponse.json(
      { error: "Ta portal je za partnerje. Račun še ni odobren kot partner." },
      { status: 403 }
    );
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const content = validateListingContent(body);
  if (!content.ok) {
    return NextResponse.json({ error: content.error }, { status: 400 });
  }
  const geo = validateGeoPin(body.lat, body.lng);
  if (!geo.ok) {
    return NextResponse.json({ error: geo.error }, { status: 400 });
  }

  try {
    const slug = await uniqueSlug(content.value.name);
    const product = await db.product.create({
      data: {
        slug,
        name: content.value.name,
        description: content.value.description,
        priceCents: content.value.priceCents,
        kind: content.value.kind,
        stock: content.value.stock,
        active: true,
        status: "draft",
        ownerId: ctx.userId,
        lat: geo.value?.lat ?? null,
        lng: geo.value?.lng ?? null,
      },
    });

    await db.auditLog.create({
      data: {
        actorType: "partner",
        actorId: ctx.userId,
        action: "listing.created",
        entityType: "product",
        entityId: product.id,
        meta: JSON.stringify({ slug, status: "draft" }),
      },
    });

    return NextResponse.json(
      { ok: true, product: { id: product.id, slug, status: "draft" } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/partner/products] POST napaka:", err);
    return NextResponse.json({ error: "Ustvarjanje vnosa ni uspelo." }, { status: 500 });
  }
}

// ── PATCH: urejanje + predaja/umik ─────────────────────────────────────────

interface PatchBody extends CreateBody {
  productId?: unknown;
  action?: unknown; // "submit" | "withdraw"
}

export async function PATCH(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(ip, Date.now())) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusi čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json(
      { error: "Najprej se prijavi — partnerjev portal je za registrirane račune." },
      { status: 401 }
    );
  }
  const ctx = await getPartnerContext();
  if (!ctx) {
    return NextResponse.json(
      { error: "Ta portal je za partnerje. Račun še ni odobren kot partner." },
      { status: 403 }
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  const productId = typeof body.productId === "string" ? body.productId : "";
  if (!productId) {
    return NextResponse.json({ error: "Manjka productId." }, { status: 400 });
  }
  const action = body.action;
  if (action !== undefined && action !== "submit" && action !== "withdraw") {
    return NextResponse.json({ error: "Neznano dejanje." }, { status: 400 });
  }

  try {
    // IDOR: query vedno dodatno filtrira ownerId — tuj vnos = "ne obstaja".
    const product = await db.product.findFirst({
      where: { id: productId, ownerId: ctx.userId },
    });
    if (!product) {
      return NextResponse.json(
        { error: "Vnos ne obstaja (ali ni tvoj)." },
        { status: 404 }
      );
    }
    if (!isListingStatus(product.status)) {
      return NextResponse.json({ error: "Neznan status vnosa." }, { status: 500 });
    }
    const current: ListingStatus = product.status;

    // 1) Vsebinska polja (če so poslana) → validacija + ponovna moderacija.
    const hasContent =
      body.name !== undefined ||
      body.description !== undefined ||
      body.priceCents !== undefined ||
      body.stock !== undefined ||
      body.kind !== undefined;
    let contentPatch: {
      name: string;
      description: string;
      priceCents: number;
      stock: number;
      kind: string;
    } | null = null;
    if (hasContent) {
      const merged = {
        name: body.name !== undefined ? body.name : product.name,
        description: body.description !== undefined ? body.description : product.description,
        priceCents: body.priceCents !== undefined ? body.priceCents : product.priceCents,
        stock: body.stock !== undefined ? body.stock : product.stock,
        kind: body.kind !== undefined ? body.kind : product.kind,
      };
      const content = validateListingContent(merged);
      if (!content.ok) {
        return NextResponse.json({ error: content.error }, { status: 400 });
      }
      contentPatch = content.value;
    }

    const hasGeo = body.lat !== undefined || body.lng !== undefined;
    let geoPatch: { lat: number | null; lng: number | null } | null = null;
    if (hasGeo) {
      const geo = validateGeoPin(
        body.lat !== undefined ? body.lat : product.lat,
        body.lng !== undefined ? body.lng : product.lng
      );
      if (!geo.ok) {
        return NextResponse.json({ error: geo.error }, { status: 400 });
      }
      geoPatch = { lat: geo.value?.lat ?? null, lng: geo.value?.lng ?? null };
    }

    const contentChanged =
      (contentPatch !== null &&
        (contentPatch.name !== product.name ||
          contentPatch.description !== product.description ||
          contentPatch.priceCents !== product.priceCents ||
          contentPatch.stock !== product.stock ||
          contentPatch.kind !== product.kind)) ||
      (geoPatch !== null &&
        (geoPatch.lat !== product.lat || geoPatch.lng !== product.lng));

    // 2) Status po pravilih.
    let nextStatus: ListingStatus = current;
    if (contentChanged) {
      nextStatus = statusAfterContentEdit(current); // §22 ponovna moderacija
    }
    // Učinkoviti "iz" status za prehod dejanja (po morebitni vsebinski
    // spremembi) — pravi vir za kanonsko ime dejanja v AuditLog.
    const preActionStatus: ListingStatus = nextStatus;
    if (action === "submit") {
      if (!canActorTransitionListing(nextStatus, "pending", "partner")) {
        return NextResponse.json(
          {
            error:
              nextStatus === "pending"
                ? "Vnos je že v predaji."
                : "Predaja ni mogoča iz tega statusa — najprej uredi zavrnjeni vnos.",
          },
          { status: 409 }
        );
      }
      nextStatus = "pending";
    } else if (action === "withdraw") {
      if (!canActorTransitionListing(nextStatus, "draft", "partner")) {
        return NextResponse.json(
          { error: "Umik ni mogoč iz tega statusa." },
          { status: 409 }
        );
      }
      nextStatus = "draft";
    }

    // 3) Pisanje v eni transakciji (+ AuditLog).
    const statusChanged = nextStatus !== current;
    const updated = await db.$transaction(async (tx) => {
      const data: Prisma.ProductUpdateInput = { updatedAt: new Date() };
      if (contentPatch) {
        data.name = contentPatch.name;
        data.description = contentPatch.description;
        data.priceCents = contentPatch.priceCents;
        data.stock = contentPatch.stock;
        data.kind = contentPatch.kind;
      }
      if (geoPatch) {
        data.lat = geoPatch.lat;
        data.lng = geoPatch.lng;
      }
      if (statusChanged) {
        data.status = nextStatus;
        if (nextStatus === "pending") {
          data.submittedAt = new Date();
          // nova predaja pošisti staro zavrnitev (razlog ostane v AuditLog)
          data.rejectionReason = null;
          data.reviewedAt = null;
          data.reviewedBy = null;
        }
        if (nextStatus === "draft") {
          data.submittedAt = null;
        }
      }
      const row = await tx.product.update({ where: { id: product.id }, data });

      if (contentChanged && !statusChanged) {
        await tx.auditLog.create({
          data: {
            actorType: "partner",
            actorId: ctx.userId,
            action: "listing.edited",
            entityType: "product",
            entityId: product.id,
            meta: JSON.stringify({ status: current }),
          },
        });
      }
      if (statusChanged) {
        const auditAction = transitionAuditAction(
          action ? preActionStatus : current,
          nextStatus
        );
        await tx.auditLog.create({
          data: {
            actorType: "partner",
            actorId: ctx.userId,
            action: auditAction,
            entityType: "product",
            entityId: product.id,
            meta: JSON.stringify({ from: current, to: nextStatus }),
          },
        });
      }
      return row;
    });

    return NextResponse.json({
      ok: true,
      product: {
        id: updated.id,
        slug: updated.slug,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
      },
      remoderated: contentChanged && current === "published",
    });
  } catch (err) {
    console.error("[api/partner/products] PATCH napaka:", err);
    return NextResponse.json({ error: "Shranjevanje ni uspelo." }, { status: 500 });
  }
}
