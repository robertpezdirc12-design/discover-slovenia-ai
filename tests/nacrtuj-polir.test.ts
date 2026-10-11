import { describe, expect, test } from "bun:test";

import { parsePlannerIntent } from "@/lib/advisor/nlu";
import { buildItinerary, budgetTier } from "@/lib/itinerary-engine";
import { planFingerprint } from "@/lib/deterministic-itinerary";
import { DESTINATIONS } from "@/lib/slovenia-data";
import type { Budget } from "@/lib/slovenia-data";

/**
 * POLIR A (2.28.0) — /nacrtuj: one-click primeri prostega opisa (naloga 1),
 * 3-korakov onboarding trak (naloga 2) in primerjalnik proračunov (naloga 3).
 *
 * Kanon (enak kot tests/trip-chat-rate-limit.test.ts):
 *  - SOURCE-CONTRACT na view.tsx (UI komponente se NE importajo, zaklenemo
 *    strukturo izvorne kode — vključno z besedili vseh 6 jezikov);
 *  - NLU primeri: 6 jezikov × 3 primeri — vsak primer je PREVERJENO
 *    razumljiv (neposreden klic parserja), izvleče interesi/dnevi/regija;
 *  - primerjalnik: variante so IZKLJUČNO iz motora (buildItinerary na
 *    klientu, 0 omrežja) — zrcalo relaksacije (pool < dni×2) je zaklenjeno
 *    proti coverageNote motorja (PLANNER_MSG.budgetRelaxed);
 *  - 0 omrežja: ta baterija ne uporablja fetch-a (nobenih stubov) — ves
 *    ogled poteka po čistih funkcijah.
 */

const VIEW = "src/app/[locale]/nacrtuj/view.tsx";

async function viewSrc(): Promise<string> {
  return Bun.file(VIEW).text();
}

const LANGS = ["sl", "en", "it", "de", "fr", "es"] as const;
type Lang = (typeof LANGS)[number];

// ── naloge 1: NLU primeri (6 jezikov × 3) ─────────────────────────────────
// ISTI besedili kot NL_EXAMPLES v view.tsx (source-contract spodaj veže
// obe plasti: če kdo spremeni primer v view, test pade in prisili ponovno
// preverbo razumljivosti s strani skriptne NLU).

const EXAMPLES: Record<Lang, [string, string, string]> = {
  sl: ["vikend na Bledu z družino", "3 dni med vinogradi na Štajerskem", "smučarski teden v Kranjski Gori"],
  en: ["a weekend on Lake Bled with the family", "3 days among the vineyards of Styria", "a week of skiing in Kranjska Gora"],
  it: ["un weekend familiare sul lago di Bled", "3 giorni alla scoperta dei vini di Maribor", "5 giorni in montagna a Kranjska Gora"],
  de: ["2 Tage in Bled mit der Familie", "3 Tage zwischen den Weingärten der Steiermark", "eine Woche Skifahren in Kranjska Gora"],
  fr: ["2 jours au lac de Bled en famille", "3 jours de gastronomie près de Maribor", "5 jours de ski à Kranjska Gora"],
  es: ["2 días en el lago de Bled en familia", "3 días de catas de vino cerca de Maribor", "5 días de montaña en Kranjska Gora"],
};

