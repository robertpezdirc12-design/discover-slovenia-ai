/**
 * COUNTRIES-F41 — zaklepi balkanske ekspanzije Faza 0 (#41, 2.54.0).
 * ============================================================================
 * #41 F0 merila: CountryCode pokriva cel Balkan (10 držav), državna meta
 * (imena 6 jezikov, valuta, emergency, klicna, eSIM cona) je POPOLNA za
 * vse ključe, `eventCountry` je enoten dostop z defaultom "SI" (obstoječih
 * 31 dogodkov NE spreminjamo — kanon #38), državni filter destinacij ima
 * URL semantiko (neznana → prazen rezultat) in `activeCountryKeys` vrne
 * kanonski geografski vrstni red. Iskrenostni kanon: velikost COUNTRIES
 * ≠ države z vsebino (nabor destinacij ostaja 38 po 4 državah do F1).
 */

import { describe, expect, test } from "bun:test";

import {
  ALL_COUNTRY_CODES,
  COUNTRIES,
  countryLabel,
  countryName,
  isNewInF0,
} from "../src/lib/countries-data";
import {
  activeCountryKeys,
  filterDestinations,
  hasActiveFilters,
} from "../src/lib/destinations-filter";
import {
  DESTINATIONS,
  type CountryCode,
} from "../src/lib/slovenia-data";
import {
  EVENTS,
  eventCountry,
} from "../src/lib/content-data";

const ALL: CountryCode[] = ["SI", "HR", "BA", "RS", "ME", "XK", "AL", "MK", "BG", "GR"];

describe("countries-f41 (#41 F0): državna meta", () => {
  test("①a COUNTRIES pokriva točno cel Balkan (10 ključev, kanonski vrstni red)", () => {
    expect(Object.keys(COUNTRIES).sort()).toEqual([...ALL].sort());
    expect(ALL_COUNTRY_CODES).toEqual(ALL);
  });

  test("①b vsaka država ima popolno meta (zastava, 6 jezikov, valuta, klicna, emergency, eSIM)", () => {
    for (const code of ALL) {
      const m = COUNTRIES[code];
      expect(m.code).toBe(code);
      expect(m.flag.length).toBeGreaterThan(0);
      for (const loc of ["sl", "en", "it", "de", "fr", "es"] as const) {
        expect(m.names[loc].length).toBeGreaterThan(2);
      }
      expect(m.currency.length).toBe(3);
      expect(m.primaryLanguage.length).toBe(2);
      expect(m.emergency.length).toBeGreaterThanOrEqual(3);
      expect(m.phoneCode).toMatch(/^\d{2,3}$/);
      expect(["EU/EEA", "Balkan", "Evropa"]).toContain(m.eSIMZone);
    }
  });

  test("①c fakta po ISO/uradnih virih: valute, klicne, emergency", () => {
    expect(COUNTRIES.SI.currency).toBe("EUR");
    expect(COUNTRIES.HR.currency).toBe("EUR"); // hrvaški evro od 2023
    expect(COUNTRIES.ME.currency).toBe("EUR"); // unilateralna evrizacija
    expect(COUNTRIES.XK.currency).toBe("EUR"); // de facto evro
    expect(COUNTRIES.BA.currency).toBe("BAM");
    expect(COUNTRIES.RS.currency).toBe("RSD");
    expect(COUNTRIES.MK.currency).toBe("MKD");
    expect(COUNTRIES.AL.currency).toBe("ALL");
    expect(COUNTRIES.BG.currency).toBe("BGN");
    expect(COUNTRIES.GR.currency).toBe("EUR");
    expect(COUNTRIES.SI.phoneCode).toBe("386");
    expect(COUNTRIES.HR.phoneCode).toBe("385");
    expect(COUNTRIES.BA.phoneCode).toBe("387");
    expect(COUNTRIES.RS.phoneCode).toBe("381");
    expect(COUNTRIES.ME.phoneCode).toBe("382");
    expect(COUNTRIES.XK.phoneCode).toBe("383");
    expect(COUNTRIES.AL.phoneCode).toBe("355");
    expect(COUNTRIES.MK.phoneCode).toBe("389");
    expect(COUNTRIES.BG.phoneCode).toBe("359");
    expect(COUNTRIES.GR.phoneCode).toBe("30");
    // Kosovo: enotna evropska 112 ni primarna — zapis dopolnilnih števil:
    expect(COUNTRIES.XK.emergency).toBe("112/192/194");
    expect(COUNTRIES.SI.emergency).toBe("112");
  });

  test("①d pomočnika imen: sl kanon + fallback neznane locale na sl", () => {
    expect(countryName("sl", "HR")).toBe("Hrvaška");
    expect(countryName("en", "BA")).toBe("Bosnia and Herzegovina");
    expect(countryName("pt", "GR")).toBe("Grčija"); // fallback sl
    expect(countryLabel("en", "SI")).toBe("🇸🇮 Slovenia");
    expect(countryLabel("sl", "MK").startsWith("🇲🇰 ")).toBeTrue();
  });

  test("①e isNewInF0: nove države brez vsebine do F1", () => {
    for (const c of ["BA", "RS", "MK", "XK", "BG", "GR"] as const) {
      expect(isNewInF0(c)).toBeTrue();
    }
    for (const c of ["SI", "HR", "ME", "AL"] as const) {
      expect(isNewInF0(c)).toBeFalse();
    }
  });

  test("①f iskrenostni kanon: nabor destinacij 74 — osnovne 4 + F1 balkanske po 6 (#41)", () => {
    expect(DESTINATIONS.length).toBe(74);
    const byCountry = new Map<string, number>();
    for (const d of DESTINATIONS) {
      byCountry.set(d.country, (byCountry.get(d.country) ?? 0) + 1);
    }
    expect(byCountry.get("SI")).toBe(22);
    expect(byCountry.get("HR")).toBe(8);
    expect(byCountry.get("ME")).toBe(4);
    expect(byCountry.get("AL")).toBe(4);
    // #41 F1: 36 novih destinacij, po 6 na državo:
    for (const c of ["BA", "RS", "MK", "XK", "BG", "GR"] as const) {
      expect(byCountry.get(c)).toBe(6);
    }
    expect(byCountry.size).toBe(10);
    // vsaka destinacija ima veljaven COUNTRIES ključ:
    for (const d of DESTINATIONS) expect(COUNTRIES[d.country]).toBeDefined();
  });
});

