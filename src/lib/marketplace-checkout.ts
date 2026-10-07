/**
 * MARKETPLACE-CHECKOUT — ČISTA logika B2C checkouta lastne tržnice.
 *
 * Rekonstrukcija izvirnika (issue #20 FAZA 2, verzija 1.158.x —
 * src/lib/marketplace-checkout.ts). Ta datoteka je NAMENOMA PURE:
 * BREZ db klicev, BREZ stripe klienta, BREZ process.env — samo
 * preslikave/preverbe (testirljivo izven strežniškega konteksta).
 *
 * Vsa stranska učinka (transakcije, Stripe seje) živita v
 * src/lib/marketplace-checkout-server.ts in API rutah.
 */

/** Aktivna (ne zaključena) stanja naročila tržnice. */
export const ORDER_ACTIVE_STATUSES = ["pending", "paid"] as const;

/** Aktivna (ne zaključena) stanja rezervacije/bookinga. */
export const BOOKING_ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "paid",
] as const;

/**
 * Stanja, ki sodelujejo pri DEDUP naročil: IZKLJUČNO "pending".
 * Plačano naročilo ("paid") je ZAKLJUČEN nakup — drugi nakup istega
 * izdelka istega uporabnika/gosta je nova, veljavna transakcija
 * (kanon izvirnika: dedup ščiti pred podvojenimi ODPRTIMI rezervacijami,
 * ne omejuje ponovnih nakupov).
 */
export const ORDER_DEDUP_STATUSES = ["pending"] as const;

/** Vrsta tržniške entitete iz Stripe metadata. */
export type MarketplaceKind = "marketplace_order" | "marketplace_booking";

/** Vhod v gradnjo Stripe line items (oblika shranjenih vrstic naročila). */
export interface CheckoutItemInput {
  name: string;
  /** Cena na kos V CENTIH. */
  unitAmountCents: number;
  qty: number;
}

/** Stripe Checkout line item (podmnožica oblike Stripe SDK). */
export interface CheckoutLineItem {
  price_data: {
    currency: "eur";
    unit_amount: number;
    product_data: { name: string };
  };
  quantity: number;
}

/**
 * Izdelki → Stripe line items (cena v centih, valuta EUR).
 * Količina se objektivno zaokroži NAVZDOL na celo število ≥ 1.
 */
export function buildOrderCheckoutLineItems(
  items: readonly CheckoutItemInput[]
): CheckoutLineItem[] {
  return items
    .map((item) => ({
      price_data: {
        currency: "eur" as const,
        unit_amount: Math.max(0, Math.round(item.unitAmountCents)),
        product_data: { name: item.name },
      },
      quantity: Math.max(1, Math.floor(item.qty)),
    }))
    .filter((item) => item.price_data.unit_amount >= 0);
}

/**
 * Preverba Stripe plačila: payment_status === "paid" IN znesek seujema
 * s pričakovanim skupnim zneskom naročila (v centih). Fail-closed:
 * karkoli neznanega/zgrešenega → false (nikoli ne potrdimo brez dokaza).
 */
export function validateMarketplacePayment(input: {
  paymentStatus: unknown;
  amountTotalCents: unknown;
  expectedTotalCents: number;
}): boolean {
  if (input.paymentStatus !== "paid") return false;
  if (
    typeof input.amountTotalCents !== "number" ||
    !Number.isFinite(input.amountTotalCents)
  ) {
    return false;
  }
  return input.amountTotalCents === input.expectedTotalCents;
}

/**
 * Razreši vrsto tržniške entitete iz Stripe metadata
 * ({ kind: "marketplace_order" | "marketplace_booking", orderId/bookingId }).
 * Neveljavna/manjkajoča metadata → null (dogodek ni naše tržnice).
 */
export function resolveMarketplaceType(
  metadata: Record<string, unknown> | null | undefined
): { kind: MarketplaceKind; id: string } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const kind = metadata.kind;
  const orderId =
    typeof metadata.orderId === "string" ? metadata.orderId : null;
  const bookingId =
    typeof metadata.bookingId === "string" ? metadata.bookingId : null;
  if (kind === "marketplace_order" && orderId) {
    return { kind: "marketplace_order", id: orderId };
  }
  if (kind === "marketplace_booking" && bookingId) {
    return { kind: "marketplace_booking", id: bookingId };
  }
  return null;
}

/** Veljavnost checkout seje: 60 minut od zdaj (Stripe expires_at, UNIX s). */
export const CHECKOUT_TTL_MINUTES = 60;

/** Čas poteka checkout seje (60 min) — kot Date ali UNIX sekunde. */
export function checkoutExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + CHECKOUT_TTL_MINUTES * 60 * 1000);
}

/** UNIX sekunde za Stripe `expires_at`. */
export function checkoutExpiresAtUnix(now: Date = new Date()): number {
  return Math.floor(checkoutExpiresAt(now).getTime() / 1000);
}

/** Vrstica za obnovo zaloge — IZKLJUČNO iz shranjenih vrstic naročila. */
export interface StockRestoreItem {
  productId: string;
  qty: number;
}

/**
 * Izračunaj obnovo zaloge iz SHRANJENIH vrstic naročila — NIKOLI iz
 * zahtevka (request body) ali metadat: zahtevek lahko ponaredi kupec,
 * shranjene vrstice pa je zapisala strežniška transakcija rezervacije.
 * Količine se objektivno sanity-zaščitijo (celo število ≥ 1).
 */
export function orderItemsForStockRestore(
  orderItems: ReadonlyArray<{
    productId: string;
    qty: number;
  }>
): StockRestoreItem[] {
  const byProduct = new Map<string, number>();
  for (const item of orderItems) {
    if (!item || typeof item.productId !== "string") continue;
    const qty = Math.max(1, Math.floor(item.qty));
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + qty);
  }
  return Array.from(byProduct.entries()).map(([productId, qty]) => ({
    productId,
    qty,
  }));
}

/** Ali status naročila sodi med aktivne (ne zaključene)? */
export function isOrderActiveStatus(status: string): boolean {
  return (ORDER_ACTIVE_STATUSES as readonly string[]).includes(status);
}

/** Ali status sodeluje pri dedupu (samo odprte "pending" rezervacije)? */
export function isOrderDedupStatus(status: string): boolean {
  return (ORDER_DEDUP_STATUSES as readonly string[]).includes(status);
}
