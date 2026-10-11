/**
 * INTERESTS-I18N (QA U4, 2026-10-11) — prikazna preslikava interesnih žetonov.
 *
 * Zaklene kanone:
 *  - POPOLNA POKRITOST čipov: vsak label interestChips() (activities ∪
 *    bestFor, združeni po normText) ima vnos v INTEREST_DISPLAY — če nabor
 *    destinacij doda dejavnost, test takoj javi manjkajoči prevod;
 *  - POKRITOST baznih žetonov skript: NLU INTEREST_RULES (17 žetonov) +
 *    Start Anywhere TYPE_INTERESTS (grad, reka, …) — kanonski žetoni, ki
 *    jih skripta izžre v form.interests, morajo biti prevedeni;
 *  - ISKRENA REZERVA: neznan žeton → surov žeton (nikoli skrito/izmišljeno);
 *  - sl → vedno surov žeton (slovenščina je kanon);
 *  - velike/male začetnice in diakritiki ne vplivajo (normText ključi);
 *  - QA REPRO: EN poizvedba „family weekend by the lake with cycling" je
 *    skripta prevedla na žetone družina/jezero/kolo — prikaz v EN vmesniku
 *    mora biti family/lake/cycling (naslov načrta je bil preveden, čipi niso).
 */

import { describe, expect, test } from "bun:test";

import { interestChips, normText } from "../src/lib/itinerary-engine";
import { INTEREST_DISPLAY, interestDisplay } from "../src/lib/interests-i18n";

/** Vsi jeziki razen sl (sl = surov kanon). */
const NON_SL = ["en", "it", "de", "fr", "es"] as const;

/** Bazni žetoni NLU INTEREST_RULES (niso izvoženi — kanonski seznam skripte). */
const NLU_BASE_TOKENS = [
  "družina",
  "gora",
  "pohodništvo",
  "jezero",
  "morje",
  "mesto",
  "kulinarika",
  "vino",
  "kultura",
  "zdravje",
  "smučanje",
  "kolo",
  "narava",
  "avantura",
  "jame",
  "soteska",
  "plavanje",
] as const;

/** Dodatni bazni žetoni Start Anywhere (TYPE_INTERESTS: tip destinacije). */
const SA_TYPE_TOKENS = ["grad", "reka"] as const;

describe("interests-i18n: popolna pokritost slovarja", () => {
  test("vsak čip interestChips() ima prevod za vseh 5 ne-slovenskih jezikov", () => {
    const chips = interestChips();
    expect(chips.length).toBeGreaterThanOrEqual(24); // priljubljenih 24 + ostali
    for (const chip of chips) {
      const key = normText(chip.label);
      const entry = INTEREST_DISPLAY[key];
      if (!entry) throw new Error(`Manjka prevod za čip "${chip.label}" (ključ "${key}")`);
      for (const lang of NON_SL) {
        expect(entry[lang].length).toBeGreaterThan(0);
      }
    }
  });

  test("bazni žetoni NLU (INTEREST_RULES) so prevedeni", () => {
    for (const token of NLU_BASE_TOKENS) {
      const entry = INTEREST_DISPLAY[normText(token)];
      if (!entry) throw new Error(`Manjka prevod za NLU žeton "${token}"`);
      for (const lang of NON_SL) {
        expect(entry[lang].length).toBeGreaterThan(0);
      }
    }
  });

  test("bazni žetoni Start Anywhere (TYPE_INTERESTS) so prevedeni", () => {
    for (const token of SA_TYPE_TOKENS) {
      const entry = INTEREST_DISPLAY[normText(token)];
      if (!entry) throw new Error(`Manjka prevod za SA žeton "${token}"`);
      for (const lang of NON_SL) {
        expect(entry[lang].length).toBeGreaterThan(0);
      }
    }
  });

  test("vsak ključ slovarja je normaliziran (normText stabilen — brez mrtvih ključev)", () => {
    for (const key of Object.keys(INTEREST_DISPLAY)) {
      expect(normText(key)).toBe(key);
    }
  });
});

describe("interests-i18n: prikaz po jezikih", () => {
  test("QA repro: družina/jezero/kolo v EN vmesniku → family/lake/cycling", () => {
    expect(interestDisplay("družina", "en")).toBe("family");
    expect(interestDisplay("jezero", "en")).toBe("lake");
    expect(interestDisplay("kolo", "en")).toBe("cycling");
  });

  test("velikost začetnice čipa ne vpliva (Pohodništvo ≡ pohodništvo)", () => {
    expect(interestDisplay("Pohodništvo", "en")).toBe("hiking");
    expect(interestDisplay("pohodništvo", "en")).toBe("hiking");
    expect(interestDisplay("Smučanje", "de")).toBe("Skifahren");
    expect(interestDisplay("SMUČANJE", "de")).toBe("Skifahren");
  });

  test("sl vedno vrne surov žeton (slovenščina je kanon)", () => {
    expect(interestDisplay("družina", "sl")).toBe("družina");
    expect(interestDisplay("Pohodništvo", "sl")).toBe("Pohodništvo");
    expect(interestDisplay("nepoznan-žeton", "sl")).toBe("nepoznan-žeton");
  });

  test("neznan žeton → iskrena rezerva: surov žeton v vseh jezikih", () => {
    for (const lang of [...NON_SL, "sl"]) {
      expect(interestDisplay("kremšnita", lang)).toBe("kremšnita");
      expect(interestDisplay("moja-želja", lang)).toBe("moja-želja");
    }
  });

  test("nekaj točkovnih prevodov po jezikih (it/de/fr/es)", () => {
    expect(interestDisplay("družina", "it")).toBe("famiglia");
    expect(interestDisplay("družina", "de")).toBe("Familie");
    expect(interestDisplay("družina", "fr")).toBe("famille");
    expect(interestDisplay("družina", "es")).toBe("familia");
    expect(interestDisplay("jame", "it")).toBe("grotte");
    expect(interestDisplay("soteska", "de")).toBe("Schlucht");
    expect(interestDisplay("grad", "fr")).toBe("château");
    expect(interestDisplay("reka", "es")).toBe("río");
  });

  test("neznan locale → slovenščina (asPickLocale fallback → surov žeton)", () => {
    expect(interestDisplay("družina", "xx-YY")).toBe("družina");
  });

  test("determinizem: isti vhod → isti izhod (5×)", () => {
    for (let i = 0; i < 5; i++) {
      expect(interestDisplay("Sončni zahod", "fr")).toBe("coucher de soleil");
      expect(interestDisplay("Kolo ob Krki", "it")).toBe("Ciclopedalata lungo la Krka");
    }
  });
});
