/**
 * MARKETPLACE-PAYOUT — testi življenjskega cikla izplačil (P0-E, issue #1 §11).
 *
 * Kanoni (src/lib/marketplace-types.ts):
 *  - not_due → due SAMO z izpeljavo (plačano + 7 dni zadrževalne dobe);
 *  - ročni prehodi: due → processing → paid (lastnik);
 *  - paid = terminalen; processing/paid sta LEPLJIVA (ne zdrsnejo nazaj);
 *  - naročilo, ki ni plačano, NIKOLI ne zapade;
 *  - zahtevek kupca po preklicu: SAMO na plačanem + lastnem naročilu,
 *    idempotenten (ponovni zahtevek = 409 odklon).
 *
 * Kanon: 0 omrežja, 0 db; imena v slovenščini.
 */

import { describe, expect, test } from "bun:test";

import {
  ALLOWED_PAYOUT_TRANSITIONS,
  PAYOUT_RETENTION_DAYS,
  PAYOUT_STATUSES,
  assertPayoutTransition,
  canRequestCancellation,
  canTransitionPayout,
  derivePayoutStatus,
  isPayoutStatus,
  payoutDueDate,
  payoutStatusLabel,
} from "../src/lib/marketplace-types";

const NOW = new Date("2026-10-17T12:00:00.000Z");

describe("marketplace-payout: statusi in tranzicije", () => {
  test("nabor statusov je točno §11", () => {
    expect(PAYOUT_STATUSES).toEqual(["not_due", "due", "processing", "paid"]);
  });

  test("isPayoutStatus fail-closed", () => {
    expect(isPayoutStatus("due")).toBe(true);
    expect(isPayoutStatus("NOT_DUE")).toBe(false); // male črke so kanon
    expect(isPayoutStatus("refunded")).toBe(false);
    expect(isPayoutStatus("")).toBe(false);
  });

  test("dovoljeni prehodi: izpeljava + skrbniška dejanja", () => {
    expect(ALLOWED_PAYOUT_TRANSITIONS.not_due).toEqual(["due"]); // samo izpeljava
    expect(ALLOWED_PAYOUT_TRANSITIONS.due).toEqual(["processing", "paid"]);
    expect(ALLOWED_PAYOUT_TRANSITIONS.processing).toEqual(["paid"]);
    expect(ALLOWED_PAYOUT_TRANSITIONS.paid).toEqual([]); // terminalen
  });

  test("canTransitionPayout", () => {
    expect(canTransitionPayout("due", "processing")).toBe(true);
    expect(canTransitionPayout("due", "paid")).toBe(true);
    expect(canTransitionPayout("processing", "paid")).toBe(true);
    expect(canTransitionPayout("not_due", "processing")).toBe(false); // ročno iz not_due NI dovoljeno
    expect(canTransitionPayout("paid", "processing")).toBe(false); // terminalen
    expect(canTransitionPayout("paid", "due")).toBe(false); // nazaj ne gre
    expect(canTransitionPayout("smetje", "paid")).toBe(false); // fail-closed
  });

  test("assertPayoutTransition s slovensko napako", () => {
    const r = assertPayoutTransition("paid", "due");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("ni dovoljen");
    expect(assertPayoutTransition("due", "processing").ok).toBe(true);
  });
});

