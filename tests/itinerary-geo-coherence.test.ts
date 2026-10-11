/**
 * GEO KOHERENCA NAČRTOVALNIKA (QA U1, 2026-10-11) — zaklenjena obnašanja.
 *
 * Povod (produkcija 2.27.0, /sl/nacrtuj): NL »družinski vikend ob jezeru
 * z kolesarjenjem, 3 dnevi« je proizvedel Dan 1 Murska Sobota (vzhod),
 * Dan 2 Bled (severozahod — ~200 km preskok), Dan 3 Plitvička jezera (HR)
 * → Črnomelj. Motor je sam opozoril na noge, ki jih je sam sestavil.
 *
 * Trije mehanizmi (vsi deterministični, 0 AI):
 *  1. IDF uteži interesov — redki interesi (jezero) razločujejo močneje
 *     kot vsepovedni (kolo);
 *  2. TIPSKA AFINITETA (×2) — »destinacija JE jezero« > »destinacija
 *     OMEMBJE jezero« (Bled jezero > Murska Sobota mesto z omembo);
 *  3. GEO VERIŽENJE SIDROV — sidro dneva N se izbere znotraj ~120 km od
 *     sidra prejšnjega dne (znotraj tolerance ANCHOR_TIER_MARGIN od vrha);
 *     če takih ni, pošteno prevzamemo vrh in preskok razkrijemo (geoHop).
 *
 * Dodatko: validatePlanGeo opozori na preskok MED dnevi (day_hop) — prej
 * je bil presledek Rogaška Slatina → Bled (~200 km) NEOPOZORAN.
 */

import { describe, expect, test } from "bun:test";

import {
  buildItinerary,
  interestIdfWeight,
  typeAffinityMatches,
  validatePlanGeo,
  haversineKm,
  round5,
  roadKm,
} from "../src/lib/itinerary-engine";
import { DESTINATIONS } from "../src/lib/slovenia-data";

// ── Pomočniki ──────────────────────────────────────────────────────────────

const dest = (id: string) => {
  const d = DESTINATIONS.find((x) => x.id === id);
  if (!d) throw new Error(`destinacija ${id} ni v korpusu`);
  return d;
};

/** Dan N prvi postanek (sidro) kot destinacija. */
const anchorSlug = (plan: ReturnType<typeof buildItinerary>, day: number) =>
  plan.days[day]?.[0]?.slug ?? "";

// ── 1) IDF uteži ───────────────────────────────────────────────────────────

describe("geo-koherenca: IDF uteži interesov (deterministična korpusna statistika)", () => {
  test("redki interes tehta več kot vsepoveden (monotonost)", () => {
    const N = DESTINATIONS.length;
    const rare = interestIdfWeight(1, N); // zadene 1 destinacijo
    const common = interestIdfWeight(N / 2, N); // zadne pol korpusa
    const everywhere = interestIdfWeight(N, N); // zadene vse
    expect(rare).toBeGreaterThan(common);
    expect(common).toBeGreaterThan(everywhere);
    expect(everywhere).toBeGreaterThan(0); // vsaj rating/10 kanon ostane
  });

  test("df=0 ostane končen (glajenje) — tak interes itak ne zadene ničesar", () => {
    expect(Number.isFinite(interestIdfWeight(0, 38))).toBe(true);
  });

  test("fiksni korpus → fiksne uteži (100× enako)", () => {
    const first = interestIdfWeight(5, 38);
    for (let i = 0; i < 100; i++) expect(interestIdfWeight(5, 38)).toBe(first);
  });
});

// ── 2) Tipska afiniteta ────────────────────────────────────────────────────

describe("geo-koherenca: tipska afiniteta (×2 za tip destinacije)", () => {
  test("Bled (lake) ima afiniteto z »jezero« — tudi s slovarskimi oblikami", () => {
    const bled = dest("bled");
    expect(bled.type).toBe("lake");
    expect(typeAffinityMatches(bled, "jezero")).toBe(true);
    expect(typeAffinityMatches(bled, "jezera")).toBe(true);
    expect(typeAffinityMatches(bled, "lake")).toBe(true);
  });

  test("Murska Sobota (city) NIMA tipske afinitete z »jezero« — samo besedilna omemba", () => {
    const murska = dest("murska-sobota");
    expect(murska.type).toBe("city");
    expect(typeAffinityMatches(murska, "jezero")).toBe(false);
  });

  test("Reka Soča (river) ima afiniteto z »reka«; sinonim »morje« NE zadene reke", () => {
    const soca = dest("soca");
    expect(soca.type).toBe("river");
    expect(typeAffinityMatches(soca, "reka")).toBe(true);
    expect(typeAffinityMatches(soca, "morje")).toBe(false);
  });

  test("prazen interes ne more imeti afinitete (varovalka)", () => {
    expect(typeAffinityMatches(dest("bled"), "")).toBe(false);
    expect(typeAffinityMatches(dest("bled"), "   ")).toBe(false);
  });
});

