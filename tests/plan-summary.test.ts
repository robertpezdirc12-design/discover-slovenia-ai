/**
 * PLAN-SUMMARY (POLIR5 A, 2.32.0) — IZMERJENE razdalje v povzetku načrta.
 * ============================================================================
 * Dva sloja:
 *  1. ČISTE funkcije iz src/lib/plan-map-data.ts (0 omrežja, 0 ure —
 *     isto okolje kot planMapLines): zaokrožitvi measuredKm (km na 1
 *     decimalko) in measuredMin (minute na 5 — ISTI kanon round5 kot
 *     LegRow), povzetek summarizeMeasured (čisti dnevi / zmešani / prazni /
 *     vsi padli / obrambni vnosi). Vsota združuje SAMO izmerjene dneve —
 *     Roadtrippersova past izklopljenih točk: padli dan NE sme tiho
 *     zapolniti vsote.
 *  2. SOURCE-CONTRACT na view.tsx + plan-map.tsx (UI komponente se NE
 *     importajo — leaflet potrebuje window; kanon nacrtuj-map-integration):
 *     onMeasured podatek na PlanMap, vrstica POD GLAVO DNEVA, skupna
 *     vrstica SAMO nad izmerjenimi dnevi, ocena = ISTA hevristika kot
 *     LegRow, urnik motorja (09:00–19:00, travelMinutes/roadKm) NEPREMJENJEN,
 *     L10N ×6 dobesedno, print-vidnost (NI print:hidden) + dostopnost
 *     (sr-only predpona).
 *
 * 0 AI, 0 omrežja, determinizem.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { round5 } from "@/lib/itinerary-engine";
import {
  measuredKm,
  measuredMin,
  summarizeMeasured,
  type MeasuredDay,
} from "@/lib/plan-map-data";

const VIEW = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/nacrtuj/view.tsx"),
  "utf8"
);

const PLAN_MAP = readFileSync(
  join(import.meta.dir, "../src/components/plan/plan-map.tsx"),
  "utf8"
);

const ENGINE = readFileSync(
  join(import.meta.dir, "../src/lib/itinerary-engine.ts"),
  "utf8"
);

/** Vsi podprti jeziki (kanon izdelka). */
const LANGS = ["sl", "en", "it", "de", "fr", "es"] as const;

// ── ZAOKROŽITVI (km 1 decimala; minute na 5 — ISTI kanon kot LegRow) ──────

describe("POLIR5 A: measuredKm — kilometri na 1 decimalko (prikaz)", () => {
  test("① živi ujet vzorec B: 21551 m → 21,6 km (izpis vrednosti OSRM)", () => {
    expect(measuredKm(21_551)).toBe(21.6);
  });

  test("② robovi in zaokrožitve navzgor/navzdol (deterministično)", () => {
    expect(measuredKm(0)).toBe(0);
    expect(measuredKm(949)).toBe(0.9); // 0,949 → 0,9
    expect(measuredKm(950)).toBe(1); // 0,95 → 1,0
    expect(measuredKm(1_234)).toBe(1.2); // 1,234 → 1,2
    expect(measuredKm(56_600)).toBe(56.6);
    expect(measuredKm(1_000_000)).toBe(1000); // 1000 km — brez pretvorbe
  });

  test("③ rezultat je VEDNO večkratnik 0,1 (brez lažne natančnosti)", () => {
    for (const m of [1, 7, 123, 4_567, 21_551, 999_999]) {
      expect(measuredKm(m) * 10).toBe(Math.round(measuredKm(m) * 10));
    }
  });
});

