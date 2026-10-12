/**
 * MOBILE-OVERFLOW (POLIR7 A, 2.34.0) — ODSTRANITEV VZPOREDNEGA PRELIVA NA MOBILNEM
 * ============================================================================
 * Produkcija 2.33.0 je (izmerjeno, scrollWidth − clientWidth @ 390 px v 6
 * jezikih) prelivala na 4 poteh: /pot/[shareId] oblak+lokalno (37 px — QR/grid
 * razdelek, nowrap URL min-vsebina 369 px → kartica 411 px), /lokali (ES 48 px
 * — Badge s CELOTIM STAVKOM nad whitespace-nowrap osnovo), /trznica (DE 32 px
 * — isti vzorec) in /zemljevid DE (62 px — sestavljenka „Durchschnittsbewertung"
 * 172 px raznese 3-stolpčni stolpec ~111 px) ter /nacrtuj FR/ES (15/23 px —
 * dva nowrap gumba v nefleksibilni vrstici).
 *
 * Popravki po kanonu defensivecss „Minimum Content Size In CSS grid" +
 * css-tricks „Preventing a Grid Blowout" (min-w-0 na PREDMETIH mreže) in
 * cn()/tailwind-merge preklopi (whitespace-normal na badge, break-words na
 * oznaki, flex-wrap na vrstici gumbov).
 *
 * Ta datoteka: SOURCE-CONTRACT + defenzivna statična preverba vzorca +
 * zaklep osnov badge.tsx/button.tsx (dokumentacija, ZAKAJ preklopi className
 * delujejo). UI komponente se NE importajo (0 omrežja, 0 DOM, 0 AI) —
 * ista dvojna plast kot shared-measured.test.ts.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const SHARED = readFileSync(
  join(import.meta.dir, "../src/components/content/shared-trip-view.tsx"),
  "utf8"
);

const LOKALI = readFileSync(
  join(import.meta.dir, "../src/components/lokali-explorer.tsx"),
  "utf8"
);

const TRZNICA = readFileSync(
  join(import.meta.dir, "../src/components/trznica-explorer.tsx"),
  "utf8"
);

const ZEMLJEVID = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/zemljevid/view.tsx"),
  "utf8"
);

const NACRTUJ = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/nacrtuj/view.tsx"),
  "utf8"
);

const BADGE = readFileSync(
  join(import.meta.dir, "../src/components/ui/badge.tsx"),
  "utf8"
);

const BUTTON = readFileSync(
  join(import.meta.dir, "../src/components/ui/button.tsx"),
  "utf8"
);

/** Kolikokrat se niz pojavi v izvorni datoteki (preštevanje pojavitev). */
function stetje(src: string, igla: string): number {
  return src.split(igla).length - 1;
}

/** Izlušči odpiralno oznako Badge, ki neposredno obdaja {t("…")}.
 *  Iskanje po „<Badge variant=" (ne „<Badge“) — sicer bi zadeli ikono
 *  BadgeCheck ZNOTRAJ badge (trznica). */
function oznakaPred(src: string, vsebina: string): string {
  const konec = src.indexOf(vsebina);
  expect(konec, `vsebina ${vsebina}`).toBeGreaterThan(-1);
  const zacetek = src.lastIndexOf('<Badge variant=', konec);
  expect(zacetek).toBeGreaterThan(-1);
  return src.slice(zacetek, konec);
}

// ── ① SOURCE-CONTRACT: shared-trip-view.tsx — min-w-0 na 4 karticah mreže ──

describe("POLIR7 A: min-w-0 na karticah QR/grid razdelka (shared-trip-view)", () => {
  test("① QR kartica (oblak + lokalno): natančno 2× <Card className=\"min-w-0\">", () => {
    expect(stetje(SHARED, '<Card className="min-w-0">')).toBe(2);
  });

  test("② kartica vira (oblak + lokalno): natančno 2× border-primary/25 bg-primary/5 z min-w-0", () => {
    expect(
      stetje(SHARED, '<Card className="min-w-0 border-primary/25 bg-primary/5">')
    ).toBe(2);
    // stara, prelivajoča oblika (brez min-w-0) ne sme več obstajati
    expect(stetje(SHARED, '<Card className="border-primary/25 bg-primary/5">')).toBe(0);
  });

  test("③ truncate URL vrstici (oblak ~856 + lokalno ~1131) ostajata — elipsizira, ne raznese", () => {
    const urlVrstica = 'mt-2 truncate rounded-md bg-muted px-2 py-1 font-mono text-xs';
    expect(stetje(SHARED, urlVrstica)).toBe(2);
  });

  test("④ mreža ostaja mreža (grid gap-4 sm:grid-cols-2) — popravek je defenziven, ne preoblikovanje", () => {
    expect(stetje(SHARED, 'grid gap-4 sm:grid-cols-2 print:hidden')).toBe(2);
  });
});