describe("POLIR A — naloga 1: one-click primeri so NLU razumljivi", () => {
  test("① source-contract: vsak primer je dobesedno v view.tsx (NL_EXAMPLES)", async () => {
    const src = await viewSrc();
    for (const lang of LANGS) {
      for (const text of EXAMPLES[lang]) {
        expect(src).toContain(`${lang}: "${text}"`);
      }
    }
  });

  test("② primer 1 (Bled): družina + jezero, 2 dni, regija gorenjska (×6)", () => {
    for (const lang of LANGS) {
      const i = parsePlannerIntent(EXAMPLES[lang][0]);
      expect(i).not.toBeNull();
      expect(i!.interests).toContain("družina");
      expect(i!.interests).toContain("jezero");
      expect(i!.days).toBe(2);
      expect(i!.region).toBe("gorenjska");
    }
  });

  test("③ primer 2 (vinogradi/Štajerska): vino (FR: kulinarika), 3 dni, stajerska (×6)", () => {
    for (const lang of LANGS) {
      const i = parsePlannerIntent(EXAMPLES[lang][1]);
      expect(i).not.toBeNull();
      // FR: skripta NE pozna „vin“/„vignoble“ — iskreni gastronomski variant.
      expect(i!.interests).toContain(lang === "fr" ? "kulinarika" : "vino");
      expect(i!.days).toBe(3);
      expect(i!.region).toBe("stajerska");
    }
  });

  test("④ primer 3 (smučarski teden): smučanje (IT/ES: gora), 5 dni, BREZ regije (×6)", () => {
    for (const lang of LANGS) {
      const i = parsePlannerIntent(EXAMPLES[lang][2]);
      expect(i).not.toBeNull();
      // IT/ES: skripta NE pozna „sci“/„esquí“ — gorska različica („gora“
      // pride iz imena kraja Kranjska Gora).
      expect(i!.interests).toContain(
        lang === "it" || lang === "es" ? "gora" : "smučanje"
      );
      expect(i!.days).toBe(5);
      // Kranjska Gora ni med namigi krajev NLU — regija je iskreno izpuščena
      // (nikoli ne ugibamo); načrt zato pokriva vse regije.
      expect(i!.region).toBeUndefined();
    }
  });

  test("⑤ vsak primer zgradi VELJAVEN načrt (postanki ≥ 1, cene iz motora)", () => {
    for (const lang of LANGS) {
      for (const text of EXAMPLES[lang]) {
        const intent = parsePlannerIntent(text)!;
        // days: vsak primer ima izrecne dneve (zaklenjeno zgoraj); fallback
        // 2 = privzeta vrednost obrazca (view obdrži izbiro, če jih ni).
        const plan = buildItinerary({
          ...intent,
          days: intent.days ?? 2,
          locale: "sl",
        });
        const stops = plan.days.flat();
        expect(stops.length).toBeGreaterThan(0);
        expect(plan.totalCost).toBe(stops.reduce((s, x) => s + x.cost, 0));
      }
    }
  });

  test("⑥ klik zgolj ZAPOLNI vnos (ne generira): source-contract obnašanja", async () => {
    const src = await viewSrc();
    const start = src.indexOf("naloga 1: ONE-CLICK PRIMERI — klik zgolj");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("pick(l, L.nlHint)", start);
    const block = src.slice(start, end);
    // zapolni vnos + počisti napako + fokusiranje na vnos (44 px tipka)
    expect(block).toContain("setNlInput(text)");
    expect(block).toContain("setNlError(null)");
    expect(block).toContain("min-h-11");
    expect(block).toContain("aria-label={`${pick(l, L.exampleUse)}: ${text}`}");
    // NIKAKOR ne sproži razumevanja/generiranja s klikom na primer
    expect(block).not.toContain("understandNl");
    expect(block).not.toContain("generate(");
  });
});

// ── naloga 3: primerjalnik proračunov ─────────────────────────────────────

/** ISTA logika relaksacije kot BudgetCompare v view.tsx (zrcalo motorja). */
function mirrorRelaxed(
  region: string | undefined,
  budget: Budget,
  days: number
): boolean {
  return (
    DESTINATIONS.filter(
      (d) =>
        (!region || d.region === region) &&
        budgetTier(d.budget) <= budgetTier(budget)
    ).length < days * 2
  );
}

const RELAXED_MARKER = "sproščen"; // PLANNER_MSG.budgetRelaxed (sl) v coverageNote