describe("countries-f41 (#41 F0): eventCountry + državni filter", () => {
  test("②a default SI: vseh 31 dogodkov ima implicitno SI (nepopremljen kanon #38)", () => {
    expect(EVENTS.length).toBe(31);
    expect(EVENTS.every((e) => e.country === undefined)).toBeTrue();
    expect(EVENTS.every((e) => eventCountry(e) === "SI")).toBeTrue();
  });

  test("②b izrecna vrednost je ohranjena (F2 bo zapisovala balkanske)", () => {
    expect(eventCountry({ country: "HR" })).toBe("HR");
    expect(eventCountry({ country: "BA" })).toBe("BA");
    expect(eventCountry({})).toBe("SI");
  });

  test("②c filter destinacij po državi: ?country=HR → samo HR", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "", region: "all", type: "all", country: "HR" });
    expect(hits.length).toBe(8);
    expect(hits.every((d) => d.country === "HR")).toBeTrue();
  });

  test("②d neznana država → prazen rezultat (URL semantika kot region/type)", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "", region: "all", type: "all", country: "ZZ" });
    expect(hits).toEqual([]);
  });

  test("②e 'all'/manjkajoča vrednost → brez omejitve (združljivost starih klicev)", () => {
    const explicit = filterDestinations(DESTINATIONS, { q: "", region: "all", type: "all", country: "all" });
    const implicit = filterDestinations(DESTINATIONS, { q: "", region: "all", type: "all" });
    expect(explicit.length).toBe(74); // #41 F1: 74 destinacij
    expect(implicit.length).toBe(74);
  });

  test("②f kombinacija: država → regija → tip → iskanje (vrstni red ne spreminja stare semantike)", () => {
    const hits = filterDestinations(DESTINATIONS, { q: "", region: "all", type: "lake", country: "SI" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((d) => d.country === "SI" && d.type === "lake")).toBeTrue();
    const none = filterDestinations(DESTINATIONS, { q: "", region: "gorenjska", type: "all", country: "HR" });
    expect(none).toEqual([]); // gorenjska ne obstaja v HR
  });

  test("②g activeCountryKeys: kanonski vrstni red, samo prisotne države", () => {
    const keys = activeCountryKeys(DESTINATIONS);
    // #41 F1: vse 10 držav zdaj nastopa (kanonski vrstni red ALL_COUNTRY_CODES)
    expect(keys).toEqual(["SI", "HR", "BA", "RS", "ME", "XK", "AL", "MK", "BG", "GR"]);
  });

  test("②h hasActiveFilters vključuje državo", () => {
    expect(hasActiveFilters({ q: "", region: "all", type: "all" })).toBeFalse();
    expect(hasActiveFilters({ q: "", region: "all", type: "all", country: "all" })).toBeFalse();
    expect(hasActiveFilters({ q: "", region: "all", type: "all", country: "HR" })).toBeTrue();
  });
});
