/**
 * MAP-MOBILE-FIRST (POLIR14, 2.41.0) — MOBILNA GLAVA ZEMLJEVIDA:
 * ZEMLJEVID NAJPREJ
 * ============================================================================
 * Raziskava 2026-10-12-polir14.md §3.3 (izmerjeno na produkciji @390×844):
 * glava + kontrolna plast sta zasedli ~87 % prvega zaslona — zemljevid je
 * bil viden SAMO 109 px (13 %, šele na y=735), seznam destinacij pa 472 px
 * POD pragom; 3 zadnji čipi so bili skriti v drsnem traku brez namiga.
 *
 * Spec §8 (A–F): stisnjena glava (kicker skrit, opis 2 vrstici, statistika
 * ≥sm + kompaktna vrstica pod zemljevidom), enovrstično iskanje+regija,
 * fade afordanca čipov, VZTRAJEN preklop „Zemljevid ⇄ Seznam“ (saasfactor
 * kanon: „list-versus-map toggle should be persistent and easy to switch“),
 * mobilni vrstni red prek fleks kolone (iskanje → čipi → preklop →
 * ZEMLJEVID/SEZNAM → plasti → legenda). Namizje (lg+) NESPREMJENJENO —
 * split view, plasti nad zemljevidom, preklop skrit.
 *
 * Ta datoteka: SOURCE-CONTRACT (vzorec stable-viewport-heights /
 * mobile-overflow — readFileSync + statična preverba izvorne kode;
 * komponente se NE importujejo: 0 omrežja, 0 DOM, 0 AI).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const MAPA = readFileSync(
  join(import.meta.dir, "../src/components/map/travel-map.tsx"),
  "utf8"
);

const STRAN = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/zemljevid/view.tsx"),
  "utf8"
);

const GLAVA = readFileSync(
  join(import.meta.dir, "../src/components/layout/page-header.tsx"),
  "utf8"
);

/** Ta test sama (sledljivost POLIR14 v VSEH 4 datotekah — točka ⑩). */
const TA_TEST = readFileSync(
  join(import.meta.dir, "./map-mobile-first.test.ts"),
  "utf8"
);

/** Izlušči celoten JSX element (od zadnjega <div pred sidrom do prvega
 *  </div> za njim) — sidro je edinstven niz znotraj ciljnega elementa. */
function elementOkoli(sidro: string, oznaka = "<div"): string {
  const sredina = MAPA.indexOf(sidro);
  expect(sredina, `sidro ${sidro} v travel-map.tsx`).toBeGreaterThan(-1);
  const zacetek = MAPA.lastIndexOf(oznaka, sredina);
  expect(zacetek, `odpiralo ${oznaka} pred sidrom`).toBeGreaterThan(-1);
  const konec = MAPA.indexOf("</div>", sredina);
  expect(konec).toBeGreaterThan(-1);
  return MAPA.slice(zacetek, konec);
}

/** Izlušči celoten aside element seznama (odpiralo <aside pred aria-label
 *  listTitle do zaklepajoče oznake). */
function asideSeznama(): string {
  const idx = MAPA.indexOf('aria-label={t("listTitle")}');
  expect(idx, "aside z aria-label listTitle v travel-map.tsx").toBeGreaterThan(
    -1
  );
  const zacetek = MAPA.lastIndexOf("<aside", idx);
  expect(zacetek).toBeGreaterThan(-1);
  const konec = MAPA.indexOf("</aside>", idx);
  expect(konec).toBeGreaterThan(-1);
  return MAPA.slice(zacetek, konec);
}

// ── ① SOURCE-CONTRACT: vztrajna preklopna vrstica „Zemljevid ⇄ Seznam“ ─────

