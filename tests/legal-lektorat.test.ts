/**
 * P2 LEKTORAT PRAVNIH STRANI (issue #38, 2.46.0)
 * ============================================================================
 * #38 P2: „Preglej pravne strani /pogoji-uporabe, /politika-zasebnosti in
 * /zaupanje-in-varnost; datum posodobitve spremeni samo, če je bila vsebina
 * dejansko pregledana in posodobljena.“
 *
 * Vsebina je bila dejansko pregledana in popravljena — datum je na vseh
 * treh straneh posodobljen na 2026-10-13. Popravki, ki jih ta datoteka
 * zaklene:
 *
 * ① AFFILIATE REGISTER 1:1 — seznam partnerjev v /pogoji-uporabe mora biti
 *   IDENTEN kanonu registra (src/lib/affiliate-providers.ts, brez
 *   nekomercialnega „osm-fuel“ plasta): prej je manjkala Kiwi.com in
 *   Rentalcars.com, „Viator“ je bil brez (Tripadvisor), Kiwitaxi pa je
 *   bil napačno vmes kot affiliateski partner — prevozi so zdaj izrecno
 *   ločeni (kanon supply/providers/kiwitaxi: rezervacija = ZUNANJA
 *   affiliate povezava).
 * ② OSLIČEN OSTARELI ZAPIS: „Slike … (Unsplash, OpenStreetMap)“ je
 *   mešal SLIKE z zemljevidnimi PODATKI — zdaj: slike (Unsplash), zemljevidi
 *   in POI (© prispevavalci OpenStreetMap, licenca ODbL) ločeno.
 * ③ B2B CENE + SLOVNICA (sl): „€149/mesec“, „€499/mesec“ (celostavčni
 *   zapis namesto okrajšave „/mes“) in „se obračunava mesečno“
 *   (nedelesknjižni glagol za ponavljajoče se obračunavanje).
 * ④ GDPR KATALOG PRAVIC POPOLN (vseh 6 jezikov): vpogled, popravek,
 *   izbris, OMEJITEV OBDELAVE, UGOVOR in PRENOSLJIVOST (prej sta manjkala
 *   omejitev obdelave + ugovor, „prenosa“ → „prenosljivosti“).
 * ⑤ ZAUPANJE-IN-VARNOST SLOVNICA: „avtomatsko izračunan oceni profil“ →
 *   „avtomatsko izračunano oceno profila“; knjižno „lokal“ namesto
 *   neknjižnega „lokalce“; „premium boosta“ brez vezaja.
 * ⑥ DATUM SPODOBLJEN: updated="2026-10-13" na VSEH treh straneh —
 *   vsebina je bila dejansko pregledana in popravljena (kanon #38:
 *   datum se spremeni SAMO tedaj).
 * ⑦ STRUKTURNA PARITETA: vsaka pravna stran definira vseh 6 jezikov
 *   (sl/en/it/de/fr/es) z enakim naborom id-jev razdelkov.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AFFILIATE_PROVIDERS } from "../src/lib/affiliate-providers";

const ROOT = join(import.meta.dir, "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const POGOJI = read("src/app/[locale]/pogoji-uporabe/view.tsx");
const ZASEBNOST = read("src/app/[locale]/politika-zasebnosti/view.tsx");
const ZAUPANJE = read("src/app/[locale]/zaupanje-in-varnost/view.tsx");

/** Telo od `const SL:` dalje — brez dokumentacijskega komentarja glave. */
function body(src: string): string {
  return src.slice(src.indexOf("const SL: LegalSection[]"));
}

const POGOJI_B = body(POGOJI);
const ZASEBNOST_B = body(ZASEBNOST);
const ZAUPANJE_B = body(ZAUPANJE);

