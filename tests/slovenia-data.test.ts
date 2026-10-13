/**
 * INTEGRITETA KANONSKEGA NABORA DESTINACIJ (rekonstrukcija 2.x).
 *
 * Nabor v src/lib/slovenia-data.ts je EDINI živi podatkovni vir aplikacije
 * (1:1 iz snapshots/render-api-destinations.json produkcije 1.190.0) —
 * te napake so P0: pokvarjen zapis pomeni pokvarjeno destinacijsko stran,
 * zemljevid, načrtovalnik ali API.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  DESTINATIONS,
  REGIONS,
  getDestination,
  getFeaturedDestinations,
  type Destination,
} from "../src/lib/slovenia-data";
import { ALL_COUNTRY_CODES } from "../src/lib/countries-data";

// #41 F0: vir resnice za države je COUNTRIES (cel Balkan); nabor
// destinacij je še vedno 4-državen (F1 dodaja vsebino).
const COUNTRIES = ALL_COUNTRY_CODES;
const TYPES = [
  "lake",
  "city",
  "coast",
  "mountain",
  "cave",
  "spa",
  "river",
  "gorge",
  "park",
  "castle",
  "island",
  "village",
] as const;
const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
const BUDGETS = ["€", "€€", "€€€"] as const;
/** Širše območje SI + cel Balkan (#41 F1) — groba geografska vrata (do Črnega morja). */
const LAT_MIN = 38, LAT_MAX = 48, LNG_MIN = 7, LNG_MAX = 29;

const all: Destination[] = DESTINATIONS;

describe("slovenia-data: obseg nabora", () => {
  test("natančno 74 destinacij (kanon #41 F1: 38 izvirnih + 6×6 novih držav)", () => {
    expect(all.length).toBe(74);
  });

  test("unikatni id-ji", () => {
    const ids = new Set(all.map((d) => d.id));
    expect(ids.size).toBe(all.length);
  });

  test("unikatni slug-i (poti /destinacija/[slug])", () => {
    const slugs = new Set(all.map((d) => d.slug));
    expect(slugs.size).toBe(all.length);
  });

  test("vsaj ena izpostavljena destinacija (featured)", () => {
    expect(getFeaturedDestinations().length).toBeGreaterThan(0);
  });
});

describe("slovenia-data: veljavnost polj", () => {
  test("države izključno iz COUNTRIES kanona (cel Balkan, #41 F0)", () => {
    for (const d of all) expect(ALL_COUNTRY_CODES).toContain(d.country);
  });

  test("koordinate znotraj geografskih vrat regije", () => {
    for (const d of all) {
      expect(d.coords.lat).toBeGreaterThan(LAT_MIN);
      expect(d.coords.lat).toBeLessThan(LAT_MAX);
      expect(d.coords.lng).toBeGreaterThan(LNG_MIN);
      expect(d.coords.lng).toBeLessThan(LNG_MAX);
    }
  });

  test("ocena 0–5, strošek na osebo pozitiven", () => {
    for (const d of all) {
      expect(d.rating).toBeGreaterThan(0);
      expect(d.rating).toBeLessThanOrEqual(5);
      expect(d.costPerPerson).toBeGreaterThan(0);
    }
  });

  test("proračun iz €/€€/€€€", () => {
    for (const d of all) expect(BUDGETS).toContain(d.budget);
  });

  test("regija ima slovarski vnos (ključ + SL/EN oznaki)", () => {
    for (const d of all) {
      expect(REGIONS).toHaveProperty(d.region);
      const r = REGIONS[d.region];
      expect(r.sl.length).toBeGreaterThan(0);
      expect(r.en.length).toBeGreaterThan(0);
    }
  });

  test("PREVERJENI POPRAVEK 2.22.0: posočje (kobarid + reka-soca) — ne gorenjska (geografska napaka izvirnika 1.190.0)", () => {
    // Preverba proti produkciji izvedena 2026-10-10 (API /api/destinations,
    // stran /destinacija/kobarid, sitemap.xml — vse „gorenjska“ = napaka
    // izvirnika). Glej glavo src/lib/slovenia-data.ts za dokaze.
    const soca = getDestination("reka-soca");
    const kob = getDestination("kobarid");
    expect(soca?.region).toBe("posocje");
    expect(kob?.region).toBe("posocje");
    // Regija ima vseh 6 jezikovnih oznak (kanon P3 paritete).
    const p = REGIONS["posocje"];
    expect(p).toBeDefined();
    for (const loc of ["sl", "en", "it", "de", "fr", "es"] as const) {
      expect(p[loc].length).toBeGreaterThan(0);
    }
    expect(p.sl).toBe("Posočje");
    expect(p.en).toBe("Soča Valley"); // uradno STO poimenovanje
    // Gorenjska obdrži svoje (bled, bohinj, triglav, vintgar) — popravek
    // ne sme prenesti drugih destinacij.
    for (const slug of ["bled", "bohinj", "triglav", "vintgarska-soteska"]) {
      const d = getDestination(slug);
      expect(d?.region).toBe("gorenjska");
    }
    // 42 regij (#41 F1: 21 izvirnih + 21 novih balkanskih).
    expect(Object.keys(REGIONS).length).toBe(42);
  });

  test("slike obstajajo na disku (public/content)", () => {
    for (const d of all) {
      const p = join(process.cwd(), "public", d.image.replace(/^\//, ""));
      expect(existsSync(p)).toBe(true);
    }
  });

  test("neprazni opisi/poudarki/dejavnosti", () => {
    for (const d of all) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(20);
      expect(d.highlights.length).toBeGreaterThan(0);
      expect(d.activities.length).toBeGreaterThan(0);
      expect(d.bestFor.length).toBeGreaterThan(0);
    }
  });

  test("sezoni iz dovoljenega nabora in vsaj ena", () => {
    for (const d of all) {
      expect(d.bestSeason.length).toBeGreaterThan(0);
      for (const s of d.bestSeason) expect(SEASONS).toContain(s);
    }
  });
});

describe("slovenia-data: izvor (iskrenost kanona)", () => {
  test("vsaka destinacija ima provenance z virom", () => {
    for (const d of all) {
      expect(d.provenance).toBeDefined();
      expect(d.provenance.source.length).toBeGreaterThan(0);
      expect(d.provenance.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("slovenia-data: dostopne funkcije", () => {
  test("getDestination najde po slug-u", () => {
    const bled = getDestination("bled");
    expect(bled?.name).toBe("Bled");
  });

  test("getDestination za neveljaven slug → undefined", () => {
    expect(getDestination("ne-obstaja-xyz")).toBeUndefined();
  });
});
