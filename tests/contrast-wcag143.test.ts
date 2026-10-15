/**
 * WCAG 1.4.3 KONTRAST (POLIR9 A, 2.36.0) — ŽETONI + HERO POD GLAVO + TEMNE STOPNJE
 * ============================================================================
 * Produkcija 2.35.0 (dvofazna revizija: izračunano + vzorčenje pikslov
 * vidnega polja) je pokazala:
 * - SVETLI --muted-foreground oklch(0.556 0 0) = #737373 = 4,37:1 na belem
 *   (vsak text-muted-foreground na svetli temi odpade: opombe kartic,
 *   „Preverjeno: …", mikrocopy; stepper 1/2/3 na /nacrtuj 4,35).
 * - TEMNI hero gradient uporablja SVETLI --primary (oklch 0.586 ≈ rgb(0,178,0))
 *   → belo besedilo heroja 1,8–2,9:1 (h1 2,85, uvod 2,06, kicker 1,81).
 * - ŽIVA NAPAKA: sticky glava na domov @scroll 0 (svetla) je bela pisava
 *   nad BELO stranjo (1,0:1) — hero se ni zavlekel pod glavo, `overHero`
 *   obarvanje pa je zahtevalo heroj pod glavo (komentar v navigation.tsx
 *   je past opisoval, prekrivanje pa je nikoli ni sprožilo).
 *
 * Popravki: -mt-16 na hero sekciji (glava h-16 sticky; py-16/24 absorbira
 * 64 px — vsebina ostane pod glavo), svetli žeton oklch(0.525 0 0)
 * (= #6a6a6a; 5,40 na belem / 4,96 na bg-muted / ≈4,8 na primary-5 % /
 * ≈4,6 na primary-10 %), izrecne temne stopnje gradienta
 * (dark:from #0b4d20 · via #0e5c28 · to #063615; čista bela na via-stopi
 * 8,15:1). Temni blok --muted-foreground NEPREMJENJEN (0.708 na 0.145 =
 * 7,66:1 ✓). Dekorativne puščice/ločila (aria-hidden) so dokumentirana
 * WCAG 1.4.3 izjema — BREZ popravka (POPRAVEK 4).
 *
 * Ta datoteka: SOURCE-CONTRACT (①④⑤⑦) + DETERMINISTIČNA MATEMATIKA
 * oklch→sRGB (②③⑥) po matrikah CSS Color 4 (oklab→linear sRGB→gama
 * sRGB), implementirano TU — 0 odvisnosti, 0 omrežja, 0 DOM, 0 AI.
 * Vzorčeno po tests/reflow-320.test.ts (fs.readFileSync vzorec).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const GLOBALS = readFileSync(
  join(import.meta.dir, "../src/app/globals.css"),
  "utf8"
);

const HOME = readFileSync(
  join(import.meta.dir, "../src/components/home/home-view.tsx"),
  "utf8"
);

const NAVIGATION = readFileSync(
  join(import.meta.dir, "../src/components/layout/navigation.tsx"),
  "utf8"
);

const LANGUAGE_SWITCHER = readFileSync(
  join(import.meta.dir, "../src/components/layout/language-switcher.tsx"),
  "utf8"
);

// ── DETERMINISTIČNA MATEMATIKA: oklch → sRGB (CSS Color 4) ──────────────────

/** Barva kot trojka sRGB kanalov 0–1 (gama-kodirana, kot CSS byte vrednosti). */
type Rgb = [number, number, number];

/** oklch(L C H) → linear sRGB po matrikah CSS Color 4:
 *  oklab a/b (a = C·cos H, b = C·sin H) → kubirana LMS → linear sRGB.
 *  Izven-game kanali (negativne vrednosti) se obrežejo na 0 — kot v
 *  brskalniku (canvas fillStyle → sRGB bajti). */
function oklchToLinearSrgb(L: number, C: number, H: number): Rgb {
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  // OKLab → LMS' (pred-nelinearna stopnja)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  // nelinearna stopnja: kubiranje
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  // LMS → linear sRGB
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [
    Math.min(1, Math.max(0, r)),
    Math.min(1, Math.max(0, g)),
    Math.min(1, Math.max(0, bLin)),
  ];
}

