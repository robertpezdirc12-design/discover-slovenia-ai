import { describe, expect, test } from "bun:test";

import {
  PAYOUT_RECALC_AUDIT_ACTION,
  planPayoutRecalc,
  type RecalcOrderInput,
} from "@/lib/marketplace-recalc";
import { PAYOUT_RETENTION_DAYS } from "@/lib/marketplace-types";

/**
 * Dnevna materializacija izplačil (P0-I, issue #1 §21 „recalculate-status"):
 * job premika SAMO not_due → due; idempotenten; lepljiva ročna stanja
 * (processing/paid) ostanejo pri miru.
 */

const NOW = new Date("2026-10-08T10:00:00.000Z");

function paid(
  id: string,
  payoutStatus: string,
  daysAgoPaid: number,
  status = "paid"
): RecalcOrderInput {
  return {
    id,
    status,
    paidAt: new Date(NOW.getTime() - daysAgoPaid * 86_400_000),
    payoutStatus,
  };
}

describe("planPayoutRecalc — materializacija not_due → due", () => {
  test("plačilo po zadrževalni dobi → plan za materializacijo", () => {
    const orders = [paid("o1", "not_due", PAYOUT_RETENTION_DAYS + 1)];
    const report = planPayoutRecalc(orders, NOW);
    expect(report.scanned).toBe(1);
    expect(report.planned).toBe(1);
    expect(report.actions[0]).toEqual({ orderId: "o1", from: "not_due", to: "due" });
  });

  test("plačilo ZNOTRAJ zadrževalne dobe → brez pisanja", () => {
    const orders = [paid("o2", "not_due", PAYOUT_RETENTION_DAYS - 1)];
    const report = planPayoutRecalc(orders, NOW);
    expect(report.planned).toBe(0);
    expect(report.actions).toEqual([]);
  });

  test("točno na meji dni (>= retention) → materializacija (kanon ≥)", () => {
    const orders = [paid("o3", "not_due", PAYOUT_RETENTION_DAYS)];
    expect(planPayoutRecalc(orders, NOW).planned).toBe(1);
  });

  test("IDEMPOTENCA: že usklajen 'due' ostane due — ponovni zagon je prazen", () => {
    const orders = [paid("o4", "due", PAYOUT_RETENTION_DAYS + 3)];
    const report = planPayoutRecalc(orders, NOW);
    expect(report.planned).toBe(0);
  });

  test("LEPLJIVOST: processing in paid se NIKOLI ne premakneta", () => {
    const orders = [
      paid("o5", "processing", PAYOUT_RETENTION_DAYS + 10),
      paid("o6", "paid", PAYOUT_RETENTION_DAYS + 30),
    ];
    const report = planPayoutRecalc(orders, NOW);
    expect(report.scanned).toBe(2);
    expect(report.planned).toBe(0);
  });

  test("ne-plačana naročila so izven načrta (not_due ostane)", () => {
    const orders = [
      { id: "o7", status: "pending", paidAt: null, payoutStatus: "not_due" },
      { id: "o8", status: "cancelled", paidAt: new Date(NOW.getTime() - 30 * 86_400_000), payoutStatus: "not_due" },
      { id: "o9", status: "expired", paidAt: null, payoutStatus: "not_due" },
    ];
    const report = planPayoutRecalc(orders, NOW);
    expect(report.planned).toBe(0);
  });

  test("plačano brez časovnega žiga → iskreno ne zapade (fail-closed)", () => {
    const orders = [{ id: "o10", status: "paid", paidAt: null, payoutStatus: "not_due" }];
    expect(planPayoutRecalc(orders, NOW).planned).toBe(0);
  });

  test("mešan nabor — samo zapadla not_due se načrtujejo", () => {
    const orders = [
      paid("a", "not_due", PAYOUT_RETENTION_DAYS + 1), // materializacija
      paid("b", "not_due", 1), // še teče
      paid("c", "due", PAYOUT_RETENTION_DAYS + 5), // že usklajeno
      paid("d", "processing", PAYOUT_RETENTION_DAYS + 9), // lepljivo
      paid("e", "not_due", PAYOUT_RETENTION_DAYS + 2), // materializacija
    ];
    const report = planPayoutRecalc(orders, NOW);
    expect(report.scanned).toBe(5);
    expect(report.planned).toBe(2);
    expect(report.actions.map((a) => a.orderId)).toEqual(["a", "e"]);
  });

  test("DETERMINIZEM: isti vhod → isti plan", () => {
    const orders = [paid("z", "not_due", PAYOUT_RETENTION_DAYS + 4)];
    expect(planPayoutRecalc(orders, NOW)).toEqual(planPayoutRecalc(orders, NOW));
  });

  test("kanonsko AuditLog dejanje je stabilno (dnevniška sledljivost)", () => {
    expect(PAYOUT_RECALC_AUDIT_ACTION).toBe("payout.due_materialized");
  });
});
