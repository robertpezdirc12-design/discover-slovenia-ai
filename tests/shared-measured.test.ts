/**
 * SHARED-MEASURED (POLIR6 A, 2.33.0) — IZMERJENE RAZDALJE V VSEH POGLEDIH POTI
 * ============================================================================
 * Poročevalna pariteta /nacrtuj ↔ /potovanje ↔ /pot/[shareId] (oblak +
 * lokalno). Zapira odloženi korak 2.32.0 „izmerjene vrstice v skupnem
 * pogledu" in ujema Roadtrippers („mileage and trip time" v deljeni poti)
 * + Wanderlog („time and distance between places" povsod, tudi v natisu).
 *
 * Dva sloja (kanon plan-summary.test.ts — 0 omrežja, 0 AI):
 *  1. ČISTE funkcije iz src/lib/plan-map-data.ts: dayEstimate (PRESTAVLJENA
 *     iz nacrtuj/view.tsx — ISTA hevristika kot LegRow: round5(roadKm) +
 *     travelMinutes po skokih OBA postanka s koordinatama; hops === 0 →
 *     null) in fmtKm1 (EN pika, ostali vejica — determinizem, BREZ Intl).
 *  2. SOURCE-CONTRACT na shared-trip-view.tsx + potovanje/view.tsx (UI
 *     komponente se NE importajo — leaflet potrebuje window): obe točki
 *     PlanMap z onMeasured, memoizacija dni (stabilna referenca = pogoj
 *     za kanon vezave stanja izmer), vrstice POD glavo dneva print-VIDNE
 *     (NI print:hidden), skupna vrstica SAMO nad izmerjenimi + iskrena
 *     opomba o padlih, L10N ×6 DOBESEEDNO enaka nacrtuj, sr-only predpona,
 *     urnik motorja (09:00–19:00, ROAD_FACTOR/AVG_SPEED) NEPREMJENJEN.
 *
 * 0 AI, 0 omrežja, determinizem.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import {
  roadKm,
  round5,
  travelMinutes,
} from "@/lib/itinerary-engine";
import { dayEstimate, fmtKm1 } from "@/lib/plan-map-data";
import type { TripStop } from "@/lib/types";

const NACRTUJ = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/nacrtuj/view.tsx"),
  "utf8"
);

const POTOVANJE = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/potovanje/view.tsx"),
  "utf8"
);

const SHARED = readFileSync(
  join(import.meta.dir, "../src/components/content/shared-trip-view.tsx"),
  "utf8"
);

const ENGINE = readFileSync(
  join(import.meta.dir, "../src/lib/itinerary-engine.ts"),
  "utf8"
);

const PLAN_MAP = readFileSync(
  join(import.meta.dir, "../src/components/plan/plan-map.tsx"),
  "utf8"
);

/** Vsi podprti jeziki (kanon izdelka). */
const LANGS = ["sl", "en", "it", "de", "fr", "es"] as const;

/** Izlušči blok izvorne kode med dvema oznakama (vključno). */
function block(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf(to, start);
  expect(end).toBeGreaterThan(-1);
  return src.slice(start, end + to.length);
}

/**
 * Izlušči L10N blok ključa (measuredDay, …) in normaliziraj zamike —
 * primerjava DOBESEEDNE enakosti med datotekami ne glede na globino
 * gnezdenja (L v nacrtuj/potovanje je na modulu, v shared v komponenti).
 */
function l10nBlok(src: string, key: string): string {
  const start = src.indexOf(`${key}: {`);
  expect(start, `ključ ${key}`).toBeGreaterThan(-1);
  const end = src.indexOf("},", start);
  expect(end).toBeGreaterThan(-1);
  return src
    .slice(start, end)
    .split("\n")
    .map((vrstica) => vrstica.trim())
    .join("\n");
}

