/**
 * DEEP-STATES-OVERFLOW (POLIR11, 2.38.0) — GLOBJA STANJA: PRELIV NOWRAP
 * GUMBOV + NAVPIČNE STRAŽE DIALOGOV + vh→dvh MODERNIZACIJA
 * ============================================================================
 * Empirična revizija globjih stanj (matrika 6 jezikov × {320, 360, 390} —
 * research-2026-10-12-polir11.md) je odkrila tri vrzeli, ki so preživele
 * POLIR7/8, ker te poti NISO bile v kanonu reviziranih poti:
 *
 *  A. HORIZONTALNI PRELIV — dolgi prevodi nowrap gumbov na globjih poteh:
 *     - /prijava „Portal za lastnike" (fr 68 px @320) — osnovni Button ima
 *       whitespace-nowrap, fr/it/de/es prevodi ne morejo prelomiti vrstice;
 *       poleg tega osnova button.tsx nosi TUDI shrink-0 — v fleksibilni
 *       vrstici (flex justify-between) se preklop whitespace-normal sam po
 *       sebi NE izvede (gumb ostane max-content) → kanon POLIR8: `shrink`
 *       preglasi osnovni shrink-0 (dokazano živo: inline flexShrink=1 →
 *       68 px → 0 px @fr320);
 *     - /owner/prijava „Prijavnica za ponudnike" (es 70 px @320) — gumb v
 *       BLOČNEM vsebniku: fit-content sam ovije besedilo, shrink ni potreben;
 *     - /pot/[shareId] „Dodaj celo pot v mojo pot" (de 64 px @320, ×2 —
 *       oblak + lokalno) — flex-wrap vrstica, enak shrink kanon.
 *     Rešitev = POLIR7 kanon: `whitespace-normal text-left` (tailwind-merge
 *     prek cn() ZANESLJIVO preglasi nowrap osnovo) + `shrink` kjer je gumb
 *     v fleksibilni vrstici (POLIR8 kanon).
 *
 *  B. NAVPIČNA ODREZANOST — trije DialogContent BREZ max-h straže (drugi v
 *     isti datoteki jo imajo — nekonzistentno): zaključek nakupa
 *     (checkout-modal ~255; 22 px rezerve @320×568), potrditev rezervacije
 *     (trip-reservations ~1977; TOČNO 100 % uporabne višine — 0 rezerve) in
 *     demo urejanje (~2607). Daljša vsebina (atestacije, de besede, napake
 *     omrežja) odreže dno BREZ drsenja — vzorec github.com/shadcn-ui/ui
 *     issue #16 (sprejeta rešitev = max-h + overflow-y-auto na vsebini).
 *     DOPOLNILO ORKESTRATORJA (enak razred, živa matrika podagenta): nowrap
 *     potrditvena gumba obeh modala (fr „Enregistrer comme confirmée"
 *     min-content 251 px > 238 px okvirja @320 — 13 px horizontalne steze
 *     ZNOTRAJ modala, vidna šele od overflow-y-auto) — isti POLIR7 kanon.
 *
 *  C. vh → dvh — 100vh na mobilnem vključuje površino pod naslovno vrstico
 *     brskalnika → dno „max-h-[NNvh]" overlayjev je lahko ZA vrstico. dvh
 *     (Safari 15.4+/Chrome 108+/FF 101+) je pravilen na mobilnem in enak vh
 *     na namizju (0 vizualne spremembe). 6 mest: mobile-tab-bar, ui/drawer
 *     (×2), reservation-import-dialog, trip-reservations, admin, partner.
 *
 *  IZVEN OBSEGA (namerno, zaklep spodaj): zemljevidi h-[62vh]/h-[70vh]
 *  (travel-map, zemljevid/view) in hero max-h-[46vh] (destination-detail) —
 *  LAYOUT bloki, ne overlay; POLIR12 kandidat, ločena revizija.
 *
 *  Ta datoteka: SOURCE-CONTRACT + DEFENZIVNA statična preverba (vzorec
 *  mobile-overflow.test.ts) — UI komponente se NE importujejo (0 omrežja,
 *  0 DOM, 0 AI), ista dvojna plast kot shared-measured.test.ts.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const PRIJAVA = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/prijava/view.tsx"),
  "utf8"
);

const OWNER = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/owner/prijava/view.tsx"),
  "utf8"
);

const SHARED = readFileSync(
  join(import.meta.dir, "../src/components/content/shared-trip-view.tsx"),
  "utf8"
);

const CHECKOUT = readFileSync(
  join(import.meta.dir, "../src/components/marketplace/checkout-modal.tsx"),
  "utf8"
);

const REZERVACIJE = readFileSync(
  join(import.meta.dir, "../src/components/trips/trip-reservations.tsx"),
  "utf8"
);

const TAB_VRSTICA = readFileSync(
  join(import.meta.dir, "../src/components/layout/mobile-tab-bar.tsx"),
  "utf8"
);

const PREDAL = readFileSync(
  join(import.meta.dir, "../src/components/ui/drawer.tsx"),
  "utf8"
);

const UVOZ = readFileSync(
  join(import.meta.dir, "../src/components/trips/reservation-import-dialog.tsx"),
  "utf8"
);

const ADMIN = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/admin/view.tsx"),
  "utf8"
);

const PARTNER = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/partner/view.tsx"),
  "utf8"
);

/** Zaklep izven-obsega: LAYOUT bloki (zemljevid/hero) morajo ostati vh. */
const ZEMLJEVID_MAPA = readFileSync(
  join(import.meta.dir, "../src/components/map/travel-map.tsx"),
  "utf8"
);