describe("POLIR14 C/D: preklopna vrstica Zemljevid ⇄ Seznam (samo <lg)", () => {
  test("① vrstica obstaja: role=group + aria-label viewToggleLabel + lg:hidden + max-lg:order-3 + oba gumba (mapView/listView)", () => {
    const preklop = elementOkoli('aria-label={t("viewToggleLabel")}');
    expect(preklop).toContain('role="group"');
    expect(preklop).toContain('aria-label={t("viewToggleLabel")}');
    expect(preklop).toContain("max-lg:order-3");
    expect(preklop).toContain("lg:hidden");
    // oba gumba z ikonama, oznakama, aria-pressed in enako višino (h-11 flex-1)
    expect(preklop).toContain('{t("mapView")}');
    expect(preklop).toContain('{t("listView")}');
    expect(preklop).toContain('<MapIcon className="size-4" aria-hidden="true" />');
    expect(preklop).toContain('<List className="size-4" aria-hidden="true" />');
    expect(preklop).toContain('aria-pressed={mobileView === "map"}');
    expect(preklop).toContain('aria-pressed={mobileView === "list"}');
    expect(
      (preklop.match(/className="h-11 flex-1"/g) ?? []).length,
      "oba gumba h-11 flex-1"
    ).toBe(2);
    // i18n ključi v slovarju L10n (vsa 3, 6 jezikov — izrecne besede)
    for (const kljuc of ["mapView", "listView", "viewToggleLabel"]) {
      expect(MAPA).toContain(`${kljuc}: {`);
    }
    expect(MAPA).toContain(
      'viewToggleLabel: { sl: "Preklop pogleda", en: "Switch view", it: "Cambia vista", de: "Ansicht wechseln", fr: "Changer de vue", es: "Cambiar vista" }'
    );
  });
});

// ── ② SOURCE-CONTRACT: privzeto stanje „map“ (zemljevid najprej) ───────────

describe("POLIR14 C: stanje mobileView", () => {
  test("② privzeto stanje: useState<\"map\" | \"list\">(\"map\") — zemljevid je namen strani", () => {
    expect(MAPA).toContain(
      'React.useState<"map" | "list">("map")'
    );
    // lucide ikoni z ALIASOM Map as MapIcon (globalni konstruktor Map ne sme
    // biti senčen — past spec §8-C)
    expect(MAPA).toContain("Map as MapIcon");
    expect(MAPA).toContain("  List,\n");
  });
});

// ── ③ SOURCE-CONTRACT: ovoj zemljevida pogojno skrit na mobilnem ───────────

describe("POLIR14 D: ovoj zemljevida (pogojni max-lg:hidden)", () => {
  test("③ ovoj: premium okvir zemljevida + pogojno skrivanje na mobilnem", () => {
    const ovoj = elementOkoli('aria-label={t("mapLabel")}', "<div");
    expect(ovoj).toContain("overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl shadow-black/10");
    expect(ovoj).toContain('mobileView === "list" && "max-lg:hidden"');
    expect(ovoj).toContain("cn(");
  });
});

// ── ④ SOURCE-CONTRACT: aside seznama pogojno skrit na mobilnem ─────────────

describe("POLIR14 D: aside seznama (pogojni max-lg:hidden)", () => {
  test("④ aside: cn(\"min-w-0\", mobileView === \"map\" && \"max-lg:hidden\"); ul className OSTAJA statičen (zaklep ② stable-viewport)", () => {
    const aside = asideSeznama();
    expect(aside).toContain("cn(");
    expect(aside).toContain('"min-w-0"');
    expect(aside).toContain('mobileView === "map" && "max-lg:hidden"');
    // ul razred (max-h svh veriga POLIR12) ostaja STATIČEN — skrivanje je na
    // STARŠU aside (sicer bi padel zaklep ② stable-viewport-heights)
    expect(aside).toContain(
      'className="scrollbar-slim max-h-[62svh] list-none space-y-1.5 overflow-y-auto pr-1 sm:max-h-[70svh] lg:max-h-[calc(100svh-16rem)]"'
    );
    // MapContainer razred (zaklep ① stable-viewport-heights) ostaja nedotaknjen
    expect(MAPA).toContain(
      'className="h-[62svh] min-h-80 w-full sm:h-[70svh] lg:h-[calc(100svh-15rem)] lg:min-h-[540px]"'
    );
  });
});

// ── ⑤ SOURCE-CONTRACT: invalidateSize ob povratku na „map“ (Leaflet past) ──

describe("POLIR14 C: Leaflet display:none past — invalidateSize", () => {
  test("⑤ useEffect ob povratku na „map“ pokliče mapRef.current?.invalidateSize()", () => {
    expect(MAPA).toContain(
      'if (mobileView === "map") mapRef.current?.invalidateSize();'
    );
    // klic je ZNOTRAJ useEffect z odvisnostjo [mobileView]
    const idx = MAPA.indexOf('if (mobileView === "map") mapRef.current?.invalidateSize();');
    const okno = MAPA.slice(Math.max(0, idx - 300), idx);
    expect(okno).toContain("React.useEffect(() => {");
    expect(MAPA.slice(idx, idx + 200)).toContain("}, [mobileView]);");
  });
});