/** Testni postanek (coords samo, če sta podani koordinati — iskrenost). */
function stop(id: string, lat?: number, lng?: number): TripStop {
  return {
    id,
    name: id,
    time: "09:00",
    durationMin: 60,
    cost: 0,
    kind: "custom",
    ...(lat !== undefined && lng !== undefined
      ? { coords: { lat, lng } }
      : {}),
  };
}

// Gorenjske koordinate (Bled / Vintgar / Bohinj / Ljubljana) — samo za
// deterministične vhode čistih funkcij (0 omrežja).
const BLED = { lat: 46.3623, lng: 14.0936 };
const VINTGAR = { lat: 46.3846, lng: 14.1097 };
const BOHINJ = { lat: 46.2619, lng: 13.9695 };
const LJUBLJANA = { lat: 46.0569, lng: 14.5058 };

// ── ČISTA FUNKCIJA: dayEstimate (novo domovanje v plan-map-data) ────────────

describe("POLIR6 A: dayEstimate — ocena dneva (ISTA hevristika kot LegRow)", () => {
  test("① prazen dan ali en sam postanek → null (ni vožnje, ni vrstice)", () => {
    expect(dayEstimate([])).toBeNull();
    expect(dayEstimate([stop("bled", BLED.lat, BLED.lng)])).toBeNull();
  });

  test("② dan s 3 postanki → vsota OBEH skokov (round5(roadKm) + travelMinutes)", () => {
    const stops = [
      stop("bled", BLED.lat, BLED.lng),
      stop("vintgar", VINTGAR.lat, VINTGAR.lng),
      stop("bohinj", BOHINJ.lat, BOHINJ.lng),
    ];
    const est = dayEstimate(stops);
    expect(est).not.toBeNull();
    // Ročna vsota po LegRow enačbah (referenca — isti kanon kot nacrtuj).
    const km1 = round5(roadKm(BLED, VINTGAR));
    const min1 = travelMinutes(BLED, VINTGAR);
    const km2 = round5(roadKm(VINTGAR, BOHINJ));
    const min2 = travelMinutes(VINTGAR, BOHINJ);
    expect(est?.km).toBe(km1 + km2);
    expect(est?.min).toBe(min1 + min2);
  });

  test("③ vrzel v koordinatah preskoči samo prizadeta skoka (LegRow: brez vrstice)", () => {
    // A(coords) → B(brez) → C(coords): OBA skoka padeta (sosed brez coords)
    // → hops === 0 → null (iskrena odsotnost, ne delna izmišljena številka).
    const zVrzeli = [
      stop("a", BLED.lat, BLED.lng),
      stop("b"), // brez koordinat
      stop("c", BOHINJ.lat, BOHINJ.lng),
    ];
    expect(dayEstimate(zVrzeli)).toBeNull();

    // A(coords) → B(brez) → C(coords) → D(coords): živi samo skok C→D.
    const delna = [
      stop("a", BLED.lat, BLED.lng),
      stop("b"), // brez koordinat
      stop("c", VINTGAR.lat, VINTGAR.lng),
      stop("d", BOHINJ.lat, BOHINJ.lng),
    ];
    const est = dayEstimate(delna);
    expect(est?.km).toBe(round5(roadKm(VINTGAR, BOHINJ)));
    expect(est?.min).toBe(travelMinutes(VINTGAR, BOHINJ));
  });

  test("④ par postankov = NATANČNO LegRow vrednost povezave (zaklep enakosti)", () => {
    const pari: Array<[typeof BLED, typeof VINTGAR]> = [
      [BLED, VINTGAR],
      [BLED, BOHINJ],
      [BLED, LJUBLJANA],
      [LJUBLJANA, BOHINJ],
    ];
    for (const [a, b] of pari) {
      const est = dayEstimate([stop("a", a.lat, a.lng), stop("b", b.lat, b.lng)]);
      expect(est?.km).toBe(round5(roadKm(a, b)));
      expect(est?.min).toBe(travelMinutes(a, b));
    }
  });

  test("⑤ premočrtna ×1,3 ostaja jedro ocene (km ≥ premočrtne razdalje)", () => {
    const est = dayEstimate([
      stop("a", BLED.lat, BLED.lng),
      stop("b", BOHINJ.lat, BOHINJ.lng),
    ]);
    // roadKm sam je premočni ×1,3 — ocena NE SME padeti pod premočrno.
    expect(est?.km).toBeGreaterThanOrEqual(roadKm(BLED, BOHINJ) * 0.99);
  });

  test("⑥ DETERMINIZEM: isti vhod → isti izhod (10×)", () => {
    const stops = [
      stop("a", BLED.lat, BLED.lng),
      stop("b", VINTGAR.lat, VINTGAR.lng),
      stop("c", BOHINJ.lat, BOHINJ.lng),
    ];
    const prvi = dayEstimate(stops);
    for (let i = 0; i < 10; i++) {
      expect(dayEstimate(stops)).toEqual(prvi);
    }
  });

  test("⑦ ČISTOČA: vhod se NE mutira (kanon plan-map-data)", () => {
    const stops = [
      stop("a", BLED.lat, BLED.lng),
      stop("b"), // brez coords — struktura brez ključa coords
      stop("c", BOHINJ.lat, BOHINJ.lng),
    ];
    const kopija = structuredClone(stops);
    dayEstimate(stops);
    expect(stops).toEqual(kopija);
  });

  test("⑧ velik dan (5 postankov) → vsota VSEH 4 skokov, ne samo prvega", () => {
    const stops = [
      stop("lj", LJUBLJANA.lat, LJUBLJANA.lng),
      stop("bled", BLED.lat, BLED.lng),
      stop("vintgar", VINTGAR.lat, VINTGAR.lng),
      stop("bohinj", BOHINJ.lat, BOHINJ.lng),
      stop("lj2", LJUBLJANA.lat, LJUBLJANA.lng),
    ];
    const pričakovano = [BLED, VINTGAR, BOHINJ, LJUBLJANA].reduce(
      (vsota, to, i) => {
        const od = [LJUBLJANA, BLED, VINTGAR, BOHINJ][i];
        return {
          km: vsota.km + round5(roadKm(od, to)),
          min: vsota.min + travelMinutes(od, to),
        };
      },
      { km: 0, min: 0 }
    );
    expect(dayEstimate(stops)).toEqual(pričakovano);
  });
});

