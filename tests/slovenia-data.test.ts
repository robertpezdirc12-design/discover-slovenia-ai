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

const COUNTRIES = ["SI", "HR", "ME", "AL"] as const;
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
/** Širše območje SI + jadran (SI/HR/ME/AL) — groba geografska vrata. */
const LAT_MIN = 38, LAT_MAX = 48, LNG_MIN = 7, LNG_MAX = 24;

const all: Destination[] = DESTINATIONS;

describe("slovenia-data: obseg nabora", () => {
  test("natančno 38 destinacij (kanon produkcije 1.190.0)", () => {
    expect(all.length).toBe(38);
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
  test("države izključno SI/HR/ME/AL", () => {
    for (const d of all) expect(COUNTRIES).toContain(d.country);
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
