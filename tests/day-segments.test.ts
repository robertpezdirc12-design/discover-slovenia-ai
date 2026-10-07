/**
 * DAY-SEGMENTS + DETERMINISTIC-ITINERARY — testi P0-D plasti (issue #1).
 *
 * DAY-SEGMENTS (kanon izvirnika, Task 93):
 *  · ura < 12 → jutro (vključno 00:30, 11:59);
 *  · „11:00-14:00" je JUTRO — segment odloča ZAČETEK;
 *  · meje: 12 → popoldan, 17 → večer;
 *  · postanki brez ure podedujejo tekoči segment.
 *
 * DETERMINISTIC-ITINERARY (kanon izvirnika, 1.87.0):
 *  · isti vhod → isti načrt → isti prstni odtis (0 AI žetonov);
 *  · različen vhod → različen odtis;
 *  · geo-validacija teče nad vsakim načrtom (ista veriga);
 *  · engine identiteta je vedno "deterministic".
 *
 * Kanon: 0 omrežja, 0 db, 0 stranskih učinkov; imena v slovenščini.
 */

import { describe, expect, test } from "bun:test";

import {
  DAY_SEGMENTS,
  DAY_SEGMENT_LABELS,
  DAY_SEGMENT_ORDER,
  SEGMENT_START_HOUR,
  buildDaySegments,
  segmentBoundaryAt,
  segmentOfHour,
  segmentOfSlot,
} from "../src/lib/day-segments";
import {
  DETERMINISTIC_ENGINE,
  buildDeterministicItinerary,
  canonicalPlanJson,
  planFingerprint,
} from "../src/lib/deterministic-itinerary";
import type { TripStop } from "../src/lib/types";

// ── Pomožnik: postanek z uro ───────────────────────────────────────────────

function postanek(id: string, time: string | null): TripStop {
  return {
    id,
    name: `Test ${id}`,
    time,
    durationMin: 60,
    cost: 10,
    kind: "castle",
  };
}

// ── segmentOfHour / segmentOfSlot ──────────────────────────────────────────

describe("segmentOfHour — meje kanona izvirnika", () => {
  test("ura < 12 → jutro (vključno 0, 11)", () => {
    expect(segmentOfHour(0)).toBe("morning");
    expect(segmentOfHour(9)).toBe("morning");
    expect(segmentOfHour(11)).toBe("morning");
  });

  test("12–16 → popoldan", () => {
    expect(segmentOfHour(12)).toBe("afternoon");
    expect(segmentOfHour(16)).toBe("afternoon");
  });

  test("17+ → večer (do 23)", () => {
    expect(segmentOfHour(17)).toBe("evening");
    expect(segmentOfHour(23)).toBe("evening");
  });
});

describe("segmentOfSlot — začetna ura odloča (kanon Task 93)", () => {
  test("ura < 12 → jutro (vključno 00:30, 11:59)", () => {
    expect(segmentOfSlot("9:00-11:00")).toBe("morning");
    expect(segmentOfSlot("09:00-11:00")).toBe("morning");
    expect(segmentOfSlot("00:30")).toBe("morning");
    expect(segmentOfSlot("11:59")).toBe("morning");
  });

  test("11:00-14:00 je JUTRO (začetek), čeprav se konča popoldan", () => {
    expect(segmentOfSlot("11:00-14:00")).toBe("morning");
  });

  test("12:00 in 17:0o sta mejni začetka", () => {
    expect(segmentOfSlot("12:00-13:00")).toBe("afternoon");
    expect(segmentOfSlot("17:00-18:30")).toBe("evening");
  });

  test("nerazumljivi vnosi → null (fail-closed, nikoli izjema)", () => {
    expect(segmentOfSlot(null)).toBeNull();
    expect(segmentOfSlot("")).toBeNull();
    expect(segmentOfSlot("cel dan")).toBeNull();
    expect(segmentOfSlot("24:00")).toBeNull();
    expect(segmentOfSlot("99:00")).toBeNull();
  });

  test("podpira tudi pomišljaj in pike kot ločila", () => {
    expect(segmentOfSlot("9.00–11.00")).toBe("morning");
    expect(segmentOfSlot("14:30 – 16:00")).toBe("afternoon");
  });
});

// ── segmentBoundaryAt ──────────────────────────────────────────────────────

describe("segmentBoundaryAt — točne meje začetkov", () => {
  test("0 → jutro, 12 → popoldan, 17 → večer", () => {
    expect(segmentBoundaryAt(0)).toBe("morning");
    expect(segmentBoundaryAt(12)).toBe("afternoon");
    expect(segmentBoundaryAt(17)).toBe("evening");
  });

  test("druge ure niso meje → null", () => {
    expect(segmentBoundaryAt(9)).toBeNull();
    expect(segmentBoundaryAt(13)).toBeNull();
    expect(segmentBoundaryAt(23)).toBeNull();
  });
});

// ── buildDaySegments ───────────────────────────────────────────────────────

