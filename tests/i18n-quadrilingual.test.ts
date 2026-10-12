/**
 * I18N QUADRILINGUAL (naloga 4+5) — POGODBENI TEST 6-jezične arhitekture.
 * ============================================================================
 * Zaklene štiri invariante feat/i18n-quadrilingual:
 *  ① PARITETA SLOVARJEV — vsak slovar v src (rekurzivno, .ts in .tsx) z
 *     vsaj 1 nizovnim `en:` vnosom mora imeti ENAKO število nizovnih
 *     `it:`/`de:`/`fr:`/`es:` vnosov (slovarji samo-sl se ne štejejo —
 *     pick() fallback kanon 48-b);
 *  ② HREFLANG POKRITOST — vseh 36 strani [locale] veje izjavlja alternates
 *     prek alternatesFor(); catch-all, not-found in layout ga NE smejo;
 *  ③ POMOČNIK alternatesFor — canonical v AKTIVNEM jeziku, sl brez predpone,
 *     x-default = privzeta (sl) pot, normalizacija vodilne poševnice;
 *  ④ ROUTING — 6 jezikov (sl privzet), localePrefixPath po kanonu as-needed.
 *
 * SOURCE-CONTEST stil (kot p0h/p1a/p1c): branje izvorne kode brez brskalnika.
 */

import { describe, expect, test } from "bun:test";

import { alternatesFor } from "../src/lib/hreflang";
import { localePrefixPath, routing } from "../src/i18n/routing";

// ── ① PARITETA SLOVARJEV ─────────────────────────────────────────────────────

/**
 * IZJEME (allowlist) — poti iz src/, kjer je neravnovesje upravičeno.
 * Trenutno PRAZNA: vse datoteke so izravnane. Tehnična mapa OG_LOCALES v
 * [locale]/layout.tsx (sl_SI/en_US/… kode za Open Graph) ima SAMA vseh 6
 * ključev, zato izjeme ne potrebuje. Znan obseg števca: nizovni pari
 * `en: "…"` v objektnih literalih — terčni slovarji (npr. WMO_LABELS v
 * weather.ts) in funkcijski vnosi (npr. GEO_MSG/REASON_MSG `en: (x) => …`)
 * vzorca `en:` + narekovaj ne sprožijo in niso predmet tega števca.
 */
const PARITY_ALLOWLIST: readonly string[] = [];