// ── ČISTA FUNKCIJA: fmtKm1 (EN pika, ostali vejica — BREZ Intl) ─────────────

describe("POLIR6 A: fmtKm1 — kilometri z 1 decimalko po jeziku", () => {
  test("⑨ EN pika (determinizem, ne odvisen od hosta locale)", () => {
    expect(fmtKm1("en", 21.551)).toBe("21.6");
    expect(fmtKm1("en", 68)).toBe("68.0");
    expect(fmtKm1("en", 4.7)).toBe("4.7");
    expect(fmtKm1("en", 0)).toBe("0.0");
  });

  test("⑩ ostalih 5 jezikov vejica (sl/it/de/fr/es)", () => {
    for (const lang of ["sl", "it", "de", "fr", "es"]) {
      expect(fmtKm1(lang, 21.551), lang).toBe("21,6");
      expect(fmtKm1(lang, 68), lang).toBe("68,0");
    }
  });

  test("⑪ VEDNO natanko 1 decimala (brez lažne natančnosti Valhalla)", () => {
    for (const km of [0, 4.7, 21.551, 63.34, 68, 1000]) {
      expect(fmtKm1("en", km)).toMatch(/^\d+\.\d$/);
      expect(fmtKm1("sl", km)).toMatch(/^\d+,\d$/);
    }
  });

  test("⑫ zaokrožitev toFixed je deterministična (21.549 → 21,5 / 63.34 → 63.3)", () => {
    expect(fmtKm1("sl", 21.549)).toBe("21,5");
    expect(fmtKm1("en", 63.34)).toBe("63.3");
    expect(fmtKm1("sl", 1000)).toBe("1000,0");
  });
});