// ── ⑥ SOURCE-CONTRACT: iskanje + regija v ENI vrstici na mobilnem ──────────

describe("POLIR14 D: nadzorna vrstica (iskanje + regija ena vrstica)", () => {
  test("⑥ iskalna vrstica: premium filter panel ohrani mobilni vrstni red + SelectTrigger h-12 w-36 md:w-56", () => {
    expect(MAPA).toContain(
      'className="mt-4 grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm sm:p-4 md:grid-cols-[1fr_auto_auto] lg:mt-8 max-lg:order-1'
    );
    // ozka sprožilna tipka regije na mobilnem (w-36), md+ nespremenjeno (w-56)
    expect(MAPA).toContain(
      '<SelectTrigger className="h-12 w-36 rounded-xl border-border/70 bg-background shadow-sm md:w-56" aria-label={t("regionFilter")}>'
    );
    // reset gumb (pogojen) na mobilnem čez celo vrstico, md+ en stolpec
    expect(MAPA).toContain('className="h-11 col-span-2 md:col-span-1"');
  });
});

// ── ⑦ SOURCE-CONTRACT: fade afordanca drsnega traku čipov ──────────────────

describe("POLIR14 D: fade afordanca (namig, da se čipi nadaljujejo desno)", () => {
  test("⑦ fade div: from-background + pointer-events-none + lg:hidden v ovoju relative mt-3 max-lg:order-2", () => {
    // ovoj traku s spec §8-D razredi (mt-3 se je preselil s traku na ovoj)
    expect(MAPA).toContain('"relative mt-3 max-lg:order-2"');
    // sam trak ohrani čiste drsne razrede (mt-3 ODSTRANJEN s traku)
    expect(MAPA).toContain(
      'className="scrollbar-slim flex gap-2 overflow-x-auto pb-1"'
    );
    expect(MAPA).not.toContain(
      'className="scrollbar-slim mt-3 flex gap-2 overflow-x-auto pb-1"'
    );
    // fade afordanca: neinteraktivna, samo <lg
    const fade = elementOkoli("from-background");
    expect(fade).toContain("pointer-events-none");
    expect(fade).toContain("from-background");
    expect(fade).toContain("lg:hidden");
    expect(fade).toContain('aria-hidden="true"');
  });
});

// ── ⑧ SOURCE-CONTRACT: mobilni vrstni red (plasti POD zemljevidom) ─────────

describe("POLIR14 D: fleks kolona roota — vrstni red na mobilnem", () => {
  test("⑧ plasti pod zemljevidom: max-lg:order-5 (plasti) + max-lg:order-4 (mreža) + max-lg:flex max-lg:flex-col (root); podniz mreže ⑭ ostaja", () => {
    // root = flex stolpec samo <lg (namizje ostaja bločno po DOM)
    expect(MAPA).toContain(
      '"mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 max-lg:flex max-lg:flex-col"'
    );
    // vrstica plasti (Lokali/Bencinske/POI/Pot) dobi order-5 NA KONCU
    expect(MAPA).toContain(
      '"mt-3 flex flex-wrap items-center gap-2 max-lg:order-5"'
    );
    // mreža zemljevid+seznam dobi order-4 NA KONCU; ZAKLEP reflow-320 ⑭:
    // podniz grid gap-4 lg:grid-cols-[1fr_340px] OSTAJA v razredu
    expect(MAPA).toContain(
      '"mt-5 grid gap-5 lg:grid-cols-[1fr_340px] max-lg:order-4"'
    );
    expect(MAPA).toContain("grid gap-5 lg:grid-cols-[1fr_340px]");
  });
});

// ── ⑨ SOURCE-CONTRACT: statistika (kartice ≥sm, kompaktna vrstica mobilno) ─

