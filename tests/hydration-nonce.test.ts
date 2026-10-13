/**
 * POLIR10 (2.37.0) — HIDRACIJSKI MISMATCH: nonce na JSON-LD skriptah.
 * ============================================================================
 * Živi dokaz (dev :4003, React dev diff, light+dark, vsi jeziki):
 *   <script type="application/ld+json"
 *   + nonce="YjVlYWY2OTUt…"   ← strežnik (middleware x-nonce)
 *   - nonce=""                ← odjemalec (flight/RSC podatki)
 *   Opozorje: „A tree hydrated but some attributes of the server rendered
 *   HTML didn't match the client properties." (console.error) na / ×6
 *   jezikov in /destinacija/[slug] ×38 slugov ×6 jezikov.
 *
 * Mehanizem: `nonce` je PER-ZAHTEVEK atribut (middleware → x-nonce →
 * headers()). Ob hidraciji odjemalec primerja atribut DOM elementa z
 * vrednostjo iz flight podatkov — tam je nonce prazen niz → primerjava
 * različna → React opozori. VSEBINA skripte (JSON-LD) je deterministična
 * in se NE razlikuje — razlika je SAMO atribut.
 *
 * Rešitev (react.dev, kanon „suppressHydrationWarning"): React ne opozori
 * o neujemanju ATRIBUTOV in vsebine TEGA elementa (en nivo globoko,
 * escape hatch za ravno te primere). ENAK vzorec že uporablja next-themes
 * na <html> v [locale]/layout.tsx — POLIR10 ga le razširi na <script>.
 * nonce atribut OSTANE v izpisanem HTML (produkcjska CSP bi brez njega
 * skripto blokirala — zaklep POLIR6 ostaja nedotaknjen).
 *
 * Ta datoteka: SOURCE-CONTRACT popravljenih strani + defenzivni zaklepi
 * (natanko 3 ld+json skripti v src/, vsaka z utišanjem; 2.45.0: + /dogodki
 * Event @graph — QA #38) + regresija layouta
 * + čistost JSON vsebine (per-zahtevni nonce živi SAMO v atributu).
 * UI komponente se NE importuje (0 omrežja, 0 DOM, 0 AI) — ista dvojna
 * plast kot reflow-320.test.ts / jsonld-schema.test.ts.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import {
  jsonldScriptHtml,
  softwareApplicationJsonLd,
  touristDestinationJsonLd,
} from "../src/lib/jsonld";
import { DESTINATIONS, getDestination } from "../src/lib/slovenia-data";

const PAGE_DOMOV = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/page.tsx"),
  "utf8"
);

const PAGE_DESTINACIJA = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/destinacija/[slug]/page.tsx"),
  "utf8"
);

const PAGE_DOGODKI = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/dogodki/page.tsx"),
  "utf8"
);

const LAYOUT = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/layout.tsx"),
  "utf8"
);

/** Koren izvorne kode (za defenzivno hojo po celem src/). */
const SRC_KOREN = join(import.meta.dir, "../src");

/**
 * Odstrani blokovne komentarje (/* … *\/ vključno z docblocki in JSX
 * {/* … *\/). Proza v komentarjih NI element — src/lib/jsonld.ts omenja
 * vzorec <script type="application/ld+json" le v dokumentacijski prozi
 * (vrstici 21 in 186), torej ju moramo za štetje ELEMENTOV izločiti.
 */
