import { describe, expect, test } from "bun:test";

import {
  DRAFT_NUDGE_AFTER_DAYS,
  DRAFT_NUDGE_AUDIT_ACTION,
  DRAFT_NUDGE_INTERVAL_DAYS,
  daysSince,
  planDraftNudges,
  type DraftNudgeInput,
} from "@/lib/draft-nudge";

/**
 * Dnevni opomnik za zamujene osnutke (P0-I, issue #1 §21 „draft-reminders"):
 * samo draft ≥ 7 dni, dedup 7 dni po AuditLog, brez lažne e-pošte (kanon).
 */

const NOW = new Date("2026-10-08T08:00:00.000Z");

function draft(
  id: string,
  daysAgoUpdated: number,
  overrides: Partial<DraftNudgeInput> = {}
): DraftNudgeInput {
  return {
    id,
    name: `Osnutek ${id}`,
    status: "draft",
    updatedAt: new Date(NOW.getTime() - daysAgoUpdated * 86_400_000),
    ownerId: "partner-1",
    ...overrides,
  };
}

describe("daysSince — pomočnik starosti", () => {
  test("dni od preteklega datuma", () => {
    expect(daysSince(new Date(NOW.getTime() - 8 * 86_400_000), NOW)).toBe(8);
  });

  test("prihodnji datum → 0 (nikoli negativno)", () => {
    expect(daysSince(new Date(NOW.getTime() + 5 * 86_400_000), NOW)).toBe(0);
  });

  test("neberljiv žig → 0 (fail-closed)", () => {
    expect(daysSince("ni-datum", NOW)).toBe(0);
  });

  test("sprejme tudi ISO niz", () => {
    expect(daysSince("2026-10-01T08:00:00.000Z", NOW)).toBe(7);
  });
});

describe("planDraftNudges — načrt opomb", () => {
  test("osnutek ≥ 7 dni → nudge s starostjo", () => {
    const report = planDraftNudges([draft("d1", 9)], new Map(), NOW);
    expect(report.scanned).toBe(1);
    expect(report.planned).toBe(1);
    expect(report.actions[0]).toEqual({
      productId: "d1",
      ownerId: "partner-1",
      ageDays: 9,
    });
  });

  test("svež osnutek (< 7 dni) → brez opombe", () => {
    expect(planDraftNudges([draft("d2", 3)], new Map(), NOW).planned).toBe(0);
  });

  test("točno 7 dni → opomba (prag vključujoč)", () => {
    expect(planDraftNudges([draft("d3", 7)], new Map(), NOW).planned).toBe(1);
  });

  test("samo status draft — pending/published/rejected niso partnerjeva zamuda", () => {
    const others = ["pending", "published", "rejected"].map((status) =>
      draft("x", 30, { status })
    );
    const report = planDraftNudges(others, new Map(), NOW);
    expect(report.scanned).toBe(3);
    expect(report.planned).toBe(0);
  });

  test("DEDUP: nudge v zadnjih 7 dneh → brez ponovitve", () => {
    const recent = new Map([
      ["d4", new Date(NOW.getTime() - 2 * 86_400_000)], // pred 2 dnevoma
    ]);
    expect(planDraftNudges([draft("d4", 20)], recent, NOW).planned).toBe(0);
  });

  test("DEDUP meja: nudge pred 7 dnevi → nova opomba je dovoljena", () => {
    const weekAgo = new Map([
      ["d5", new Date(NOW.getTime() - DRAFT_NUDGE_INTERVAL_DAYS * 86_400_000)],
    ]);
    const report = planDraftNudges([draft("d5", 20)], weekAgo, NOW);
    expect(report.planned).toBe(1);
    expect(report.actions[0].ageDays).toBe(20);
  });

  test("DEDUP se nanaša NA TA osnutek (drugi osnutki niso blokirani)", () => {
    const recent = new Map([
      ["d6", new Date(NOW.getTime() - 1 * 86_400_000)],
    ]);
    const report = planDraftNudges(
      [draft("d6", 15), draft("d7", 15)],
      recent,
      NOW
    );
    expect(report.planned).toBe(1);
    expect(report.actions[0].productId).toBe("d7");
  });

  test("IDEMPOTENCA: ponovni zagon po zapisu (recent nudge) je prazen", () => {
    // Prvi zagon:
    const first = planDraftNudges([draft("d8", 10)], new Map(), NOW);
    expect(first.planned).toBe(1);
    // Simuliraj zapis AuditLog → drugi zagon vidi nedavni nudge:
    const afterLog = new Map([[first.actions[0].productId, NOW]]);
    expect(planDraftNudges([draft("d8", 10)], afterLog, NOW).planned).toBe(0);
  });

  test("platformski osnutki (brez lastnika) so izključeni", () => {
    const report = planDraftNudges([draft("d9", 12, { ownerId: null })], new Map(), NOW);
    expect(report.planned).toBe(0);
  });

  test("mešan nabor — determinističen vrstni red po vhodu", () => {
    const drafts = [
      draft("a", 3), // svež
      draft("b", 10), // opomba
      draft("c", 40, { status: "pending" }), // ne draft
      draft("d", 15), // opomba
    ];
    const report = planDraftNudges(drafts, new Map(), NOW);
    expect(report.actions.map((a) => a.productId)).toEqual(["b", "d"]);
  });

  test("kanoni konstant so stabilni (dokumentacija + dedup)", () => {
    expect(DRAFT_NUDGE_AFTER_DAYS).toBe(7);
    expect(DRAFT_NUDGE_INTERVAL_DAYS).toBe(7);
    expect(DRAFT_NUDGE_AUDIT_ACTION).toBe("partner.draft_nudge");
  });
});
