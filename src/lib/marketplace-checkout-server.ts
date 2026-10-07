/**
 * MARKETPLACE-CHECKOUT-SERVER — strežniški del B2C checkouta lastne tržnice.
 *
 * Rekonstrukcija izvirnika (issue #20 FAZA 2, v1.158.x —
 * src/lib/marketplace-checkout-server.ts). Vsi ključi izključno iz
 * process.env (NIKOLI v kodi); env se bere ob KLICU (ne ob zagonu),
 * da Next dev strežnik ob spremembi .env nemudoma upošteva novo stanje
 * (fail-closed preverba živo možna).
 *
 * Čista logika (line items, preverbe, expiry) živi v
 * src/lib/marketplace-checkout.ts — ta datoteka nosi SAMO stranske
 * učinke: Prisma transakcije in lenient Stripe klient.
 */

import Stripe from "stripe";

import { db } from "@/lib/db";
import { orderItemsForStockRestore } from "@/lib/marketplace-checkout";

/** Ali je Stripe konfiguriran (STRIPE_SECRET_KEY prisoten)? */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Ali so omogočena DEMO plačila (DSA_DEMO_PAYMENTS=1)?
 * Demo veja ustvari naročilo takoj "paid" z demo: true — izrecno
 * označeno, BREZ prave bremenitve (iskrenostni kanon).
 */
export function isStripeDemo(): boolean {
  return process.env.DSA_DEMO_PAYMENTS === "1";
}

/**
 * Lenient Stripe klient — null, kadar STRIPE_SECRET_KEY ni nastavljen
 * (brez metanj ob initu; klicoč odloči fail-closed pot).
 */
let stripeClient: Stripe | null = null;
let stripeClientKey: string | null = null;

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (stripeClient && stripeClientKey === key) return stripeClient;
  stripeClient = new Stripe(key);
  stripeClientKey = key;
  return stripeClient;
}

/** Ciljni status ob sprostitvi odprte rezervacije. */
export type ReleaseStatus = "cancelled" | "expired";

/** Izid sprostitve (idempotentno — večkratni klici so varni). */
export interface ReleaseResult {
  ok: boolean;
  reason?: "not_found" | "already_released";
  orderId?: string;
  status?: string;
  /** Obnovljene količine po izdelku (samo ob prvi sprostitvi). */
  restored?: Array<{ productId: string; qty: number }>;
}

/**
 * OPORTUNISTIKO pometenje: sprosti VSE pending naročila, katerih
 * checkout seja je že potekla (expiresAt < zdaj) — varnostna mreža za
 * primer, da webhook checkout.session.expired ne prispe. Best-effort:
 * vsako naročilo se sprosti posamično, napaka enega ne ustavi ostalih.
 *
 * @returns število sproščenih naročil.
 */
export async function sweepExpiredPendingOrders(): Promise<number> {
  const stale = await db.order.findMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  });
  let released = 0;
  for (const order of stale) {
    try {
      const result = await releasePendingOrder(order.id, "expired");
      if (result.ok && result.restored) released += 1;
    } catch (err) {
      // Nepomembno za tok klicoča — zabeležimo (ni tiho), nadaljujemo.
      console.error(
        `[marketplace] sprostitev poteklega naročila ${order.id} ni uspela:`,
        err
      );
    }
  }
  return released;
}

/**
 * PREKLIČI-NATO-SPROSTI odprto (pending) naročilo — idempotentno:
 *  1. status "pending" → "cancelled" (oz. "expired" za potek seje);
 *  2. zaloga += qty IN saleCount -= qty — IZKLJUČNO iz shranjenih
 *     vrstic naročila (orderItemsForStockRestore; nikoli iz zahtevka);
 *  3. že zaključena/neobstoječa naročila se NE dotaknejo (no-op).
 *
 * Transakcija (BEGIN IMMEDIATE) zagotavlja, da med preklicem in obnovo
 * zaloge nihče drug ne rezervira istih kosov.
 */
export async function releasePendingOrder(
  orderId: string,
  toStatus: ReleaseStatus = "cancelled"
): Promise<ReleaseResult> {
  return db.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) return { ok: false, reason: "not_found" as const };
      if (order.status !== "pending") {
        // Že zaključeno/plačano/preklicano — idempotentni no-op.
        return {
          ok: true,
          reason: "already_released" as const,
          orderId: order.id,
          status: order.status,
        };
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: toStatus },
      });

      const restore = orderItemsForStockRestore(order.items);
      for (const item of restore) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.qty },
            saleCount: { decrement: item.qty },
          },
        });
      }

      return {
        ok: true,
        orderId: order.id,
        status: toStatus,
        restored: restore,
      };
    },
    { timeout: 15_000 }
  );
}