// ── SOURCE-CONTRACT: shared-trip-view.tsx (/pot/[shareId]) ──────────────────

describe("POLIR6 A: shared-trip-view — obe PlanMap točki poročata izmere", () => {
  test("Ⓐ obe PlanMap klica (oblak + lokalno) imata onMeasured", () => {
    expect(SHARED).toContain(
      "<PlanMap days={cloudMapDays} onMeasured={handleMeasured}"
    );
    expect(SHARED).toContain(
      "<PlanMap days={localMapDays} onMeasured={handleMeasured}"
    );
    expect(SHARED.split("onMeasured={handleMeasured}").length - 1).toBe(2);
  });

  test("Ⓑ dnevi za PlanMap so MEMOIZIRANI (stabilna referenca = pogoj kanona)", () => {
    // Oblak: sharedPlanMapDays(db.plan) z deps na STABILNI referenci stanja.
    expect(SHARED).toContain("React.useMemo(");
    expect(SHARED).toContain(
      "() => (db?.plan ? sharedPlanMapDays(db.plan, shareId) : NO_MAP_DAYS)"
    );
    expect(SHARED).toContain("[db, shareId]");
    // Lokalna pota: isti vzorec nad localPlan stanjem.
    expect(SHARED).toContain(
      "() => (localPlan ? sharedPlanMapDays(localPlan, shareId) : NO_MAP_DAYS)"
    );
    expect(SHARED).toContain("[localPlan, shareId]");
    // Brez memoja bi vsak re-render naredil NOVO tabelo dni → PlanMap bi
    // znova klical proxy; inline klic v JSX je zato prepovedan:
    expect(SHARED).not.toContain("<PlanMap days={sharedPlanMapDays(");
  });

  test("Ⓒ NO_MAP_DAYS: stabilna PRAZNA referenca (kanon NO_ROUTES)", () => {
    expect(SHARED).toContain("const NO_MAP_DAYS: TripStop[][] = [];");
  });

  test("Ⓓ stanje izmer VEZANO NA REFERENCO dni (kanon 2.32.0)", () => {
    expect(SHARED).toContain(
      "measuredState?.forDays === activeMapDays ? measuredState.stats : null"
    );
    // handleMeasured stabilen (useCallback) — prepreči ponovni zagon efekta
    // PlanMap ob vsakem re-renderju.
    expect(SHARED).toContain(
      "(stats: MeasuredDay[]) => setMeasuredState({ forDays: activeMapDays, stats })"
    );
    expect(SHARED).toContain("[activeMapDays]");
    // povzetek porabi ČISTO funkcijo (0 omrežja v komponenti)
    expect(SHARED).toContain("summarizeMeasured(activeMapDays.length, measured)");
  });

  test("Ⓔ vrstica POD glavo dneva (h2) v PlanDays — print-VIDNA + sr-only", () => {
    // Segment od zemljepisa dneva (travelRows(dayIdx)) čez h2 do seznama
    // lokacij: vrstica izmere/ocene stoji POD h2 in NI skrita v natisu
    // (del povzetka dneva, kanon /nacrtuj).
    const glava = block(
      SHARED,
      "plan.days.map((day, dayIdx) => {",
      "{day.locations.length === 0 ? ("
    );
    expect(glava).toContain("travelRows(dayIdx)");
    expect(glava).toContain('<span className="sr-only">{travelSrPrefix}</span>');
    expect(glava).not.toContain("print:hidden");
  });

  test("Ⓕ ocena padlega dneva = dayEstimate nad dnevi zemljevida (ISTA hevristika)", () => {
    expect(SHARED).toContain("dayEstimate(activeMapDays[dayIdx] ?? [])");
    expect(SHARED).toContain("pick(l, L.estimatedDay)");
    expect(SHARED).toContain("pick(l, L.measuredDay)");
    expect(SHARED).toContain("fmtKm1(l, row.km)");
  });

  test("Ⓖ skupna vrstica POD seznamom dni, PRED zemljevidom — SAMO izmerjeni", () => {
    const skupna = block(
      SHARED,
      "POLIR6 A (2.33.0): SKUPNA IZMERJENA vrstica POD seznamom dni",
      "travelTotals.missing}"
    );
    expect(skupna).toContain("{travelTotals.total}");
    expect(skupna).toContain("travelTotals?.missing");
    expect(skupna).not.toContain("print:hidden");
    // vrstica nastane SAMO ob totalKm/totalMin ≠ null (iskrena odsotnost)
    expect(SHARED).toContain("measuredSummary.totalKm !== null");
    expect(SHARED).toContain("measuredSummary.totalMin !== null");
    expect(SHARED).toContain("pick(l, L.measuredTotal)");
    // opomba o padlih SAMO ob failedCount > 0
    expect(SHARED).toContain("measuredSummary.failedCount > 0");
    expect(SHARED).toContain("pick(l, L.measuredMissing)");
    // formatDuration (Y h Z min) za skupne minute
    expect(SHARED).toContain("formatDuration(measuredSummary.totalMin)");
    // umestitev (DOM vrstni red): vrstica je ZNOTRAJ PlanDays za </ol>
    // seznama dni (fragment), klic PlanDays pa v OBEH vejah PRED PlanMap.
    const olKonec = SHARED.indexOf("</ol>");
    const vrsticaSkupna = SHARED.indexOf("travelTotals.total", olKonec);
    expect(olKonec).toBeGreaterThan(-1);
    expect(vrsticaSkupna).toBeGreaterThan(olKonec);
    const oblakDnevi = SHARED.indexOf("<PlanDays plan={plan}");
    const oblakZemljevid = SHARED.indexOf("<PlanMap days={cloudMapDays}");
    expect(oblakDnevi).toBeGreaterThan(-1);
    expect(oblakDnevi).toBeLessThan(oblakZemljevid);
    const lokalniDnevi = SHARED.indexOf("<PlanDays plan={localPlan}");
    const lokalniZemljevid = SHARED.indexOf("<PlanMap days={localMapDays}");
    expect(lokalniDnevi).toBeGreaterThan(-1);
    expect(lokalniDnevi).toBeLessThan(lokalniZemljevid);
  });
});