const QUERY_MATRIX: ReadonlyArray<{
  interests: string[];
  days: number;
  region?: string;
}> = [
  { interests: ["družina", "jezero"], days: 2, region: "gorenjska" },
  { interests: ["smučanje", "gora"], days: 5 },
  { interests: ["vino"], days: 3, region: "stajerska" },
  { interests: ["romantika", "hrana"], days: 2, region: "primorska" },
  { interests: ["kulinarika", "mesto"], days: 3, region: "stajerska" },
  { interests: ["gora"], days: 1, region: "koroska" },
];

describe("POLIR A — naloga 3: primerjalnik (številke izključno iz motora)", () => {
  const TIERS: Budget[] = ["€", "€€", "€€€"];

  test("⑦ engine vrne veljaven načrt za vsako od 3 stopenj (vsaka poizvedba × raven)", () => {
    for (const q of QUERY_MATRIX) {
      for (const budget of TIERS) {
        const plan = buildItinerary({ ...q, budget, locale: "sl" });
        expect(plan.days.length).toBeGreaterThanOrEqual(1);
        expect(plan.days.length).toBeLessThanOrEqual(5);
        const stops = plan.days.flat();
        expect(stops.length).toBeGreaterThan(0);
        // številke v primerjalniku so iz motorja: totalCost = vsota postankov
        expect(plan.totalCost).toBe(stops.reduce((s, x) => s + x.cost, 0));
        const regions = new Set(stops.map((s) => s.region).filter(Boolean));
        expect(regions.size).toBeGreaterThan(0);
      }
    }
  });

  test("⑧ brez relaksacije so VSI postanki znotraj ravni proračuna (register)", () => {
    const bySlug = new Map(DESTINATIONS.map((d) => [d.slug, d]));
    for (const q of QUERY_MATRIX) {
      for (const budget of TIERS) {
        const relaxed = mirrorRelaxed(q.region, budget, q.days);
        const plan = buildItinerary({ ...q, budget, locale: "sl" });
        const engineRelaxed = plan.coverageNote.includes(RELAXED_MARKER);
        // zrcalo v view mora biti IDENTIČNO razkritju motorja
        expect(engineRelaxed).toBe(relaxed);
        if (!relaxed) {
          for (const stop of plan.days.flat()) {
            const dest = bySlug.get(stop.slug ?? "");
            expect(dest).toBeDefined();
            expect(budgetTier(dest!.budget)).toBeLessThanOrEqual(
              budgetTier(budget)
            );
          }
        }
      }
    }
  });

  test("⑨ zrcalo relaksacije se ujema z motorjem tudi na robovih (majhne regije)", () => {
    // koroska/kras z 5 dnevi: pool < 10 → sprostitev tudi na €€€ (iskreno,
    // enako kot bi zapisal coverageNote motorja).
    for (const region of ["kras", "koroska", "prekmurje"]) {
      for (const budget of TIERS) {
        const plan = buildItinerary({
          interests: ["narava"],
          days: 5,
          region,
          budget,
          locale: "sl",
        });
        expect(plan.coverageNote.includes(RELAXED_MARKER)).toBe(
          mirrorRelaxed(region, budget, 5)
        );
      }
    }
  });

  test("⑩ determinizem variant: isti vhod → isti prstni odtis (10×)", () => {
    for (const budget of TIERS) {
      const first = buildItinerary({
        interests: ["družina", "jezero"],
        days: 2,
        region: "gorenjska",
        budget,
        locale: "sl",
      });
      for (let i = 0; i < 10; i++) {
        const again = buildItinerary({
          interests: ["družina", "jezero"],
          days: 2,
          region: "gorenjska",
          budget,
          locale: "sl",
        });
        expect(planFingerprint(again)).toBe(planFingerprint(first));
      }
    }
  });

  test("⑪ številke so jezikovno neodvisne (sl/en/it/de/fr/es — kot /api/itinerary)", () => {
    for (const locale of LANGS) {
      const a = buildItinerary({
        interests: ["družina", "jezero"],
        days: 2,
        region: "gorenjska",
        budget: "€",
        locale,
      });
      const b = buildItinerary({
        interests: ["družina", "jezero"],
        days: 2,
        region: "gorenjska",
        budget: "€",
        locale: "sl",
      });
      expect(a.days.flat().length).toBe(b.days.flat().length);
      expect(a.totalCost).toBe(b.totalCost);
      expect(a.days.flat().map((s) => s.name)).toEqual(
        b.days.flat().map((s) => s.name)
      );
    }
  });

  test("⑫ source-contract: primerjalnik računa klientansko (0 omrežja, 0 izmišljenih številk)", async () => {
    const src = await viewSrc();
    const start = src.indexOf("function BudgetCompare");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("function LegRow", start);
    const block = src.slice(start, end);
    // variante iz čiste funkcije motora — NE iz fetch-a na API
    expect(block).toContain("buildItinerary(");
    expect(block).toContain("budgetTier(");
    expect(block).toContain("COMPARE_TIERS");
    expect(block).not.toContain("fetch(");
    // iskreni opombi (relaksacija / izpuščeni dražji postanki) obstajata
    expect(block).toContain("compareRelaxed");
    expect(block).toContain("compareFiltered");
  });
});

