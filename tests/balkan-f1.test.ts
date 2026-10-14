/**
 * BALKAN F1 INTEGRITETA (#41 Faza 1) — 36 novih destinacij v 6 državah.
 *
 * Testi spremljajo podatke (pravilo 2 iz #41): vsak nov vnos mora imeti
 * veljaven vir po kanonu #38, realne koordinate, obstoječo sliko in regijo
 * iz NUTS-ish slovarja. Fail tega modula = pokvarjen vnos na živi strani.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  DESTINATIONS,
  REGIONS,
  DEST_TYPES,
  type Destination,
  type CountryCode,
} from "../src/lib/slovenia-data";
import { REGIONS_BALKAN, DESTINATIONS_BALKAN } from "../src/lib/balkan-data";
import { COUNTRIES } from "../src/lib/countries-data";

const F1_COUNTRIES = ["BA", "RS", "MK", "XK", "BG", "GR"] as const;
const F1 = DESTINATIONS_BALKAN;

/** Groba geografska vrata po državi (lat min/max, lng min/max). */
const COUNTRY_BBOX: Record<(typeof F1_COUNTRIES)[number], [number, number, number, number]> = {
  BA: [42.4, 45.3, 15.5, 19.7],
  RS: [42.0, 46.2, 19.0, 23.0],
  MK: [40.5, 42.4, 20.4, 23.0],
  XK: [41.8, 43.3, 20.0, 21.8],
  BG: [41.2, 44.3, 22.3, 28.7],
  GR: [38.5, 41.8, 20.0, 27.0],
};

/** Uradni NTO domene (kanon #38: vir mora biti resničen, preverjen 2026-10-13). */
const OFFICIAL_DOMAINS = [
  "tourismbih.com",
  "serbia.travel",
  "macedonia-timeless.com",
  "tourism.government.bg",
  "visitgreece.gr",
];

const byId = (id: string) => F1.find((d) => d.id === id);

describe("balkan-f1 (#41): obseg in razporeditev", () => {
  test("natančno 36 novih destinacij, po 6 na državo", () => {
    expect(F1.length).toBe(36);
    for (const c of F1_COUNTRIES) {
      expect(F1.filter((d) => d.country === c).length).toBe(6);
    }
  });

  test("vsak F1 zapis je del živega registra DESTINATIONS", () => {
    const ids = new Set(DESTINATIONS.map((d) => d.id));
    for (const d of F1) expect(ids.has(d.id)).toBeTrue();
  });

  test("unikatni id/slug tudi čez celoten 74-register", () => {
    const ids = new Set(DESTINATIONS.map((d) => d.id));
    const slugs = new Set(DESTINATIONS.map((d) => d.slug));
    expect(ids.size).toBe(DESTINATIONS.length);
    expect(slugs.size).toBe(DESTINATIONS.length);
  });

  test("specifikacija #41 F1: ključne destinacije po državah so prisotne", () => {
    const must = [
      "sarajevo", "mostar", "kravica", "jahorina", "blagaj", "travnik",
      "beograd", "novi-sad", "kopaonik", "derdap", "sremski-karlovci", "subotica",
      "ohrid", "skopje", "matka", "bitola", "prespa", "mavrovo",
      "prizren", "rugova", "brezovica", "gjakova", "gadime",
      "sofija", "plovdiv", "rila-samostan", "nesebar", "bansko", "veliko-tarnovo",
      "solun", "meteora", "kastoria", "vergina",
    ];
    for (const id of must) expect(byId(id)).toBeDefined();
  });
});