// ── ② DEFENZIVNA STATIČNA PREVERBA VZORCA v shared-trip-view ────────────────

describe("POLIR7 A: defenzivna preverba — vsak truncate ima predhodni min-w-0", () => {
  test("⑤ vsak razred truncate ima v 25 vrsticah pred seboj min-w-0 (preprosta preverba, ne parser)", () => {
    const vrstice = SHARED.split("\n");
    const zadetki: number[] = [];
    vrstice.forEach((vrstica, i) => {
      if (/className="[^"]*\btruncate\b/.test(vrstica)) zadetki.push(i);
    });
    // 3 truncate: URL oblak, URL lokalno, ime postanka v PlanDays
    expect(zadetki.length).toBe(3);
    for (const i of zadetki) {
      const okno = vrstice.slice(Math.max(0, i - 25), i).join("\n");
      expect(
        okno.includes("min-w-0"),
        `truncate na vrstici ${i + 1} nima min-w-0 prednika v oknu`
      ).toBe(true);
    }
  });

  test("⑥ oba URL truncate sta ZNOTRAJ svoje kartice z min-w-0 (odprtje → prvi </Card>)", () => {
    const odpiralo = '<Card className="min-w-0">';
    const urlVrstica = "mt-2 truncate rounded-md bg-muted";
    let od = 0;
    for (let k = 0; k < 2; k++) {
      const zacetek = SHARED.indexOf(odpiralo, od);
      expect(zacetek, `kartica QR #${k + 1}`).toBeGreaterThan(-1);
      const konec = SHARED.indexOf("</Card>", zacetek);
      expect(konec).toBeGreaterThan(-1);
      const telo = SHARED.slice(zacetek, konec);
      expect(
        telo.includes(urlVrstica),
        `kartica QR #${k + 1} ne vsebuje truncate URL vrstice`
      ).toBe(true);
      od = konec;
    }
  });
});

// ── ③ SOURCE-CONTRACT: lokali-explorer.tsx — Badge s stavkom ────────────────

describe("POLIR7 A: whitespace-normal na Badge s stavkom (lokali-explorer)", () => {
  test("⑦ Badge s sectionLead vsebuje whitespace-normal in text-left (stavek se ovije)", () => {
    const oznaka = oznakaPred(LOKALI, '{t("sectionLead")}');
    expect(oznaka).toContain("whitespace-normal");
    expect(oznaka).toContain("text-left");
  });

  test("⑧ Badge B2B imenik (kratek) OSTAJA whitespace-nowrap (osnova, ni preliva)", () => {
    const oznaka = oznakaPred(LOKALI, '{t("b2b")}');
    expect(oznaka).not.toContain("whitespace-normal");
  });

  test("⑧b vrstica gumbov na kartici lokala ima flex-wrap (DE dolgi gumb za dodajanje + povezava — 6. točka, odkrita pri živi verifikaciji)", () => {
    // min-vsebina nowrap gumbov 239 + 8 + 87 = 334 px > 316 px stolpca kartice
    // na 390 px — ISTI vzorec kot vrstica gumbov na /nacrtuj (točka 5).
    expect(
      LOKALI.includes(
        'className="mt-auto flex flex-wrap items-center gap-2 pt-1"'
      )
    ).toBe(true);
    expect(
      LOKALI.includes('className="mt-auto flex items-center gap-2 pt-1"')
    ).toBe(false);
  });
});

// ── ④ SOURCE-CONTRACT: trznica-explorer.tsx — Badge s stavkom + ikono ───────

describe("POLIR7 A: whitespace-normal na Badge s stavkom (trznica-explorer)", () => {
  test("⑨ Badge z badge (stavek) vsebuje whitespace-normal in text-left", () => {
    const oznaka = oznakaPred(TRZNICA, '{t("badge")}');
    expect(oznaka).toContain("whitespace-normal");
    expect(oznaka).toContain("text-left");
  });

  test("⑩ BadgeCheck ikona ostaja v badge (identiteta, ne odstranjujemo vsebine)", () => {
    const konec = TRZNICA.indexOf('{t("badge")}');
    const zacetek = TRZNICA.lastIndexOf('<Badge variant=', konec);
    const telo = TRZNICA.slice(zacetek, TRZNICA.indexOf("</Badge>", konec));
    expect(telo).toContain("BadgeCheck");
  });
});

