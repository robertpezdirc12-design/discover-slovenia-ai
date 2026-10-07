/**
 * I18N-PICK — 6-jezikovna lupina z delnimi slovarji (rekonstrukcija 48-b).
 *
 * Kanon: lokalni slovar { sl: T } + neobvezni en/it/de/fr/es; kadar slovar
 * nima vnosa za aktivni jezik → SLOVENSKA rezerva (resnica). To je most,
 * ki omogoča postopno prevajanje brez preloma obstoječih { sl, en } komponent.
 */

import { describe, expect, test } from "bun:test";

import {
  APP_LANGUAGES,
  PICK_LOCALES,
  isPickLocale,
  pick,
  localeName,
} from "../src/lib/i18n-pick";

describe("i18n-pick: pick()", () => {
  test("sl → slovenski vnos", () => {
    expect(pick("sl", { sl: "Zemljevid", en: "Map" })).toBe("Zemljevid");
  });

  test("en → angleški vnos", () => {
    expect(pick("en", { sl: "Zemljevid", en: "Map" })).toBe("Map");
  });

  test("it s slovarjem { sl, en } → slovenska rezerva (delni slovar)", () => {
    expect(pick("it", { sl: "Zemljevid", en: "Map" })).toBe("Zemljevid");
  });

  test("de/fr/es brez prevoda → slovenska rezerva", () => {
    const L = { sl: "Načrt", en: "Plan" };
    expect(pick("de", L)).toBe("Načrt");
    expect(pick("fr", L)).toBe("Načrt");
    expect(pick("es", L)).toBe("Načrt");
  });

  test("it s prevodom → italijanski vnos", () => {
    expect(
      pick("it", { sl: "Zemljevid", it: "Mappa" })
    ).toBe("Mappa");
  });

  test("neznan locale → slovenščina (fail-safe)", () => {
    expect(pick("xx", { sl: "Zemljevid", en: "Map" })).toBe("Zemljevid");
  });

  test("objektni vnosi (gnezdeni slovarji) delujejo enako", () => {
    const L = {
      sl: { title: "Kam na izlet?", cta: "Načrtuj" },
      en: { title: "Where to?", cta: "Plan" },
    };
    expect(pick("en", L).cta).toBe("Plan");
    expect(pick("de", L).title).toBe("Kam na izlet?");
  });
});

describe("i18n-pick: lokali", () => {
  test("PICK_LOCALES: 6 jezikov, sl prvi", () => {
    expect(PICK_LOCALES.length).toBe(6);
    expect(PICK_LOCALES[0]).toBe("sl");
    expect(PICK_LOCALES).toContain("it");
    expect(PICK_LOCALES).toContain("de");
    expect(PICK_LOCALES).toContain("fr");
    expect(PICK_LOCALES).toContain("es");
  });

  test("isPickLocale prepozna veljavne, zavrne smeti", () => {
    for (const l of PICK_LOCALES) expect(isPickLocale(l)).toBe(true);
    expect(isPickLocale("hr")).toBe(false);
    expect(isPickLocale("")).toBe(false);
  });

  test("APP_LANGUAGES ima vseh 6 jezikov z domačimi imeni", () => {
    expect(APP_LANGUAGES.length).toBe(6);
    const natives = APP_LANGUAGES.map((l) => l.native);
    expect(natives).toContain("Slovenščina");
    expect(natives).toContain("Italiano");
    expect(natives).toContain("Deutsch");
    expect(natives).toContain("Français");
    expect(natives).toContain("Español");
    // kode so veljavni lokalI v PICK_LOCALES
    for (const l of APP_LANGUAGES) expect(isPickLocale(l.code)).toBe(true);
  });

  test("localeName: sl → Slovenščina, en → English", () => {
    expect(localeName("sl")).toBe("Slovenščina");
    expect(localeName("en")).toBe("English");
  });
});