describe("POLIR5 A: measuredMin — minute na 5 (ISTI kanon round5 kot LegRow)", () => {
  test("④ živi ujet vzorec B: 2173 s → 35 min (36,2 min → 35)", () => {
    expect(measuredMin(2_173)).toBe(35);
  });

  test("⑤ round5 semantika: zelo kratke vožnje → 0, dolge → 5/10/…", () => {
    expect(measuredMin(0)).toBe(0);
    expect(measuredMin(60)).toBe(0); // 1 min → 0 (ISTA semantika kot LegRow)
    expect(measuredMin(150)).toBe(5); // 2,5 min → 5
    expect(measuredMin(300)).toBe(5); // 5 min → 5
    expect(measuredMin(480)).toBe(10); // 8 min → 10
    expect(measuredMin(3_600)).toBe(60); // 1 h → 60
  });

  test("⑥ identično round5(durationS / 60) po celotni bateriji (zaklep kanona)", () => {
    for (const s of [0, 1, 30, 61, 217, 999, 2_173, 21_730, 86_400]) {
      expect(measuredMin(s)).toBe(round5(s / 60));
    }
  });
});

// ── SUMMARIZE-MEASURED (čista presodba povzetka) ───────────────────────────

describe("POLIR5 A: summarizeMeasured — povzetek izmerjenih dni", () => {
  test("⑦ ČISTI dnevi: vsi izmerjeni → vse vrstice measured, vsota obeh stolpcev", () => {
    const stats: MeasuredDay[] = [
      { day: 0, status: "route", km: 21.6, min: 35 },
      { day: 1, status: "route", km: 13.5, min: 20 },
      { day: 2, status: "route", km: 0.3, min: 0 },
    ];
    const s = summarizeMeasured(3, stats);
    expect(s.rows).toEqual([
      { day: 0, kind: "measured", km: 21.6, min: 35 },
      { day: 1, kind: "measured", km: 13.5, min: 20 },
      { day: 2, kind: "measured", km: 0.3, min: 0 },
    ]);
    // 21,6 + 13,5 + 0,3 = 35,4 (plavajoča vejica bi dala 35,399999…)
    expect(s.totalKm).toBe(35.4);
    expect(s.totalMin).toBe(55);
    expect(s.measuredCount).toBe(3);
    expect(s.failedCount).toBe(0);
  });

  test("⑧ ZMEŠANI dnevi: vsota SAMO izmerjenih; padli dan je estimate BREZ številk", () => {
    const stats: MeasuredDay[] = [
      { day: 0, status: "route", km: 21.6, min: 35 },
      { day: 1, status: "straight" }, // padel dan — BREZ km/min (iskrenost)
      { day: 2, status: "route", km: 56.6, min: 45 },
    ];
    const s = summarizeMeasured(3, stats);
    expect(s.rows).toEqual([
      { day: 0, kind: "measured", km: 21.6, min: 35 },
      { day: 1, kind: "estimate" },
      { day: 2, kind: "measured", km: 56.6, min: 45 },
    ]);
    // Roadtrippersova past: padli dan NE sme tiho zapolniti vsote
    expect(s.totalKm).toBe(78.2);
    expect(s.totalMin).toBe(80);
    expect(s.measuredCount).toBe(2);
    expect(s.failedCount).toBe(1);
  });

  test("⑨ PRAZNI: 0 dni ali brez podatkov → totalKm/totalMin null (iskrena odsotnost)", () => {
    const nic = summarizeMeasured(0, []);
    expect(nic.rows).toEqual([]);
    expect(nic.totalKm).toBeNull();
    expect(nic.totalMin).toBeNull();
    expect(nic.measuredCount).toBe(0);
    expect(nic.failedCount).toBe(0);

    // 3 dnevi načrta, a odgovor proxyja ni prinesel IZMERE nobenega dne
    const brez = summarizeMeasured(3, []);
    expect(brez.rows).toEqual([
      { day: 0, kind: "estimate" },
      { day: 1, kind: "estimate" },
      { day: 2, kind: "estimate" },
    ]);
    expect(brez.totalKm).toBeNull();
    expect(brez.totalMin).toBeNull();
    expect(brez.failedCount).toBe(3);
  });

  test("⑩ VSI PADLI: samo straight → vsote NI (ne lažemo z ocenami pod oznako izmere)", () => {
    const s = summarizeMeasured(2, [
      { day: 0, status: "straight" },
      { day: 1, status: "straight" },
    ]);
    expect(s.rows.every((r) => r.kind === "estimate")).toBe(true);
    expect(s.totalKm).toBeNull();
    expect(s.totalMin).toBeNull();
    expect(s.measuredCount).toBe(0);
    expect(s.failedCount).toBe(2);
  });

  test("⑪ dan NEPOSREDNO v proxyju, a izven dneva načrta → ignoriran (obramba)", () => {
    const s = summarizeMeasured(2, [
      { day: 0, status: "route", km: 10, min: 10 },
      { day: 5, status: "route", km: 99, min: 99 }, // day ≥ dayCount
      { day: -1, status: "route", km: 77, min: 77 }, // day < 0
    ]);
    expect(s.rows.length).toBe(2);
    expect(s.totalKm).toBe(10); // tuj dan NE more zastrupiti vsote
    expect(s.measuredCount).toBe(1);
  });

  test("⑫ obrambni vnosi: route BREZ km/min ali z negativnimi → estimate", () => {
    const s = summarizeMeasured(3, [
      { day: 0, status: "route" }, // manjkajoči številki
      { day: 1, status: "route", km: -1, min: 10 }, // negativna km
      { day: 2, status: "route", km: Number.NaN, min: 10 }, // NaN
    ]);
    expect(s.rows.every((r) => r.kind === "estimate")).toBe(true);
    expect(s.totalKm).toBeNull();
    expect(s.measuredCount).toBe(0);
  });

  test("⑬ dan, ki ga proxy NI dobil (npr. postanek brez koordinat) → estimate", () => {
    // dan 0 ni bil upravičen (vrzel v koordinatah) — proxy je poslal samo dan 1
    const s = summarizeMeasured(2, [
      { day: 1, status: "route", km: 21.6, min: 35 },
    ]);
    expect(s.rows).toEqual([
      { day: 0, kind: "estimate" },
      { day: 1, kind: "measured", km: 21.6, min: 35 },
    ]);
    expect(s.totalKm).toBe(21.6);
    expect(s.failedCount).toBe(1); // iskreno preštet v opombo povzetka
  });

  test("⑭ DETERMINIZEM: isti vhod → isti izhod (10× globoko)", () => {
    const stats: MeasuredDay[] = [
      { day: 0, status: "route", km: 21.6, min: 35 },
      { day: 1, status: "straight" },
      { day: 2, status: "route", km: 5, min: 5 },
    ];
    const first = summarizeMeasured(3, stats);
    for (let i = 0; i < 10; i++) {
      expect(summarizeMeasured(3, stats)).toEqual(first);
    }
  });

  test("⑮ ČISTOČA: vhod se NE mutira (kanon plan-map-data)", () => {
    const stats: MeasuredDay[] = [
      { day: 0, status: "route", km: 21.6, min: 35 },
      { day: 1, status: "straight" },
    ];
    const kopija = structuredClone(stats);
    summarizeMeasured(2, stats);
    expect(stats).toEqual(kopija);
  });
});