describe("balkan-f1 (#41): veljavnost polj (kanon #38)", () => {
  test("vsi zapisi imajo poln provenance (vir + verifiedAt)", () => {
    for (const d of F1) {
      expect(d.provenance).toBeDefined();
      expect(d.provenance.source.length).toBeGreaterThan(0);
      expect(d.provenance.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("official viri: sourceUrl je uradna NTO domena (nič izmišljenih URL-jev)", () => {
    for (const d of F1) {
      if (d.provenance.kind === "official") {
        expect(d.provenance.sourceUrl).toBeDefined();
        const url = new URL(d.provenance.sourceUrl!);
        expect(OFFICIAL_DOMAINS).toContain(url.hostname.replace(/^www\./, ""));
      }
    }
  });

  test("XK zapisi so iskreno internal (uradni NTO portal ni potrjen)", () => {
    for (const d of F1.filter((x) => x.country === "XK")) {
      expect(d.provenance.kind).toBe("internal");
      expect(d.provenance.sourceUrl).toBeUndefined();
    }
  });

  test("koordinate znotraj državnih bbox vrat (groba geografska resnica)", () => {
    for (const d of F1) {
      const [latMin, latMax, lngMin, lngMax] = COUNTRY_BBOX[d.country as (typeof F1_COUNTRIES)[number]];
      expect(d.coords.lat).toBeGreaterThan(latMin);
      expect(d.coords.lat).toBeLessThan(latMax);
      expect(d.coords.lng).toBeGreaterThan(lngMin);
      expect(d.coords.lng).toBeLessThan(lngMax);
    }
  });

  test("regije obstajajo v REGIONS in imajo vseh 6 jezikov", () => {
    for (const d of F1) {
      const r = REGIONS[d.region];
      expect(r).toBeDefined();
      for (const loc of ["sl", "en", "it", "de", "fr", "es"] as const) {
        expect(r[loc].length).toBeGreaterThan(0);
      }
    }
  });

  test("tipi so iz DEST_TYPES; novi tip monastery pokriva Rilo/Meteoro/Blagaj", () => {
    for (const d of F1) expect(DEST_TYPES[d.type as keyof typeof DEST_TYPES]).toBeDefined();
    for (const id of ["rila-samostan", "meteora", "blagaj"]) {
      expect(byId(id)!.type).toBe("monastery");
    }
    expect(Object.keys(DEST_TYPES)).toContain("monastery");
  });

  test("slike obstajajo na disku (public/content/<id>.jpg)", () => {
    for (const d of F1) {
      const path = join(process.cwd(), "public", d.image);
      expect(existsSync(path)).toBeTrue();
    }
  });

  test("vsebina ni prazna: opis ≥ 200 znakov, 4 poudarki, 4 aktivnosti, 3 bestFor", () => {
    for (const d of F1) {
      expect(d.description.length).toBeGreaterThanOrEqual(200);
      expect(d.highlights.length).toBeGreaterThanOrEqual(4);
      expect(d.activities.length).toBeGreaterThanOrEqual(4);
      expect(d.bestFor.length).toBeGreaterThanOrEqual(3);
      expect(d.tagline.length).toBeGreaterThan(0);
    }
  });

  test("ocene 4.0–4.9, stroški ugodni (balkanski realni razpon)", () => {
    for (const d of F1) {
      expect(d.rating).toBeGreaterThanOrEqual(4.0);
      expect(d.rating).toBeLessThanOrEqual(4.9);
      expect(d.costPerPerson).toBeGreaterThanOrEqual(8);
      expect(d.costPerPerson).toBeLessThanOrEqual(40);
    }
  });

  test("nič featured (izpostavljenost ostaja SI kanon; F2/F3 oceni)", () => {
    for (const d of F1) expect(d.featured).toBeFalse();
  });
});

describe("balkan-f1 (#41): regije in tipi slovarjev", () => {
  test("REGIONS_BALKAN ima 23 regij in so vse merge-ane v REGIONS (44 skupaj)", () => {
    expect(Object.keys(REGIONS_BALKAN).length).toBe(23);
    for (const key of Object.keys(REGIONS_BALKAN)) {
      expect(REGIONS).toHaveProperty(key);
    }
    expect(Object.keys(REGIONS).length).toBe(44);
  });

  test("DEST_TYPES ima 10 tipov s 6-jezičnimi oznakami (vključno monastery)", () => {
    expect(Object.keys(DEST_TYPES).length).toBe(10);
    const m = DEST_TYPES.monastery;
    expect(m.sl).toBe("Samostan");
    expect(m.en).toBe("Monastery");
    for (const loc of ["it", "de", "fr", "es"] as const) {
      expect(m[loc].length).toBeGreaterThan(0);
    }
  });

  test("državne ključe COUNTRIES prepoznavajo (F1 države so v meta)", () => {
    for (const c of F1_COUNTRIES) expect(COUNTRIES[c as CountryCode]).toBeDefined();
  });
});

describe("balkan-f1 (#41): ne-regresija osnovnega registra", () => {
  test("osnovne 4 države ostanejo nedotaknjene (SI 22 · HR 8 · ME 4 · AL 4)", () => {
    const orig = DESTINATIONS.filter((d) => !F1_COUNTRIES.includes(d.country as never));
    expect(orig.length).toBe(38);
    const byCountry = new Map<string, number>();
    for (const d of orig) byCountry.set(d.country, (byCountry.get(d.country) ?? 0) + 1);
    expect(byCountry.get("SI")).toBe(22);
    expect(byCountry.get("HR")).toBe(8);
    expect(byCountry.get("ME")).toBe(4);
    expect(byCountry.get("AL")).toBe(4);
  });

  test("getDestination najde nove vnose (slug poti /destinacija/[slug])", () => {
    for (const id of ["sarajevo", "beograd", "ohrid", "prizren", "sofija", "meteora"]) {
      const d = DESTINATIONS.find((x) => x.slug === id);
      expect(d).toBeDefined();
      expect(d!.id).toBe(id);
    }
  });
});

/** Vrsta za izvoz tipa (testna uporaba). */
export type { Destination };
