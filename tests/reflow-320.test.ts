/**
 * REFLOW @320 (POLIR8 A, 2.35.0) — WCAG 1.4.10 REFLOW + STRAN DESTINACIJE
 * ============================================================================
 * Produkcija 2.34.0 je (izmerjeno, scrollWidth − clientWidth) prelivala:
 * @390 px /destinacija/[slug] 161 px — rezervacijska vrstica
 *   „flex shrink-0 …" + nowrap gumb „Leti do Letališče Jožeta Pučnika
 *   Ljubljane (SBNZ)" (510 px; shrink-0 je preprečeval skrčenje vrstice).
 * @360 px /zemljevid FR/IT/ES 3–4 px — <aside> je PREDMET mreže
 *   grid lg:grid-cols-[1fr_340px] z min-width:auto (živi dokaz iz raziskave:
 *   aside.style.minWidth = '0' takoj 4 → 0 px).
 * @320 px (WCAG 1.4.10): noga DE 14 px (enojne nemške sestavljenke
 *   „Nutzungsbedingungen" 158 px / „Datenschutzerklärung" 155 px v stolpcu
 *   128 px — na VSEH straneh v DE), partner CTA domov 9–29 px („Odpri pri
 *   Viator (Tripadvisor)" min-vsebina 275 px → kartica 313 px > 288 px),
 *   vzorčni načrti FR 138 px („Plan type : Un week-end paisible au bord de
 *   la rivière" 423 px), gost gumb FR ~350 px, NextStepCard FR 16 px
 *   („Parcourir les destinations" 251 px), H1 DE 57–64 px
 *   („Nutzungsbedingungen" 368 px, text-3xl bold).
 *
 * Popravki po POLIR7 kanonih: min-w-0 na predmetih mreže (defensivecss
 * „Minimum Content Size In CSS grid"), whitespace-normal h-auto prek
 * cn()/tailwind-merge (PREGLASI nowrap/h-8 osnovo Button; min-h-* ohrani
 * minimalno višino), break-words za nedeljive sestavljenke (aktivira se
 * SAMO ob prekoračitvi). Noga: EMPIRIČNO dokazano, da break-words na
 * inline-flex NE prelomi besede (anonymous flex item min-width:auto =
 * min-content, break-word ne vpliva na min-content) — zato inline-block +
 * max-w-full + break-words (besedilo živi v vrsticah BFC).
 *
 * Ta datoteka: SOURCE-CONTRACT vseh 7 točk + izvedena točka 8 (vir-podatkov,
 * min-w-0 na karticah virov — nowrap URL 263 px je naredila kartico 305 px
 * v 288 px tracku) + defenzivni zaklepi (PageHeader ohranja text-balance;
 * zaklep osnove button.tsx ŽE obstaja v tests/mobile-overflow.test.ts — tu
 * preverimo samo obstoj, NE podvajamo).
 * UI komponente se NE importajo (0 omrežja, 0 DOM, 0 AI) — ista dvojna
 * plast kot mobile-overflow.test.ts.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const DESTINATION = readFileSync(
  join(import.meta.dir, "../src/components/destination-detail.tsx"),
  "utf8"
);

const HOME = readFileSync(
  join(import.meta.dir, "../src/components/home/home-view.tsx"),
  "utf8"
);

const NEXT_STEP = readFileSync(
  join(import.meta.dir, "../src/components/next-step-card.tsx"),
  "utf8"
);

const MOJA_POTOVANJA = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/moja-potovanja/view.tsx"),
  "utf8"
);

const FOOTER = readFileSync(
  join(import.meta.dir, "../src/components/layout/footer.tsx"),
  "utf8"
);

const MAP = readFileSync(
  join(import.meta.dir, "../src/components/map/travel-map.tsx"),
  "utf8"
);

const PAGE_HEADER = readFileSync(
  join(import.meta.dir, "../src/components/layout/page-header.tsx"),
  "utf8"
);

const VIR_PODATKOV = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/vir-podatkov/view.tsx"),
  "utf8"
);

/** Zaklep osnove button.tsx ŽE obstaja v mobile-overflow.test.ts (POLIR7) —
 *  tukaj samo potrdimo, da ta datoteka še vedno obstaja in zaklep drži
 *  (preverimo obstoj, NE podvajamo testov). */
const MOBILE_OVERFLOW_TEST = readFileSync(
  join(import.meta.dir, "./mobile-overflow.test.ts"),
  "utf8"
);

/** Kolikokrat se niz pojavi v izvorni datoteki (preštevanje pojavitev). */
function stetje(src: string, igla: string): number {
  return src.split(igla).length - 1;
}

// ── ① SOURCE-CONTRACT: destination-detail.tsx — rezervacijska vrstica ──────