// ── SOURCE-CONTRACT: plan-map.tsx (onMeasured, vsak odgovor proxyja) ───────

describe("POLIR5 A: plan-map.tsx — prop onMeasured (poročevalna plast)", () => {
  test("⑯ neobvezen prop onMeasured v PlanMapProps (stari klici nedotaknjeni)", () => {
    expect(PLAN_MAP).toContain("onMeasured?: (stats: MeasuredDay[]) => void;");
  });

  test("⑰ pokliče se ob VSAKEM odgovoru proxyja — tudi za padle dneve (straight)", () => {
    // klic po setRouteState v isti .then veji odgovora; straight dnevi so
    // v seznamu BREZ km/min; uporabita se čisti zaokrožitvi iz plan-map-data
    expect(PLAN_MAP).toContain("onMeasured?.(stats);");
    expect(PLAN_MAP).toContain('stats.push({ day: origin.dayIdx, status: "straight" });');
    expect(PLAN_MAP).toContain("km: measuredKm(distanceM),");
    expect(PLAN_MAP).toContain("min: measuredMin(durationS),");
  });

  test("⑱ izris se NE spremeni: polna/črtkana črta iz geometry ostaja edini vir", () => {
    // onMeasured je poročanje NAVZOR; routes (polne črte) še vedno nastanejo
    // IZKLJUČNO iz geometry — distanceM/durationS ne učinkujeta izrisa.
    expect(PLAN_MAP).toContain("routes[origin.dayIdx] = pts;");
    // efekt ostaja vezan na referenco dni (+ identiteta callbacka)
    expect(PLAN_MAP).toContain("}, [days, onMeasured]);");
  });
});