// ── ⑤ SOURCE-CONTRACT: zemljevid/view.tsx — break-words na oznaki ───────────

describe("POLIR7 A: break-words na oznaki statistike (zemljevid)", () => {
  test("⑪ oznaka statistike vsebuje break-words (nemške sestavljenke se prelomijo)", () => {
    expect(
      ZEMLJEVID.includes(
        '<span className="text-sm break-words text-muted-foreground">{s.label}</span>'
      )
    ).toBe(true);
  });

  test("⑫ stara, nedeljiva oznaka (brez break-words) ne sme več obstajati", () => {
    expect(
      ZEMLJEVID.includes(
        '<span className="text-sm text-muted-foreground">{s.label}</span>'
      )
    ).toBe(false);
  });

  test("⑬ statistika ostaja 3-stolpčna (grid-cols-3) — popravek defenziven", () => {
    // POLIR14 (2.41.0): 3-stolpčna statistika je zdaj ≥sm (hidden … sm:grid —
    // na mobilnem zemljevid sije, kartice pa se izrišejo od sm naprej);
    // mobilni nadomestek je kompaktna vrstica POD zemljevidom (view.tsx,
    // sm:hidden z ločilom „·“). Zaklep grid-cols-3 ostaja — defenziven
    // popravek, ne preoblikovanje (precedens POLIR12 ⑬/⑭).
    expect(
      ZEMLJEVID.includes('className="mt-6 hidden grid-cols-3 gap-3 sm:grid"')
    ).toBe(true);
  });
});

// ── ⑥ SOURCE-CONTRACT: nacrtuj/view.tsx — flex-wrap na vrstici gumbov ───────

describe("POLIR7 A: flex-wrap na vrstici gumbov (nacrtuj, Start Anywhere)", () => {
  // Sidro: območje sa-input → uvoz KML/GPX (vrstica 1248–1285; golega
  // „flex gap-2" je v datoteki več — NE smemo zadeti napačnega).
  const saBlok = (() => {
    const zacetek = NACRTUJ.indexOf('id="sa-input"');
    expect(zacetek).toBeGreaterThan(-1);
    const sidro = "importInputRef.current?.click()";
    const konec = NACRTUJ.indexOf(sidro, zacetek);
    expect(konec).toBeGreaterThan(-1);
    return NACRTUJ.slice(zacetek, konec + sidro.length);
  })();

  test("⑭ vrstica gumbov (saButton + uvoz KML/GPX) vsebuje flex flex-wrap gap-2", () => {
    expect(saBlok).toContain('className="flex flex-wrap gap-2"');
  });

  test("⑮ v bloku sa-input ni več golega flex gap-2 (stara, nefleksibilna vrstica)", () => {
    expect(saBlok).not.toContain('className="flex gap-2"');
  });

  test("⑯ oba gumba ostajata v vrstici (saButton + importButton — 0 odstranjene vsebine)", () => {
    expect(saBlok).toContain("runStartAnywhere()");
    expect(saBlok).toContain("importInputRef.current?.click()");
  });
});

// ── ⑦ ZAKLEP OSNOVE: badge.tsx + button.tsx (dokumentacija preklopov) ───────

describe("POLIR7 A: zaklep osnove badge.tsx/button.tsx (zakaj preklopi delujejo)", () => {
  test("⑰ badge.tsx osnova še vedno vsebuje whitespace-nowrap (default za KRATKE oznake)", () => {
    expect(BADGE).toContain("whitespace-nowrap");
  });

  test("⑱ badge.tsx uporablja cn(…) — whitespace-normal v className ZANESLJIVO preglasi osnovo (tailwind-merge); brez cn bi se preklop tiho prelomil", () => {
    expect(BADGE).toContain("cn(badgeVariants({ variant }), className)");
    expect(BADGE).toContain('from "@/lib/utils"');
  });

  test("⑲ button.tsx osnova vsebuje whitespace-nowrap (oznake gumbov ostanejo enovrstne — zato flex-wrap na VRSTICI)", () => {
    expect(BUTTON).toContain("whitespace-nowrap");
  });

  test("⑳ slovenski komentar POLIR7 je prisoten v vseh 5 popravljenih datotekah (sledljivost spremembe)", () => {
    for (const [ime, src] of [
      ["shared-trip-view.tsx", SHARED],
      ["lokali-explorer.tsx", LOKALI],
      ["trznica-explorer.tsx", TRZNICA],
      ["zemljevid/view.tsx", ZEMLJEVID],
      ["nacrtuj/view.tsx", NACRTUJ],
    ] as const) {
      expect(src, ime).toContain("POLIR7");
    }
  });
});
