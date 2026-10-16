/**
 * MAP-STICKY-CLS (POLIR15-a/d, 2.42.0) — STICKY PREKLOP NAD LEAFLETOM +
 * CLS SKELETA ZEMLJEVIDA (0,023 → 0)
 * ============================================================================
 * POLIR15-a (z-index nasprotje z Leafletom): Leafletovi notranji z-indexi
 * (.leaflet-map-pane ~200–400, kontrole ~800–1000) živijo izven React drevesa
 * in prej »pobegnejo« v koreninski stacking context — ko zemljevid drsi pod
 * sticky glavo (z-40, h-16), so jo prekrile Leafletove plasti. Rešitev:
 * ovoj zemljevida dobi LASTEN stacking context (`relative z-0 isolate`) —
 * Leaflet CSS OSTANE NESPREMJEN; preklopna vrstica „Zemljevid ⇄ Seznam“ je
 * ZDAJ sticky (max-lg:top-16, z-30, neprozorno ozadje) — ko zemljevid drsi
 * pod njo, preklop OSTANE klikaben (zgled Wanderlog/Švica: preklop kot
 * persistentna glava pogleda).
 *
 * POLIR15-d (CLS skeleta): dinamični uvoz TravelMap je prej rezerviral SAMO
 * zemljevid+seznam — nadzorne vrstice (iskanje+regija, čipi, preklop,
 * plasti) in legenda so se VSTAVILE ob razrešitvi uvoza (vse pod njimi se
 * premakne ≈ 176 px: izmerjeno CLS ≈ 0,023 na /zemljevid). Zdaj skelet
 * ZRCALI celotno drevo TravelMap (isti DOM vrstni red, isti order-1…7,
 * isti odmiki mt-4/mt-3, iste višine h-11/h-9/h-13, višina mape = DOBESEDNO
 * isti razredni niz kot MapContainer) → ob naložitvi Leafleta 0 vstavljanja,
 * 0 premika (web.dev „Reserve space for late-loading content“).
 *
 * Ta datoteka: SOURCE-CONTRACT (vzorec map-mobile-first / cls-next-step —
 * readFileSync + statična preverba izvorne kode; komponente se NE
 * importujejo: 0 omrežja, 0 DOM, 0 AI).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MAPA = readFileSync(
  join(import.meta.dir, "../src/components/map/travel-map.tsx"),
  "utf8"
);

const POGLED = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/zemljevid/view.tsx"),
  "utf8"
);

const CSS = readFileSync(
  join(import.meta.dir, "../src/app/globals.css"),
  "utf8"
);

/** Ta test sama (sledljivost POLIR15 v testnem naboru). */
const TA_TEST = readFileSync(join(import.meta.dir, "./map-sticky-cls.test.ts"), "utf8");

/** Izlušči celoten element (od zadnjega <div pred sidrom do prvega </div>
 *  za njim) — sidro je edinstven niz znotraj ciljnega elementa. */
function elementOkoli(vir: string, sidro: string, oznaka = "<div"): string {
  const sredina = vir.indexOf(sidro);
  expect(sredina, `sidro ${sidro}`).toBeGreaterThan(-1);
  const zacetek = vir.lastIndexOf(oznaka, sredina);
  expect(zacetek, `odpiralo ${oznaka} pred sidrom`).toBeGreaterThan(-1);
  const konec = vir.indexOf("</div>", sredina);
  expect(konec).toBeGreaterThan(-1);
  return vir.slice(zacetek, konec);
}

/** Višinski razredni niz mape (ISTI v MapContainer in skeletu). */
const VISINA_MAPE =
  "h-[62svh] min-h-80 sm:h-[70svh] lg:h-[calc(100svh-15rem)] lg:min-h-[540px]";

// ── POLIR15-a: izolacija stacking contexta + sticky preklop ─────────────────