const ZEMLJEVID_STRAN = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/zemljevid/view.tsx"),
  "utf8"
);

const DESTINACIJA = readFileSync(
  join(import.meta.dir, "../src/components/destination-detail.tsx"),
  "utf8"
);

/** Overlay nabor (samo dvh dovoljen) z pričakovanim številom dvh straž. */
const OVERLAY: Array<[ime: string, src: string, dvh: number]> = [
  ["mobile-tab-bar.tsx", TAB_VRSTICA, 1],
  ["ui/drawer.tsx", PREDAL, 2],
  ["reservation-import-dialog.tsx", UVOZ, 1],
  ["trip-reservations.tsx", REZERVACIJE, 3],
  ["checkout-modal.tsx", CHECKOUT, 1],
  ["admin/view.tsx", ADMIN, 1],
  ["partner/view.tsx", PARTNER, 1],
];

/** Kolikokrat se niz pojavi v izvorni datoteki (preštevanje pojavitev). */
function stetje(src: string, igla: string): number {
  return src.split(igla).length - 1;
}

/** Izlušči odpiralno oznako <Button …>, ki neposredno obdaja vsebino
 *  `vsebina` (iskanje nazaj do zadnjega „<Button“) — kontekst gumba brez
 *  občutljivosti na formatiranje ( prelomi vrstic, vrstni red atributov ). */
function gumbPred(src: string, vsebina: string): string {
  const konec = src.indexOf(vsebina);
  expect(konec, `vsebina ${vsebina}`).toBeGreaterThan(-1);
  const zacetek = src.lastIndexOf("<Button", konec);
  expect(zacetek).toBeGreaterThan(-1);
  return src.slice(zacetek, konec);
}

// ── ① SOURCE-CONTRACT: prijava/view.tsx — „Portal za lastnike" ─────────────

describe("POLIR11 A: prijava — gumb „Portal za lastnike“ se ovije (fr 68 px @320)", () => {
  test("① odpiralna oznaka gumba (providersCta) vsebuje min-h-11 font-semibold whitespace-normal text-left shrink", () => {
    const gumb = gumbPred(PRIJAVA, '{pick(l, L.providersCta)}');
    expect(gumb).toContain('className="min-h-11 font-semibold whitespace-normal text-left shrink"');
    // natanko ENA sprememba v datoteki (in to z zaključnim narekovajem —
    // komentar sledljivosti se ne šteje); shrink je OBVEZEN ker osnova
    // button.tsx nosi shrink-0 (kanon POLIR8) — brez njega živa matrika
    // ostane 68 px @fr320 (gumb v flex justify-between vrstici)
    expect(stetje(PRIJAVA, 'whitespace-normal text-left shrink"')).toBe(1);
  });

  test("② na gumbu providersCta ni shrink-0 (osnovni shrink-0 Buttona je preglasen s shrink)", () => {
    const gumb = gumbPred(PRIJAVA, '{pick(l, L.providersCta)}');
    expect(gumb).not.toContain("shrink-0");
    expect(gumb).toContain("shrink");
    // stara, prelivajoča oblika razreda ne sme več obstajati NIKOLER
    // (demo gumb „Izpuni demo“ z ikono ima DRUG razred min-h-11 shrink-0
    // gap-1.5 — kratka oznaka, ni predmet preliva, sme ostati)
    expect(PRIJAVA.includes("min-h-11 shrink-0 font-semibold")).toBe(false);
  });
});

// ── ② SOURCE-CONTRACT: owner/prijava/view.tsx — „Prijavnica za ponudnike" ──