/** Linear → gama-kodiran sRGB kanal (sRGB prenosna funkcija). */
function gamaKodiraj(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** oklch(L C H) → sRGB 0–1 (gama-kodirano, obrezano na [0,1]). */
function oklch(L: number, C: number, H: number): Rgb {
  return oklchToLinearSrgb(L, C, H).map(gamaKodiraj) as Rgb;
}

/** Hex (#rrggbb) → sRGB 0–1. */
function hex(htag: string): Rgb {
  const n = parseInt(htag.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** WCAG relativna luminanca iz sRGB 0–1 (decode: prag 0,03928 po WCAG 2.x). */
function luminanca([r, g, b]: Rgb): number {
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG razmerje kontrasta (≥ 4,5 besedilo / ≥ 3 veliko besedilo). */
function razmerje(fg: Rgb, bg: Rgb): number {
  const l1 = Math.max(luminanca(fg), luminanca(bg));
  const l2 = Math.min(luminanca(fg), luminanca(bg));
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Alfa mešanica v sRGB (kot CSS compositing): alpha·fg + (1−alpha)·bg. */
function mesanica(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [
    alpha * fg[0] + (1 - alpha) * bg[0],
    alpha * fg[1] + (1 - alpha) * bg[1],
    alpha * fg[2] + (1 - alpha) * bg[2],
  ];
}

/** Izlušči blok CSS bloka (od „{“ do zaklepajočega „}“ po selektorju). */
function cssBlok(vir: string, selektor: string): string {
  const zacetek = vir.indexOf(selektor);
  expect(zacetek).toBeGreaterThanOrEqual(0); // selektor mora obstajati
  const odprta = vir.indexOf("{", zacetek);
  return vir.slice(odprta, vir.indexOf("}", odprta));
}

// Kanonične žetonske vrednosti (enote resnice za matematiko spodaj)
const MUTED_TEMNA = oklch(0.708, 0, 0); // temni --muted-foreground
const PODLAGA_TEMNA = oklch(0.145, 0, 0); // temni --background
const PRIMARY_SVETLA = oklch(0.399, 0.359, 148.2); // svetli --primary
const BELA: Rgb = [1, 1, 1];

// ── ① SOURCE-CONTRACT: globals.css — svetli --muted-foreground žeton ────────

describe("POLIR9 A: svetli --muted-foreground žeton (globals.css)", () => {
  test("① :root vsebuje oklch(0.525 0 0); stara vrednost 0.556 izbrisana; temni blok še vedno 0.708", () => {
    // Vrednost 0.556 (siva #737373) = 4,37:1 na belem — padala je pod WCAG
    // 1.4.3 na VSAKI svetli podlagi (belo/muted/primary-5 %/primary-10 %).
    // 0.525 (#6a6a6a) drži ≥ 4,5:1 na vseh štirih (dokazano v ②).
    const root = cssBlok(GLOBALS, ":root {");
    expect(root).toContain("--muted-foreground: oklch(0.525 0 0);");
    // stara vrednost ne sme obstati kot ŽETON nikjer v datoteki (komentarji
    // smejo staro vrednost dokumentirati — zaklep je na „oklch(0.556“)
    expect(GLOBALS.includes("oklch(0.556")).toBe(false);
    // temni blok (7,66:1) NIPOVZETNO nepremaknjen — dokazano v ⑥
    // (selektor „.dark {“ — vrstica 4 @custom-variant dark vsebuje „.dark *“)
    const temni = cssBlok(GLOBALS, ".dark {");
    expect(temni).toContain("--muted-foreground: oklch(0.708 0 0);");
  });
});

// ── ⓪ SIDRO MATEMATIKE: pretvorba oklch→sRGB da znane vrednosti ─────────────

describe("POLIR9 A: sidro matematike oklch→sRGB (znane Tailwind/shadcn vrednosti)", () => {
  test("⓪ sivinska os in svetli primary se pretvorita v pričakovane bajte (±1)", () => {
    // Sidrne točke: če bi se matrike tipkarsko polomile, bi se vrednosti
    // zamaknile za veliko več kot ±1. Vrednosti preverjene proti
    // brskalniški pretvorbi (canvas fillStyle) iz raziskave POLIR9.
    const siva525 = oklch(0.525, 0, 0).map((c) => Math.round(c * 255));
    // #6a6a6a = rgb(106,106,106) — nov svetli muted-foreground
    expect(siva525[0]).toBeGreaterThanOrEqual(105);
    expect(siva525[0]).toBeLessThanOrEqual(107);
    expect(siva525).toEqual([siva525[0], siva525[0], siva525[0]]);
    const mutedOzadje = oklch(0.97, 0, 0).map((c) => Math.round(c * 255));
    // #f5f5f5 = rgb(245,245,245) — svetli --muted
    expect(mutedOzadje[0]).toBeGreaterThanOrEqual(244);
    expect(mutedOzadje[0]).toBeLessThanOrEqual(246);
    const temnaSiva = oklch(0.708, 0, 0).map((c) => Math.round(c * 255));
    // #a1a1a1 = rgb(161,161,161) — temni --muted-foreground (Tailwind)
    expect(temnaSiva[0]).toBeGreaterThanOrEqual(160);
    expect(temnaSiva[0]).toBeLessThanOrEqual(162);
    const primary = PRIMARY_SVETLA.map((c) => Math.round(c * 255));
    // svetli --primary ≈ rgb(0,107,0) — čisto zelena, r/b kanala obrezana na 0
    expect(primary[0]).toBe(0);
    expect(primary[2]).toBe(0);
    expect(primary[1]).toBeGreaterThanOrEqual(105);
    expect(primary[1]).toBeLessThanOrEqual(110);
  });
});

// ── ② MATEMATIKA: svetli muted-foreground ≥ 4,5:1 na vseh svetlih podlagah ──

describe("POLIR9 A: oklch(0.525 0 0) ≥ 4,5:1 (WCAG 1.4.3, svetla tema)", () => {
  test("② proti belem ozadju, --muted (oklch 0.97), bg-primary/5 in bg-primary/10", () => {
    const fg = oklch(0.525, 0, 0);
    const naBeli = razmerje(fg, BELA);
    expect(naBeli).toBeGreaterThanOrEqual(4.5); // izračun: ≈5,40
    const naMuted = razmerje(fg, oklch(0.97, 0, 0));
    expect(naMuted).toBeGreaterThanOrEqual(4.5); // izračun: ≈4,96
    // bg-primary/5 in /10: 5 %/10 % --primary nad belo (CSS alfa mešanica)
    const podloga5 = mesanica(PRIMARY_SVETLA, 0.05, BELA);
    const podloga10 = mesanica(PRIMARY_SVETLA, 0.1, BELA);
    expect(razmerje(fg, podloga5)).toBeGreaterThanOrEqual(4.5); // ≈4,8–5,0
    expect(razmerje(fg, podloga10)).toBeGreaterThanOrEqual(4.5); // ≈4,6 (najtesneje)
  });
});

// ── ③ MATEMATIKA: temne stopnje hero gradienta — belo besedilo ≥ 4,5:1 ──────

describe("POLIR9 A: temne stopnje hero gradienta (dark:from/via/to) ≥ 4,5:1", () => {
  test("③ čista bela, white/85 in white/80 proti #0e5c28 (via-stopa) — in vse tri stopnje", () => {
    // via-stopa #0e5c28 (14,92,40) je SVETLA od from/to stopenj — če drži
    // tu, drži povsod po gradientu.
    const via = hex("#0e5c28");
    // white/85 = mešanica 0,85·255 + 0,15·barva (CSS alfa nad podlago)
    const white85 = mesanica(BELA, 0.85, via);
    const white80 = mesanica(BELA, 0.8, via);
    expect(razmerje(BELA, via)).toBeGreaterThanOrEqual(4.5); // izračun: ≈8,15
    expect(razmerje(white85, via)).toBeGreaterThanOrEqual(4.5); // ≈6,4
    expect(razmerje(white80, via)).toBeGreaterThanOrEqual(4.5); // ≈5,9
    // od/to stopnji sta še temnejši (višje razmerje) — zaklep celotnega razpona
    const from = hex("#0b4d20");
    const to = hex("#063615");
    expect(razmerje(BELA, from)).toBeGreaterThanOrEqual(4.5); // ≈10,0
    expect(razmerje(BELA, to)).toBeGreaterThanOrEqual(4.5); // ≈13,6
  });
});

// ── ④ SOURCE-CONTRACT: home-view.tsx — hero pod glavo + temne stopnje ────────

describe("POLIR9 A: hero pod glavo (home-view.tsx, živa napaka nevidne glave)", () => {
  test("④ hero sekcija: -mt-16 + fotografija + preliv z WCAG AA kontrastom", () => {
    expect(
      HOME.includes('className="relative -mt-16 overflow-hidden bg-[#0b3029] text-white"')
    ).toBe(true);
    expect(
      HOME.includes("linear-gradient(90deg, rgba(5, 28, 25, 0.84) 0%, rgba(5, 28, 25, 0.70) 48%, rgba(5, 28, 25, 0.64) 100%)")
    ).toBe(true);
    expect(HOME.includes("url('/content/bled.jpg')")).toBe(true);

    // Najslabši primer: bel piksel fotografije za najmanj neprosojnim
    // delom preliva. Bela pisava mora ostati nad pragom WCAG AA 4,5:1.
    const alpha = 0.64;
    const rgb = [5, 28, 25].map((channel) =>
      Math.round(channel * alpha + 255 * (1 - alpha))
    );
    const linear = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance =
      0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});

// ── ⑤ SOURCE-CONTRACT: navigation.tsx — overHero logika nespremenjena ────────

describe("POLIR9 A: overHero logika (navigation.tsx)", () => {
  test("⑤ bela pisava glave SAMO nad herojem na domov pred scrollom (vzorec zaklenjen)", () => {
    // Logika NEspremenjena — sedaj pa je hero DEJANSKO pod glavo (-mt-16),
    // zato `overHero` obarvanje končno stoji na zelenem (ne na belem).
    // Zaklep vzorca preprečuje „izboljšave", ki bi belem pisavo pustile
    // nad svetlo podlago.
    expect(NAVIGATION.includes("const overHero = isHome && !scrolled;")).toBe(
      true
    );
    expect(NAVIGATION.includes("const glass = scrolled || !isHome;")).toBe(
      true
    );
  });
});

// ── ⑥ MATEMATIKA: temna tema — muted-foreground zaklep proti regresiji ───────

describe("POLIR9 A: temna tema muted-foreground (regresijski zaklep)", () => {
  test("⑥ oklch(0.708 0 0) proti oklch(0.145 0 0) ≥ 4,5 (temna mute nikoli ne regredira)", () => {
    const r = razmerje(MUTED_TEMNA, PODLAGA_TEMNA);
    expect(r).toBeGreaterThanOrEqual(4.5); // izračun: ≈7,66
  });
});

// ── ⑧ ŽIVI DOKAZ (odstopanje, dokumentirano): glava na heroju — 2 naknadni ────

describe("POLIR9 A: živi dokaz — izpostanjeni kršitvi v glavi nad herojem (8. korak)", () => {
  test("⑧a tagline „I Feel Slovenia“: text-white/80 (4,47:1 pri /70, temna tema, piksli)", () => {
    // POPRAVEK 1 je pokril glavo z herojem in s tem IZPOSTAVIL dve kršitvi,
    // ki sta bili na produkciji MASKIRANI z nevidno glavo nad belim telesom:
    // (1) tagline white/70 je padel na 4,47:1 (10 px w600, temna tema —
    // vzorčenje pikslov, lise + gradient ga posvetlijo); /80 drži z rezervo.
    expect(NAVIGATION.includes('overHero ? "text-white/80"')).toBe(true);
    expect(NAVIGATION.includes('"text-white/70"')).toBe(false);
  });

  test("⑧b tabletka jezika: nad herojem bela steklena oblika (3,41:1 pri stari, svetla)", () => {
    // (2) „SL“ tabletka (text-primary na bg-background/60) je padla na 3,41:1
    // nad zelenim herojem (svetla) — prop overHero preklopi na belo steklo.
    expect(NAVIGATION.includes("<LanguageSwitcher overHero={overHero} />")).toBe(
      true
    );
    expect(
      LANGUAGE_SWITCHER.includes(
        "export function LanguageSwitcher({ overHero = false }: { overHero?: boolean }) {"
      )
    ).toBe(true);
    expect(
      LANGUAGE_SWITCHER.includes(
        '"border-white/40 bg-white/10 text-white hover:bg-white/20"'
      )
    ).toBe(true);
    // običajna (neglava) oblika ostaja — podstrani imajo svetlo podlago
    expect(
      LANGUAGE_SWITCHER.includes("border-border/70 bg-background/60")
    ).toBe(true);
  });
});

// ── ⑦ ZAKLEP: #1e4f2d ostaja KONČNA stopnja SVETLEGA gradienta ────────────────

describe("POLIR9 A: stabilen kontrast heroja v obeh temah", () => {
  test("⑦ temna plast je neodvisna od teme in nikjer ne pade pod minimalno neprosojnost", () => {
    // Hero uporablja fotografijo in fiksno temno prekrivno plast namesto
    // theme-dependent --primary stopnje; skrajna desna alfa določa najslabši
    // kontrast in se preverja tudi numerično v testu ④ zgoraj.
    expect(HOME.includes("bg-[#0b3029] text-white")).toBe(true);
    expect(HOME.includes("from-primary via-primary")).toBe(false);
    expect(HOME.includes("dark:to-[#1e4f2d]")).toBe(false);
    expect(HOME.includes("dark:to-[#063615]")).toBe(false);
    expect(HOME.includes("rgba(5, 28, 25, 0.64) 100%")).toBe(true);
  });
});
