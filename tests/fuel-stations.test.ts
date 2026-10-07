/**
 * FUEL-STATIONS — čisti nabor bencinskih črpalk po Sloveniji (Task 55-fuel):
 * integriteta kuriranega nabora (odprti podatki po osnovi OSM), geo-funkcije
 * (bbox, haversine, najbližja črpalka), DTO za odjemalca in števec po verigah.
 *
 * Zaklene kanone:
 * - INTEGRITETA: 66 črpalk z unikatnimi id-ji v zmrznjenem seznamu; koordinate
 *   v mejah Slovenije (lat 45,3–46,9 · lng 13,3–16,7); vsaka črpalka ponuja
 *   dizel; brand je ena izmed dovoljenih verig.
 * - ISKRENOST: FUEL_PRECISION = "approximate" (nikoli "exact") in
 *   FUEL_SOURCE.license = "ODbL" — približnost in licenca sta javno izkazani.
 * - GEO: inBbox velja vključno z robom; filterFuelByBbox za prazen bbox
 *   iskreno vrne prazen seznam; haversineKm je zračna razdalja v km.
 * - ČISTOST: fuelStationDTO kopira fuels — mutacija na strani odjemalca
 *   ne onesnaži registrskega nabora.
 */

import { describe, expect, test } from "bun:test";

import {
  filterFuelByBbox,
  fuelBrandCounts,
  fuelStationDTO,
  FUEL_PRECISION,
  FUEL_SOURCE,
  FUEL_STATIONS,
  haversineKm,
  inBbox,
  nearestFuelStation,
  parseFuelBbox,
  type FuelBrand,
  type FuelStation,
} from "../src/lib/fuel-stations";

/** Dovoljene verige (kanon tipa FuelBrand). */
const VELJAVNE_VERIGE = new Set<FuelBrand>([
  "Petrol",
  "OMV",
  "MOL",
  "Cink",
  "Euro MIL",
]);

/** Bbox okoli Ljubljane — ročno prešteto 8 črpalk v tem okvirju. */
const LJ_BBOX = { south: 45.95, west: 14.35, north: 46.2, east: 14.7 };

describe("fuel-stations: integriteta nabora", () => {
  test("zmrznjen seznam (Object.isFrozen) — register ni živ objekt", () => {
    expect(Object.isFrozen(FUEL_STATIONS)).toBe(true);
  });

  test("66 črpalk z unikatnimi id-ji", () => {
    expect(FUEL_STATIONS.length).toBe(66);
    const ids = FUEL_STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(66);
  });

  test("koordinate v mejah Slovenije: lat 45,3–46,9 · lng 13,3–16,7 (vse)", () => {
    for (const s of FUEL_STATIONS) {
      expect(s.lat).toBeGreaterThanOrEqual(45.3);
      expect(s.lat).toBeLessThanOrEqual(46.9);
      expect(s.lng).toBeGreaterThanOrEqual(13.3);
      expect(s.lng).toBeLessThanOrEqual(16.7);
    }
  });

  test("fuels neprazen in vsebuje dizel (vsaka črpalka)", () => {
    for (const s of FUEL_STATIONS) {
      expect(s.fuels.length).toBeGreaterThan(0);
      expect(s.fuels).toContain("dizel");
    }
  });

  test("brand je ena izmed dovoljenih verig (Petrol/OMV/MOL/Cink/Euro MIL)", () => {
    for (const s of FUEL_STATIONS) {
      expect(VELJAVNE_VERIGE.has(s.brand)).toBe(true);
    }
  });

  test("FUEL_PRECISION = approximate (iskrena oznaka, nikoli exact)", () => {
    expect(FUEL_PRECISION).toBe("approximate");
  });

  test("FUEL_SOURCE.license = ODbL (odprti podatki po osnovi OSM)", () => {
    expect(FUEL_SOURCE.license).toBe("ODbL");
    expect(FUEL_SOURCE.slug).toBe("osm-curated");
    expect(FUEL_SOURCE.label.length).toBeGreaterThan(0);
  });
});