describe("marketplace-payout: izpeljava (determinizem)", () => {
  test("neplačano naročilo NIKOLI ne zapade", () => {
    for (const status of ["pending", "cancelled", "expired"]) {
      expect(
        derivePayoutStatus({
          orderStatus: status,
          paidAt: new Date("2026-01-01T00:00:00Z"),
          currentPayout: "not_due",
          now: NOW,
        })
      ).toBe("not_due");
    }
  });

  test("plačano + zadrževalna doba ŠE teče → not_due", () => {
    expect(
      derivePayoutStatus({
        orderStatus: "paid",
        paidAt: new Date("2026-10-16T12:00:00.000Z"), // 1 dan nazaj
        currentPayout: "not_due",
        now: NOW,
      })
    ).toBe("not_due");
  });

  test("plačano + 7 dni (mejna vrednost) → due", () => {
    expect(
      derivePayoutStatus({
        orderStatus: "paid",
        paidAt: new Date("2026-10-10T12:00:00.000Z"), // točno 7 dni
        currentPayout: "not_due",
        now: NOW,
      })
    ).toBe("due");
  });

  test("plačano + 6,99 dneva → še not_due (iskrena meja)", () => {
    expect(
      derivePayoutStatus({
        orderStatus: "paid",
        paidAt: new Date("2026-10-10T12:20:00.000Z"), // 6,99 dneva
        currentPayout: "not_due",
        now: NOW,
      })
    ).toBe("not_due");
  });

  test("plačano brez časovnega žiga → not_due (fail-closed)", () => {
    expect(
      derivePayoutStatus({
        orderStatus: "paid",
        paidAt: null,
        currentPayout: "not_due",
        now: NOW,
      })
    ).toBe("not_due");
  });

  test("LEPLJIVOST: processing in paid ne zdrsnejo nazaj", () => {
    expect(
      derivePayoutStatus({
        orderStatus: "paid",
        paidAt: new Date("2026-10-01T00:00:00Z"),
        currentPayout: "processing",
        now: NOW,
      })
    ).toBe("processing");
    expect(
      derivePayoutStatus({
        orderStatus: "cancelled", // tudi kasnejša sprememba ne pobriše ročnega napredka
        paidAt: new Date("2026-10-01T00:00:00Z"),
        currentPayout: "paid",
        now: NOW,
      })
    ).toBe("paid");
  });

  test("neveljaven currentPayout se obravnava kot not_due", () => {
    expect(
      derivePayoutStatus({
        orderStatus: "pending",
        paidAt: null,
        currentPayout: "smetje",
        now: NOW,
      })
    ).toBe("not_due");
  });

  test("determinizem: isti vhod → isti izhod", () => {
    const input = {
      orderStatus: "paid",
      paidAt: new Date("2026-10-05T00:00:00Z"),
      currentPayout: "not_due",
      now: NOW,
    } as const;
    expect(derivePayoutStatus(input)).toBe(derivePayoutStatus(input));
  });

  test("retention je 7 dni (izvirniški vzorec)", () => {
    expect(PAYOUT_RETENTION_DAYS).toBe(7);
  });

  test("payoutDueDate = paidAt + 7 dni", () => {
    const due = payoutDueDate(new Date("2026-10-10T12:00:00.000Z"));
    expect(due?.toISOString()).toBe("2026-10-17T12:00:00.000Z");
    expect(payoutDueDate("smetje")).toBeNull();
  });
});

describe("marketplace-payout: oznake", () => {
  test("oznake SL/EN za vse štiri statuse", () => {
    expect(payoutStatusLabel("not_due", "sl")).toBe("Še ne zapadlo");
    expect(payoutStatusLabel("due", "sl")).toBe("Zapadlo");
    expect(payoutStatusLabel("processing", "sl")).toBe("Izplačilo v teku");
    expect(payoutStatusLabel("paid", "sl")).toBe("Izplačano");
    expect(payoutStatusLabel("due", "en")).toBe("Due");
    // neznan status se NE izmišljuje
    expect(payoutStatusLabel("smetje", "sl")).toBe("smetje");
  });
});

describe("marketplace-payout: zahtevek kupca po preklicu (customer state)", () => {
  test("plačano naročilo brez zahtevka → dovoljeno", () => {
    expect(
      canRequestCancellation({ status: "paid", cancellationRequestedAt: null })
    ).toEqual({ ok: true });
  });

  test("ponovni zahtevek → odklon (idempotenca)", () => {
    const r = canRequestCancellation({
      status: "paid",
      cancellationRequestedAt: new Date("2026-10-17T00:00:00Z"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("že podan");
  });

  test("pending → odklon (plačilo se še ni zgodilo)", () => {
    const r = canRequestCancellation({ status: "pending", cancellationRequestedAt: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("še ni plačano");
  });

  test("cancelled → odklon (že preklicano)", () => {
    const r = canRequestCancellation({ status: "cancelled", cancellationRequestedAt: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("že preklicano");
  });

  test("expired → odklon", () => {
    expect(
      canRequestCancellation({ status: "expired", cancellationRequestedAt: null }).ok
    ).toBe(false);
  });
});