// ── SOURCE-CONTRACT: potovanje/view.tsx („Moja pot") ────────────────────────

describe("POLIR6 A: potovanje/view.tsx — vrstica trenutnega dne + skupna vrstica", () => {
  test("Ⓗ PlanMap poročata izmere (onMeasured, dnevi načrta nespremenjeni)", () => {
    expect(POTOVANJE).toContain(
      "<PlanMap days={data.plan.days} onMeasured={handleMeasured}"
    );
  });

  test("Ⓘ stanje izmer VEZANO NA REFERENCO dni (kanon 2.32.0)", () => {
    expect(POTOVANJE).toContain(
      "measuredState?.forDays === days ? measuredState.stats : null"
    );
    expect(POTOVANJE).toContain("[days]");
    // days = data?.plan.days ?? null — stabilna referenca stanja fetcha
    expect(POTOVANJE).toContain("const days = data?.plan.days ?? null;");
    expect(POTOVANJE).toContain("summarizeMeasured(days.length, measured)");
  });

  test("Ⓙ vrstica TRENUTNEGA dneva pod glavo dneva — print-VIDNA + sr-only", () => {
    const glava = block(
      POTOVANJE,
      "POLIR6 A (2.33.0): vrstica izmere/ocene TRENUTNEGA dneva",
      "</CardHeader>"
    );
    expect(glava).toContain("{currentTravelRow &&");
    expect(glava).toContain("pick(l, L.measuredSrPrefix)");
    expect(glava).not.toContain("print:hidden");
    // izmerjeno / ocena (ocena = dayEstimate nad dnevi NAČRTA)
    expect(POTOVANJE).toContain("pick(l, L.measuredDay)");
    expect(POTOVANJE).toContain("dayEstimate(data.plan.days[dayIndex] ?? [])");
    expect(POTOVANJE).toContain("pick(l, L.estimatedDay)");
  });

  test("Ⓚ skupna vrstica pod dnevno kartico — SAMO izmerjeni + opomba o padlih", () => {
    const skupna = block(
      POTOVANJE,
      "POLIR6 A (2.33.0): SKUPNA IZMERJENA vrstica (vsi dnevi)",
      "Neujemajoči zapisi"
    );
    expect(skupna).toContain("measuredSummary.totalKm !== null");
    expect(skupna).toContain("measuredSummary.totalMin !== null");
    expect(skupna).toContain("pick(l, L.measuredTotal)");
    expect(skupna).toContain("measuredSummary.failedCount > 0");
    expect(skupna).toContain("pick(l, L.measuredMissing)");
    expect(skupna).toContain("formatDuration(measuredSummary.totalMin)");
    expect(skupna).not.toContain("print:hidden");
  });

  test("Ⓛ LegRow / JourneyStopRow / DayTimeline NEPREMJENJENI (dodatek, ne sprememba)", () => {
    // LegRow še vedno nosi ISTI hevristiki (noga med postankoma ostaja).
    const legRow = block(POTOVANJE, "function LegRow({", "aria-label={`${label}");
    expect(legRow).toContain("round5(roadKm(prev.coords, stop.coords))");
    expect(legRow).toContain("travelMinutes(prev.coords, stop.coords)");
    // dnevna navigacija še vedno izbira dan (vrstica se menja z njo)
    expect(POTOVANJE).toContain("onClick={() => setDayIndex(i)}");
    expect(POTOVANJE).toContain("stops={data.plan.days[dayIndex] ?? []}");
  });

  test("Ⓜ 0 novih omrežnih klicev: izmere prihajajo IZKLJUČNO iz PlanMap proxyja", () => {
    // Pogleda NE smeta klicati directions proxyja neposredno — izmere
    // prinese obstoječi klic PlanMap (0 novih zahtevkov, kanon 2.33.0).
    expect(SHARED).not.toContain("/api/plan/directions");
    expect(POTOVANJE).not.toContain("/api/plan/directions");
  });
});

