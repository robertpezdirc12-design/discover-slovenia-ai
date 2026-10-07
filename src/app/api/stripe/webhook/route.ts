import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import {
  resolveMarketplaceType,
  validateMarketplacePayment,
} from "@/lib/marketplace-checkout";
import {
  getStripeClient,
  releasePendingOrder,
} from "@/lib/marketplace-checkout-server";

export const dynamic = "force-dynamic";

/**
 * /api/stripe/webhook — Stripe dogodki za lastno tržnico (issue #20 FAZA 2).
 *
 * Tok (fail-closed + idempotentno):
 *  1. brez STRIPE_WEBHOOK_SECRET → 503 (ne sprejemamo nepodpisanih);
 *  2. stripe.webhooks.constructEvent (PREVERBA PODPISA) → 400 ob napaki;
 *  3. dedup: zapis v ProcessedStripeEvent (eventId @unique) — P2002 pomeni
 *     že obdelan dogodek → 200 prezrto;
 *  4. obravnava (vse idempotentno):
 *     - checkout.session.completed → kind marketplace_order: preverba
 *       payment_status === "paid" IN zneska === totalCents naročila →
 *       pending → paid (že plačano/preklicano = no-op);
 *     - checkout.session.expired → releasePendingOrder(…, "expired");
 *     - checkout.session.async_payment_failed / charge.async_payment_failed
 *       → releasePendingOrder(…, "cancelled");
 *     - ostali dogodki → 200 prezrti (ne naša entiteta / nezanimiv).
 */

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook ni konfiguriran (STRIPE_WEBHOOK_SECRET)." },
      { status: 503 }
    );
  }
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Plačila niso konfigurirana (STRIPE_SECRET_KEY)." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Manjka glava stripe-signature." },
      { status: 400 }
    );
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] neveljaven podpis:", err);
    return NextResponse.json(
      { error: "Podpis dogodka ni veljaven." },
      { status: 400 }
    );
  }

  // DEDUP: eventId je unikaten; P2002 → dogodek že obravnavan → 200.
  try {
    await db.processedStripeEvent.create({
      data: { eventId: event.id, type: event.type },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error("[stripe/webhook] dedup zapis ni uspel:", err);
    return NextResponse.json(
      { error: "Dogodka ni bilo mogoče zabeležiti." },
      { status: 500 }
    );
  }

  try {
    // event.type je v SDK tipiziran kot zaprta unija — naše veje
    // primerjamo po razširjeni nizi (constructEvent je obliko že potrdil).
    const type = event.type as string;
    switch (type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const resolved = resolveMarketplaceType(session.metadata);
        if (resolved?.kind !== "marketplace_order") break;

        const order = await db.order.findUnique({
          where: { id: resolved.id },
          select: { id: true, status: true, totalCents: true },
        });
        if (!order) {
          console.warn(
            `[stripe/webhook] naročilo ${resolved.id} ne obstaja (preskočeno)`
          );
          break;
        }
        if (order.status !== "pending") break; // idempotentno: že zaključeno

        // Fail-closed: POTRDIMO SAMO ob payment_status "paid" IN ujemajočem
        // znesku (v centih). Karkoli drugega pusti v pending (čaka expired).
        const valid = validateMarketplacePayment({
          paymentStatus: session.payment_status,
          amountTotalCents: session.amount_total,
          expectedTotalCents: order.totalCents,
        });
        if (valid) {
          await db.order.update({
            where: { id: order.id },
            data: { status: "paid" },
          });
        } else {
          console.error(
            `[stripe/webhook] plačilo za ${order.id} NI potrjeno ` +
              `(status=${String(session.payment_status)}, ` +
              `znesek=${String(session.amount_total)} ≠ ${order.totalCents})`
          );
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const resolved = resolveMarketplaceType(session.metadata);
        if (resolved?.kind !== "marketplace_order") break;
        await releasePendingOrder(resolved.id, "expired");
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const resolved = resolveMarketplaceType(session.metadata);
        if (resolved?.kind !== "marketplace_order") break;
        await releasePendingOrder(resolved.id, "cancelled");
        break;
      }

      case "charge.async_payment_failed": {
        // Charge dogodek ne nosi metadata seje neposredno — metadata
        // checkout seje Stripe kopira na PaymentIntent; prek njega
        // razrešimo naročilo (best-effort; brez PI/metadata → prezrto).
        const charge = event.data.object as Stripe.Charge;
        const intentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!intentId || !stripe) break;
        try {
          const intent = await stripe.paymentIntents.retrieve(intentId);
          const resolved = resolveMarketplaceType(
            intent.metadata as Record<string, unknown> | null
          );
          if (resolved?.kind === "marketplace_order") {
            await releasePendingOrder(resolved.id, "cancelled");
          }
        } catch (err) {
          console.error(
            "[stripe/webhook] charge.async_payment_failed: razrešitev ni uspela:",
            err
          );
        }
        break;
      }

      default:
        // Neznan dogodek → 200 prezrt (kanon Stripe: ne mečemo 4xx/5xx).
        break;
    }
  } catch (err) {
    console.error(
      `[stripe/webhook] obdelava ${event.type} ni uspela:`,
      err
    );
    return NextResponse.json(
      { error: "Obdelava dogodka ni uspela." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
