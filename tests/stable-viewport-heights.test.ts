/**
 * STABLE-VIEWPORT-HEIGHTS (POLIR12, 2.39.0) — vh→svh NA LAYOUT BLOKIH
 * ============================================================================
 * Raziskava 2026-10-12-polir12.md: goli vh je enota VELIKEGA viewporta —
 * meri z naslovno vrstico SKRČENO. Pri VIDNI vrstici (iOS Safari / Chrome
 * Android) sta zemljevid (62 %) in hero destinacije (46 %) zavzemala VEČ
 * kot načrtovani delež VIDNE višine — spodnji rob zemljevida je zašel pod
 * pregubo. Dinamična enota (dvh) je ZAVRNJENA za tokovne bloke: WebKit
 * #266835 — višina se med drsenjem spreminja (jank). svh = delež
 * NAJMANJŠEGA stabilnega viewporta: vedno ≤ načrtovanega deleža vidnega,
 * med drsenjem NEPOSPREMEMENJEN (kanon: Shadeedov hero vzorec, web.dev,
 * lastna shadcn/ui praksa — sidebar.tsx že uporablja h-svh). Podporna
 * okna svh ≡ dvh (Safari 15.4+/Chrome 108+/FF 101+) ⇒ 0 novih tveganj.
 *
 * 4 MESTA (3 datoteke — zemljevid in seznam sta oba v travel-map.tsx):
 *   A. zemljevid — MapContainer h-[62svh]/sm:h-[70svh]/lg: calc 100svh
 *   B. stranski seznam — ul max-h-[62svh]/sm:max-h-[70svh]/lg: calc 100svh
 *   C. nalagalni skelet — Skeleton ZRCALI zemljevid (brez skoka ob
 *      naložitvi Leafleta)
 *   D. hero destinacije — aspect-[21/9] max-h-[46svh]
 * Namizne lg: kalkulacije (prej dinamična enota) so svh — na namizju so
 * VSE enote identične (ni dinamičnega UI ⇒ ničelna vizualna sprememba).
 * MIN-h ščiti (min-h-80, lg:min-h-[540px]) ostajajo. POLIR11 dvh straže
 * na PREKRIVNIH elementih (drawer/dialogi) so PRAVILNE in ostajajo (⑨).
 *
 * Ta datoteka: SOURCE-CONTRACT + DEFENZIVNA statična preverba (vzorec
 * mobile-overflow/deep-states) — komponente se NE importujejo (0 omrežja,
 * 0 DOM, 0 AI).
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

const DESTINACIJA = readFileSync(
  join(import.meta.dir, "../src/components/destination-detail.tsx"),
  "utf8"
);

/** Zaklep POLIR11 regresije — prekrivne straže (dvh) ostajajo nedotaknjene. */
const PREDAL = readFileSync(
  join(import.meta.dir, "../src/components/ui/drawer.tsx"),
  "utf8"
);

const CHECKOUT = readFileSync(
  join(import.meta.dir, "../src/components/marketplace/checkout-modal.tsx"),
  "utf8"
);

const UVOZ = readFileSync(
  join(import.meta.dir, "../src/components/trips/reservation-import-dialog.tsx"),
  "utf8"
);

const REZERVACIJE = readFileSync(
  join(import.meta.dir, "../src/components/trips/trip-reservations.tsx"),
  "utf8"
);

/** Kolikokrat se niz pojavi v izvorni datoteki (preštevanje pojavitev). */
function stetje(src: string, igla: string): number {
  return src.split(igla).length - 1;
}

/** Izlušči className MapContainerja — prvi className="h-[62…" za
 *  odpiralno oznako <MapContainer (drugi className atributi v datoteki
 *  ne začnejo s h-[62, zato izluščevanje ne more zgrešiti mesta). */
function razredZemljevida(): string {
  const zacetek = MAPA.indexOf("<MapContainer");
  expect(zacetek, "travel-map.tsx vsebuje <MapContainer").toBeGreaterThan(-1);
  const m = MAPA.slice(zacetek).match(/className="(h-\[62[^"]*)"/);
  expect(m, "className z začetkom h-[62… znotraj <MapContainer>").not.toBeNull();
  return m![1];
}