// ── i18n popolnost (×6) vseh novih ključev ────────────────────────────────

describe("POLIR A — i18n: vsi novi ključi imajo 6 jezikov", () => {
  const NEW_L_KEYS = [
    "examplesLabel",
    "exampleUse",
    "stepsLabel",
    "stepOne",
    "stepTwo",
    "stepThree",
    "compareTitle",
    "compareLead",
    "compareEstimate",
    "compareCurrent",
    "compareRelaxed",
    "compareFiltered",
  ] as const;

  test("⑬ L slovar: vsak nov ključ ima sl+en+it+de+fr+es", async () => {
    const src = await viewSrc();
    for (const key of NEW_L_KEYS) {
      const start = src.indexOf(`${key}: {`);
      expect(start).toBeGreaterThan(-1);
      const block = src.slice(start, src.indexOf("}", start));
      for (const lang of LANGS) {
        expect(block).toContain(`${lang}:`);
      }
    }
  });

  test("⑭ NL_EXAMPLES: 3 primeri × 6 jezikov (po jeziku natanko 3 vnosi)", async () => {
    const src = await viewSrc();
    const start = src.indexOf("const NL_EXAMPLES");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("];", start));
    for (const lang of LANGS) {
      const hits = block.match(new RegExp(`${lang}: "`, "g")) ?? [];
      expect(hits.length).toBe(3);
    }
  });

  test("⑮ COMPARE_TIERS: 3 ravni × 6 jezikov", async () => {
    const src = await viewSrc();
    const start = src.indexOf("const COMPARE_TIERS");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("];", start));
    for (const lang of LANGS) {
      const hits = block.match(new RegExp(`${lang}: "`, "g")) ?? [];
      expect(hits.length).toBe(3);
    }
  });

  test("⑯ naloga 2 (trak): 3 koraki so prisotni in statični (brez close/cookies)", async () => {
    const src = await viewSrc();
    expect(src).toContain("aria-label={pick(l, L.stepsLabel)}");
    expect(src).toContain("pick(l, L.stepOne)");
    expect(src).toContain("pick(l, L.stepTwo)");
    expect(src).toContain("pick(l, L.stepThree)");
    // čisto statičen <ol>: brez stanja zapiranja in brez localStorage/cookies
    // (sidro je JSX komentar traku — em-dash različica, ne komentar v L slovarju)
    const start = src.indexOf("onboarding trak — statičen");
    const end = src.indexOf("{/* OBRAZEC */}", start);
    const strip = src.slice(start, end);
    expect(strip).not.toContain("useState");
    expect(strip).not.toContain("localStorage");
    expect(strip).not.toContain("document.cookie");
  });
});