describe("POLIR8 A: rezervacijska vrstica destinacije (ŽIVA napaka 161 px @390)", () => {
  test("① stara oblika flex shrink-0 flex-wrap items-center gap-x-2 ne sme več obstajati (v celotni datoteki)", () => {
    // shrink-0 je preprečeval skrčenje vrstice — nowrap gumb „Leti do …"
    // (510 px) je raznesel stran pri 390 px (161 px preliva).
    expect(
      stetje(DESTINATION, "flex shrink-0 flex-wrap items-center gap-x-2")
    ).toBe(0);
    // defenzivno: v datoteki ni več NOBENE vrstice „flex shrink-0"
    // (preostali shrink-0 so ikone size-5, ki se ne skrčijo — pravilno).
    expect(stetje(DESTINATION, "flex shrink-0")).toBe(0);
  });

  test("② nova oblika vsebuje flex min-w-0 flex-wrap (vrstica se lahko skrči, gumb+čip se ovijeta)", () => {
    expect(
      DESTINATION.includes(
        '<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">'
      )
    ).toBe(true);
  });

  test("③ rezervacijski gumb vsebuje whitespace-normal h-auto min-h-8 shrink (nowrap/h-8/shrink-0 osnova preglasena prek cn)", () => {
    expect(
      DESTINATION.includes(
        'className="font-semibold whitespace-normal h-auto min-h-8 shrink"'
      )
    ).toBe(true);
  });

  test("④ rezervacijski gumb nedotaknjen po vsebini: vodeni klik /api/affiliate/go + rel=sponsored", () => {
    expect(
      DESTINATION.includes(
        "href={`/api/affiliate/go?provider=${row.id}&dest=${d.slug}`}"
      )
    ).toBe(true);
    expect(DESTINATION.includes('rel="nofollow sponsored noopener"')).toBe(
      true
    );
  });
});

// ── ② SOURCE-CONTRACT: home-view.tsx — partner CTA gumb (commissionable) ────

describe("POLIR8 A: partner CTA gumb na domači strani (kartica 313 px > 288 px @320)", () => {
  test("⑤ commissionable CTA vsebuje whitespace-normal h-auto min-h-8 (v kontekstu w-full font-semibold tap-target)", () => {
    expect(
      HOME.includes(
        'className="mt-4 w-full whitespace-normal h-auto min-h-8 font-semibold tap-target"'
      )
    ).toBe(true);
  });

  test("⑥ map CTA (Poglej na zemljevidu, kratek) ostaja v stari obliki — samo commissionable veja je spremenjena", () => {
    expect(
      stetje(HOME, 'className="mt-4 w-full font-semibold tap-target"')
    ).toBe(1);
  });
});

// ── ③ SOURCE-CONTRACT: next-step-card.tsx — CTA gumb ────────────────────────

describe("POLIR8 A: NextStepCard CTA (FR „Parcourir les destinations“ 16 px preliva)", () => {
  test("⑦ Button vsebuje whitespace-normal h-auto (min-h-11 ohranja minimalno višino)", () => {
    expect(
      NEXT_STEP.includes(
        'className="min-h-11 h-auto whitespace-normal font-semibold"'
      )
    ).toBe(true);
    // stara, nowrap oblika ne sme več obstajati
    expect(
      NEXT_STEP.includes('className="min-h-11 font-semibold"')
    ).toBe(false);
  });
});

// ── ④ SOURCE-CONTRACT: moja-potovanja/view.tsx — vzorčni načrti + gost ───────

describe("POLIR8 A: vzorčni načrti + gost gumb (FR 138 px / 11 px preliva @320)", () => {
  test("⑧ vzorčni načrti Button vsebuje whitespace-normal h-auto shrink (FR oznaka 423 px)", () => {
    expect(
      MOJA_POTOVANJA.includes(
        'className="min-h-11 h-auto whitespace-normal shrink"'
      )
    ).toBe(true);
  });

  test("⑨ gost gumb (Prijavi se za poti v oblaku) vsebuje whitespace-normal h-auto (FR ~350 px)", () => {
    expect(
      MOJA_POTOVANJA.includes(
        'className="mt-3 min-h-11 h-auto whitespace-normal gap-1.5 font-semibold"'
      )
    ).toBe(true);
    expect(
      MOJA_POTOVANJA.includes(
        'className="mt-3 min-h-11 gap-1.5 font-semibold"'
      )
    ).toBe(false);
  });

  test("⑩ vzorčni gumbi ostajajo v flex-wrap vrstici (ovijanje cele vrstice, POLIR7 kanon)", () => {
    expect(
      MOJA_POTOVANJA.includes(
        'className="mt-3 flex flex-wrap items-center justify-center gap-2"'
      )
    ).toBe(true);
  });
});

// ── ⑤ SOURCE-CONTRACT: footer.tsx — povezave z nemškimi sestavljenkami ──────

describe("POLIR8 A: povezave noge (DE 14 px preliva na VSEH straneh @320)", () => {
  test("⑪ Link vsebuje break-words + max-w-full + inline-block (empirično: break-words SAMO na inline-flex NE prelomi besede)", () => {
    expect(
      FOOTER.includes(
        'className="inline-block max-w-full min-h-6 text-sm break-words text-muted-foreground transition-colors hover:text-primary"'
      )
    ).toBe(true);
  });

  test("⑫ stara oblika (inline-flex brez max-w-full/break-words) ne sme več obstajati", () => {
    expect(
      FOOTER.includes(
        'className="inline-flex min-h-6 items-center text-sm text-muted-foreground transition-colors hover:text-primary"'
      )
    ).toBe(false);
  });
});