/** Izlušči className seznama — edini <ul> z max-h višinsko stražo. */
function razredSeznama(): string {
  const m = MAPA.match(/<ul className="([^"]*max-h-\[[^"]*\])"/);
  expect(m, "ul z max-h višinsko stražo v travel-map.tsx").not.toBeNull();
  return m![1];
}

/** Izlušči className nalagalnega skeleta (višina zemljevida). */
function razredSkeleta(): string {
  const m = STRAN.match(/<Skeleton className="(h-\[62[^"]*)"/);
  expect(m, "Skeleton z višino h-[62… v zemljevid/view.tsx").not.toBeNull();
  return m![1];
}

// ── ① SOURCE-CONTRACT: zemljevid — MapContainer višina v svh enotah ────────

describe("POLIR12 A: zemljevid — višina MapContainerja v svh enotah", () => {
  test("① izluščen MapContainer className: h-[62svh], sm:h-[70svh], lg:h-[calc(100svh-15rem)], min-h-80, lg:min-h-[540px]; brez golih vh]", () => {
    const razred = razredZemljevida();
    expect(razred).toContain("h-[62svh]");
    expect(razred).toContain("sm:h-[70svh]");
    expect(razred).toContain("lg:h-[calc(100svh-15rem)]");
    expect(razred).toContain("min-h-80");
    expect(razred).toContain("lg:min-h-[540px]");
    // goli vh] (brez s/d/l predpone pred vh) v razredu NE sme obstajati —
    // lookbehind: „svh]“ NE zadeti (s pred vh blokera zadetek)
    expect(razred.match(/(?<![sdl])vh\]/g) ?? []).toEqual([]);
    // stara enota velikega viewporta na mestu zemljevida ne sme ostati
    expect(razred).not.toContain("h-[62vh]");
    expect(razred).not.toContain("h-[70vh]");
  });
});

// ── ② SOURCE-CONTRACT: stranski seznam — ul max-h v svh enotah ─────────────

describe("POLIR12 B: stranski seznam — max-h v svh enotah (drsi z zemljevidom)", () => {
  test("② izluščen ul className: max-h-[62svh], sm:max-h-[70svh], lg:max-h-[calc(100svh-16rem)]; ostali razredi nepremaknjeni", () => {
    const razred = razredSeznama();
    expect(razred).toContain("max-h-[62svh]");
    expect(razred).toContain("sm:max-h-[70svh]");
    expect(razred).toContain("lg:max-h-[calc(100svh-16rem)]");
    // razredi vrstice iz §4-B ostajajo (defenzivna dopolnitev, ne preoblikovanje)
    expect(razred).toContain("scrollbar-slim");
    expect(razred).toContain("list-none");
    expect(razred).toContain("space-y-1.5");
    expect(razred).toContain("overflow-y-auto");
    expect(razred).toContain("pr-1");
    // stara enota velikega viewporta na seznamu ne sme ostati
    expect(razred).not.toContain("max-h-[62vh]");
    expect(razred).not.toContain("max-h-[70vh]");
  });
});

// ── ③④ SOURCE-CONTRACT + PARITETA: nalagalni skelet ≡ zemljevid ────────────

describe("POLIR12 C: nalagalni skelet /zemljevid zrceli višino zemljevida", () => {
  test("③ izluščen Skeleton className: h-[62svh], sm:h-[70svh], lg:h-[calc(100svh-15rem)]", () => {
    const razred = razredSkeleta();
    expect(razred).toContain("h-[62svh]");
    expect(razred).toContain("sm:h-[70svh]");
    expect(razred).toContain("lg:h-[calc(100svh-15rem)]");
    expect(razred).toContain("min-h-80");
    expect(razred).toContain("lg:min-h-[540px]");
  });

  test("④ pariteta skelet ≡ zemljevid: višinski razredi so IDENTIČNI (brez skoka ob hidraciji Leafleta)", () => {
    // samo višinski žetoni (h-/min-h- z morebitno sm:/lg: predpono) iz obeh
    // izluščenih razredov — ostalo (w-full, rounded-xl …) je dekoracija
    const visinskiZetoni = (razred: string): string[] =>
      razred
        .split(" ")
        .filter((z) => /^(?:sm:|lg:)?(?:min-)?h-/.test(z))
        .sort();
    const zemljevid = visinskiZetoni(razredZemljevida());
    const skelet = visinskiZetoni(razredSkeleta());
    expect(zemljevid.length, "zemljevid: 5 višinskih razredov").toBe(5);
    expect(skelet.length, "skelet: 5 višinskih razredov").toBe(5);
    expect(skelet).toEqual(zemljevid);
  });
});

// ── ⑤ SOURCE-CONTRACT: hero destinacije — max-h v svh enotah ───────────────