// ── SOURCE-CONTRACT: view.tsx (povzetek načrta) ────────────────────────────

/** Izlušči blok izvorne kode med dvema oznakama (vključno). */
function block(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf(to, start);
  expect(end).toBeGreaterThan(-1);
  return src.slice(start, end + to.length);
}

describe("POLIR5 A: view.tsx — povzetek izmerjenih dni", () => {
  test("⑲ onMeasured podatek na PlanMap (dinamični uvoz ssr:false ostaja)", () => {
    expect(VIEW).toContain("onMeasured={handleMeasured}");
    expect(VIEW).toContain('import("@/components/plan/plan-map")');
    expect(VIEW).toContain("ssr: false");
    // stanje VEZANO NA REFERENCO dni (zastarelo → null, isti kanon kot PlanMap)
    expect(VIEW).toContain(
      "const measured = measuredState?.forDays === days ? measuredState.stats : null;"
    );
  });

  test("⑳ vrstica POD GLAVO DNEVA (v CardHeader kartice dneva, obeh vrst)", () => {
    const danKartica = block(VIEW, "days.map((stops, dayIdx)", "</CardHeader>");
    expect(danKartica).toContain("measuredSummary?.rows[dayIdx]");
    expect(danKartica).toContain("pick(l, L.measuredDay)");
    expect(danKartica).toContain("pick(l, L.estimatedDay)");
    // print prijazna: vrstica dneva NI skrita v natisu (kartice so vir resnice)
    expect(danKartica).not.toContain("print:hidden");
    // dostopnost: sr-only predpona da kontekst bralcem zaslonov
    expect(danKartica).toContain("pick(l, L.measuredSrPrefix)");
  });

  test("㉑ ocena padlega dneva = ISTA hevristika kot LegRow (vsota skokov dneva)", () => {
    const ocena = block(VIEW, "function dayEstimate(", "return hops > 0");
    expect(ocena).toContain("round5(roadKm(prev.coords, stop.coords))");
    expect(ocena).toContain("travelMinutes(prev.coords, stop.coords)");
    expect(ocena).toContain("if (!prev.coords || !stop.coords) continue;");
    // LegRow OSTAJA (med postankoma) — povzetek je dodatek, ne nadomestilo
    const legRow = block(VIEW, "function LegRow({", "aria-label={`${label}");
    expect(legRow).toContain("round5(roadKm(prev.coords, stop.coords))");
    expect(legRow).toContain("travelMinutes(prev.coords, stop.coords)");
  });

  test("㉒ skupna vrstica SAMO nad izmerjenimi dnevi + iskrena opomba o padlih", () => {
    // vrstica je vezana na totalKm/totalMin ≠ null (null, če ni izmere)
    expect(VIEW).toContain(
      "measuredSummary.totalKm !== null && measuredSummary.totalMin !== null"
    );
    expect(VIEW).toContain("pick(l, L.measuredTotal)");
    // opomba „za N dni ni izmerjenih podatkov" samo ob padlih dnevih
    expect(VIEW).toContain("measuredSummary.failedCount > 0");
    expect(VIEW).toContain("pick(l, L.measuredMissing)");
    // povzetek porabi ČISTO funkcijo (0 omrežja v komponenti)
    expect(VIEW).toContain("summarizeMeasured(days.length, measured)");
  });

  test("㉓ URNIK MOTORJA NEPREMJENJEN: 09:00–19:00 + hevristiki ostajajo v motorju", () => {
    // engine: isti konstanti dneva in izvozi hevristik (kanon 2.30.0/2.31.0)
    expect(ENGINE).toContain("const DAY_START_MIN = 9 * 60;");
    expect(ENGINE).toContain("const DAY_END_MIN = 19 * 60;");
    expect(ENGINE).toContain("export function round5(");
    expect(ENGINE).toContain("export function roadKm(");
    expect(ENGINE).toContain("export function travelMinutes(");
    expect(ENGINE).toContain("export const ROAD_FACTOR = 1.3;");
    expect(ENGINE).toContain("export const AVG_SPEED_KMH = 60;");
    // view: urnik se NE riše iz izmer (OSRM je poročevalna plast) — vrstica
    // povzetka ne hrani ur postankov in ne dotika recomputeDayTimes
    const povzetek = block(VIEW, "POLIR5 A (2.32.0): SKUPNA IZMERJENA vrstica", "manualOrder && (");
    expect(povzetek).not.toContain("recomputeDayTimes");
    expect(povzetek).not.toContain(".time");
  });

  test("㉔ formatDuration za skupne ure (Y h Z min) ostaja vir oblike", () => {
    expect(VIEW).toContain("formatDuration(measuredSummary.totalMin)");
  });
});

