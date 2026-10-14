/**
 * LOKALI-DATA — integriteta kuriranih lokalnih ponudnikov (/lokali).
 *
 * Kanon iskrenosti: zapisi so uredniška kuracija; koordinat/kontaktov NI
 * (LOKALI_HONESTY_NOTE) — kar JE zapisano, mora biti dosledno:
 * kategorije, regije, države in povezave na destinacije morajo obstajati.
 */

import { describe, expect, test } from "bun:test";

import { LOKALI, LOKAL_CATEGORIES, WEATHER_FIT_LABELS } from "../src/lib/lokali-data";
import { DESTINATIONS, REGIONS } from "../src/lib/slovenia-data";

const CATS = Object.keys(LOKAL_CATEGORIES);
const WEATHER = Object.keys(WEATHER_FIT_LABELS);

describe("lokali-data: obseg in integriteta", () => {
  test("vsaj 20 zapisov (jedro ponudbe /lokali)", () => {
    expect(LOKALI.length).toBeGreaterThanOrEqual(20);
  });

  test("unikatni id-ji", () => {
    const ids = new Set(LOKALI.map((l) => l.id));
    expect(ids.size).toBe(LOKALI.length);
  });

  test("kategorija iz dovoljenega nabora (7)", () => {
    expect(CATS.length).toBe(7);
    for (const l of LOKALI) expect(CATS).toContain(l.category);
  });

  test("regija obstaja v REGIONS slovarju kanonskega nabora", () => {
    for (const l of LOKALI) {
      expect(REGIONS).toHaveProperty(l.region);
    }
  });

  test("država iz canona 10 balkanskih držav (#41 F2: + BA/RS/MK/XK/BG/GR)", () => {
    for (const l of LOKALI) {
      expect(["SI", "HR", "ME", "AL", "BA", "RS", "MK", "XK", "BG", "GR"]).toContain(l.country);
    }
  });

  test("destinationSlug (če je) obstaja med 74 destinacijami", () => {
    const slugs = new Set(DESTINATIONS.map((d) => d.slug));
    for (const l of LOKALI) {
      if (l.destinationSlug) {
        expect(slugs.has(l.destinationSlug)).toBe(true);
      }
    }
  });

  test("vremenska primernost iz nabora (indoor/outdoor/all-weather)", () => {
    expect(WEATHER.length).toBe(3);
    for (const l of LOKALI) expect(WEATHER).toContain(l.weather);
  });

  test("dvojezični opisi neprazni (SL vir + EN prevod)", () => {
    for (const l of LOKALI) {
      expect(l.description.sl.length).toBeGreaterThan(20);
      expect(l.description.en.length).toBeGreaterThan(10);
      expect(l.name.length).toBeGreaterThan(0);
      expect(l.town.length).toBeGreaterThan(0);
    }
  });

  test("pokritost kategorij: vsaj 5 različnih kategorij ima zapis", () => {
    const used = new Set(LOKALI.map((l) => l.category));
    expect(used.size).toBeGreaterThanOrEqual(5);
  });
});