// ── L10N ×6 DOBESEEDNO (nacrtuj = izvor semantike za oba nova pogleda) ──────

describe("POLIR6 A: L10N ×6 — 5 ključev v obeh pogledih, dobesedno enakih nacrtuj", () => {
  const KEYS = [
    "measuredDay",
    "estimatedDay",
    "measuredTotal",
    "measuredMissing",
    "measuredSrPrefix",
  ] as const;

  test("Ⓝ vsak ključ ima VSEH 6 jezikovnih vnosov v OBEH novih pogledih", () => {
    for (const src of [SHARED, POTOVANJE]) {
      for (const key of KEYS) {
        const blok = l10nBlok(src, key);
        for (const lang of LANGS) {
          expect(blok, `ključ ${key}, jezik ${lang}`).toContain(`${lang}:`);
        }
      }
    }
  });

  test("Ⓞ bloki ključev so DOBESEEDNO enaki nacrtuj (izvor semantike 2.32.0)", () => {
    for (const key of KEYS) {
      const nacrtujBlok = l10nBlok(NACRTUJ, key);
      expect(l10nBlok(SHARED, key), `shared-trip-view ${key}`).toBe(nacrtujBlok);
      expect(l10nBlok(POTOVANJE, key), `potovanje ${key}`).toBe(nacrtujBlok);
    }
  });

  test("Ⓟ dvojina 1 dan/dni pravilna ×6 (measuredMissing)", () => {
    // Pogojni izraz n === 1 mora ostati v VSEH jezikih obeh pogledov.
    for (const src of [SHARED, POTOVANJE]) {
      const blok = l10nBlok(src, "measuredMissing");
      const dvojine = blok.match(/n === 1 \?/g) ?? [];
      expect(dvojine.length).toBe(6);
    }
  });

  test("Ⓠ atribucija Valhalla/OpenStreetMap razkrita v vseh jezikih izmere/skupne (2.65.1)", () => {
    // Vir podatka je razkrit (kanon iskernosti 2.30.0): measuredDay ×6 +
    // measuredTotal ×6 = 12 pojavitev na pogled; 2.65.0 je zamenjal motor
    // (OSRM demo → Valhalla), oznake so sledile 2.65.1 (zlata pot ujela 36 zastarelih).
    for (const [ime, src] of [
      ["/pot/[shareId]", SHARED],
      ["/potovanje", POTOVANJE],
    ] as const) {
      const stetje = (src.match(/Valhalla\/OpenStreetMap/g) ?? []).length;
      expect(stetje, ime).toBe(12);
      // zastarel vir se NE sme vrniti
      expect(src.match(/OSRM/g) ?? [], ime).toHaveLength(0);
    }
  });
});

