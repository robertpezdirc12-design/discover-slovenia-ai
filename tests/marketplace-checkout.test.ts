/**
 * MARKETPLACE-CHECKOUT (PURE) — rekonstrukcija specifikacije issue #20
 * FAZA 2 (izvirnik 1.158.x): fail-closed B2C checkout lastne tržnice.
 *
 * Pure funkcije so edini testirljivi vir resnice o plačilni pogodbi:
 * - TTL seje 60 min,
 * - line items izključno iz snapshotov (ime/cena shranjena ob naročilu),
 * - validateMarketplacePayment: payment_status + znesek (prepreči potrditev
 *   naročila po ceniku, ki se je medtem spremenil),
 * - dedup velja SAMO za pending (demo/ekspotirana naročila so zaprta).
 */

import { describe, expect, test } from "bun:test";

import {
  BOOKING_ACTIVE_STATUSES,
  CHECKOUT_TTL_MINUTES,
  ORDER_ACTIVE_STATUSES,
  ORDER_DEDUP_STATUSES,
  buildOrderCheckoutLineItems,
  checkoutExpiresAt,
  checkoutExpiresAtUnix,
  isOrderActiveStatus,
  orderItemsForStockRestore,
  resolveMarketplaceType,
  validateMarketplacePayment,
} from "../src/lib/marketplace-checkout";

describe("marketplace-checkout: TTL seje", () => {
  test("kanon izvirnika: 60 minut", () => {
    expect(CHECKOUT_TTL_MINUTES).toBe(60);
  });

  test("checkoutExpiresAt = now + 60 min", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    const exp = checkoutExpiresAt(now);
    expect(exp.getTime() - now.getTime()).toBe(60 * 60 * 1000);
  });

  test("unix izpis v sekundah (Stripe expires_at)", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    expect(checkoutExpiresAtUnix(now)).toBe(
      Math.floor(now.getTime() / 1000) + 3600
    );
  });
});

describe("marketplace-checkout: line items", () => {
  test("izdelki → vrstice s snapshotom imena, ceno v centih, količino", () => {
    const items = buildOrderCheckoutLineItems([
      { name: "Vintgarska soteska — voden ogled", unitAmountCents: 2500, qty: 2 },
      { name: "Pletna vožnja", unitAmountCents: 1500, qty: 1 },
    ]);
    expect(items.length).toBe(2);
    expect(items[0].price_data.unit_amount).toBe(2500);
    expect(items[0].price_data.currency).toBe("eur");
    expect(items[0].price_data.product_data.name).toBe(
      "Vintgarska soteska — voden ogled"
    );
    expect(items[0].quantity).toBe(2);
    expect(items[1].quantity).toBe(1);
  });

  test("količina se zaokroži NAVZDOL na celo št. ≥ 1 (sanity)", () => {
    const items = buildOrderCheckoutLineItems([
      { name: "X", unitAmountCents: 1000, qty: 0 },
      { name: "Y", unitAmountCents: 1000, qty: 2.9 },
    ]);
    expect(items[0].quantity).toBe(1);
    expect(items[1].quantity).toBe(2);
  });

  test("prazen seznam → brez vrstic (ne izumlja)", () => {
    expect(buildOrderCheckoutLineItems([]).length).toBe(0);
  });
});

describe("marketplace-checkout: validateMarketplacePayment", () => {
  test("paid + ujemajoč znesek → veljavno", () => {
    expect(
      validateMarketplacePayment({ paymentStatus: "paid", amountTotalCents: 5000, expectedTotalCents: 5000 })
    ).toBe(true);
  });

  test("unpaid → ZAVRNJENO (kljub ujemajočemu znesku)", () => {
    expect(
      validateMarketplacePayment({ paymentStatus: "unpaid", amountTotalCents: 5000, expectedTotalCents: 5000 })
    ).toBe(false);
  });

  test("znesek se ne ujema → ZAVRNJENO (prepreči cenikov drift)", () => {
    expect(
      validateMarketplacePayment({ paymentStatus: "paid", amountTotalCents: 5000, expectedTotalCents: 4999 })
    ).toBe(false);
  });

  test("neštevilski znesek → ZAVRNJENO (fail-closed)", () => {
    expect(
      validateMarketplacePayment({ paymentStatus: "paid", amountTotalCents: "5000", expectedTotalCents: 5000 })
    ).toBe(false);
  });
});

describe("marketplace-checkout: resolveMarketplaceType", () => {
  test("marketplace_order / marketplace_booking iz metadata", () => {
    expect(resolveMarketplaceType({ kind: "marketplace_order", orderId: "o1" })).toEqual({
      kind: "marketplace_order",
      id: "o1",
    });
    expect(resolveMarketplaceType({ kind: "marketplace_booking", bookingId: "b1" })).toEqual({
      kind: "marketplace_booking",
      id: "b1",
    });
  });

  test("neznan kind / manjkajoči id / null → fail-closed null", () => {
    expect(resolveMarketplaceType({ kind: "nephemeren", orderId: "x" })).toBeNull();
    expect(resolveMarketplaceType({ kind: "marketplace_order" })).toBeNull(); // brez orderId
    expect(resolveMarketplaceType(null)).toBeNull();
    expect(resolveMarketplaceType({})).toBeNull();
  });
});

describe("marketplace-checkout: statusi", () => {
  test("aktivna naročila: pending + paid", () => {
    expect([...ORDER_ACTIVE_STATUSES].sort()).toEqual(["paid", "pending"]);
  });

  test("rezervacije aktivne dokler niso preklicane", () => {
    expect(BOOKING_ACTIVE_STATUSES).toContain("pending");
    expect(BOOKING_ACTIVE_STATUSES).toContain("confirmed");
  });

  test("isOrderActiveStatus: cancelled/expired nista aktivna", () => {
    expect(isOrderActiveStatus("pending")).toBe(true);
    expect(isOrderActiveStatus("paid")).toBe(true);
    expect(isOrderActiveStatus("cancelled")).toBe(false);
    expect(isOrderActiveStatus("expired")).toBe(false);
  });

  test("dedup SAMO pending (zaklenjeno — demo veja zapre naročilo)", () => {
    expect(ORDER_DEDUP_STATUSES).toEqual(["pending"]);
  });
});

describe("marketplace-checkout: orderItemsForStockRestore (STROGO)", () => {
  test("obnova zaloge IZKLJUČNO iz shranjenih vrstic naročila", () => {
    const restore = orderItemsForStockRestore([
      { productId: "p1", qty: 2 },
      { productId: "p2", qty: 3 },
    ]);
    expect(restore).toEqual([
      { productId: "p1", qty: 2 },
      { productId: "p2", qty: 3 },
    ]);
  });

  test("ISTI produkt v več vrsticah se ZDRUŽI (seštevanje)", () => {
    const restore = orderItemsForStockRestore([
      { productId: "p1", qty: 2 },
      { productId: "p1", qty: 3 },
    ]);
    expect(restore).toEqual([{ productId: "p1", qty: 5 }]);
  });

  test("qty sanity ≥ 1 (delne količine se povzdignejo)", () => {
    const restore = orderItemsForStockRestore([
      { productId: "p1", qty: 0.5 }, // → 1
      { productId: "p2", qty: 2.9 }, // → 2
    ] as unknown as Array<{ productId: string; qty: number }>);
    expect(restore).toEqual([
      { productId: "p1", qty: 1 },
      { productId: "p2", qty: 2 },
    ]);
  });

  test("prazno naročilo → nič za obnoviti", () => {
    expect(orderItemsForStockRestore([])).toEqual([]);
  });
});
