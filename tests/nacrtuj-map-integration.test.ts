/**
 * INTEGRACIJSKI TESTI ZEMLJEVIDA NAČRTA NA /nacrtuj (POLIR2 B, izdaja 2.29.0)
 * ============================================================================
 * Source-contract vezava view.tsx ↔ PlanMap komponenta (orkestratorjeva
 * integracija): dinamični uvoz ssr:false (Leaflet potrebuje window —
 * neposreden uvoz ŽIVO pade na „window is not defined"), sinhronizacija
 * seznam ↔ zemljevid (klik markerja → drsenje + obroba; hover/fokus vrstice
 * → poudarek markerja), print pariteta (zemljevid se v natisu izpusti —
 * kartice dneva so vir resnice), i18n ×6 novih ključev.
 *
 * 0 omrežja, 0 AI — čisto branje izvorne kode (kanon source-contract testov).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const VIEW = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/nacrtuj/view.tsx"),
  "utf8",
);

const PLAN_MAP = readFileSync(
  join(import.meta.dir, "../src/components/plan/plan-map.tsx"),
  "utf8",
);

/** Vsi podprti jeziki (kanon izdelka). */
const LANGS = ["sl", "en", "it", "de", "fr", "es"] as const;

describe("POLIR2 B integracija: dinamični uvoz PlanMap (ssr:false)", () => {
  test("dinamični uvoz prek next/dynamic z imenovanim exportom", () => {
    expect(VIEW).toContain('import dynamic from "next/dynamic"');
    expect(VIEW).toContain('import("@/components/plan/plan-map")');
    expect(VIEW).toContain(".then((m) => m.PlanMap)");
    expect(VIEW).toContain("ssr: false");
  });

  test("Skeleton med nalaganjem (brez layout shifta)", () => {
    expect(VIEW).toContain("loading: () => <Skeleton");
  });

  test("PlanMap prejema dneve, poudarek in klik markerja", () => {
    expect(VIEW).toContain("<PlanMap");
    expect(VIEW).toContain("days={days}");
    expect(VIEW).toContain("highlightId={highlightStopId}");
    expect(VIEW).toContain("onMarkerClick={handleMarkerClick}");
  });

  test("komponenta PlanMap izvozi enak podpis (imenovani export)", () => {
    expect(PLAN_MAP).toContain("export function PlanMap");
    expect(PLAN_MAP).toContain("highlightId?");
    expect(PLAN_MAP).toContain("onMarkerClick?");
  });
});

describe("POLIR2 B integracija: sinhronizacija seznam ↔ zemljevid", () => {
  test("vrstice imajo data-stop-id (iskanje ob kliku markerja)", () => {
    expect(VIEW).toContain("data-stop-id={stop.id}");
  });

  test("klik markerja drsi do vrstice (scrollIntoView, varnostni escape)", () => {
    expect(VIEW).toContain("scrollIntoView");
    // POZOR kanon: CSS je v view.tsx uvožen iz @dnd-kit/utilities →
    // brskalnikov CSS.escape MORA iti prek globalThis (ni senčen).
    expect(VIEW).toContain("globalThis");
    expect(VIEW).not.toContain("CSS.escape(stopId)");
  });

  test("hover/fokus vrstice → poudarek markerja (onHighlight)", () => {
    expect(VIEW).toContain("onMouseEnter={() => onHover?.(stop.id)}");
    expect(VIEW).toContain("onMouseLeave={() => onHover?.(null)}");
    expect(VIEW).toContain("onFocus={() => onHover?.(stop.id)}");
    expect(VIEW).toContain("onBlur={() => onHover?.(null)}");
    expect(VIEW).toContain("highlighted={highlightId === stop.id}");
  });

  test("poudarjena vrstica dobi obrobo (ring) + ozadje", () => {
    expect(VIEW).toContain("bg-accent/50 ring-2 ring-primary/60");
  });

  test("DayTimeline posreduje poudarek v obe smeri", () => {
    expect(VIEW).toContain("highlightId={highlightStopId}");
    expect(VIEW).toContain("onHighlight={setHighlightStopId}");
  });

  test("zemljevid dovaža PREDogled vlečenja (isti `days` kot časovnica)", () => {
    // days = previewDays ?? plan.days — zemljevid in seznam kažeta isti
    // (predogledni) vrstni red MED vlečenjem med dnevi
    expect(VIEW).toContain("const days = previewDays ?? plan.days;");
  });
});

describe("POLIR2 B integracija: print pariteta + i18n", () => {
  test("zemljevid se v natisu izpusti (print:hidden) — kartice so vir resnice", () => {
    expect(VIEW).toContain('className="mt-6 print:hidden"');
  });

  test("naslov kartice zemljevida ×6 jezikov", () => {
    expect(VIEW).toContain(
      'mapTitle: { sl: "Zemljevid načrta", en: "Plan map", it: "Mappa del piano", de: "Plankarte", fr: "Carte du plan", es: "Mapa del plan" }',
    );
  });

  test("legenda kartice (barva/številka = dan) ×6 jezikov", () => {
    // Vseh 6 jezikov mora biti prisotnih v slovarju (iskanje delov nizov,
    // ker je večvrstični zapis)
    const anchors: Record<(typeof LANGS)[number], string> = {
      sl: "Položaji postankov po dnevih — barva in številka pomenita dan.",
      en: "Stop positions by day — colour and number stand for the day.",
      it: "Posizioni delle tappe per giorno — colore e numero indicano il giorno.",
      de: "Positionen der Stopps nach Tag — Farbe und Nummer stehen für den Tag.",
      fr: "Positions des arrêts par jour — couleur et numéro désignent le jour.",
      es: "Posiciones de las paradas por día — color y número indican el día.",
    };
    for (const lang of LANGS) {
      expect(VIEW).toContain(anchors[lang]);
    }
  });

  test("uporaba naslova/legende v JSX (pick vzorec)", () => {
    expect(VIEW).toContain("pick(l, L.mapTitle)");
    expect(VIEW).toContain("pick(l, L.mapDesc)");
  });
});