describe("POLIR11 A: owner/prijava — gumb „Prijavnica za ponudnike“ se ovije (es 70 px @320)", () => {
  test("③ gumb (providersCta) vsebuje mt-4 font-semibold whitespace-normal text-left", () => {
    const gumb = gumbPred(OWNER, '{pick(l, L.providersCta)}');
    expect(gumb).toContain('className="mt-4 font-semibold whitespace-normal text-left"');
    // stara, nedeljiva oblika ne sme več obstajati
    expect(OWNER.includes('className="mt-4 font-semibold">')).toBe(false);
    expect(stetje(OWNER, 'whitespace-normal text-left"')).toBe(1);
  });
});

// ── ③ SOURCE-CONTRACT: shared-trip-view.tsx — OBE addAll gumba ──────────────

describe("POLIR11 A: deljena pot — OBE „Dodaj celo pot v mojo pot“ se ovijeta (de 64 px @320)", () => {
  test("④ natančno 2× tap-target font-semibold whitespace-normal text-left shrink (oblak ~739 + lokalno ~1049)", () => {
    expect(
      stetje(SHARED, 'className="tap-target font-semibold whitespace-normal text-left shrink"')
    ).toBe(2);
    // natanko ta dva gumba v datoteki nosita prelom vrstice (z zaključnim
    // narekovajem, da se komentar sledljivosti ne šteje)
    expect(stetje(SHARED, 'whitespace-normal text-left shrink"')).toBe(2);
  });

  test("⑤ oba prelomljena gumba sta res onAddAll (plan + localPlan); sosednji gumbi ostajajo na nowrap osnovi", () => {
    // identiteta: natanko ta dva gumba (zavihek oblak + lokalna različica),
    // ne kateri drug — className sledi onClick v isti odpiralni oznaki
    expect(
      SHARED.includes(
        '<Button onClick={() => onAddAll(plan)} className="tap-target font-semibold whitespace-normal text-left shrink">'
      )
    ).toBe(true);
    expect(
      SHARED.includes(
        '<Button onClick={() => onAddAll(localPlan)} className="tap-target font-semibold whitespace-normal text-left shrink">'
      )
    ).toBe(true);
    // sosednji gumbi (tiskaj/PDF/ICS/kopiraj/povezave) ostajajo na nowrap
    // osnovi — njihovi razredi se končajo z gotočim narekovajem BREZ preloma
    // (9 golih tap-target font-semibold": 7 enovrstičnih + 2 večvrstična
    // PDF gumba; kanon: nowrap za KRATKE oznake, mobile-overflow ⑲)
    expect(stetje(SHARED, 'tap-target font-semibold"')).toBe(9);
  });
});

// ── ④ SOURCE-CONTRACT: navpične straže dialogov (shadcn-ui/ui #16) ─────────

describe("POLIR11 B: navpična straža dialogov — max-h + overflow-y-auto", () => {
  test("⑥ checkout-modal: zaključek nakupa nosi max-h-[85dvh] overflow-y-auto (ne več goli sm:max-w-md)", () => {
    expect(
      stetje(CHECKOUT, 'className="max-h-[85dvh] overflow-y-auto sm:max-w-md"')
    ).toBe(1);
    // stara, nestražena oblika (22 px rezerve @320×568) ne sme več obstajati
    expect(CHECKOUT.includes('className="sm:max-w-md">')).toBe(false);
  });

  test("⑦ trip-reservations: 2× max-h-[90dvh] …sm:max-w-md (potrditev ~1977 + demo urejanje ~2607) + 1× …sm:max-w-lg (iskanje ~2075)", () => {
    expect(stetje(REZERVACIJE, "max-h-[90dvh] overflow-y-auto sm:max-w-md")).toBe(2);
    expect(stetje(REZERVACIJE, "max-h-[90dvh] overflow-y-auto sm:max-w-lg")).toBe(1);
    // stara vh oblika iskanja ne sme več obstajati
    expect(REZERVACIJE.includes("max-h-[90vh]")).toBe(false);
  });

  test("⑦b DOPOLNILO: potrditvena gumba obeh modala (submitConfirmation + submitDemoModify) se ovijeta (fr 13 px steza @320)", () => {
    // fr „Enregistrer comme confirmée“ nosi min-content 251 px > 238 px
    // vsebinskega okvirja @320×568 — od max-h/overflow-y-auto (⑦) je dialog
    // drsen vsebnik, zato je steza postala merljiva; isti POLIR7 kanon
    // prelomi vrstico in stezo zapre (orkestratorjevo dopolnilo 22-a).
    // Oznaka gumba: onClick je pred className → rez od klica NAPREJ do „>“
    const potrdiAt = REZERVACIJE.indexOf("void submitConfirmation()");
    expect(potrdiAt).toBeGreaterThan(-1);
    expect(REZERVACIJE.slice(potrdiAt, REZERVACIJE.indexOf(">", potrdiAt))).toContain(
      'className="gap-1.5 whitespace-normal text-left"'
    );
    const demoAt = REZERVACIJE.indexOf("void submitDemoModify()");
    expect(demoAt).toBeGreaterThan(-1);
    expect(REZERVACIJE.slice(demoAt, REZERVACIJE.indexOf(">", demoAt))).toContain(
      'className="gap-1.5 whitespace-normal text-left"'
    );
    // natanko 2 pojavitvi (oba modala), drugi gap-1.5 gumbi ostanejo na osnovi
    expect(stetje(REZERVACIJE, 'className="gap-1.5 whitespace-normal text-left"')).toBe(2);
  });
});