/** Jezikovni ključi v števcu paritete (vrednost mora biti niz v narekovajih). */
const PARITY_PATTERNS: ReadonlyArray<{ key: string; re: RegExp }> = [
  { key: "en", re: /\ben:\s*[`"']/g },
  { key: "it", re: /\bit:\s*[`"']/g },
  { key: "de", re: /\bde:\s*[`"']/g },
  { key: "fr", re: /\bfr:\s*[`"']/g },
  { key: "es", re: /\bes:\s*[`"']/g },
];

describe("i18n-quadrilingual ①: pariteta slovarjev (en = it = de = fr = es)", () => {
  test("vsaka datoteka z vsaj 1 nizovnim en: ima izravnane števce vseh 4 prevodov", async () => {
    const { Glob } = await import("bun");
    const glob = new Glob("**/*.{ts,tsx}");
    const checked: string[] = [];
    for await (const rel of glob.scan("src")) {
      // i18n-pick.ts je MEHANIZEM pick() (dokumentacija v komentarjih), ne slovar.
      if (rel === "lib/i18n-pick.ts") continue;
      if (PARITY_ALLOWLIST.includes(rel)) continue;
      const text = await Bun.file(`src/${rel}`).text();
      const counts = PARITY_PATTERNS.map(({ re }) => (text.match(re) || []).length);
      const [en, it, de, fr, es] = counts;
      if (en === 0) continue; // slovarji samo-sl se ne štejejo (fallback kanon)
      // Sporočilo nosi pot datoteke, da je padec takoj lokaliziran:
      expect(
        [it, de, fr, es],
        `${rel}: manjka prevod (en=${en}, it=${it}, de=${de}, fr=${fr}, es=${es})`
      ).toEqual([en, en, en, en]);
      checked.push(rel);
    }
    // Varnostna mreža: štetje res obide slovarje (ne prazna zanka) —
    // trenutno jih je ~85; prag 50 dopušča konsolidacijo brez lažnega padca.
    expect(checked.length).toBeGreaterThan(50);
  });
});

// ── ② HREFLANG POKRITOST ────────────────────────────────────────────────────

/** Vseh 36 strani [locale] veje (naslovnica + 35 podstrani). */
const PAGES_WITH_HREFLANG: readonly string[] = [
  "src/app/[locale]/page.tsx",
  "src/app/[locale]/admin/page.tsx",
  "src/app/[locale]/destinacija/[slug]/page.tsx",
  "src/app/[locale]/destinacije/page.tsx",
  "src/app/[locale]/dogodki/page.tsx",
  "src/app/[locale]/dozivetja/page.tsx",
  "src/app/[locale]/go/page.tsx",
  "src/app/[locale]/go/[partner]/page.tsx",
  "src/app/[locale]/kontakt/page.tsx",
  "src/app/[locale]/konzultacija/page.tsx",
  "src/app/[locale]/konzultacija/[token]/page.tsx",
  "src/app/[locale]/lokali/page.tsx",
  "src/app/[locale]/moj-profil/page.tsx",
  "src/app/[locale]/moja-potovanja/page.tsx",
  "src/app/[locale]/na-poti/page.tsx",
  "src/app/[locale]/nacrtuj/page.tsx",
  "src/app/[locale]/notifikacije/page.tsx",
  "src/app/[locale]/owner/izplacila/page.tsx",
  "src/app/[locale]/owner/page.tsx",
  "src/app/[locale]/owner/prijava/page.tsx",
  "src/app/[locale]/owner/provizije/page.tsx",
  "src/app/[locale]/partner/page.tsx",
  "src/app/[locale]/pogoji-uporabe/page.tsx",
  "src/app/[locale]/politika-zasebnosti/page.tsx",
  "src/app/[locale]/pot/[shareId]/page.tsx",
  "src/app/[locale]/potovanje/page.tsx",
  "src/app/[locale]/prijava/page.tsx",
  "src/app/[locale]/primerjava/page.tsx",
  "src/app/[locale]/slovenia-pass/page.tsx",
  "src/app/[locale]/trznica/page.tsx",
  "src/app/[locale]/vir-podatkov/page.tsx",
  "src/app/[locale]/vodici/page.tsx",
  "src/app/[locale]/vodici/[slug]/page.tsx",
  "src/app/[locale]/za-ponudnike/page.tsx",
  "src/app/[locale]/zaupanje-in-varnost/page.tsx",
  "src/app/[locale]/zemljevid/page.tsx",
];

/** Strani, ki hreflang alternates NE smejo izjavljati. */
const PAGES_WITHOUT_HREFLANG: readonly string[] = [
  "src/app/[locale]/[...rest]/page.tsx",
  "src/app/[locale]/layout.tsx",
  "src/app/[locale]/not-found.tsx",
];

describe("i18n-quadrilingual ②: hreflang pokritost strani", () => {
  test("vseh 36 strani izjavlja hreflang (alternatesFor( ali pageMetadata() P1 2.44.0)", async () => {
    expect(PAGES_WITH_HREFLANG.length).toBe(36);
    for (const path of PAGES_WITH_HREFLANG) {
      const code = await Bun.file(path).text();
      // P1 SEO (2.44.0): statične strani kličejo pageMetadata(), ki
      // INTERNO sestavi alternatesFor — hreflang izjava ostane obvezna.
      const declares = code.includes("alternatesFor(") || code.includes("pageMetadata(");
      expect(
        declares,
        `${path} mora vsebovati alternatesFor( ali pageMetadata(`
      ).toBe(true);
    }
  });

  test("catch-all, not-found in layout NE vsebujejo alternatesFor(", async () => {
    for (const path of PAGES_WITHOUT_HREFLANG) {
      const code = await Bun.file(path).text();
      expect(
        code.includes("alternatesFor("),
        `${path} NE sme vsebovati alternatesFor(`
      ).toBe(false);
    }
  });
});

// ── ③ POMOČNIK alternatesFor ────────────────────────────────────────────────

describe("i18n-quadrilingual ③: alternatesFor (enota)", () => {
  test("sl (privzeti) → canonical brez predpone; 6 jezikov + x-default", () => {
    const alt = alternatesFor("sl", "/destinacije");
    expect(alt.canonical).toBe("/destinacije");
    expect(alt.languages.sl).toBe("/destinacije");
    expect(alt.languages.en).toBe("/en/destinacije");
    expect(alt.languages.it).toBe("/it/destinacije");
    expect(alt.languages.de).toBe("/de/destinacije");
    expect(alt.languages.fr).toBe("/fr/destinacije");
    expect(alt.languages.es).toBe("/es/destinacije");
    expect(alt.languages["x-default"]).toBe("/destinacije");
  });

  test("de (neprivzeti) → canonical s predpono; x-default ostane sl pot", () => {
    const alt = alternatesFor("de", "/destinacije/x");
    expect(alt.canonical).toBe("/de/destinacije/x");
    expect(alt.languages.sl).toBe("/destinacije/x");
    expect(alt.languages.de).toBe("/de/destinacije/x");
    expect(alt.languages["x-default"]).toBe("/destinacije/x");
  });

  test("normalizacija: pot brez vodilne / dobi vodilno /", () => {
    expect(alternatesFor("sl", "destinacije")).toEqual({
      canonical: "/destinacije",
      languages: {
        sl: "/destinacije",
        en: "/en/destinacije",
        it: "/it/destinacije",
        de: "/de/destinacije",
        fr: "/fr/destinacije",
        es: "/es/destinacije",
        "x-default": "/destinacije",
      },
    });
  });
});

// ── ④ ROUTING ───────────────────────────────────────────────────────────────

describe("i18n-quadrilingual ④: routing (6 jezikov, predpone as-needed)", () => {
  test("routing.locales vsebuje vseh 6 jezikov (sl privzet)", () => {
    expect([...routing.locales]).toEqual(["sl", "en", "it", "de", "fr", "es"]);
    expect(routing.defaultLocale).toBe("sl");
  });

  test("localePrefixPath: sl brez predpone, ostali s predpono", () => {
    expect(localePrefixPath("sl")).toBe("");
    expect(localePrefixPath("de")).toBe("/de");
    expect(localePrefixPath("en")).toBe("/en");
    expect(localePrefixPath("it")).toBe("/it");
    expect(localePrefixPath("fr")).toBe("/fr");
    expect(localePrefixPath("es")).toBe("/es");
  });
});