/** SL blok pogojev (od `const SL` do `const EN`) — komentarji izven njega. */
function slBlock(src: string): string {
  const start = src.indexOf("const SL: LegalSection[]");
  const end = src.indexOf("const EN: LegalSection[]");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

// ── ① — affiliate register 1:1 s kanonom ──────────────────────────────────

describe("lektorat ①: affiliate seznam = register (brez osm-fuel)", () => {
  const kanon = AFFILIATE_PROVIDERS.filter((p) => p.id !== "osm-fuel").map(
    (p) => p.name
  );
  const kanonNiz = kanon.join(", ");

  test("kanon registra: 12 komercialnih partnerjev, točna imena", () => {
    expect(kanon).toContain("Kiwi.com");
    expect(kanon).toContain("Rentalcars.com");
    expect(kanon).toContain("Viator (Tripadvisor)");
    expect(kanon).not.toContain("Viator");
    expect(kanon).not.toContain("Kiwitaxi"); // prevozi = ločen kanon
    expect(kanon.length).toBe(12);
  });

  for (const [loc, vzorec, ime] of [
    ["sl", /povezave \((.+)\) ter povezave za prevoze/, "Pogoji (SL)"],
    ["en", /affiliate links \((.+)\) as well as/, "Pogoji (EN)"],
    ["it", /affiliazione \((.+)\) oltre ai link/, "Pogoji (IT)"],
    ["de", /Affiliate-Links \((.+)\) sowie/, "Pogoji (DE)"],
    ["fr", /affiliation \((.+)\) ainsi que/, "Pogoji (FR)"],
    ["es", /afiliaci[óo]n \((.+)\) adem[áa]s/, "Pogoji (ES)"],
  ] as const) {
    test(`${ime}: seznam v besedilu je IDENTEN kanonu`, () => {
      // požrešni match do jezikovno specifičnega nadaljevanja — notranje
      // oklepaje imena „Viator (Tripadvisor)“ ne smejo poknjati zajema:
      const m = POGOJI_B.match(vzorec);
      expect(m, String(loc)).toBeTruthy();
      expect(m![1]).toBe(kanonNiz);
    });
  }

  test("Kiwitaxi izrecno kot PREVOZI (vseh 6 jezikov)", () => {
    for (const fraza of [
      "povezave za prevoze Kiwitaxi",
      "Kiwitaxi transfer links",
      "trasferimenti Kiwitaxi",
      "Kiwitaxi-Transferlinks",
      "transfert Kiwitaxi",
      "traslados de Kiwitaxi",
    ]) {
      expect(POGOJI).toContain(fraza);
    }
  });

  test("stari okvarjeni seznam ne sme obstajati (manjkajoči/izmišljeni vnosi)", () => {
    expect(POGOJI_B).not.toContain("Kiwitaxi, Omio");
    expect(POGOJI_B).not.toContain("Tiqets in Viator");
  });
});

// ── ② — slike vs zemljevidni podatki (ODbL atribucija) ───────────────────

describe("lektorat ②: Unsplash ≠ OpenStreetMap (ODbL)", () => {
  test("sl: slike iz Unsplash; zemljevidi/POI = © prispevavalci OpenStreetMap (ODbL)", () => {
    expect(POGOJI).toContain(
      "Slike destinacij so pridobljene iz odprtih virov (Unsplash)."
    );
    expect(POGOJI).toContain(
      "Zemljevidi in točke interesa izhajajo iz odprtih podatkov OpenStreetMap — © prispevavalci OpenStreetMap (licenca ODbL)."
    );
  });

  test("vseh 6 jezikov nosi ODbL atribucijo (telo, brez komentarja glave)", () => {
    expect(POGOJI_B.match(/ODbL/g)?.length).toBe(6);
    expect(POGOJI_B.match(/© /g)?.length).toBe(6);
  });

  test("stari mešani zapis (Unsplash, OpenStreetMap) je odstranjen", () => {
    expect(POGOJI_B).not.toContain("Unsplash, OpenStreetMap");
  });

  test("MIT licenca: navedba ostane (lastnikova izjava), formulacija „objavljena pod“", () => {
    expect(POGOJI_B).toContain("Vsebina platforme je objavljena pod licenco MIT");
    expect(POGOJI_B).not.toContain("zaščitena z MIT licenco");
  });
});

// ── ③ — B2B cene + slovnica (sl) ──────────────────────────────────────────

describe("lektorat ③: cene €/mesec + obračunava (sl)", () => {
  test("€149/mesec in €499/mesec (ne okrajšava /mes v slovenščini)", () => {
    expect(POGOJI_B).toContain("Premium €149/mesec");
    expect(POGOJI_B).toContain("Enterprise €499/mesec");
    // okrajšava je v drugih jezikih legitimna (es: „mes“ = mesec) — samo sl blok:
    expect(slBlock(POGOJI)).not.toMatch(/€149\/mes,/);
  });

  test("nedelesknjižni glagol za ponavljajoče obračunavanje", () => {
    expect(POGOJI_B).toContain("se obračunava mesečno");
    expect(slBlock(POGOJI)).not.toContain("se obračuna mesečno");
  });
});

// ── ④ — GDPR katalog pravic (6 jezikov) ───────────────────────────────────

describe("lektorat ④: GDPR pravice popolne (6 jezikov)", () => {
  test("sl: vseh 6 pravic", () => {
    const pravice = slBlock(ZASEBNOST).slice(
      slBlock(ZASEBNOST).indexOf("V skladu s GDPR")
    );
    expect(pravice).toContain("vpogleda");
    expect(pravice).toContain("popravka");
    expect(pravice).toContain("izbrisa");
    expect(pravice).toContain("omejitve obdelave");
    expect(pravice).toContain("ugovora");
    expect(pravice).toContain("prenosljivosti");
    // stari nepopoln zapis ne sme obstajati
    expect(pravice).not.toContain("prenosa svojih podatkov");
    expect(pravice).not.toContain("pravico do: vpogleda");
  });

  test("en: restriction of processing + objection + portability", () => {
    expect(ZASEBNOST).toContain("restriction of processing");
    expect(ZASEBNOST).toContain("objection");
    expect(ZASEBNOST).toContain("portability");
  });

  test("it/de/fr/es: limitazione/Einschränkung/limitation/limitación + opposizione/Widerspruch/opposition/oposición", () => {
    expect(ZASEBNOST).toContain("limitazione del trattamento");
    expect(ZASEBNOST).toContain("Einschränkung der Verarbeitung");
    expect(ZASEBNOST).toContain("limitation du traitement");
    expect(ZASEBNOST).toContain("limitación del tratamiento");
    expect(ZASEBNOST).toContain("opposizione");
    expect(ZASEBNOST).toContain("Widerspruch");
    expect(ZASEBNOST).toContain("oposición");
  });

  test("sl newsletter: „se naročite na novice“ (pravilni refleksiv)", () => {
    expect(slBlock(ZASEBNOST)).toContain("se naročite na novice (newsletter)");
    expect(slBlock(ZASEBNOST)).not.toContain("prijavite na newsletter");
  });
});

// ── ⑤ — zaupanje-in-varnost slovnica (sl) ────────────────────────────────

describe("lektorat ⑤: zaupanje-in-varnost (sl slovnica)", () => {
  test("„avtomatsko izračunano oceno profila“ (ne „izračunan oceni profil“)", () => {
    expect(ZAUPANJE).toContain("avtomatsko izračunano oceno profila");
    expect(slBlock(ZAUPANJE)).not.toContain("oceni profil");
  });

  test("knjižno „lokal“ namesto neknjižnega „lokalce“", () => {
    const sl = slBlock(ZAUPANJE);
    expect(sl).not.toContain("lokalci");
    expect(sl).not.toContain("lokalca");
    expect(sl).toContain("Nepotrjeni lokali niso vidni uporabnikom");
    expect(sl).toContain("Kakovost profila lokala");
    expect(sl).toContain("slabega lokala");
    expect(sl).toContain("Lokali z oceno pod 3,5");
  });

  test("„premium boosta“ brez vezaja", () => {
    expect(ZAUPANJE).toContain("premium boosta");
    expect(ZAUPANJE).not.toContain("boost-a");
  });
});

// ── ⑥ — datumi: posodobljeni, ker je bila vsebina dejansko spremenjena ───

describe("lektorat ⑥: datum = 2026-10-13 (vsebina dejansko popravljena)", () => {
  test("vseh 3 strani", () => {
    for (const [ime, src] of [
      ["pogoji-uporabe", POGOJI],
      ["politika-zasebnosti", ZASEBNOST],
      ["zaupanje-in-varnost", ZAUPANJE],
    ] as const) {
      expect(src, ime).toContain('updated="2026-10-13"');
      expect(src, ime).not.toContain('updated="2025"');
    }
  });
});

// ── ⑦ — strukturna pariteta: 6 jezikov na stran ──────────────────────────

describe("lektorat ⑦: strukturna pariteta (6 jezikov × število razdelkov)", () => {
  const locales = ["SL", "EN", "IT", "DE", "FR", "ES"] as const;

  function sectionIds(src: string, loc: string): string[] {
    const start = src.indexOf(`const ${loc}: LegalSection[]`);
    const tail = src.slice(start);
    const end =
      loc === "ES"
        ? tail.indexOf("const SECTIONS")
        : tail.indexOf(`const ${locales[locales.indexOf(loc as never) + 1]}:`);
    const block = tail.slice(0, end);
    return [...block.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
  }

  for (const [ime, src] of [
    ["pogoji-uporabe", POGOJI],
    ["politika-zasebnosti", ZASEBNOST],
    ["zaupanje-in-varnost", ZAUPANJE],
  ] as const) {
    test(`${ime}: vseh 6 jezikov z ISTIM ŠTEVILOM razdelkov + unikatni id-ji`, () => {
      const base = sectionIds(src, "SL");
      expect(base.length).toBeGreaterThanOrEqual(4);
      expect(new Set(base).size, `${ime}/SL unikatni id`).toBe(base.length);
      for (const loc of locales.slice(1)) {
        const ids = sectionIds(src, loc);
        expect(ids.length, `${ime}/${loc}`).toBe(base.length);
        expect(new Set(ids).size, `${ime}/${loc} unikatni id`).toBe(ids.length);
      }
    });
  }

  test("SECTIONS mape nosijo vseh 6 jezikov", () => {
    for (const src of [POGOJI, ZASEBNOST, ZAUPANJE]) {
      expect(src).toMatch(/const SECTIONS: Record<string, LegalSection\[\]> = \{[\s\S]*?sl: SL,[\s\S]*?en: EN,[\s\S]*?it: IT,[\s\S]*?de: DE,[\s\S]*?fr: FR,[\s\S]*?es: ES,[\s\S]*?\};/);
    }
  });
});