// ── ⑤ SOURCE-CONTRACT + DEFENZIVNO: vh → dvh modernizacija (6 mest) ────────

describe("POLIR11 C: vh → dvh modernizacija overlay straž", () => {
  test("⑧ mobile-tab-bar: list „Več“ nosi max-h-[75dvh] (ne več 75vh)", () => {
    expect(TAB_VRSTICA).toContain("max-h-[75dvh]");
    expect(TAB_VRSTICA).not.toContain("max-h-[75vh]");
  });

  test("⑨ ui/drawer: natančno 2× max-h-[80dvh] (smeri top + bottom)", () => {
    expect(stetje(PREDAL, "max-h-[80dvh]")).toBe(2);
    expect(PREDAL).not.toContain("max-h-[80vh]");
  });

  test("⑩ reservation-import-dialog: uvoz nosi max-h-[85dvh] (ne več 85vh)", () => {
    expect(UVOZ).toContain("max-h-[85dvh]");
    expect(UVOZ).not.toContain("max-h-[85vh]");
  });

  test("⑪ DEFENZIVNO: v CELEM overlay naboru ni več max-h-[NNvh] — vh bi segal pod mobilno vrstico brskalnika", () => {
    for (const [ime, src] of OVERLAY) {
      // regex zahteva zaporedje „max-h-[<števke>vh]“ — max-h-[90dvh] NE
      // ustreza (d ni števka), zato je preverba čista
      expect(src.match(/max-h-\[\d+vh\]/g) ?? [], ime).toEqual([]);
    }
  });

  test("⑫ DEFENZIVNO: max-h dvh števci so NATANKO (tab 1, drawer 2, uvoz 1, rezervacije 3, checkout 1, admin 1, partner 1)", () => {
    for (const [ime, src, dvh] of OVERLAY) {
      expect(src.match(/max-h-\[\d+dvh\]/g)?.length ?? 0, ime).toBe(dvh);
    }
  });
});

// ── ⑥ ZAKLEP IZVEN OBSEGA: layout bloki ostajajo vh (POLIR12 kandidat) ──────

describe("POLIR11: zaklep izven-obsega — zemljevid/hero LAYOUT bloki so NEDOTAKNJENI", () => {
  test("⑬ travel-map + zemljevid/view še vedno vsebujeta h-[62vh] in h-[70vh] (layout, ne overlay)", () => {
    expect(ZEMLJEVID_MAPA).toContain("h-[62vh]");
    expect(ZEMLJEVID_MAPA).toContain("h-[70vh]");
    expect(ZEMLJEVID_STRAN).toContain("h-[62vh]");
    expect(ZEMLJEVID_STRAN).toContain("h-[70vh]");
  });

  test("⑭ destination-detail hero ohranja max-h-[46vh] (aspect 21/9 layout)", () => {
    expect(DESTINACIJA).toContain("max-h-[46vh]");
  });
});

// ── ⑦ SLEDLJIVOST: slovenski komentar POLIR11 v vseh 9 popravljenih ────────

describe("POLIR11: sledljivost spremembe", () => {
  test("⑮ komentar POLIR11 je prisoten v vseh 9 popravljenih datotekah (kanon POLIR7–10)", () => {
    for (const [ime, src] of [
      ["prijava/view.tsx", PRIJAVA],
      ["owner/prijava/view.tsx", OWNER],
      ["shared-trip-view.tsx", SHARED],
      ["checkout-modal.tsx", CHECKOUT],
      ["trip-reservations.tsx", REZERVACIJE],
      ["mobile-tab-bar.tsx", TAB_VRSTICA],
      ["ui/drawer.tsx", PREDAL],
      ["reservation-import-dialog.tsx", UVOZ],
      ["admin/view.tsx", ADMIN],
      ["partner/view.tsx", PARTNER],
    ] as const) {
      expect(src, ime).toContain("POLIR11");
    }
  });
});