// ── ⑥ SOURCE-CONTRACT: travel-map.tsx — aside kot predmet mreže ─────────────

describe("POLIR8 A: stranski seznam zemljevida (FR/IT/ES 3–4 px @360, do 44 px @320)", () => {
  test("⑬ aside vsebuje min-w-0 (živi dokaz iz raziskave: minWidth 0 → preliv 4 → 0 px)", () => {
    // POLIR14 (2.41.0): aside je dobil pogojni max-lg:hidden (mobilni
    // preklop „Zemljevid ⇄ Seznam“ — skrivanje na STARŠU, ul razred ostaja
    // statičen); min-w-0 zaklep POLIR8 ostaja v novi cn() obliki.
    expect(
      MAP.includes(
        '<aside\n          aria-label={t("listTitle")}\n          className={cn("min-w-0", mobileView === "map" && "max-lg:hidden")}\n        >'
      )
    ).toBe(true);
  });

  test("⑭ mreža ostaja mreža grid gap-4 lg:grid-cols-[1fr_340px] (min-w-0 na PREDMETU, ne na mreži — defensivecss kanon)", () => {
    expect(MAP.includes("grid gap-4 lg:grid-cols-[1fr_340px]")).toBe(true);
  });

  test("⑮ truncate veriga v seznamu ostaja (li > button > span.min-w-0 > span.truncate prevzame delo)", () => {
    expect(MAP.includes("block truncate")).toBe(true);
  });
});

// ── ⑦ SOURCE-CONTRACT: page-header.tsx — H1 z dolgimi naslovi ───────────────

describe("POLIR8 A: H1 PageHeader (DE 57–64 px preliva @320, VSI klicatelji)", () => {
  test("⑯ h1 vsebuje break-words (dolge enobesedne nemške sestavljenke se prelomijo)", () => {
    expect(
      PAGE_HEADER.includes(
        "text-3xl font-bold tracking-tight text-balance break-words sm:text-4xl"
      )
    ).toBe(true);
  });

  test("⑰ h1 še vedno vsebuje text-balance (obstoječi razredi se NE odstranjujejo)", () => {
    expect(PAGE_HEADER.includes("text-balance")).toBe(true);
    expect(PAGE_HEADER.includes("text-3xl")).toBe(true);
    expect(PAGE_HEADER.includes("sm:text-4xl")).toBe(true);
  });
});

// ── ⑧ TOČKA 8 (OPCIJSKA, izvedena): vir-podatkov/view.tsx — kartice virov ───

describe("POLIR8 A: kartice virov na /vir-podatkov (1 px sub-pixel preliva @320, SL)", () => {
  test("⑱ kartica vira (predmet mreže grid gap-4 sm:grid-cols-2) vsebuje min-w-0", () => {
    // Vzrok (empirično, @320): min-content kartice = nowrap URL povezava
    // (inline-flex, atomarna, 263 px) → kartica 305 px > 288 px tracka →
    // 1 px sub-pixel preliva; minWidth 0 (živi dokaz) → 1 → 0 px.
    expect(VIR_PODATKOV.includes('<Card key={s.name} className="min-w-0">')).toBe(
      true
    );
    expect(
      VIR_PODATKOV.includes("<Card key={s.name}>")
    ).toBe(false);
  });

  test("⑲ mreža virov ostaja grid gap-4 sm:grid-cols-2 (min-w-0 na PREDMETU — defensivecss kanon)", () => {
    expect(VIR_PODATKOV.includes('className="mt-4 grid gap-4 sm:grid-cols-2"')).toBe(
      true
    );
  });
});

// ── ⑨ DEFENZIVNI ZAKLEPI: osnova Button + sledljivost POLIR8 ────────────────

describe("POLIR8 A: defenzivni zaklepi (osnova Button obstaja v mobile-overflow.test.ts)", () => {
  test("⑳ zaklep osnove button.tsx (whitespace-nowrap) ŽE obstaja v mobile-overflow.test.ts — preverimo obstoj, NE podvajamo", () => {
    expect(
      MOBILE_OVERFLOW_TEST.includes(
        'join(import.meta.dir, "../src/components/ui/button.tsx")'
      )
    ).toBe(true);
    expect(
      MOBILE_OVERFLOW_TEST.includes('expect(BUTTON).toContain("whitespace-nowrap")')
    ).toBe(true);
  });

  test("㉑ slovenski komentar POLIR8 je prisoten v vseh 8 popravljenih datotekah (sledljivost spremembe)", () => {
    for (const [ime, src] of [
      ["destination-detail.tsx", DESTINATION],
      ["home-view.tsx", HOME],
      ["next-step-card.tsx", NEXT_STEP],
      ["moja-potovanja/view.tsx", MOJA_POTOVANJA],
      ["footer.tsx", FOOTER],
      ["travel-map.tsx", MAP],
      ["page-header.tsx", PAGE_HEADER],
      ["vir-podatkov/view.tsx", VIR_PODATKOV],
    ] as const) {
      expect(src, ime).toContain("POLIR8");
    }
  });
});