describe("fuel-stations: inBbox (vključno z robom)", () => {
  const bbox = { south: 46, west: 14, north: 47, east: 15 };

  test("točka znotraj ovoja", () => {
    expect(inBbox(46.05, 14.5, bbox)).toBe(true);
  });

  test("točka izven ovoja (vse štiri smeri)", () => {
    expect(inBbox(45.99, 14.5, bbox)).toBe(false); // južno od south
    expect(inBbox(47.01, 14.5, bbox)).toBe(false); // severno od north
    expect(inBbox(46.05, 13.99, bbox)).toBe(false); // zahodno od west
    expect(inBbox(46.05, 15.01, bbox)).toBe(false); // vzhodno od east
  });

  test("robne vrednosti veljajo (vključno z robom na vseh štirih straneh)", () => {
    expect(inBbox(46, 14.5, bbox)).toBe(true); // lat == south
    expect(inBbox(47, 14.5, bbox)).toBe(true); // lat == north
    expect(inBbox(46.05, 14, bbox)).toBe(true); // lng == west
    expect(inBbox(46.05, 15, bbox)).toBe(true); // lng == east
  });
});

describe("fuel-stations: parseFuelBbox (široki pogled bez omejitve razpona)", () => {
  // E2E odkritje 2026-10-08: pogled CELE DRŽAVE pri zoom 8 pošlje
  // bbox ~10,5° × ~17,4°, ki ga parseBbox (map-pins, 10°/15° omejitev za
  // FSQ) zavrne s 400. Plast črpalk MORA tak pogled sprejeti — zaklep.
  test("pogled cele države (razpon ~10,5° × ~17,4°) je SPREJET", () => {
    const r = parseFuelBbox("37.874853,8.129883,48.414619,25.576172");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.south).toBeCloseTo(37.874853, 6);
      expect(r.value.east).toBeCloseTo(25.576172, 6);
    }
  });

  test("veljaven ozek bbox → ok", () => {
    const r = parseFuelBbox("45.95,14.35,46.20,14.70");
    expect(r.ok).toBe(true);
  });

  test("manjka / napačno število vrednosti → napaka", () => {
    expect(parseFuelBbox(null).ok).toBe(false);
    expect(parseFuelBbox("").ok).toBe(false);
    expect(parseFuelBbox("1,2").ok).toBe(false);
    expect(parseFuelBbox("1,2,3,4,5").ok).toBe(false);
  });

  test("neveljavne koordinate / usmerjenost → napaka", () => {
    expect(parseFuelBbox("abc,1,2,3").ok).toBe(false);
    expect(parseFuelBbox("-91,0,10,20").ok).toBe(false);
    expect(parseFuelBbox("0,0,0,20").ok).toBe(false); // south >= north
    expect(parseFuelBbox("0,20,10,20").ok).toBe(false); // west >= east
    expect(parseFuelBbox("0,-181,10,181").ok).toBe(false);
  });
});

describe("fuel-stations: filterFuelByBbox", () => {
  test("bbox Ljubljane (45,95–46,20 · 14,35–14,70) → natanko 8 črpalk", () => {
    const r = filterFuelByBbox(LJ_BBOX);
    expect(r.length).toBe(8);
    expect(r.map((s) => s.id).sort()).toEqual([
      "mol-celovska",
      "omv-brezovica",
      "omv-domzale",
      "omv-smartinska",
      "petrol-bezigrad",
      "petrol-grosuplje-a2",
      "petrol-rudnik",
      "petrol-vodice-a2",
    ]);
    // konsistentnost: točno tiste znotraj ovoja so vrnjene, ostale ne
    const vrnjene = new Set(r.map((s) => s.id));
    for (const s of FUEL_STATIONS) {
      expect(inBbox(s.lat, s.lng, LJ_BBOX)).toBe(vrnjene.has(s.id));
    }
  });

  test("prazen bbox sredi oceana (0,0–0,1) → prazen seznam", () => {
    expect(
      filterFuelByBbox({ south: 0, west: 0, north: 0.1, east: 0.1 })
    ).toEqual([]);
  });
});

describe("fuel-stations: haversineKm (zračna razdalja v kilometrih)", () => {
  test("Ljubljana–Maribor: ~103,6 km (med 100 in 110)", () => {
    const km = haversineKm(46.0569, 14.5058, 46.5547, 15.6459);
    // Izmerjena vrednost 103,60 km — ravna črta (cestna razdalja je ~130 km).
    expect(km).toBeGreaterThan(100);
    expect(km).toBeLessThan(110);
    expect(km).toBeCloseTo(103.6, 1);
  });

  test("razdalja točke same s sabo → 0", () => {
    expect(haversineKm(46.0569, 14.5058, 46.0569, 14.5058)).toBe(0);
  });

  test("pozitivna za različni točki in simetrična (a→b === b→a)", () => {
    const ab = haversineKm(45.5463, 13.7294, 46.5547, 15.6459); // Koper–Maribor
    expect(ab).toBeGreaterThan(0);
    expect(ab).toBeCloseTo(
      haversineKm(46.5547, 15.6459, 45.5463, 13.7294),
      9
    );
  });
});

