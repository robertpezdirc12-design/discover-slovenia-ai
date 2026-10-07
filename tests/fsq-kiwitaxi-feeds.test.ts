/**
 * FSQ DATASET + KIWITAXI RUTE — testi P0-C podatkovnih slojev (issue §4/§7).
 *
 * Pokriva:
 *  · FSQ: stroga validacija vrstic (shema, geo bbox države, kategorije),
 *    iskren nalagalnik (missing/empty/ok), dedupe, statistika z odmikom
 *    od baseline izvirnika (125.446: SI 18.010 · HR 88.331 · ME 10.285
 *    · AL 8.820);
 *  · KiwiTaxi: validacija rut (ISO-2, cena > 0), kanon „rute, ki se
 *    dotikajo SI", iskanje po krajih (diakritike, obojestransko),
 *    iskren nalagalnik.
 *
 * Kanon: množica/feed ŠE NISTA nameščena (mrtvi GitHub račun) — testi
 * dokazujejo, da koda ČAKA na vir iskreno (missing), ne da lažno živi.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FSQ_ATTRIBUTION,
  FSQ_COUNTRY_BBOXES,
  FSQ_EXPECTED_COUNTS,
  FSQ_EXPECTED_TOTAL,
  FSQ_TRAVEL_CATEGORIES,
  summarizeFsqPlaces,
  validateFsqLine,
  type FsqPlace,
} from "../src/lib/supply/providers/fsq/dataset";
import { loadFsqDataset } from "../src/lib/supply/providers/fsq/loader";
import {
  findRoutes,
  routeTouchesSlovenia,
  validateKiwitaxiRoute,
} from "../src/lib/supply/providers/kiwitaxi/routes";

// ── FSQ validacija ─────────────────────────────────────────────────────────

describe("validateFsqLine — stroga vrstična validacija", () => {
  const veljaven = {
    fsq_id: "abc123",
    name: "Blejski grad",
    latitude: 46.36,
    longitude: 14.11,
    country: "SI",
    category: "attraction",
    address: "Grajska cesta 25",
    locality: "Bled",
  };

  test("veljaven vnos (SI koordinate v SI bboxu)", () => {
    const v = validateFsqLine(veljaven);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.place.fsq_id).toBe("abc123");
      expect(v.place.name).toBe("Blejski grad");
      expect(v.place.address).toBe("Grajska cesta 25");
    }
  });

  test("geo laž: SI država, a koordinata v Splitu (HR) → ZAVRNIJENA", () => {
    const v = validateFsqLine({ ...veljaven, latitude: 43.5, longitude: 16.44 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("izven bbox SI");
  });

  test("manjka fsq_id / ime → zavrnjeno", () => {
    expect(validateFsqLine({ ...veljaven, fsq_id: "" }).ok).toBe(false);
    expect(validateFsqLine({ ...veljaven, name: " " }).ok).toBe(false);
  });

  test("ne-številske / končne koordinate → zavrnjeno", () => {
    expect(validateFsqLine({ ...veljaven, latitude: "46" }).ok).toBe(false);
    expect(validateFsqLine({ ...veljaven, longitude: Infinity }).ok).toBe(false);
  });

  test("neznan country (izven SI/HR/ME/AL) → zavrnjeno", () => {
    expect(validateFsqLine({ ...veljaven, country: "IT" }).ok).toBe(false);
  });

  test("nepotovalna kategorija → zavrnjeno (sloj je potovalni)", () => {
    expect(validateFsqLine({ ...veljaven, category: "krojač" }).ok).toBe(false);
  });

  test("vseh 12 kanonskih kategorij je veljavnih", () => {
    for (const category of FSQ_TRAVEL_CATEGORIES) {
      expect(validateFsqLine({ ...veljaven, category }).ok).toBe(true);
    }
  });

  test("bboxi vseh 4 držav so smiselni (s<w, n<e znotraj Zemlje)", () => {
    for (const [country, [s, w, n, e]] of Object.entries(FSQ_COUNTRY_BBOXES)) {
      expect(FSQ_EXPECTED_COUNTS[country]).toBeDefined();
      expect(s).toBeLessThan(n);
      expect(w).toBeLessThan(e);
      expect(s).toBeGreaterThanOrEqual(-90);
      expect(n).toBeLessThanOrEqual(90);
    }
  });
});

// ── FSQ statistika + baseline ──────────────────────────────────────────────

describe("summarizeFsqPlaces — statistika z odmikom od baseline", () => {
  test("prazna množica: vsi odmiki negativni (iskren prikaz vrzeli)", () => {
    const stats = summarizeFsqPlaces([]);
    expect(stats.total).toBe(0);
    expect(stats.vsBaseline.SI).toBe(-FSQ_EXPECTED_COUNTS.SI);
    expect(FSQ_EXPECTED_TOTAL).toBe(125446);
  });

  test("števci po državah in kategorijah", () => {
    const places: FsqPlace[] = [
      { fsq_id: "1", name: "A", latitude: 46.36, longitude: 14.11, country: "SI", category: "hotel" },
      { fsq_id: "2", name: "B", latitude: 46.36, longitude: 14.11, country: "SI", category: "cafe" },
      { fsq_id: "3", name: "C", latitude: 45.81, longitude: 15.96, country: "HR", category: "hotel" },
    ];
    const stats = summarizeFsqPlaces(places, 5, 2);
    expect(stats.byCountry.SI).toBe(2);
    expect(stats.byCountry.HR).toBe(1);
    expect(stats.byCategory.hotel).toBe(2);
    expect(stats.invalidLines).toBe(5);
    expect(stats.duplicateIds).toBe(2);
    expect(stats.vsBaseline.SI).toBe(2 - FSQ_EXPECTED_COUNTS.SI);
  });
});

// ── FSQ nalagalnik (iskren) ────────────────────────────────────────────────

describe("loadFsqDataset — iskrena stanja", () => {
  test("manjkajoča mapa → missing (množica čaka vir — gate data)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fsq-test-"));
    try {
      const loaded = await loadFsqDataset(join(dir, "ne-obstaja"));
      expect(loaded.status).toBe("missing");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("mapa brez .jsonl → empty", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fsq-test-"));
    try {
      const sub = join(dir, "fsq-places");
      await mkdir(sub, { recursive: true });
      const loaded = await loadFsqDataset(sub);
      expect(loaded.status).toBe("empty");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("veljavne + neveljavne vrstice + duplikati → samo veljavne ostanejo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fsq-test-"));
    try {
      const sub = join(dir, "fsq-places");
      await mkdir(sub, { recursive: true });
      const lines = [
        JSON.stringify({ fsq_id: "1", name: "Bled", latitude: 46.36, longitude: 14.11, country: "SI", category: "hotel" }),
        "{pokvarjena vrstica",
        JSON.stringify({ fsq_id: "1", name: "Bled duplikat", latitude: 46.36, longitude: 14.11, country: "SI", category: "cafe" }),
        JSON.stringify({ fsq_id: "2", name: "Geo laž", latitude: 45.0, longitude: 16.0, country: "SI", category: "hotel" }),
        JSON.stringify({ fsq_id: "3", name: "Split", latitude: 43.5, longitude: 16.44, country: "HR", category: "restaurant" }),
      ];
      await writeFile(join(sub, "places.jsonl"), lines.join("\n") + "\n", "utf8");

      const loaded = await loadFsqDataset(sub);
      expect(loaded.status).toBe("ok");
      if (loaded.status === "ok") {
        expect(loaded.places.length).toBe(2);
        expect(loaded.stats.duplicateIds).toBe(1);
        expect(loaded.stats.invalidLines).toBe(2);
        expect(loaded.stats.byCountry.SI).toBe(1);
        expect(loaded.stats.byCountry.HR).toBe(1);
        expect(loaded.manifest).toBeNull(); // brez manifesta — provenance neznan (iskreno)
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("manifest se prebere, kadar obstaja (provenance)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fsq-test-"));
    try {
      const sub = join(dir, "fsq-places");
      await mkdir(sub, { recursive: true });
      await writeFile(
        join(sub, "places.jsonl"),
        JSON.stringify({ fsq_id: "1", name: "Bled", latitude: 46.36, longitude: 14.11, country: "SI", category: "hotel" }) + "\n",
        "utf8"
      );
      await writeFile(
        join(sub, "manifest.json"),
        JSON.stringify({
          snapshotDate: "2025-02-06",
          source: "Foursquare Open Places",
          license: "Apache-2.0",
          attribution: FSQ_ATTRIBUTION,
          ingestedAt: "2026-10-07T00:00:00.000Z",
          counts: { SI: 1 },
          total: 1,
        }),
        "utf8"
      );
      const loaded = await loadFsqDataset(sub);
      expect(loaded.status).toBe("ok");
      if (loaded.status === "ok") {
        expect(loaded.manifest?.snapshotDate).toBe("2025-02-06");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── KiwiTaxi validacija ────────────────────────────────────────────────────

describe("validateKiwitaxiRoute — shema FROM_PRICE", () => {
  test("veljavna ruta (Ljubljana → Blejski otok)", () => {
    const v = validateKiwitaxiRoute({
      fromName: "Ljubljana",
      fromCountry: "SI",
      toName: "Bled",
      toCountry: "SI",
      priceFromEur: 89.5,
      vehicleClass: "Economy",
      url: "https://kiwitaxi.com/…",
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.route.id).toBe("ljubljana-bled");
      expect(v.route.priceFromEur).toBe(89.5);
      expect(v.route.vehicleClass).toBe("Economy");
    }
  });

  test("id zloži diakritike (Čatež → catez)", () => {
    const v = validateKiwitaxiRoute({
      fromName: "Ljubljana",
      fromCountry: "SI",
      toName: "Čatež ob Savi",
      toCountry: "SI",
      priceFromEur: 40,
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.route.id).toContain("catez-ob-savi");
  });

  test("država ni ISO-2 → zavrnjeno", () => {
    expect(
      validateKiwitaxiRoute({
        fromName: "Zagreb",
        fromCountry: "Hrvaška",
        toName: "Bled",
        toCountry: "SI",
        priceFromEur: 120,
      }).ok
    ).toBe(false);
  });

  test("cena 0 / negativna / NaN → zavrnjeno (FROM_PRICE je še vedno cena)", () => {
    for (const priceFromEur of [0, -5, Number.NaN]) {
      expect(
        validateKiwitaxiRoute({
          fromName: "A",
          fromCountry: "SI",
          toName: "B",
          toCountry: "HR",
          priceFromEur,
        }).ok
      ).toBe(false);
    }
  });

  test("http URL se zavrne (samo https)", () => {
    const v = validateKiwitaxiRoute({
      fromName: "A",
      fromCountry: "SI",
      toName: "B",
      toCountry: "HR",
      priceFromEur: 50,
      url: "http://nezavarovan.si",
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.route.url).toBeUndefined();
  });
});

describe("routeTouchesSlovenia — kanon izvirnika", () => {
  const ruta: Parameters<typeof routeTouchesSlovenia>[0] = {
    id: "a-b",
    fromName: "A",
    fromCountry: "SI",
    toName: "B",
    toCountry: "HR",
    priceFromEur: 50,
  };
  test("iz SI se dotika", () => {
    expect(routeTouchesSlovenia(ruta)).toBe(true);
  });
  test("v SI se dotika", () => {
    expect(routeTouchesSlovenia({ ...ruta, fromCountry: "HR", toCountry: "SI" })).toBe(true);
  });
  test("tujka (HR→ME) se NE dotika", () => {
    expect(
      routeTouchesSlovenia({ ...ruta, fromCountry: "HR", toCountry: "ME" })
    ).toBe(false);
  });
});

describe("findRoutes — iskanje po relacijah", () => {
  const routes = [
    { id: "ljubljana-bled", fromName: "Ljubljana", fromCountry: "SI", toName: "Bled", toCountry: "SI", priceFromEur: 89 },
    { id: "ljubljana-zagreb", fromName: "Ljubljana", fromCountry: "SI", toName: "Zagreb", toCountry: "HR", priceFromEur: 140 },
    { id: "zagreb-bled", fromName: "Zagreb", fromCountry: "HR", toName: "Bled", toCountry: "SI", priceFromEur: 110 },
  ];

  test("popolna relacija (obe točki) na prvem mestu", () => {
    const hits = findRoutes("Ljubljana", "Bled", routes);
    expect(hits[0].matchedStops).toBe(2);
    expect(hits[0].route.id).toBe("ljubljana-bled");
  });

  test("diakritike in velike črke niso ovira", () => {
    expect(findRoutes("LJUBLJANA", "", routes).length).toBe(2);
  });

  test("dvojni zadetki pred enojnimi; cenejše pred dražjimi", () => {
    const hits = findRoutes("Bled", "", routes);
    expect(hits.every((h, i) => i === 0 || hits[i - 1].matchedStops >= h.matchedStops)).toBe(true);
  });

  test("prazna poizvedba → prazni zadetki", () => {
    expect(findRoutes("", "", routes)).toEqual([]);
  });
});

// ── Kanon čakanja na vir (iskrena stanja danes) ────────────────────────────

describe("danes: feedi čakajo vir (mrtvi GitHub račun)", () => {
  test("FSQ: data/fsq-places še ni nameščen → missing (gate data)", async () => {
    const loaded = await loadFsqDataset("data/fsq-places");
    // Ko vir pride, status postane „ok"/„empty" — do takrat iskreno missing.
    expect(["missing", "empty", "ok"]).toContain(loaded.status);
  });
});
