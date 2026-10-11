/**
 * TESTI ZEMLJEVIDA POTI NA /potovanje IN /pot/[shareId] (POLIR3 B, izdaja 2.30.0)
 * ============================================================================
 * Source-contract + i18n (0 omrežja, 0 AI — čisto branje izvorne kode po
 * kanonu nacrtuj-map-integration.test.ts):
 *  - oba pogleda nalagata obstoječo komponento PlanMap IZKLJUČNO klientno
 *    (dinamični uvoz ssr:false — Leaflet potrebuje window; Skeleton med
 *    nalaganjem; BREZ neposrednega uvoza leaflet v pogledih);
 *  - print pariteta: kartica zemljevida na obeh pogledih nosi print:hidden
 *    (natis pokaže dneve, ne zemljevida — kanon /nacrtuj);
 *  - shared-trip-view: koordinate IZKLJUČNO iz registra prek destSlug
 *    (getDestination = DESTINATIONS.find(d => d.slug === …)); neujemanja
 *    ostanejo BREZ coords (iskren števec jih prešteje v PlanMap); v datoteki
 *    NE sme biti inline števk koordinat (nikoli izmišljene koordinate);
 *  - pogojna izrisava: /potovanje samo z vsaj enim postankom, deljena pot
 *    samo z vsaj 2 točkama skupaj (prazno stanje brez praznega zemljevida);
 *  - novi L10N ključi ×6 (sl/en/it/de/fr/es) dobesedno v OBEH datotekah.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const POTOVANJE = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/potovanje/view.tsx"),
  "utf8",
);

const SHARED = readFileSync(
  join(import.meta.dir, "../src/components/content/shared-trip-view.tsx"),
  "utf8",
);

const SLOVENIA_DATA = readFileSync(
  join(import.meta.dir, "../src/lib/slovenia-data.ts"),
  "utf8",
);

/** Vsi podprti jeziki (kanon izdelka). */
const LANGS = ["sl", "en", "it", "de", "fr", "es"] as const;

/** Oba pogleda skupaj (isti pogoj za skupne trditve). */
const OBA_POGLEDA: Array<[string, string]> = [
  ["/potovanje", POTOVANJE],
  ["/pot/[shareId]", SHARED],
];

/**
 * Vsaka `<PlanMap` pojava mora imeti print:hidden na ovojnici kartice
 * (zemljevid se v natisu izpusti — vir resnice so dnevi, kanon /nacrtuj).
 * Vrača true samo, če je vsaj ena pojava NAJDENA in vse poštene.
 */
function mapCardsPrintHidden(src: string): boolean {
  let idx = src.indexOf("<PlanMap");
  let najdenih = 0;
  while (idx !== -1) {
    najdenih += 1;
    const ovojnica = src.slice(Math.max(0, idx - 500), idx);
    if (!ovojnica.includes("print:hidden")) return false;
    idx = src.indexOf("<PlanMap", idx + 1);
  }
  return najdenih > 0;
}

describe("POLIR3 B: dinamični uvoz PlanMap (ssr:false, Skeleton)", () => {
  test("oba pogleda: next/dynamic z imenovanim exportom in ssr: false", () => {
    for (const [ime, src] of OBA_POGLEDA) {
      expect(src, ime).toContain('import dynamic from "next/dynamic"');
      expect(src, ime).toContain('import("@/components/plan/plan-map")');
      expect(src, ime).toContain(".then((m) => m.PlanMap)");
      expect(src, ime).toContain("ssr: false");
    }
  });

  test("oba pogleda: Skeleton med nalaganjem (brez layout shifta)", () => {
    for (const [ime, src] of OBA_POGLEDA) {
      expect(src, ime).toContain("loading: () => <Skeleton");
    }
  });

  test("oba pogleda: BREZ neposrednega uvoza leaflet (samo prek dynamic plan-map)", () => {
    for (const [ime, src] of OBA_POGLEDA) {
      expect(src, ime).not.toContain('from "leaflet"');
      expect(src, ime).not.toContain('from "react-leaflet"');
    }
  });
});

describe("POLIR3 B: print pariteta (natis = dnevi, ne zemljevid)", () => {
  test("oba pogleda: kartica zemljevida nosi print:hidden", () => {
    expect(mapCardsPrintHidden(POTOVANJE), "/potovanje").toBe(true);
    expect(mapCardsPrintHidden(SHARED), "/pot/[shareId]").toBe(true);
  });
});