// ── 3) GEO veriženje — QA repro primer ─────────────────────────────────────

describe("geo-koherenca: QA repro »družinski vikend ob jezeru z kolesarjenjem, 3 dnevi«", () => {
  // NLU na produkciji iz tega besedila izvleče čipe: družina, jezero, kolo.
  const plan = buildItinerary({ interests: ["družina", "jezero", "kolo"], days: 3, locale: "sl" });

  test("Dan 1 prične ob JEZERU (tipska afiniteta) — ne v mestu z omembo jezer", () => {
    const d1 = DESTINATIONS.find((x) => x.slug === anchorSlug(plan, 0));
    expect(d1?.type).toBe("lake");
  });

  test("Dan 2 sidro znotraj 120 km (premočno) od sidra dneva 1 — veriženje", () => {
    const a1 = plan.days[0][0];
    const a2 = plan.days[1]?.[0];
    expect(a2).toBeDefined();
    if (!a2 || !a1.coords || !a2.coords) throw new Error("manjkajo koordinate sidra");
    expect(haversineKm(a1.coords, a2.coords)).toBeLessThanOrEqual(120);
  });

  test("vsak dan vsaj 1 postanek, vsi postanki edinstveni", () => {
    expect(plan.days.length).toBe(3);
    const ids = plan.days.flat().map((s) => s.id.split("--")[0]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("pokritje razkrije geo povezanost ali preskok (iskrenost)", () => {
    expect(plan.coverageNote).toMatch(/urejeni geografsko|geografsko ločen/);
  });

  test("če je preskok, je razkrit z danom in razdaljo", () => {
    const hop = plan.days.length > 1 && plan.coverageNote.includes("geografsko ločen");
    if (hop) {
      expect(plan.coverageNote).toMatch(/Dan \d+ je geografsko ločen \(preskok ~\d+ km\)/);
    }
  });

  test("determinizem: 3× identičen JSON (tudi z novimi utežmi)", () => {
    const q = { interests: ["družina", "jezero", "kolo"], days: 3, locale: "sl" as const };
    const a = JSON.stringify(buildItinerary(q));
    const b = JSON.stringify(buildItinerary(q));
    const c = JSON.stringify(buildItinerary(q));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

// ── 4) Geo opomba v drugem jeziku ──────────────────────────────────────────

describe("geo-koherenca: i18n opombe (6 jezikov kanona)", () => {
  test("EN načrt nosi EN geo opombo", () => {
    const en = buildItinerary({ interests: ["družina", "jezero", "kolo"], days: 3, locale: "en" });
    expect(en.coverageNote).toMatch(/ordered geographically|geographically separated/);
    expect(en.coverageNote).not.toMatch(/urejeni geografsko/);
  });

  test("struktura dni je jezikovno neodvisna (isti sidri)", () => {
    const sl = buildItinerary({ interests: ["družina", "jezero", "kolo"], days: 3, locale: "sl" });
    const de = buildItinerary({ interests: ["družina", "jezero", "kolo"], days: 3, locale: "de" });
    expect(
      JSON.stringify(de.days.map((d) => d.map((s) => s.slug)))
    ).toBe(
      JSON.stringify(sl.days.map((d) => d.map((s) => s.slug)))
    );
  });
});

// ── 5) Prednastavitev »Miren vikend ob reki« ────────────────────────────────

describe("geo-koherenca: prednastavitev »Miren vikend ob reki« (reka/mir/sprehod/narava)", () => {
  const plan = buildItinerary({
    interests: ["reka", "mir", "sprehod", "narava"],
    days: 2,
    locale: "sl",
  });

  test("dan 1 sidro je rečna destinacija (tipska afiniteta za »reka«)", () => {
    const a1 = DESTINATIONS.find((x) => x.slug === anchorSlug(plan, 0));
    expect(a1?.type).toBe("river");
  });

  test("dan 2 sidro verižen znotraj 120 km od sidra dneva 1", () => {
    const a1 = plan.days[0][0];
    const a2 = plan.days[1]?.[0];
    expect(a2).toBeDefined();
    if (!a2 || !a1.coords || !a2.coords) throw new Error("manjkajo koordinate sidra");
    expect(haversineKm(a1.coords, a2.coords)).toBeLessThanOrEqual(120);
  });
});

// ── 6) validatePlanGeo: preskok MED dnevi (day_hop) ─────────────────────────

describe("geo-koherenca: validatePlanGeo opozori na preskok med dnevi", () => {
  test("jezerski načrt (Bled + Bohinj, 19 km narazen) NIMA day_hop opozorila", () => {
    const plan = buildItinerary({ interests: ["jezero"], days: 2, locale: "sl" });
    // Edini jezeri v naboru, ki sta si blizu (Gorenjska): Bled + Bohinj.
    // Sidri sta veriženi → meddnevni preskok ne sme obstajati.
    const slugs = plan.days.map((d) => d[0]?.slug);
    expect(slugs[0]).toBe("bled");
    expect(slugs[1]).toBe("bohinj");
    const v = validatePlanGeo(plan, "sl");
    expect(v.issues.filter((i) => i.rule === "day_hop").length).toBe(0);
  });

  test("ročni načrt s preskokom > 120 km cestne ocene sproži day_hop WARN z imeni in razdaljo", () => {
    // Skonstruiramo minimalen načrt: Murska Sobota → Bled (~200+ km ceste).
    const murska = dest("murska-sobota");
    const bled = dest("bled");
    const plan = {
      days: [
        [
          {
            id: "t1--d0s0", name: murska.name, time: "09:00",
            durationMin: 120, cost: 10, kind: murska.type,
            coords: murska.coords, slug: murska.slug, region: murska.region,
          },
        ],
        [
          {
            id: "t2--d1s0", name: bled.name, time: "09:00",
            durationMin: 120, cost: 10, kind: bled.type,
            coords: bled.coords, slug: bled.slug, region: bled.region,
          },
        ],
      ],
      dayTitles: ["Dan 1", "Dan 2"],
      title: "test", summary: "test", totalCost: 20, coverageNote: "test",
      meta: { interests: [], days: 2, locale: "sl" as const },
    };
    const v = validatePlanGeo(plan, "sl");
    const hop = v.issues.find((i) => i.rule === "day_hop");
    expect(hop).toBeDefined();
    expect(hop?.level).toBe("warn");
    expect(hop?.day).toBe(1);
    expect(hop?.message).toContain(murska.name);
    expect(hop?.message).toContain(bled.name);
    expect(hop?.message).toMatch(/~\d+ km/);
    // razdalja v opozorilu = round5(roadKm) — isti kanon kot vse ostale noge
    expect(hop?.message).toContain(String(round5(roadKm(murska.coords, bled.coords))));
  });

  test("enodnevni načrt ne more imeti day_hop (ni naslednjega dne)", () => {
    const bled = dest("bled");
    const plan = {
      days: [[
        { id: "t1--d0s0", name: bled.name, time: "09:00", durationMin: 120, cost: 10,
          kind: bled.type, coords: bled.coords, slug: bled.slug, region: bled.region },
      ]],
      dayTitles: ["Dan 1"], title: "t", summary: "t", totalCost: 10, coverageNote: "t",
      meta: { interests: [], days: 1, locale: "sl" as const },
    };
    const v = validatePlanGeo(plan, "sl");
    expect(v.issues.filter((i) => i.rule === "day_hop").length).toBe(0);
  });
});

// ── 7) Regresija: stari kanoni ostajajo ────────────────────────────────────

describe("geo-koherenca: regresijske invariante starega kanona", () => {
  test("regija ostane trdi filter (posočje: kobarid + reka-soca skupaj)", () => {
    const plan = buildItinerary({
      interests: ["narava", "adrenalin"],
      days: 2,
      region: "posocje",
      locale: "sl",
    });
    expect(plan.days.length).toBeGreaterThan(0);
    const slugs = plan.days.flat().map((s) => s.slug).filter((x): x is string => typeof x === "string");
    for (const s of slugs) expect(["kobarid", "reka-soca"]).toContain(s);
    expect(slugs).toContain("kobarid");
    expect(slugs).toContain("reka-soca");
  });

  test("postanki na dan znotraj 1–4; urnik 09:00–19:00", () => {
    const plan = buildItinerary({ interests: ["narava", "jezero"], days: 3, locale: "sl" });
    for (const day of plan.days) {
      expect(day.length).toBeGreaterThanOrEqual(1);
      expect(day.length).toBeLessThanOrEqual(4);
      for (const s of day) {
        const [h, m] = (s.time as string).split(":").map(Number);
        const min = h * 60 + m;
        expect(min).toBeGreaterThanOrEqual(9 * 60);
        expect(min).toBeLessThanOrEqual(19 * 60);
      }
    }
  });

  test("0 dni → prazen načrt (varovalka ostaja)", () => {
    const plan = buildItinerary({ interests: ["narava"], days: 0 });
    expect(plan.days.length).toBe(0);
  });

  test("cena je vsota postankov (kanon)", () => {
    const plan = buildItinerary({ interests: ["družina", "jezero", "kolo"], days: 3, locale: "sl" });
    expect(plan.totalCost).toBe(plan.days.flat().reduce((n, s) => n + s.cost, 0));
  });
});
