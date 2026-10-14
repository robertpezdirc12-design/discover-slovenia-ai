/**
 * BALKAN-F5 (#41, 2.59.0) — AI čezmejna potovanja:
 *  · TripStop.country na vseh postankih (motor + osnutek MyTrip);
 *  · detectBorderCrossings — spremembe države po vrsti potovanja;
 *  · državni filter v buildItinerary (zoži bazen, determinizem ostane);
 *  · border-docs: Schengen status iz PREVERJENEGA EU vira (curl 200,
 *    2026-10-14 — glej glavo modula), dokumentne vrstice po kategorijah,
 *    iskren namig k MZV za ne-preverjene pogoje;
 *  · coverageNote nosi državni filter; povzetek nosi čezmejno opombo.
 *
 * Kanon #38: nič izmišljenih dokumentnih pravil — Schengen trditve so
 * zaklenjene na EU vir, ostalo je eksplicitno usmerjeno k MZV.
 */

import { describe, expect, test } from "bun:test";

import {
  buildItinerary,
  detectBorderCrossings,
  type PlannerQuery,
} from "../src/lib/itinerary-engine";
import { buildPlanFromMyTrip } from "../src/lib/itinerary-engine";
import { DESTINATIONS } from "../src/lib/slovenia-data";
import {
  borderDocBlock,
  borderDocFor,
  EU_DOCS_SOURCE_URL,
  SCHENGEN_CODES,
  SCHENGEN_SOURCE_URL,
} from "../src/lib/border-docs";
import type { TripStop } from "../src/lib/types";

// ── detectBorderCrossings ──────────────────────────────────────────────────

describe("F5: detectBorderCrossings", () => {
  const stop = (name: string, country?: string): TripStop => ({
    id: `${name}--x`,
    name,
    time: "09:00",
    durationMin: 90,
    cost: 0,
    kind: "city",
    country,
  });

  test("sprememba države med dnevi → prehod z 1-indeksiranim dnem", () => {
    const days = [
      [stop("Bled", "SI"), stop("Kranj", "SI")],
      [stop("Zagreb", "HR")],
    ];
    expect(detectBorderCrossings(days)).toEqual([
      { from: "SI", to: "HR", day: 2 },
    ]);
  });

  test("prehod ZNOTRAJ dneva → prehod na tem dnevu", () => {
    const days = [[stop("Bled", "SI"), stop("Trst", "IT")]];
    expect(detectBorderCrossings(days)).toEqual([
      { from: "SI", to: "IT", day: 1 },
    ]);
  });

  test("več prehodov (SI→HR→ME) v vrsti potovanja", () => {
    const days = [
      [stop("Bled", "SI")],
      [stop("Zagreb", "HR")],
      [stop("Kotor", "ME")],
    ];
    expect(detectBorderCrossings(days)).toEqual([
      { from: "SI", to: "HR", day: 2 },
      { from: "HR", to: "ME", day: 3 },
    ]);
  });

  test("ista država prek dneva → NI prehoda", () => {
    const days = [[stop("Bled", "SI")], [stop("Piran", "SI")]];
    expect(detectBorderCrossings(days)).toEqual([]);
  });

  test("postanki brez države NE sprožijo prehoda (iskreno: manjkajoči podatek)", () => {
    const days = [
      [stop("Custom A"), stop("Bled", "SI")],
      [stop("Custom B")],
    ];
    expect(detectBorderCrossings(days)).toEqual([]);
  });

  test("prazen načrt → prazno polje", () => {
    expect(detectBorderCrossings([])).toEqual([]);
  });
});

// ── buildItinerary: country na postankih + državni filter ──────────────────

describe("F5: buildItinerary — država + filter", () => {
  const query: PlannerQuery = {
    interests: ["jezero", "mesto"],
    days: 3,
    locale: "sl",
  };

  test("vsi postanki nosijo country (F0 nabor je popoln)", () => {
    const plan = buildItinerary(query);
    const stops = plan.days.flat();
    expect(stops.length).toBeGreaterThan(0);
    for (const s of stops) {
      expect(s.country).toBeDefined();
      expect(s.country).toMatch(/^(SI|HR|ME|AL|BA|RS|MK|XK|BG|GR)$/);
    }
  });

  test("determinizem ostane: isti vhod → isti načrt (+ enaki prehodi)", () => {
    const a = buildItinerary(query);
    const b = buildItinerary(query);
    expect(JSON.stringify(a.days)).toBe(JSON.stringify(b.days));
    expect(JSON.stringify(a.borderCrossings ?? [])).toBe(
      JSON.stringify(b.borderCrossings ?? [])
    );
  });

  test("državni filter HR → vsi postanki v HR (in ni prehodov)", () => {
    const plan = buildItinerary({ ...query, country: "HR" });
    const stops = plan.days.flat();
    expect(stops.length).toBeGreaterThan(0);
    for (const s of stops) expect(s.country).toBe("HR");
    expect(plan.borderCrossings).toBeUndefined();
    expect(plan.meta?.country).toBe("HR");
  });

  test("coverageNote nosi državni filter", () => {
    const plan = buildItinerary({ ...query, country: "HR" });
    expect(plan.coverageNote).toContain("Filter države: HR.");
  });

  test("čezmejni načrt: povzetek nosi iskreno opombo (če prehodi obstajajo)", () => {
    const plan = buildItinerary(query);
    if (plan.borderCrossings && plan.borderCrossings.length > 0) {
      expect(plan.summary).toMatch(/Čezmejni načrt/);
      // vsak prehod ima from ≠ to in veljaven dan
      for (const c of plan.borderCrossings) {
        expect(c.from).not.toBe(c.to);
        expect(c.day).toBeGreaterThanOrEqual(1);
      }
    } else {
      // 3-dnevni načrt je lahko tudi znotraj ene države — takrat brez opombe.
      expect(plan.summary).not.toMatch(/Čezmejni načrt/);
    }
  });

  test("neznana država v poizvedbi → prazen bazen (motor ne ugiba)", () => {
    // Motor ne validira kode (to dela /api/itinerary) — neznan kodirc
    // jedro samo izprazni bazen; test zaklene fail-closed vedenje.
    const plan = buildItinerary({ ...query, country: "XX" });
    expect(plan.days.length).toBe(0);
  });
});

