/**
 * BALKAN-F3 (#41, 2.57.0) — SEO: sitemap.xml + /drzava/[code] + kanon.
 *
 * Zaklepi po kanonu P1 SEO (#34 → #38, tests/seo-metadata.test.ts) in
 * iskrenostnem kanonu #38: sitemap je GENERIRAN iz kanonskih registrov
 * (ne ročen), hreflang alternates × 6 jezikov + x-default, državne
 * strani imajo unikaten 6-jezičen naslov/opis, JSON-LD geo je izpeljan
 * iz kuriranih destinacij (ne izmišljen), robots.txt kaže na sitemap.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  COUNTRY_SEO,
  COUNTRY_UI,
  countryGeoCenter,
} from "../src/lib/countries-seo";
import { ALL_COUNTRY_CODES, COUNTRIES } from "../src/lib/countries-data";
import { GUIDES } from "../src/lib/content-data";
import { PICK_LOCALES } from "../src/lib/i18n-pick";
import {
  SEO_PAGES,
  TITLE_SUFFIX,
  composedTitle,
} from "../src/lib/page-metadata";
import {
  SITEMAP_STATIC_PATHS,
  buildSitemapEntries,
  sitemapEntityPaths,
  sitemapXml,
} from "../src/lib/sitemap-data";
import { countryTouristDestinationJsonLd } from "../src/lib/jsonld";
import { DESTINATIONS } from "../src/lib/slovenia-data";

const LOCALES = PICK_LOCALES;
const ORIGIN = "https://i-feel-slovenia.vercel.app";

// ---------------------------------------------------------------------------
// ① COUNTRY_SEO — polnost, dolžine, unikatnost (kanon P1 SEO)
// ---------------------------------------------------------------------------

describe("balkan-f3 (#41 F3): COUNTRY_SEO kanon", () => {
  test("①a parnost: vseh 10 držav kanona ima SEO vnos (in obratno)", () => {
    expect(ALL_COUNTRY_CODES.length).toBe(10);
    for (const c of ALL_COUNTRY_CODES) {
      expect(COUNTRY_SEO[c]).toBeDefined();
    }
    expect(Object.keys(COUNTRY_SEO).sort()).toEqual([...ALL_COUNTRY_CODES].sort());
  });

  test("①b vsaka država ima naslov + opis za vseh 6 jezikov", () => {
    for (const c of ALL_COUNTRY_CODES) {
      for (const l of LOCALES) {
        expect((COUNTRY_SEO[c].title[l] ?? "").trim().length > 0).toBe(true);
        expect((COUNTRY_SEO[c].description[l] ?? "").trim().length > 0).toBe(true);
      }
    }
  });

  test("①c naslovi 8–38 zn (pripono doda layout template)", () => {
    for (const c of ALL_COUNTRY_CODES) {
      for (const l of LOCALES) {
        const t = COUNTRY_SEO[c].title[l] ?? "";
        expect(t.length).toBeGreaterThanOrEqual(8);
        expect(t.length).toBeLessThanOrEqual(38);
        // anti-vzorec: brand v kratkem naslovu (podvojitev s pripono)
        expect(t.includes("Discover Slovenia AI")).toBe(false);
        // sestavljen naslov ostane ≤ 60 zn (benchmark NTO strani)
        expect(composedTitle(t).length).toBeLessThanOrEqual(60);
        expect(composedTitle(t).endsWith(TITLE_SUFFIX)).toBe(true);
      }
    }
  });

  test("①d opisi 100–160 zn (anti-vzorec: prazen ali klinker opis)", () => {
    for (const c of ALL_COUNTRY_CODES) {
      for (const l of LOCALES) {
        const d = COUNTRY_SEO[c].description[l] ?? "";
        expect(d.length).toBeGreaterThanOrEqual(100);
        expect(d.length).toBeLessThanOrEqual(160);
      }
    }
  });

  test("①e unikatnost naslovov in opisov (med državami in proti SEO_PAGES)", () => {
    for (const l of LOCALES) {
      const cTitles = ALL_COUNTRY_CODES.map((c) => COUNTRY_SEO[c].title[l] ?? "");
      const cDescs = ALL_COUNTRY_CODES.map((c) => COUNTRY_SEO[c].description[l] ?? "");
      expect(new Set(cTitles).size).toBe(cTitles.length);
      expect(new Set(cDescs).size).toBe(cDescs.length);
      // anti-kolizija proti statičnim stranem (isti jezik)
      const sTitles = Object.values(SEO_PAGES).map((p) => p.title[l] ?? "");
      const sDescs = Object.values(SEO_PAGES).map((p) => p.description[l] ?? "");
      for (const t of cTitles) expect(sTitles).not.toContain(t);
      for (const d of cDescs) expect(sDescs).not.toContain(d);
    }
  });
});

// ---------------------------------------------------------------------------
// ② SITEMAP — generiran, ne ročen (pravilo #41 F3)
// ---------------------------------------------------------------------------

describe("balkan-f3 (#41 F3): sitemap.xml gradnik", () => {
  test("②a viri: 17 javnih statičnih poti + 106 entitet (74 dest + 10 držav + 22 vodnikov)", () => {
    expect(SITEMAP_STATIC_PATHS.length).toBe(17);
    expect(sitemapEntityPaths().length).toBe(106);
    const paths = sitemapEntityPaths();
    expect(paths.filter((p) => p.startsWith("/destinacija/")).length).toBe(
      DESTINATIONS.length,
    );
    expect(paths.filter((p) => p.startsWith("/drzava/")).length).toBe(10);
    expect(paths.filter((p) => p.startsWith("/vodici/")).length).toBe(GUIDES.length);
    // zasebne poti NISO v sitemapu (kuracija, ne imejnik)
    for (const privatePath of ["/prijava", "/moja-potovanja", "/na-poti", "/potovanje"]) {
      expect(SITEMAP_STATIC_PATHS).not.toContain(privatePath);
    }
  });

  test("②b vsaka pot × 6 jezikov, s polno množico alternat (vključno s sabo)", () => {
    const entries = buildSitemapEntries(ORIGIN);
    const paths = SITEMAP_STATIC_PATHS.length + sitemapEntityPaths().length;
    expect(entries.length).toBe(paths * 6);
    for (const e of entries) {
      const keys = Object.keys(e.alternates);
      expect(keys.sort()).toEqual(["de", "en", "es", "fr", "it", "sl", "x-default"]);
      // kanon hreflang: sl brez predpone (x-default = sl), entiteta sama s sabo
      const slPath = e.loc.slice(ORIGIN.length).replace(/^\/(en|it|de|fr|es)(?=\/)/, "");
      expect(e.alternates["sl"]).toBe(`${ORIGIN}${slPath}`);
      expect(e.alternates["x-default"]).toBe(`${ORIGIN}${slPath}`);
    }
    // vzorčni lokatorji
    expect(entries.some((e) => e.loc === `${ORIGIN}/destinacija/ohrid`)).toBe(true);
    expect(entries.some((e) => e.loc === `${ORIGIN}/en/destinacija/ohrid`)).toBe(true);
    expect(entries.some((e) => e.loc === `${ORIGIN}/drzava/BA`)).toBe(true);
    expect(entries.some((e) => e.loc === `${ORIGIN}/en/drzava/BA`)).toBe(true);
    const ba = entries.find((e) => e.loc === `${ORIGIN}/en/drzava/BA`);
    expect(ba?.alternates["en"]).toBe(`${ORIGIN}/en/drzava/BA`);
    expect(ba?.alternates["sl"]).toBe(`${ORIGIN}/drzava/BA`);
    expect(ba?.alternates["x-default"]).toBe(`${ORIGIN}/drzava/BA`);
  });

  test("②c XML: glava, urlset imenski prostor, xhtml:link alternates, ubežanje", () => {
    const xml = sitemapXml(ORIGIN);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')).toBe(true);
    expect(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')).toBe(true);
    const entries = buildSitemapEntries(ORIGIN);
    expect((xml.match(/<url>/g) ?? []).length).toBe(entries.length);
    expect((xml.match(/xhtml:link/g) ?? []).length).toBe(entries.length * 7);
    // ubežanje: izvor z & ne sme razbiti XML
    const evil = sitemapXml("https://x.example/?a=1&b=2");
    expect(evil.includes("https://x.example/?a=1&amp;b=2")).toBe(true);
    expect(evil.includes("a=1&b=2")).toBe(false);
  });

  test("②d route: sitemap.xml/route.ts je force-dynamic in izpelje origin iz zahteve", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "app", "sitemap.xml", "route.ts"),
      "utf8",
    );
    expect(src.includes('export const dynamic = "force-dynamic"')).toBe(true);
    expect(src.includes("new URL(request.url).origin")).toBe(true);
    expect(src.includes("sitemapXml")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ③ ROBOTS — Sitemap kaže na generiran /sitemap.xml
// ---------------------------------------------------------------------------

describe("balkan-f3 (#41 F3): robots.txt", () => {
  const robots = () =>
    readFileSync(join(process.cwd(), "public", "robots.txt"), "utf8");

  test("③a vsebuje Sitemap: na /sitemap.xml", () => {
    expect(robots()).toMatch(/^Sitemap: .+\/sitemap\.xml$/m);
  });

  test("③b zasebne poti so Disallow (kuracija indeksa)", () => {
    const src = robots();
    for (const p of ["/admin", "/owner", "/prijava", "/moja-potovanja"]) {
      expect(src).toContain(`Disallow: ${p}`);
    }
  });
});

// ---------------------------------------------------------------------------
// ④ DRŽAVNE STRANI /drzava/[code] — SSG + JSON-LD (iskrenostni kanon)
// ---------------------------------------------------------------------------

describe("balkan-f3 (#41 F3): /drzava/[code] strani", () => {
  test("④a source-contract: SSG po ALL_COUNTRY_CODES + hreflang + JSON-LD + nonce", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "app", "[locale]", "drzava", "[code]", "page.tsx"),
      "utf8",
    );
    expect(src.includes("generateStaticParams")).toBe(true);
    expect(src.includes("ALL_COUNTRY_CODES.map")).toBe(true);
    expect(src.includes("alternatesFor")).toBe(true);
    expect(src.includes("countryTouristDestinationJsonLd")).toBe(true);
    expect(src.includes("jsonldScriptHtml")).toBe(true);
    expect(src.includes("suppressHydrationWarning")).toBe(true);
    // neznana koda → notFound (pošten 404, ne izmišljena stran)
    expect(src.includes("notFound()")).toBe(true);
  });

  test("④b countryGeoCenter: izpeljano središče kuriranih destinacij", () => {
    const ba = DESTINATIONS.filter((d) => d.country === "BA");
    expect(ba.length).toBeGreaterThan(0);
    const c = countryGeoCenter(ba);
    expect(c).not.toBeNull();
    if (!c) return;
    const lats = ba.map((d) => d.coords.lat);
    const lngs = ba.map((d) => d.coords.lng);
    expect(c.lat).toBeGreaterThanOrEqual(Math.min(...lats));
    expect(c.lat).toBeLessThanOrEqual(Math.max(...lats));
    expect(c.lng).toBeGreaterThanOrEqual(Math.min(...lngs));
    expect(c.lng).toBeLessThanOrEqual(Math.max(...lngs));
    // prazna država → null (brez izmišljene koordinate)
    expect(countryGeoCenter([])).toBeNull();
  });

  test("④c countryTouristDestinationJsonLd: tip, url po hreflang, geo opcijsko", () => {
    const ba = countryTouristDestinationJsonLd("BA", "en", "Bosna in Hercegovina", "Opis države.", { lat: 43.9, lng: 18.0 });
    expect(ba["@context"]).toBe("https://schema.org");
    expect(ba["@type"]).toBe("TouristDestination");
    expect(ba.url).toBe("https://i-feel-slovenia.vercel.app/en/drzava/BA");
    expect(ba.geo?.latitude).toBe(43.9);
    const baSl = countryTouristDestinationJsonLd("BA", "sl", "Bosna in Hercegovina", "Opis.", { lat: 43.9, lng: 18.0 });
    expect(baSl.url).toBe("https://i-feel-slovenia.vercel.app/drzava/BA");
    // brez destinacij → geo izpuščen (pošteno, ne ugibamo)
    const empty = countryTouristDestinationJsonLd("XX", "sl", "X", "Y.", null);
    expect(empty.geo).toBeUndefined();
  });

  test("④d praktične meta oznake so popolne za vseh 10 držav (F0 izvor resnice)", () => {
    for (const c of ALL_COUNTRY_CODES) {
      expect(COUNTRIES[c].currency.length).toBe(3);
      expect(COUNTRIES[c].phoneCode.length).toBeGreaterThanOrEqual(2);
      expect(COUNTRIES[c].emergency.length).toBeGreaterThanOrEqual(3);
      expect(COUNTRIES[c].primaryLanguage.length).toBe(2);
    }
  });

  test("④e COUNTRY_UI oznake: 6 jezikov za vse ključe", () => {
    for (const [key, dict] of Object.entries(COUNTRY_UI)) {
      for (const l of LOCALES) {
        expect((dict[l as keyof typeof dict] ?? "") as unknown as string).toBeTruthy();
      }
      expect(typeof key).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// ⑤ COUNT-SYNC — SEO števci ne smejo zastareti (lekcija F1: 38 → 74)
// ---------------------------------------------------------------------------

describe("balkan-f3 (#41 F3): count-sync SEO opisov z registrom", () => {
  test("⑤a /destinacije opis nosi REALNO število destinacij (vseh 6 jezikov)", () => {
    const page = SEO_PAGES["/destinacije"];
    expect(page).toBeDefined();
    for (const l of LOCALES) {
      expect(page.description[l] ?? "").toContain(`${DESTINATIONS.length}`);
    }
    expect(page.description.sl).toContain(`${DESTINATIONS.length} kuriranih destinacij`);
  });

  test("⑤b /zemljevid opis nosi REALNO število destinacij (vseh 6 jezikov)", () => {
    const page = SEO_PAGES["/zemljevid"];
    expect(page).toBeDefined();
    for (const l of LOCALES) {
      expect(page.description[l] ?? "").toContain(`${DESTINATIONS.length}`);
    }
  });
});