describe("fuel-stations: nearestFuelStation", () => {
  test("za koordinate Bleda (46,3683 · 14,0944) vrne črpalko znotraj 5 km", () => {
    const r = nearestFuelStation(46.3683, 14.0944);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.km).toBeGreaterThan(0);
    expect(r.km).toBeLessThan(5);
    // kanon: OMV Lesce je najbližja (~0,9 km od središča Bleda)
    expect(r.station.id).toBe("omv-lesce");
    // razdalja v odgovoru je haversine do izbrane postaje (konzistentnost)
    expect(r.km).toBeCloseTo(
      haversineKm(46.3683, 14.0944, r.station.lat, r.station.lng),
      9
    );
  });

  test("prazen seznam → null (edini primer, ko ni odgovora)", () => {
    expect(nearestFuelStation(46.05, 14.5, [])).toBeNull();
  });

  test("custom seznam dveh črpalk izbere bližjo (ne glede na vrstni red)", () => {
    const dalec: FuelStation = {
      id: "test-maribor",
      name: "Testni Maribor",
      brand: "Petrol",
      lat: 46.5547,
      lng: 15.6459,
      fuels: ["95", "dizel"],
      highway: false,
    };
    const blizu: FuelStation = {
      id: "test-bled",
      name: "Testni Bled",
      brand: "OMV",
      lat: 46.36,
      lng: 14.095,
      fuels: ["95", "dizel"],
      highway: false,
    };
    for (const seznam of [
      [dalec, blizu],
      [blizu, dalec],
    ]) {
      const r = nearestFuelStation(46.3683, 14.0944, seznam);
      expect(r?.station.id).toBe("test-bled");
    }
    const r = nearestFuelStation(46.3683, 14.0944, [dalec, blizu]);
    expect(r?.km).toBeCloseTo(haversineKm(46.3683, 14.0944, 46.36, 14.095), 9);
  });
});

describe("fuel-stations: fuelStationDTO (kopija, ne sklic na register)", () => {
  test("kopira vsa polja; fuels je nova tabela z enakimi vrstami goriv", () => {
    const s = FUEL_STATIONS.find((x) => x.id === "petrol-bled");
    expect(s).toBeDefined();
    if (!s) return;
    const dto = fuelStationDTO(s);
    expect(dto.id).toBe("petrol-bled");
    expect(dto.name).toBe(s.name);
    expect(dto.brand).toBe(s.brand);
    expect(dto.lat).toBe(s.lat);
    expect(dto.lng).toBe(s.lng);
    expect(dto.highway).toBe(s.highway);
    expect(dto.fuels).toEqual(s.fuels);
    expect(dto.fuels).not.toBe(s.fuels); // kopija, ne sklic
  });

  test("mutacija DTO polja ne spremeni originala (push + ponovni klic)", () => {
    const s = FUEL_STATIONS.find((x) => x.id === "petrol-bled");
    if (!s) return;
    const dto = fuelStationDTO(s);
    dto.fuels.push("vodonik");
    expect(fuelStationDTO(s).fuels).not.toContain("vodonik");
    expect(s.fuels).not.toContain("vodonik");
    expect(s.fuels.length).toBe(3); // 95, 98, dizel — nedotaknjeno
  });
});

describe("fuel-stations: fuelBrandCounts (števec po verigah)", () => {
  test("vsota števcev = velikost nabora (66) — nobena črpalka ni pozabljena", () => {
    const counts = fuelBrandCounts();
    const vsota = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(vsota).toBe(FUEL_STATIONS.length);
    expect(vsota).toBe(66);
  });

  test("vsaj trije ključi; Petrol, OMV in MOL vsak > 0; samo veljavne verige", () => {
    const counts = fuelBrandCounts();
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(3);
    expect(counts["Petrol"] ?? 0).toBeGreaterThan(0);
    expect(counts["OMV"] ?? 0).toBeGreaterThan(0);
    expect(counts["MOL"] ?? 0).toBeGreaterThan(0);
    for (const veriga of Object.keys(counts)) {
      expect(VELJAVNE_VERIGE.has(veriga as FuelBrand)).toBe(true);
    }
  });
});