describe("buildDaySegments — združevanje postankov dneva", () => {
  test("prazen dan → prazen seznam", () => {
    expect(buildDaySegments([])).toEqual([]);
  });

  test("klasičen dan: jutro + popoldan + večer po vrsti", () => {
    const stops = [
      postanek("a", "09:00"),
      postanek("b", "11:00"),
      postanek("c", "13:00"),
      postanek("d", "18:00"),
    ];
    const groups = buildDaySegments(stops);
    expect(groups.map((g) => g.segment)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
    expect(groups[0].stops.map((s) => s.id)).toEqual(["a", "b"]);
    expect(groups[1].stops.map((s) => s.id)).toEqual(["c"]);
    expect(groups[2].stops.map((s) => s.id)).toEqual(["d"]);
  });

  test("postanek brez ure podeduje tekoči segment (vrstni red ostane)", () => {
    const stops = [
      postanek("a", "09:00"),
      postanek("b", null), // podeduje jutro
      postanek("c", "15:00"),
      postanek("d", null), // podeduje popoldan
    ];
    const groups = buildDaySegments(stops);
    expect(groups.map((g) => g.segment)).toEqual(["morning", "afternoon"]);
    expect(groups[0].stops.map((s) => s.id)).toEqual(["a", "b"]);
    expect(groups[1].stops.map((s) => s.id)).toEqual(["c", "d"]);
  });

  test("prvi postanek brez ure → jutro (iskrena privzetost)", () => {
    const groups = buildDaySegments([postanek("x", null)]);
    expect(groups.length).toBe(1);
    expect(groups[0].segment).toBe("morning");
  });

  test("samo popoldanski dan ostane samo popoldanski (brez izmišljenih segmentov)", () => {
    const groups = buildDaySegments([
      postanek("a", "14:00"),
      postanek("b", "16:00"),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].segment).toBe("afternoon");
    expect(groups[0].stops.length).toBe(2);
  });

  test("ne-kronološki skok nazaj ustvari novo skupino (iskren prikaz)", () => {
    const groups = buildDaySegments([
      postanek("a", "14:00"),
      postanek("b", "09:00"), // skok nazaj na jutro
    ]);
    expect(groups.map((g) => g.segment)).toEqual(["afternoon", "morning"]);
  });

  test("vsota postankov po skupinah = vsi postanki (nič se ne izgubi)", () => {
    const stops = [
      postanek("a", "09:00"),
      postanek("b", "12:00"),
      postanek("c", null),
      postanek("d", "19:00"),
    ];
    const groups = buildDaySegments(stops);
    expect(groups.reduce((s, g) => s + g.stops.length, 0)).toBe(4);
  });
});

// ── oznake in red segmentov ────────────────────────────────────────────────

describe("oznake segmentov (SL/EN, dvojezičnost)", () => {
  test("vsi trije segmenti imajo SL in EN oznake", () => {
    expect(DAY_SEGMENTS.length).toBe(3);
    for (const seg of DAY_SEGMENTS) {
      expect(DAY_SEGMENT_LABELS[seg].sl.length).toBeGreaterThan(0);
      expect(DAY_SEGMENT_LABELS[seg].en.length).toBeGreaterThan(0);
    }
    expect(DAY_SEGMENT_LABELS.morning.sl).toBe("Jutro");
    expect(DAY_SEGMENT_LABELS.afternoon.sl).toBe("Popoldan");
    expect(DAY_SEGMENT_LABELS.evening.sl).toBe("Večer");
  });

  test("vrstni red in začetne ure so konsistentne", () => {
    expect(DAY_SEGMENT_ORDER.morning).toBeLessThan(DAY_SEGMENT_ORDER.afternoon);
    expect(DAY_SEGMENT_ORDER.afternoon).toBeLessThan(DAY_SEGMENT_ORDER.evening);
    expect(SEGMENT_START_HOUR.afternoon).toBe(12);
    expect(SEGMENT_START_HOUR.evening).toBe(17);
  });
});

// ── DETERMINISTIC-ITINERARY ────────────────────────────────────────────────

describe("deterministic-itinerary — kanon: isti vhod → isti načrt", () => {
  const query = {
    interests: ["bled", "jame", "vino"],
    days: 2,
    region: "gorenjska",
    locale: "sl" as const,
  };

  test("isti vhod dvakrat → GLOBINSKO ENAK rezultat (0 AI žetonov)", () => {
    const a = buildDeterministicItinerary(query);
    const b = buildDeterministicItinerary(query);
    expect(a).toEqual(b);
    expect(a.engine).toBe("deterministic");
    expect(a.aiTokensUsed).toBe(0);
  });

  test("isti vhod → isti prstni odtis (dokazljiva reproducibilnost)", () => {
    const a = buildDeterministicItinerary(query);
    const b = buildDeterministicItinerary(query);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).toBe(planFingerprint(a.plan));
    expect(a.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  test("različen vhod → različen prstni odtis", () => {
    const a = buildDeterministicItinerary(query);
    const b = buildDeterministicItinerary({ ...query, days: 3 });
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  test("geo-validacija teče nad vsakim načrtom (ista veriga)", () => {
    const r = buildDeterministicItinerary(query);
    expect(r.geo).toBeDefined();
    expect(Array.isArray(r.geo.issues)).toBe(true);
    expect(typeof r.geo.tripKm).toBe("number");
    expect(["ok", "warn", "error"]).toContain(r.geo.worst);
  });

  test("engine identiteta je izključno deterministična (v 2.x ni AI poti)", () => {
    expect(DETERMINISTIC_ENGINE).toBe("deterministic");
  });
});

describe("canonicalPlanJson — stabilna serializacija", () => {
  test("ključi po abecedi: vrstni red vnosov ne vpliva", () => {
    expect(canonicalPlanJson({ b: 1, a: 2 })).toBe(
      canonicalPlanJson({ a: 2, b: 1 })
    );
    expect(canonicalPlanJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  test("polja po vrsti; null in primitivi ostanejo stabilni", () => {
    expect(canonicalPlanJson([1, "x", null])).toBe('[1,"x",null]');
    expect(canonicalPlanJson({ x: undefined })).toBe('{"x":null}');
  });

  test("zgoščeni zapis je 8-mestna šestnajstiška (FNV-1a)", () => {
    const fp = planFingerprint({
      days: [[postanek("a", "09:00")]],
      title: "T",
      summary: "S",
      totalCost: 10,
      coverageNote: "C",
    });
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
  });
});