describe("POLIR12 D: hero destinacije — zgornja meja v svh enotah", () => {
  test("⑤ destination-detail vsebuje max-h-[46svh] in NE max-h-[46vh] (cap pri vidni naslovni vrstici)", () => {
    expect(DESTINACIJA).toContain("max-h-[46svh]");
    expect(DESTINACIJA).not.toContain("max-h-[46vh]");
    // identiteta bloka ostaja (aspect 21/9, polnilo, obrez) — samo enota se
    // je zamenjala
    expect(DESTINACIJA).toContain('className="relative aspect-[21/9] max-h-[46svh] w-full overflow-hidden bg-muted"');
  });
});

// ── ⑥⑦⑧⑨ DEFENZIVNE STRAŽE: goli vh, lg: konsistenca, sledljivost, POLIR11 ─

describe("POLIR12: defenzivne straže (goli vh, lg: svh, sledljivost, POLIR11 regresija)", () => {
  test("⑥ DEFENZIVNO: goli vh (števka + vh brez s/d/l predpone) po VSEH ciljnih mestih = 0 zadetkov", () => {
    // regex zahteva števke TAKOJ pred vh — „62svh“ NE more zadeti (med
    // števkami in vh je s), prav tako dinamična/logična enota; lookbehind
    // po specifikaciji §4-E ⑥
    const goliVh = /(?<![sdl])\d+(?:\.\d+)?vh/g;
    for (const [ime, src] of [
      ["travel-map.tsx (zemljevid + seznam)", MAPA],
      ["zemljevid/view.tsx (skelet)", STRAN],
      ["destination-detail.tsx (hero)", DESTINACIJA],
    ] as const) {
      expect(src.match(goliVh) ?? [], ime).toEqual([]);
    }
  });

  test("⑦ zaklep lg: konsistenca — v travel-map.tsx + zemljevid/view.tsx NI več podniza „dvh“ (vse tri lg: kalkulacije so svh)", () => {
    expect(MAPA).not.toContain("dvh");
    expect(STRAN).not.toContain("dvh");
    // pozitivni dokaz: vse tri lg: kalkulacije (zemljevid, seznam, skelet)
    // so na svh
    expect(MAPA).toContain("lg:h-[calc(100svh-15rem)]");
    expect(MAPA).toContain("lg:max-h-[calc(100svh-16rem)]");
    expect(STRAN).toContain("lg:h-[calc(100svh-15rem)]");
  });

  test("⑧ sledljivost: komentar POLIR12 na vseh 4 mestih (zemljevid + seznam sta oba v travel-map.tsx)", () => {
    for (const [ime, src] of [
      ["travel-map.tsx", MAPA],
      ["zemljevid/view.tsx", STRAN],
      ["destination-detail.tsx", DESTINACIJA],
    ] as const) {
      expect(src, ime).toContain("POLIR12");
    }
    // 4. mesto: seznam je druga sprememba v isti datoteki — komentar mora
    // biti tudi pri njem (2 pojavitvi POLIR12 v travel-map.tsx)
    expect(stetje(MAPA, "POLIR12")).toBeGreaterThanOrEqual(2);
  });

  test("⑨ regresijski zaklep POLIR11: prekrivne straže ŠE VSEBUJEJO dvh (drawer ≥ 4 zadetki)", () => {
    // POLIR11 dvh na PREKRIVNIH elementih (drawer/dialogi) je PRAVILEN —
    // tam se element prilagodi razpoložljivemu viewportu; POLIR12 se ga
    // NE sme dotakniti (kanon §3 raziskave)
    for (const [ime, src] of [
      ["ui/drawer.tsx", PREDAL],
      ["checkout-modal.tsx", CHECKOUT],
      ["reservation-import-dialog.tsx", UVOZ],
      ["trip-reservations.tsx", REZERVACIJE],
    ] as const) {
      expect(src, ime).toContain("dvh");
    }
    // konkretne straže ostajajo: drawer (2 razreda + komentar), checkout,
    // uvoz, 3 rezervacijski dialogi
    expect(stetje(PREDAL, "dvh")).toBeGreaterThanOrEqual(4);
    expect(PREDAL).toContain("max-h-[80dvh]");
    expect(CHECKOUT).toContain("max-h-[85dvh]");
    expect(UVOZ).toContain("max-h-[85dvh]");
    expect(stetje(REZERVACIJE, "max-h-[90dvh]")).toBe(3);
  });
});