function brezBlokovnihKomentarjev(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Izlušči vse <script … /> JSX elemente iz (očiščene) izvorne datoteke.
 * Multivrstični elementi (atributi v svojih vrsticah) so podprti prek
 * [\s\S]*? do zaključnega />.
 */
function scriptElementi(src: string): string[] {
  return src.match(/<script\b[\s\S]*?\/>/g) ?? [];
}

/** Rekurzivna hoja po src/ — vse .ts/.tsx datoteke (polne poti). */
function srcDatoteke(pot: string): string[] {
  const vse: string[] = [];
  for (const vnos of readdirSync(pot, { withFileTypes: true })) {
    const polna = join(pot, vnos.name);
    if (vnos.isDirectory()) {
      vse.push(...srcDatoteke(polna));
    } else if (vnos.isFile() && /\.(ts|tsx)$/.test(vnos.name)) {
      vse.push(polna);
    }
  }
  return vse;
}

// ── ① SOURCE-CONTRACT: domača stran — ld+json skripta z utišanjem ───────────

describe("POLIR10: domača stran ([locale]/page.tsx) — ld+json + nonce + utišanje", () => {
  test("① ena sama ld+json skripta, v njej VSI štirje atributi: type, nonce, suppressHydrationWarning, dangerouslySetInnerHTML", () => {
    const elementi = scriptElementi(brezBlokovnihKomentarjev(PAGE_DOMOV));
    const ld = elementi.filter((e) => e.includes('type="application/ld+json"'));
    // natanko ENA ld+json skripta na strani:
    expect(ld.length).toBe(1);
    // vsi štirje atributi v ISTI skripti (isti element):
    expect(ld[0]).toContain('type="application/ld+json"');
    expect(ld[0]).toContain("nonce={nonce}");
    expect(ld[0]).toContain("suppressHydrationWarning");
    expect(ld[0]).toContain("dangerouslySetInnerHTML");
    // varno telo (ubežni '<'), ne surovi JSON.stringify:
    expect(ld[0]).toContain("jsonldScriptHtml(softwareApplicationJsonLd(locale))");
    expect(ld[0]).not.toContain("__html: JSON.stringify(");
    // v DATOTEKI ni ld+json skripte BREZ utišanja (defenzivno):
    const brez = ld.filter((e) => !e.includes("suppressHydrationWarning"));
    expect(brez.length).toBe(0);
  });
});

// ── ② SOURCE-CONTRACT: destinacija — ld+json skripta z utišanjem ────────────

describe("POLIR10: destinacija ([locale]/destinacija/[slug]/page.tsx) — ld+json + nonce + utišanje", () => {
  test("② ena sama ld+json skripta, v njej VSI štirje atributi (destinacijski gradilnik)", () => {
    const elementi = scriptElementi(brezBlokovnihKomentarjev(PAGE_DESTINACIJA));
    const ld = elementi.filter((e) => e.includes('type="application/ld+json"'));
    expect(ld.length).toBe(1);
    expect(ld[0]).toContain('type="application/ld+json"');
    expect(ld[0]).toContain("nonce={nonce}");
    expect(ld[0]).toContain("suppressHydrationWarning");
    expect(ld[0]).toContain("dangerouslySetInnerHTML");
    expect(ld[0]).toContain("jsonldScriptHtml(touristDestinationJsonLd(d, locale))");
    expect(ld[0]).not.toContain("__html: JSON.stringify(");
    const brez = ld.filter((e) => !e.includes("suppressHydrationWarning"));
    expect(brez.length).toBe(0);
  });
});

// ── ③ KANON NONCE: middleware → x-nonce → headers() (zaklep vzorca) ────────

describe("POLIR10: kanon nonce (nextjs.org CSP vodnik — middleware → glava → stran)", () => {
  test("③ vse tri strani berejo nonce iz (await headers()).get(\"x-nonce\") ?? \"\" (isti vzorec kot layout)", () => {
    const kanon = '(await headers()).get("x-nonce") ?? ""';
    expect(PAGE_DOMOV).toContain(kanon);
    expect(PAGE_DESTINACIJA).toContain(kanon);
    expect(PAGE_DOGODKI).toContain(kanon); // 2.45.0 (#38): Event @graph
    // nonce se NE sme odstraniti (produkcjska CSP bi blokirala skripto) —
    // zaklep POLIR6 (glave ≡ skripte) ostaja nedotaknjen:
    expect(PAGE_DOMOV).toContain("nonce={nonce}");
    expect(PAGE_DESTINACIJA).toContain("nonce={nonce}");
    expect(PAGE_DOGODKI).toContain("nonce={nonce}");
  });
});

// ── ④ DEFENZIVNO: natanko 3 ld+json skripti v celem src/, vsaka z utišanjem ───

describe("POLIR10: defenzivni zaklep — NATANKO 3 ld+json skripti v src/, VSAKA z utišanjem", () => {
  test("④ hoja po vsem src/ poišče natanko 3 ld+json elementa, vsi z nonce + suppressHydrationWarning (nobena nova brez utišanja)", () => {
    const najdeni: { datoteka: string; element: string }[] = [];
    for (const pot of srcDatoteke(SRC_KOREN)) {
      const cisto = brezBlokovnihKomentarjev(readFileSync(pot, "utf8"));
      for (const element of scriptElementi(cisto)) {
        if (element.includes('type="application/ld+json"')) {
          najdeni.push({ datoteka: pot, element });
        }
      }
    }
    // NATANKO 3 ld+json skripti v celotnem src/ (domov + destinacija + dogodki;
    // 2.45.0 #38: nova skripta zahteva zavesten update tega zaklepa):
    expect(najdeni.length).toBe(3);
    // vsaka ima tako utišanje KOT nonce (utrežena hidracija + CSP živ):
    for (const { datoteka, element } of najdeni) {
      expect(element, datoteka).toContain("suppressHydrationWarning");
      expect(element, datoteka).toContain("nonce={nonce}");
    }
    // in sta natanko na pričakovanih poteh (drift poti takoj pade):
    const poti = najdeni
      .map((n) => n.datoteka.replace(SRC_KOREN + "/", ""))
      .sort();
    expect(poti).toEqual([
      "app/[locale]/destinacija/[slug]/page.tsx",
      "app/[locale]/dogodki/page.tsx",
      "app/[locale]/page.tsx",
    ]);
  });
});

// ── ⑤ REGRESIJA: next-themes kanon na <html> ostaja ─────────────────────────

describe("POLIR10: regresija — <html> v [locale]/layout.tsx ohranja suppressHydrationWarning (next-themes)", () => {
  test("⑤ <html lang={locale} suppressHydrationWarning … (kanon iz POLIR10 raziskave ostaja nedotaknjen)", () => {
    expect(LAYOUT).toContain(
      '<html lang={locale} suppressHydrationWarning'
    );
  });
});

// ── ⑥ ČISTOST VSEBINE: nonce živi SAMO v atributu, nikoli v JSON ────────────

describe("POLIR10: JSON vsebina brez per-zahtevnih vrednosti (nonce samo atribut)", () => {
  test("⑥ jsonldScriptHtml(…) izpis vseh 6 jezikov + vseh 38 destinacij NE vsebuje žetona \"nonce\"", () => {
    // Če bi per-zahtevni nonce kdaj pretekel v JSON vsebino, bi hidracijska
    // razlika postala NEdeterministična tudi po vsebini (in CSP nonce bi
    // puščal v iskalne kazale). Vsebina mora ostati per-jezikovno fiksna.
    const izpisi: string[] = [];
    for (const locale of ["sl", "en", "it", "de", "fr", "es", "xx"]) {
      izpisi.push(jsonldScriptHtml(softwareApplicationJsonLd(locale)));
    }
    for (const d of DESTINATIONS) {
      izpisi.push(jsonldScriptHtml(touristDestinationJsonLd(d, "sl")));
      izpisi.push(jsonldScriptHtml(touristDestinationJsonLd(d, "en")));
    }
    expect(DESTINATIONS.length).toBe(38); // kanon nabora (slovenia-data.test)
    expect(izpisi.length).toBe(7 + 38 * 2);
    for (const izpis of izpisi) {
      expect(izpis).not.toContain("nonce");
      expect(izpis).not.toContain("Nonce");
    }
    // negativni dokaz, da preverba dejansko kaj šteje (žeton bi se ulovil):
    expect(jsonldScriptHtml({ nonce: "a", b: 1 })).toContain("nonce");
    // determinizem izpisa ostaja (isti vhod → isti niz):
    const bled = getDestination("bled")!;
    expect(jsonldScriptHtml(touristDestinationJsonLd(bled, "sl"))).toBe(
      jsonldScriptHtml(touristDestinationJsonLd(bled, "sl"))
    );
  });
});
