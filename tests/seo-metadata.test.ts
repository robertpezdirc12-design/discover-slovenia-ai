/**
 * SEO METADATA (P1, #34 → #38, 2.44.0)
 * ============================================================================
 * Vrzel iz QA pregleda (#38 P1 SEO): statične strani so imele SKUPNI naslov
 * „Discover Slovenia AI — Kaj želiš doživeti v Sloveniji?“ (samo hreflang
 * alternates so bile unikatne). Benchmark 5 najboljših NTO strani
 * (raziskava R-3-a, 2026-10-13: MySwitzerland, VisitNorway, austria.info,
 * slovenia.info, Croatia.hr) potrjuje: unikaten naslov + opis PER STRAN je
 * higiena kategorije.
 *
 * Zaklepi (po vzorcu R-3-a checklist, anti-vzorce iz benchmarka):
 * ① vsaka statična stran ima 6-jezičen unikaten naslov + opis (pick kanon),
 * ② sestavljen naslov „Tema · Discover Slovenia AI“ ≤ 60 zn, brez podvojenega
 *    branda (anti-vzorec slovenia.info „| I feel Slovenia | I feel Slovenia“),
 * ③ opis 100–160 zn, unikaten med stranmi (anti-vzorec: prazen opis
 *    slovenia.info hub in 16-zn „Discover Austria“ na austria.info),
 * ④ pageMetadata() sestavi alternates (canonical + hreflang + x-default),
 *    OG (naslov z enkratno pripono, locale) in twitter card,
 * ⑤ SOURCE-CONTRACT: vsaka statična page.tsx dejansko kliče pageMetadata()
 *    s svojo potjo (statična preverba vira — hišni kanon),
 * ⑥ dinamični strani (/destinacija/[slug], /vodici/[slug]) ohranita svoj
 *    unikaten naslov iz podatkov (nestroknost tu NE smeta pasti na privzeti).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  composedTitle,
  OG_LOCALES,
  pageMetadata,
  SEO_PAGES,
  SITE_NAME,
  TITLE_SUFFIX,
} from "../src/lib/page-metadata";
import { PICK_LOCALES } from "../src/lib/i18n-pick";
import { alternatesFor } from "../src/lib/hreflang";

const LOCALES = PICK_LOCALES;

// ---------------------------------------------------------------------------
// ① Polnost in unikatnost 6-jezičnega slovarja
// ---------------------------------------------------------------------------

describe("seo metadata: polnost slovarja", () => {
  const PATHS = Object.keys(SEO_PAGES);

  test("①a vsaj 18 statičnih strani pokritih (obseg #38 P1 SEO)", () => {
    expect(PATHS.length).toBeGreaterThanOrEqual(18);
    for (const p of [
      "/destinacije",
      "/zemljevid",
      "/nacrtuj",
      "/dogodki",
      "/dozivetja",
      "/lokali",
      "/trznica",
      "/vodici",
      "/slovenia-pass",
      "/vir-podatkov",
      "/moja-potovanja",
      "/na-poti",
      "/potovanje",
      "/kontakt",
      "/prijava",
      "/pogoji-uporabe",
      "/politika-zasebnosti",
      "/zaupanje-in-varnost",
    ]) {
      expect(PATHS).toContain(p);
    }
  });

  test("①b vsaka stran ima naslov + opis za vseh 6 jezikov (pick kanon)", () => {
    for (const page of Object.values(SEO_PAGES)) {
      for (const l of LOCALES) {
        const t = page.title[l] ?? "";
        const d = page.description[l] ?? "";
        expect(t.trim().length > 0).toBe(true);
        expect(d.trim().length > 0).toBe(true);
      }
    }
  });

  test("①c naslovi unikatni med stranmi (za vsak jezik posebej)", () => {
    for (const l of LOCALES) {
      const titles = Object.values(SEO_PAGES).map((p) => p.title[l] ?? "");
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  test("①d opisi unikatni med stranmi (za vsak jezik posebej)", () => {
    for (const l of LOCALES) {
      const descs = Object.values(SEO_PAGES).map((p) => p.description[l] ?? "");
      expect(new Set(descs).size).toBe(descs.length);
    }
  });
});

// ---------------------------------------------------------------------------
// ②③ Dolžine (benchmark: naslov 30–60, opis 100–160)
// ---------------------------------------------------------------------------

describe("seo metadata: dolžine po vzorcu NTO benchmarka", () => {
  test("②a sestavljen naslov ≤ 60 zn in vsebuje pripono točno ENKRAT", () => {
    for (const page of Object.values(SEO_PAGES)) {
      for (const l of LOCALES) {
        const full = composedTitle(page.title[l] ?? "");
        expect(full.length).toBeLessThanOrEqual(60);
        // anti-vzorec: podvojen brand (slovenia.info bug)
        const count = full.split(TITLE_SUFFIX.trim()).length - 1;
        expect(count).toBe(1);
        expect(full.endsWith(TITLE_SUFFIX)).toBe(true);
      }
    }
  });

  test("②b kratek naslov sam po sebi med 8 in 38 zn (pripona 22 zn)", () => {
    for (const page of Object.values(SEO_PAGES)) {
      for (const l of LOCALES) {
        const t = page.title[l] ?? "";
        expect(t.length).toBeGreaterThanOrEqual(8);
        expect(t.length).toBeLessThanOrEqual(38);
      }
    }
  });

  test("③a opis med 100 in 160 zn (anti-vzorec: prazen ali 16-zn opis)", () => {
    for (const page of Object.values(SEO_PAGES)) {
      for (const l of LOCALES) {
        const d = page.description[l] ?? "";
        expect(d.length).toBeGreaterThanOrEqual(100);
        expect(d.length).toBeLessThanOrEqual(160);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ④ pageMetadata() — sestava Metadata objekta
// ---------------------------------------------------------------------------

describe("seo metadata: pageMetadata sestava", () => {
  test("④a sl: unikaten title/description + canonical + hreflang z x-default", () => {
    const m = pageMetadata("sl", "/destinacije");
    expect(m.title).toBe("Destinacije v Sloveniji");
    expect(m.description).toContain("74 kuriranih destinacij");
    const alts = m.alternates!;
    const lang = (alts.languages ?? {}) as Record<string, string>;
    expect(alts.canonical).toBe("/destinacije");
    expect(lang["en"]).toBe("/en/destinacije");
    expect(lang["x-default"]).toBe("/destinacije");
  });

  test("④b en: predpona poti v canonical in hreflang", () => {
    const m = pageMetadata("en", "/destinacije");
    expect(m.title).toBe("Destinations in Slovenia");
    const altsEn = m.alternates!;
    const langEn = (altsEn.languages ?? {}) as Record<string, string>;
    expect(altsEn.canonical).toBe("/en/destinacije");
    expect(langEn["sl"]).toBe("/destinacije");
  });

  test("④c OG: naslov z enkratno pripono, locale zemljevid, canonical URL", () => {
    for (const l of ["sl", "en", "it", "de", "fr", "es"]) {
      const m = pageMetadata(l, "/dogodki");
      const og = m.openGraph as Record<string, string>;
      expect(og.title).toBe(composedTitle(pageMetadata(l, "/dogodki").title as string));
      expect(og.title.split(TITLE_SUFFIX.trim()).length - 1).toBe(1);
      expect(og.siteName).toBe(SITE_NAME);
      expect(og.locale).toBe(OG_LOCALES[l]);
      expect(og.url).toBe(alternatesFor(l, "/dogodki").canonical);
      expect(og.type).toBe("website");
    }
  });

  test("④d twitter card: summary_large_image z istim naslovom kot OG", () => {
    const m = pageMetadata("sl", "/nacrtuj");
    const tw = m.twitter as Record<string, string>;
    expect(tw.card).toBe("summary_large_image");
    expect(tw.title).toBe(composedTitle("Načrtovalnik potovanja"));
  });

  test("④e neznana pot → SAMO alternates (brez izmišljenega SEO)", () => {
    const m = pageMetadata("sl", "/ne-obstaja");
    expect(m.title).toBeUndefined();
    expect(m.alternates!.canonical).toBe("/ne-obstaja");
  });

  test("④f OG locale koda pokriva vseh 6 jezikov", () => {
    expect(Object.keys(OG_LOCALES).sort()).toEqual([...LOCALES].sort());
  });
});

// ---------------------------------------------------------------------------
// ⑤ SOURCE-CONTRACT: page.tsx dejansko kliče pageMetadata() s svojo potjo
// ---------------------------------------------------------------------------

describe("seo metadata: source-contract page.tsx → pageMetadata()", () => {
  test("⑤a vsaka statična stran iz slovarja uvozi in kliče pageMetadata", () => {
    for (const path of Object.keys(SEO_PAGES)) {
      const file = join(process.cwd(), "src", "app", "[locale]", path.slice(1), "page.tsx");
      const src = readFileSync(file, "utf8");
      expect(src.includes('from "@/lib/page-metadata"')).toBe(true);
      expect(src.includes(`pageMetadata(locale, "${path}")`)).toBe(true);
      // stari kanon (alternates-only) NE SME več obstajati na teh straneh
      expect(src.includes("alternatesFor")).toBe(false);
    }
  });

  test("⑤b dinamični strani ohranjata lasten unikaten naslov iz podatkov", () => {
    const dest = readFileSync(
      join(process.cwd(), "src", "app", "[locale]", "destinacija", "[slug]", "page.tsx"),
      "utf8",
    );
    expect(dest.includes("`${d.name} — ${d.tagline}`")).toBe(true);
    const guide = readFileSync(
      join(process.cwd(), "src", "app", "[locale]", "vodici", "[slug]", "page.tsx"),
      "utf8",
    );
    expect(guide.includes("title: g.title")).toBe(true);
  });

  test("⑤c layout template uporablja enotno pripono iz page-metadata", () => {
    const layout = readFileSync(
      join(process.cwd(), "src", "app", "[locale]", "layout.tsx"),
      "utf8",
    );
    expect(layout.includes("template: `%s · Discover Slovenia AI`")).toBe(true);
    // OG_LOCALES je enoten vir (brez lokalne podvojenosti)
    expect(layout.includes('from "@/lib/page-metadata"')).toBe(true);
    expect(layout.includes("const OG_LOCALES")).toBe(false);
  });
});