describe("POLIR3 B: pogojna izrisava (iskreno prazno stanje)", () => {
  test("/potovanje: zemljevid SAMO, ko načrt dejansko nosi vsaj en postanek", () => {
    // days = data.plan.days; prazno stanje ostane prazno (brez praznega
    // zemljevida) — pogoj je ekspliciten v izvorni kodi.
    expect(POTOVANJE).toContain(
      "data.plan.days.some((day) => day.length > 0)",
    );
    expect(POTOVANJE).toContain("<PlanMap days={data.plan.days}");
  });

  test("/potovanje: brez highlightId/onMarkerClick (pogled nima izbirnih vrstic)", () => {
    expect(POTOVANJE).not.toContain("highlightId");
    expect(POTOVANJE).not.toContain("onMarkerClick");
  });

  test("deljena pot: zemljevid SAMO z vsaj 2 točkama skupaj (baza + lokalno)", () => {
    // Baza: totalStops >= 2; lokalna pota: isti pogoj prek reduce.
    expect(SHARED).toContain("totalStops >= 2");
    expect(SHARED).toContain(
      "localPlan.days.reduce((n, d) => n + d.locations.length, 0) >= 2",
    );
  });

  test("deljena pot: kartica v OBEH poteh (baza in lokalna — pariteta)", () => {
    // POLIR6 A (2.33.0): dnevi za PlanMap so MEMOIZIRANI (cloudMapDays /
    // localMapDays — stabilna referenca stanja je pogoji za vezavo izmer),
    // klicev PlanMap pa je še vedno TOČNO 2 (baza + lokalna pota).
    const pojav = SHARED.split("<PlanMap").length - 1;
    expect(pojav).toBe(2);
    expect(SHARED).toContain(
      "<PlanMap days={cloudMapDays} onMeasured={handleMeasured}",
    );
    expect(SHARED).toContain(
      "<PlanMap days={localMapDays} onMeasured={handleMeasured}",
    );
  });
});

describe("POLIR3 B: destSlug → register DESTINATIONS (iskrene koordinate)", () => {
  test("iskanje prek getDestination — kanonski ovojnik DESTINATIONS.find(d => d.slug === …)", () => {
    // getDestination je edini iskalni kanal (ista funkcija že izrisuje
    // povezave „Odpri destinacijo“ v PlanDays) in je dobesedno
    // DESTINATIONS.find(d => d.slug === slug).
    expect(SHARED).toContain("getDestination(loc.destSlug)");
    expect(SLOVENIA_DATA).toContain("export function getDestination");
    expect(SLOVENIA_DATA).toContain(
      "DESTINATIONS.find((d) => d.slug === slug)",
    );
  });

  test("coords SAMO iz ujemanja v registru (neujemanja iskreno brez)", () => {
    // Pogojni spread: brez ujemanja destSlug postanek ostane BREZ coords
    // (planMapData ga iskreno prešteje v „N postankov brez znanih
    // koordinat ni prikazan“ — koordinat ne izmišljujemo).
    expect(SHARED).toContain("...(dest ? { coords: dest.coords } : {})");
  });

  test("enolični id-ji postankov (shareId + dan + zaporedje) in iskrena ura", () => {
    expect(SHARED).toContain("`${shareId}-d${day.day}-${i}`");
    expect(SHARED).toContain("loc.time ?? null");
  });

  test("NIKOLI izmišljene koordinate: v obeh pogledih ni inline števk koordinat", () => {
    // Niti ena števka koordinate ne sme biti zapisana v pogledu — vse
    // koordinate prihajajo iz registra (slovenia-data) ali motorja.
    for (const [ime, src] of OBA_POGLEDA) {
      expect(src, ime).not.toMatch(/(?:lat|lng)\s*:\s*[-]?\d/);
    }
  });
});

describe("POLIR3 B: L10N ×6 dobesedno (novi ključi)", () => {
  test("mapTitle ×6 v obeh pogledih (dobesedno, en same vrstice)", () => {
    const vrstica =
      'mapTitle: { sl: "Zemljevid poti", en: "Trip map", it: "Mappa del viaggio", de: "Reisekarte", fr: "Carte du voyage", es: "Mapa del viaje" },';
    expect(POTOVANJE).toContain(vrstica);
    expect(SHARED).toContain(vrstica);
  });

  test("mapDesc ×6 v obeh pogledih (dobesedno po jezikih)", () => {
    const anchors: Record<(typeof LANGS)[number], string> = {
      sl: "Položaji postankov po dnevih — barva in številka pomenita dan.",
      en: "Stop positions by day — colour and number stand for the day.",
      it: "Posizioni delle tappe per giorno — colore e numero indicano il giorno.",
      de: "Positionen der Stopps nach Tag — Farbe und Nummer stehen für den Tag.",
      fr: "Positions des arrêts par jour — couleur et numéro désignent le jour.",
      es: "Posiciones de las paradas por día — color y número indican el día.",
    };
    for (const lang of LANGS) {
      expect(POTOVANJE).toContain(anchors[lang]);
      expect(SHARED).toContain(anchors[lang]);
    }
  });

  test("uporaba naslova/legende v JSX (pick vzorec) na obeh pogledih", () => {
    for (const [ime, src] of OBA_POGLEDA) {
      expect(src, ime).toContain("pick(l, L.mapTitle)");
      expect(src, ime).toContain("pick(l, L.mapDesc)");
    }
  });
});