describe("POLIR15-a: Leaflet zaprt v stacking context + sticky preklop", () => {
  test("① ovoj zemljevida: relative z-0 isolate (lasten stacking context)", () => {
    const ovoj = elementOkoli(MAPA, 'aria-label={t("mapLabel")}');
    expect(ovoj).toContain("relative z-0 isolate");
    // overflow-hidden ostaja (popups so bili že vezani na ovoj).
    expect(ovoj).toContain("overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl shadow-black/10");
  });

  test("② Leaflet CSS ostane NESPREMJEN (0 prepisov z-indexa v globals.css)", () => {
    // Izolacija prek `isolate` je kanon — hakerski prepisi .leaflet-* v
    // globalnem CSS-u bi povzročili regresije na vseh straneh z mapo.
    expect(CSS).not.toContain(".leaflet-pane");
    expect(CSS).not.toContain(".leaflet-container");
  });

  test("③ preklopna vrstica: sticky top-16 z-30 z neprosojnim ozadjem (<lg)", () => {
    const preklop = elementOkoli(MAPA, 'aria-label={t("viewToggleLabel")}');
    expect(preklop).toContain("max-lg:sticky");
    expect(preklop).toContain("max-lg:top-16"); // pod sticky glavo h-16
    expect(preklop).toContain("max-lg:z-30"); // nad mapo z-0, pod glavo z-40
    expect(preklop).toContain("max-lg:bg-background"); // zemljevid ne komolca skozi
    // Namizje (lg+) nespremenjeno: preklop skrit (split view).
    expect(preklop).toContain("lg:hidden");
  });

  test("④ višina preklopne vrstice NI spremenjena (0 odmikov, 0 CLS)", () => {
    const preklop = elementOkoli(MAPA, 'aria-label={t("viewToggleLabel")}');
    // gumba h-11 = 44 px (touch kanon); brez dodanih py odmikov.
    expect(preklop).toContain('className="h-11 flex-1"');
    expect(preklop).not.toMatch(/max-lg:py-\d/);
  });
});

// ── POLIR15-d: skelet strukturno identičen TravelMap ────────────────────────

describe("POLIR15-d: CLS skeleta zemljevida (0,023 → 0)", () => {
  test("⑤ koren skeleta = koren TravelMap (flex kolona <lg, isti px/pb)", () => {
    expect(POGLED).toContain("max-lg:flex max-lg:flex-col");
    expect(POGLED).toContain(
      "mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 max-lg:flex max-lg:flex-col"
    );
    expect(MAPA).toContain(
      "mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 max-lg:flex max-lg:flex-col"
    );
  });

  test("⑥ skelet zrcali VSE mobilne order plasti (order-1…5,7 — ne samo mapo)", () => {
    for (const order of [
      "max-lg:order-1",
      "max-lg:order-2",
      "max-lg:order-3",
      "max-lg:order-4",
      "max-lg:order-5",
      "max-lg:order-7",
    ]) {
      expect(POGLED, `skelet ima ${order}`).toContain(order);
    }
  });

  test("⑦ višina skeleta mape = DOBESEDNO isti razredni niz kot MapContainer", () => {
    // MapContainer: h-[62svh] min-h-80 w-full sm:h-[70svh] lg:…
    expect(MAPA).toContain("h-[62svh] min-h-80 w-full");
    // Skelet: isti niz (brez w-full, z rounded-xl na Skeletonu).
    expect(POGLED).toContain(
      "h-[62svh] min-h-80 rounded-xl sm:h-[70svh] lg:h-[calc(100svh-15rem)] lg:min-h-[540px]"
    );
  });

  test("⑧ skelet zrcali mrežo zemljevid+seznam (grid 1fr_340px) in vrstice kontrol", () => {
    // Mreža (ista v obeh).
    expect(MAPA).toContain("mt-5 grid gap-5 lg:grid-cols-[1fr_340px] max-lg:order-4");
    expect(POGLED).toContain("mt-5 grid gap-5 lg:grid-cols-[1fr_340px] max-lg:order-4");
    // Iskanje+regija (isti grid, isti odmik).
    expect(POGLED).toContain(
      "mt-4 grid grid-cols-[1fr_auto] gap-3 md:grid-cols-[1fr_auto_auto] lg:grid-cols-[minmax(200px,1fr)_auto_auto_auto] lg:mt-8 max-lg:order-1"
    );
    // Čipi (isti ovoj + pb-1).
    expect(POGLED).toContain("relative mt-3 max-lg:order-2");
    // Preklop (<lg) — h-11 flex-1, kot v TravelMap.
    expect(POGLED).toContain("mt-3 flex gap-2 max-lg:order-3 lg:hidden");
    // Plasti (isti ovoj).
    expect(POGLED).toContain("mt-3 flex flex-wrap items-center gap-2 max-lg:order-5");
  });

  test("⑨ skelet seznama in legende: slot za aside (<lg skrit) + rezervacija legende", () => {
    expect(POGLED).toContain('hidden space-y-2 lg:block');
    expect(POGLED).toContain("h-13 w-full rounded-lg");
    expect(POGLED).toContain("max-lg:order-7");
  });

  test("⑩ sledljivost: test sam omenja POLIR15 (house kanon dokazovanja)", () => {
    expect(TA_TEST).toContain("POLIR15");
  });
});