// ── URNIK MOTORJA NEPREMJENJEN (Valhalla ostaja poročevalna plast) ──────────

describe("POLIR6 A: urnik motorja zaklenjen (kanon 2.30.0/2.32.0)", () => {
  test("Ⓡ konstante dneva in hevristike ostajajo v motorju nespremenjene", () => {
    expect(ENGINE).toContain("const DAY_START_MIN = 9 * 60;");
    expect(ENGINE).toContain("const DAY_END_MIN = 19 * 60;");
    expect(ENGINE).toContain("export const ROAD_FACTOR = 1.3;");
    expect(ENGINE).toContain("export const AVG_SPEED_KMH = 60;");
    expect(ENGINE).toContain("export function round5(");
    expect(ENGINE).toContain("export function roadKm(");
    expect(ENGINE).toContain("export function travelMinutes(");
  });

  test("Ⓢ novi vrstici NE dotikata urnika (časi postankov ostajajo motorjevi)", () => {
    // Vrstice izmere/ocene so ČISTI dodatek k povzetku — ne prevzemajo ur
    // postankov in ne vplivajo na razpored (Valhalla je poročevalna plast).
    const sharedVrstice = block(
      SHARED,
      "const travelRow = (dayIdx: number): string | null => {",
      "return null;"
    );
    expect(sharedVrstice).not.toContain("recomputeDayTimes");
    expect(sharedVrstice).not.toContain(".time");
    const potovanjeVrstice = block(
      POTOVANJE,
      "const currentTravelRow = (() => {",
      "return null;"
    );
    expect(potovanjeVrstice).not.toContain("recomputeDayTimes");
    expect(potovanjeVrstice).not.toContain(".time");
    // pogleda sploh ne uvažata urnega preurejanja (živi samo v /nacrtuj)
    expect(SHARED).not.toContain("recomputeDayTimes");
    expect(POTOVANJE).not.toContain("recomputeDayTimes");
  });

  test("Ⓣ plan-map.tsx: poročevalna plast nepremaknjena (komentar posodobljen)", () => {
    // Izmere še vedno prihajajo iz ISTEGA odgovora proxyja; izris črt
    // izključno iz geometry; efekt vezan na [days, onMeasured].
    expect(PLAN_MAP).toContain("onMeasured?.(stats);");
    expect(PLAN_MAP).toContain("routes[origin.dayIdx] = pts;");
    expect(PLAN_MAP).toContain("}, [days, onMeasured]);");
    // NEREČEN komentar 2.30.0 („skupni pogled ostaja pri 2.30.0") je
    // posodobljen — zdaj poročajo VSI pogledi.
    expect(PLAN_MAP).not.toContain("skupni pogled ostaja pri 2.30.0");
    expect(PLAN_MAP).toContain("onMeasured zdaj podajo VSI pogledi poti");
  });
});
