/**
 * SITEMAP-DATA — generiran sitemap.xml (#41 Faza 3, 2.57.0).
 *
 * Zapre P2 vrzel iz QA pregleda (#38): sitemap.xml ne obstaja (404).
 * Pravilo #41 F3: „sitemap generiran, ne ročen" — vhod so KANONSKI
 * registri (SEO_PAGES javne poti, DESTINATIONS, državne landing strani
 * ALL_COUNTRY_CODES, GUIDES), izhod pa URL nabor z hreflang
 * alternatami po xhtml:link vzorcu Google dokumentacije.
 *
 * HREFLANG kanon (src/lib/hreflang.ts): sl = pot brez predpone (privzeti),
 * en/it/de/fr/es s predpono, x-default → sl. Vsaka jezikovna različica
 * je SAMOSTAN <url> vnos s POLNO množico alternat (tudi sama s sabo) —
 * točno tako priporoča Google sitemap specifikacija za večjezična
 * spletišča (developers.google.com/search/docs/specialty/international,
 * vir raziskave #41 „Kako drugi naredijo").
 *
 * Kuracija (iskrenost): javne vsebinske + pravne strani; IZPUŠČENE so
 * uporabniško-zasebne/prijavne poti (/prijava, /moja-potovanja, /na-poti,
 * /potovanje, /moj-profil, /notifikacije, /admin, /owner) — sitemap ni
 * imejnik strani, ampak oglasnik JAVNE vsebine.
 */

import { GUIDES } from "./content-data";
import { ALL_COUNTRY_CODES } from "./countries-data";
import { alternatesFor } from "./hreflang";
import { localePrefixPath, routing } from "@/i18n/routing";
import { DESTINATIONS } from "./slovenia-data";

/** Javne statične poti (vsebinske + pravne; izvzem uporabniško-zasebnih). */
export const SITEMAP_STATIC_PATHS: readonly string[] = Object.freeze([
  "/",
  "/destinacije",
  "/dogodki",
  "/dozivetja",
  "/lokali",
  "/zemljevid",
  "/nacrtuj",
  "/vodici",
  "/trznica",
  "/slovenia-pass",
  "/vir-podatkov",
  "/kontakt",
  "/konzultacija",
  "/za-ponudnike",
  "/pogoji-uporabe",
  "/politika-zasebnosti",
  "/zaupanje-in-varnost",
]);

/** En vnos sitemap-a: absolutni URL + absolutne hreflang alternates. */
export interface SitemapEntry {
  loc: string;
  /** Ključi: sl/en/it/de/fr/es + x-default; vrednosti: ABSOLUTNI URL-ji. */
  alternates: Record<string, string>;
}

/** Poti vseh vsebinskih entitet (destinacije, države, vodniki). */
export function sitemapEntityPaths(): string[] {
  return [
    ...DESTINATIONS.map((d) => `/destinacija/${d.slug}`),
    ...ALL_COUNTRY_CODES.map((c) => `/drzava/${c}`),
    ...GUIDES.map((g) => `/vodici/${g.slug}`),
  ];
}

/**
 * Vsi <url> vnosi: statične poti + entitete × 6 jezikov, vsak s polno
 * množico absolutnih hreflang alternat. Determinističen vrstni red:
 * statične poti → destinacije → države → vodniki, jeziki po routing.
 */
export function buildSitemapEntries(origin: string): SitemapEntry[] {
  const paths = [...SITEMAP_STATIC_PATHS, ...sitemapEntityPaths()];
  const entries: SitemapEntry[] = [];
  for (const path of paths) {
    for (const locale of routing.locales) {
      const alts = alternatesFor(locale, path).languages;
      const alternates: Record<string, string> = {};
      for (const [lang, p] of Object.entries(alts)) {
        alternates[lang] = `${origin}${p}`;
      }
      entries.push({ loc: `${origin}${localePrefixPath(locale)}${path}`, alternates });
    }
  }
  return entries;
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Celoten XML dokument (kanon rss.xml/route.ts: origin iz zahteve). */
export function sitemapXml(origin: string): string {
  const urls = buildSitemapEntries(origin)
    .map((e) => {
      const links = Object.entries(e.alternates)
        .map(
          ([lang, href]) =>
            `    <xhtml:link rel="alternate" hreflang="${esc(lang)}" href="${esc(href)}"/>`,
        )
        .join("\n");
      return `  <url>\n    <loc>${esc(e.loc)}</loc>\n${links}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}