describe("POLIR14 B: statistika /zemljevid", () => {
  test("⑨ dl mt-6 hidden grid-cols-3 gap-3 sm:grid + kompaktna vrstica sm:hidden z „·“ POD <TravelMap", () => {
    // 3-stolpčne kartice samo ≥sm (vsebina ostaja v DOM — hidden, ne izpust)
    expect(STRAN).toContain('className="mt-6 hidden grid-cols-3 gap-3 sm:grid"');
    expect(STRAN).not.toContain('className="mt-6 grid grid-cols-3 gap-3"');
    // kompaktna vrstica: ena vrstica, ločilo „·“, samo <sm
    expect(STRAN).toContain(
      'className="mt-6 text-center text-xs text-muted-foreground sm:hidden"'
    );
    const kompaktna = STRAN.match(
      /<p className="mt-6 text-center text-xs text-muted-foreground sm:hidden">[\s\S]*?<\/p>/
    );
    expect(kompaktna, "kompaktna statistična vrstica v view.tsx").not.toBeNull();
    expect((kompaktna![0].match(/ · /g) ?? []).length, "ločili „·“ med 3 vrednostmi").toBe(2);
    expect(kompaktna![0]).toContain("DESTINATIONS.length");
    expect(kompaktna![0]).toContain("AVG_RATING.toFixed(1)");
    // VRSTNI RED: kompaktna vrstica je POD <TravelMap (indeks večji)
    const zemljevidIdx = STRAN.indexOf("<TravelMap");
    const kompaktnaIdx = STRAN.indexOf(
      'className="mt-6 text-center text-xs text-muted-foreground sm:hidden"'
    );
    expect(zemljevidIdx).toBeGreaterThan(-1);
    expect(
      kompaktnaIdx,
      "kompaktna vrstica mora biti ZA <TravelMap v datoteki"
    ).toBeGreaterThan(zemljevidIdx);
    // skelet: POLIR15-d (2.42.0) — strukturno identičen CELOTNEMU TravelMap:
    // vrstica iskanja nosi glavni odmik (mt-4 / lg:mt-8), mreža zemljevida
    // sledi z mt-4 (za preklopnim pasom), mapa+seznam order-4, legenda
    // order-7 → ob naložitvi Leafleta NI vstavljanja kontrolnih vrstic
    // (prej CLS ≈ 0,023; zaklep ⑨ iz POLIR14 posodobljen na novo strukturo).
    expect(STRAN).toContain(
      '"mt-4 grid grid-cols-[1fr_auto] gap-3 md:grid-cols-[1fr_auto_auto] lg:mt-8 max-lg:order-1"'
    );
    expect(STRAN).toContain(
      '"mt-5 grid gap-5 lg:grid-cols-[1fr_340px] max-lg:order-4"'
    );
    expect(STRAN).toContain('className="hidden space-y-2 lg:block"');
  });
});

// ── ⑩ SOURCE-CONTRACT: PageHeader propa + sledljivost POLIR14 ───────────────

describe("POLIR14 A/B: PageHeader propa + sledljivost", () => {
  test("⑩ view.tsx poda kickerClassName/leadClassName, page-header.tsx ima OPCIJSKA propa, POLIR14 v VSEH 4 datotekah", () => {
    // klic v zemljevid/view.tsx (kicker skrit <sm, opis 2 vrstici <sm)
    expect(STRAN).toContain('kickerClassName="hidden sm:block"');
    expect(STRAN).toContain('leadClassName="line-clamp-2 sm:line-clamp-none"');
    // stisnjen zgornji odmik glave strani na mobilnem (pt-6, ≥sm pt-10)
    expect(STRAN).toContain('"mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8"');
    // komponenta: opcijska propa (privzeto nedoločena = 0 sprememb za vse
    // ostale klicatelje), spoj prek cn()
    expect(GLAVA).toContain("kickerClassName?: string");
    expect(GLAVA).toContain("leadClassName?: string");
    expect(GLAVA).toContain("kickerClassName");
    expect(GLAVA).toContain("leadClassName");
    // h1 NEPREMAKNJEN (zaklep reflow-320 ⑯⑰ — besedila se lahko prelomijo)
    expect(GLAVA).toContain(
      "text-3xl font-bold tracking-tight text-balance break-words sm:text-4xl"
    );
    // sledljivost: slovenski komentar POLIR14 v VSEH 4 datotekah
    for (const [ime, src] of [
      ["travel-map.tsx", MAPA],
      ["zemljevid/view.tsx", STRAN],
      ["page-header.tsx", GLAVA],
      ["map-mobile-first.test.ts (ta test)", TA_TEST],
    ] as const) {
      expect(src, ime).toContain("POLIR14");
    }
  });
});