// ── L10N ×6 (dobesedno, kanon nacrtuj-map-integration) ─────────────────────

describe("POLIR5 A: L10N ×6 — vsi novi ključi imajo sl+en+it+de+fr+es", () => {
  const KEYS = [
    "measuredDay",
    "estimatedDay",
    "measuredTotal",
    "measuredMissing",
    "measuredSrPrefix",
  ] as const;

  test("㉕ vsak ključ ima VSESH jezikovnih vnosov", () => {
    for (const key of KEYS) {
      const start = VIEW.indexOf(`${key}: {`);
      expect(start).toBeGreaterThan(-1);
      const end = VIEW.indexOf("},", start);
      const blok = VIEW.slice(start, end);
      for (const lang of LANGS) {
        expect(blok, `ključ ${key}, jezik ${lang}`).toContain(`${lang}:`);
      }
    }
  });

  test("㉖ dobesedni SL nizi (kanon specifikacije 2.32.0)", () => {
    expect(VIEW).toContain(
      "sl: (km: string, min: number) => `${km} km · ${min} min vožnje — izmerjeno (OSRM/OpenStreetMap)`"
    );
    expect(VIEW).toContain(
      "sl: (km: number, min: number) => `~ ${km} km · ~ ${min} min — ocena (premočna ×1,3 @ ~60 km/h)`"
    );
    expect(VIEW).toContain(
      "sl: (km: string, dur: string) => `Skupaj izmerjeno: ${km} km · ${dur} vožnje (OSRM/OpenStreetMap)`"
    );
    expect(VIEW).toContain(
      'za ${n} ${n === 1 ? "dan" : "dni"} ni izmerjenih podatkov — prikazana je ocena`'
    );
    expect(VIEW).toContain('sl: "Vožnja tega dne: "');
  });

  test("㉗ dobesedni EN nizi (prevodi po istem ključu)", () => {
    expect(VIEW).toContain(
      "en: (km: string, min: number) => `${km} km · ${min} min of driving — measured (OSRM/OpenStreetMap)`"
    );
    expect(VIEW).toContain(
      "en: (km: number, min: number) => `~ ${km} km · ~ ${min} min — estimate (straight-line ×1.3 @ ~60 km/h)`"
    );
    expect(VIEW).toContain(
      "en: (km: string, dur: string) => `Measured in total: ${km} km · ${dur} of driving (OSRM/OpenStreetMap)`"
    );
    expect(VIEW).toContain(
      "en: (n: number) => `for ${n} ${n === 1 ? \"day\" : \"days\"} no measured data is available — an estimate is shown`"
    );
    expect(VIEW).toContain('en: "Driving this day: "');
  });

  test("㉘ atribucija OSRM/OpenStreetMap v VSEH jezikih izmere/skupne vrstice", () => {
    // vir podatka je razkrit v vsakem jeziku (kanon iskrenosti 2.30.0)
    const stetri = VIEW.match(/OSRM\/OpenStreetMap/g) ?? [];
    // measuredDay ×6 + measuredTotal ×6 + opombe zemljevida ( obstoječe )
    expect(stetri.length).toBeGreaterThanOrEqual(12);
  });
});