// ── MyTrip osnutek: country + prehodi ──────────────────────────────────────

describe("F5: buildPlanFromMyTrip — država + prehodi", () => {
  test("osnutek nosi country na postankih in prehode (če jih je)", () => {
    const items = DESTINATIONS.slice(0, 6).map((d) => ({
      refId: d.slug,
      name: d.name,
      kind: "destination" as const,
      addedAt: new Date(0).toISOString(),
    }));
    const draft = buildPlanFromMyTrip(items, "sl");
    const stops = draft.plan.days.flat();
    expect(stops.length).toBeGreaterThan(0);
    for (const s of stops) expect(s.country).toBeDefined();
    const expected = detectBorderCrossings(draft.plan.days);
    expect(draft.plan.borderCrossings).toEqual(
      expected.length > 0 ? expected : undefined
    );
  });
});

// ── border-docs: zaklenjeno na preverjene vire ────────────────────────────

describe("F5: border-docs — Schengen status (EU vir, curl 200 2026-10-14)", () => {
  test("SI/HR/GR/BG so Schengen; ME/AL/BA/RS/MK/XK niso", () => {
    // Vir: home-affairs.ec.europa.eu — 29 članic; BG/RO od 1.1.2025.
    for (const c of ["SI", "HR", "GR", "BG"]) {
      expect(SCHENGEN_CODES.has(c)).toBe(true);
    }
    for (const c of ["ME", "AL", "BA", "RS", "MK", "XK"]) {
      expect(SCHENGEN_CODES.has(c)).toBe(false);
    }
  });

  test("Schengen vrstica: potni list ALI osebna izkaznica (EU dokazan vir)", () => {
    const d = borderDocFor("HR");
    expect(d.schengen).toBe(true);
    expect(d.doc.sl).toContain("ALI");
    expect(d.doc.sl).toContain("osebna izkaznica");
    expect(d.currency).toBe("EUR");
  });

  test("izvenschengenska vrstica NE trdi ID-pogoja — usmerja k MZV (iskrenost)", () => {
    for (const code of ["ME", "AL", "BA", "RS", "MK"] as const) {
      const d = borderDocFor(code);
      expect(d.schengen).toBe(false);
      // Iskrenostni kanon: vrstica vsebuje namig k uradnemu viru in NE
      // trdi, da ID zadošča (to nismo preverili).
      expect(d.doc.sl).toContain("MZV");
      expect(d.doc.sl).toContain("potni list");
    }
  });

  test("XK: posebna pravila eksplicitno omenjena", () => {
    const d = borderDocFor("XK");
    expect(d.doc.sl).toContain("posebna pravila");
    expect(d.doc.sl).toContain("MZV");
  });

  test("MZV URL vzorci po kanonu drzave.mzz.gov.si/{slug}/", () => {
    expect(borderDocFor("HR").mzzUrl).toBe(
      "https://www.drzave.mzz.gov.si/hrvaska/"
    );
    expect(borderDocFor("XK").mzzUrl).toBe(
      "https://www.drzave.mzz.gov.si/kosovo/"
    );
  });

  test("viri EU so eksportirani (za UI povezave)", () => {
    expect(SCHENGEN_SOURCE_URL).toContain("home-affairs.ec.europa.eu");
    expect(EU_DOCS_SOURCE_URL).toContain("europa.eu/youreurope");
  });
});

describe("F5: borderDocBlock — vrstni red + dedupe", () => {
  test("odstrani duplikate, ohrani vrstni red prvih pojavitev", () => {
    const out = borderDocBlock(["SI", "HR", "SI", "HR"]);
    expect(out.map((d) => d.code)).toEqual(["SI", "HR"]);
  });

  test("neznane kode spusti (fail-closed, brez izmišljevanja)", () => {
    const out = borderDocBlock(["SI", "XX", "HR"]);
    expect(out.map((d) => d.code)).toEqual(["SI", "HR"]);
  });
});
