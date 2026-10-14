/**
 * MAP-PINS — čista logika /api/map/pins (bbox/zoom validacija, gradnja
 * pinov iz kanonskih podatkov, zoom vrata 14/15, agregacija celic ~0,05°,
 * cap 500, invariante odgovora).
 *
 * Kanon iskrenosti: 74 destinacij (precision "exact") + 32 lokalov
 * (precision "destination_center", izpeljane koordinate) = 64 krajev;
 * 2 lokala brez povezave na destinacijo sta IZPUŠČENA (nimajo koordinat).
 */

import { describe, expect, test } from "bun:test";

import { LOKALI } from "../src/lib/lokali-data";
import {
  aggregateCells,
  ALL_PINS,
  BBOX_REQUIRED_ERROR,
  buildAllPins,
  buildPinsPayload,
  parseBbox,
  parseZoom,
  PINS_CAP,
  PINS_DATASET_PLACES,
  PINS_ZOOM_THRESHOLD,
  pinsInBbox,
  type MapPin,
} from "../src/lib/map-pins";
import { DESTINATIONS } from "../src/lib/slovenia-data";

/** Veljaven bbox, ki pokriva VSE pine (#41 F1). */
/** Bbox cel Balkan (#41 F1: od Alp do severne Grčije, do bg Črnega morja). */
const FULL_BBOX = { south: 39, west: 13, north: 47, east: 28 };
/** Bbox Ljubljane (destinacija + 11 lokalov = 12 pinov). */
const LJ_BBOX = { south: 46.03, west: 14.42, north: 46.1, east: 14.6 };

describe("map-pins: bbox parsing", () => {
  test("veljaven bbox (south,west,north,east)", () => {
    const r = parseBbox("45.3,13.2,47.0,16.5");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ south: 45.3, west: 13.2, north: 47, east: 16.5 });
    }
  });

  test("manjkajoč bbox → DOSEDNA napaka produkcije", () => {
    expect(parseBbox(null)).toEqual({ ok: false, error: BBOX_REQUIRED_ERROR });
    expect(BBOX_REQUIRED_ERROR).toBe("bbox required (south,west,north,east)");
    expect(parseBbox("").ok).toBe(false);
    expect(parseBbox("   ").ok).toBe(false);
  });

  test("napačno število vrednosti", () => {
    expect(parseBbox("1,2,3").ok).toBe(false);
    expect(parseBbox("1,2,3,4,5").ok).toBe(false);
  });

  test("ne-številke", () => {
    expect(parseBbox("a,13.2,47,16.5").ok).toBe(false);
    expect(parseBbox("45.3,13.2,NaN,16.5").ok).toBe(false);
  });

  test("širina izven [-90,90] in dolžina izven [-180,180]", () => {
    expect(parseBbox("91,13.2,47,16.5").ok).toBe(false);
    expect(parseBbox("45.3,-181,47,16.5").ok).toBe(false);
    expect(parseBbox("45.3,13.2,-91,16.5").ok).toBe(false);
  });

  test("south ≥ north oziroma west ≥ east → napaka", () => {
    expect(parseBbox("47,13.2,45,16.5").ok).toBe(false);
    expect(parseBbox("45.3,16.5,47,13.2").ok).toBe(false);
  });

  test("prevelik razpon (>10° širine / >15° dolžine) → napaka", () => {
    expect(parseBbox("30,13.2,47,16.5").ok).toBe(false); // 17° N–S
    expect(parseBbox("45.3,0,46,16.5").ok).toBe(false); // 16,5° E–W
  });

  test("robična razpona (natanko 10° / 15°) sta veljavna", () => {
    expect(parseBbox("36,13,46,16").ok).toBe(true); // 10° N–S
    expect(parseBbox("45,0,46,15").ok).toBe(true); // 15° E–W
  });
});

describe("map-pins: zoom", () => {
  test("manjkajoč/prazen zoom → privzetek 10 (kot v produkciji)", () => {
    expect(parseZoom(null)).toEqual({ ok: true, value: 10 });
    expect(parseZoom("")).toEqual({ ok: true, value: 10 });
  });

  test("veljaven zoom 3–19", () => {
    expect(parseZoom("3")).toEqual({ ok: true, value: 3 });
    expect(parseZoom("15")).toEqual({ ok: true, value: 15 });
    expect(parseZoom("19")).toEqual({ ok: true, value: 19 });
  });

  test("neveljaven zoom → napaka", () => {
    expect(parseZoom("2").ok).toBe(false);
    expect(parseZoom("20").ok).toBe(false);
    expect(parseZoom("abc").ok).toBe(false);
    expect(parseZoom("9.5").ok).toBe(false);
    expect(parseZoom("15,5").ok).toBe(false);
  });
});

describe("map-pins: gradnja pinov (74 + 32 = 106, iskrene oznake)", () => {
  test("obseg: 74 destinacij + 32 lokalov = 106 pinov z unikatnimi id-ji (#41 F2)", () => {
    const pins = buildAllPins();
    expect(DESTINATIONS.length).toBe(74); // #41 F1: 38 + 36 balkanskih
    expect(LOKALI.filter((l) => l.destinationSlug).length).toBe(32);
    expect(pins.length).toBe(106);
    expect(new Set(pins.map((p) => p.id)).size).toBe(106);
    expect(ALL_PINS.length).toBe(106);
    expect(PINS_DATASET_PLACES).toBe(106);
  });

  test("vseh 74 destinacij: type destination, precision exact, id = slug, koordinate 1:1", () => {
    const pins = buildAllPins();
    for (const d of DESTINATIONS) {
      const pin = pins.find((p) => p.id === d.slug);
      expect(pin).toBeDefined();
      if (!pin) continue;
      expect(pin.type).toBe("destination");
      expect(pin.precision).toBe("exact");
      expect(pin.name).toBe(d.name);
      expect(pin.lat).toBe(d.coords.lat);
      expect(pin.lng).toBe(d.coords.lng);
    }
  });

  test("32 lokalov: precision destination_center, koordinate = središče povezane destinacije", () => {
    const pins = buildAllPins();
    const bySlug = new Map(DESTINATIONS.map((d) => [d.slug, d]));
    for (const x of LOKALI) {
      if (!x.destinationSlug) continue;
      const pin = pins.find((p) => p.id === x.id);
      expect(pin).toBeDefined();
      if (!pin) continue;
      const d = bySlug.get(x.destinationSlug);
      expect(d).toBeDefined();
      if (!d) continue;
      expect(pin.precision).toBe("destination_center");
      expect(pin.type).toBe(x.category);
      expect(pin.name).toBe(x.name);
      expect(pin.lat).toBe(d.coords.lat);
      expect(pin.lng).toBe(d.coords.lng);
    }
  });

  test("2 lokala brez destinationSlug sta izpuščena (iskrena odsotnost)", () => {
    const pins = buildAllPins();
    const without = LOKALI.filter((l) => !l.destinationSlug);
    expect(without.length).toBe(2); // trenutni kanon podatkov
    for (const x of without) {
      expect(pins.some((p) => p.id === x.id)).toBe(false);
    }
    expect(pins.length - DESTINATIONS.length).toBe(32);
  });
});

describe("map-pins: zoom vrata in agregacija", () => {
  test("zoom 14 → grid (celice, brez pinov); zoom 15 → pins (brez celic)", () => {
    expect(PINS_ZOOM_THRESHOLD).toBe(15);
    const grid = buildPinsPayload(FULL_BBOX, 14);
    expect(grid.mode).toBe("grid");
    expect(Array.isArray(grid.cells)).toBe(true);
    expect(grid.pins).toBeUndefined();

    const pins = buildPinsPayload(FULL_BBOX, 15);
    expect(pins.mode).toBe("pins");
    expect(Array.isArray(pins.pins)).toBe(true);
    expect(pins.cells).toBeUndefined();
  });

  test("grid: total = vsota števil terk celic, returned = št. celic, capped false", () => {
    const p = buildPinsPayload(FULL_BBOX, 9);
    expect(p.mode).toBe("grid");
    expect(p.total).toBe(106);
    expect(p.cells?.length).toBeGreaterThan(0);
    if (!p.cells) throw new Error("grid način mora vrniti celice");
    expect(p.cells.reduce((s, c) => s + c.count, 0)).toBe(p.total);
    expect(p.returned).toBe(p.cells.length);
    expect(p.capped).toBe(false);
  });

  test("agregacija: vsi pinovi Ljubljane v eni celici (12) s povprečnim središčem", () => {
    const matching = pinsInBbox(ALL_PINS, LJ_BBOX);
    expect(matching.length).toBe(12); // 1 destinacija + 11 lokalov
    const cells = aggregateCells(matching);
    expect(cells.length).toBe(1);
    const cell = cells[0];
    // Vsi pripadajoči pinovi so na koordinatah Ljubljane → povprečje = isto.
    expect(cell?.count).toBe(12);
    expect(cell?.lat).toBeCloseTo(46.0569, 4);
    expect(cell?.lng).toBeCloseTo(14.5058, 4);
  });

  test("cats razvrščene po številu padajoče (izenačenja po abecedi)", () => {
    const cells = aggregateCells(pinsInBbox(ALL_PINS, LJ_BBOX));
    const cats = cells[0]?.cats ?? [];
    // Ljubljana: restaurant 5 · bar 2 · transport 2 · destination/hotel/shop 1
    expect(cats[0]).toEqual({ type: "restaurant", count: 5 });
    expect(cats[1]).toEqual({ type: "bar", count: 2 });
    expect(cats[2]).toEqual({ type: "transport", count: 2 });
    expect(cats.length).toBe(6);
    for (let i = 1; i < cats.length; i++) {
      const prev = cats[i - 1] as { type: string; count: number };
      const cur = cats[i] as { type: string; count: number };
      expect(prev.count).toBeGreaterThanOrEqual(cur.count);
    }
  });

  test("pins mode nad Ljubljano: 12 pinov, capped false", () => {
    const p = buildPinsPayload(LJ_BBOX, 15);
    expect(p.mode).toBe("pins");
    expect(p.pins?.length).toBe(12);
    expect(p.total).toBe(12);
    expect(p.returned).toBe(12);
    expect(p.capped).toBe(false);
    expect(p.pins?.filter((x) => x.type === "destination").length).toBe(1);
    expect(p.pins?.filter((x) => x.type !== "destination").length).toBe(11);
  });

  test("bbox filter vrača samo pine znotraj ovoja (vključno z robovi)", () => {
    const inside = pinsInBbox(ALL_PINS, LJ_BBOX);
    for (const p of inside) {
      expect(p.lat).toBeGreaterThanOrEqual(LJ_BBOX.south);
      expect(p.lat).toBeLessThanOrEqual(LJ_BBOX.north);
      expect(p.lng).toBeGreaterThanOrEqual(LJ_BBOX.west);
      expect(p.lng).toBeLessThanOrEqual(LJ_BBOX.east);
    }
    // Prazna območja → iskren prazen odgoviv (npr. sredina Atlantika)
    const atlantic = { south: 0, west: -30, north: 5, east: -25 };
    const empty = buildPinsPayload(atlantic, 9);
    expect(empty.total).toBe(0);
    expect(empty.cells).toEqual([]);
  });
});

describe("map-pins: cap 500 + invariante odgovora", () => {
  test("cap 500: prirezen seznam → capped true, returned 500, total 600", () => {
    expect(PINS_CAP).toBe(500);
    // Izmišljeni pinovi SAMO za preizkus capa (injekcija čiste funkcije).
    const fake: MapPin[] = Array.from({ length: 600 }, (_, i) => ({
      id: `fake-${i}`,
      lat: 40 + i * 0.0001,
      lng: 14 + i * 0.0001,
      type: "other",
      name: `Fake ${i}`,
      precision: "exact",
    }));
    const p = buildPinsPayload(
      { south: 39.9, west: 13.9, north: 40.2, east: 14.2 },
      15,
      fake
    );
    expect(p.mode).toBe("pins");
    expect(p.total).toBe(600);
    expect(p.returned).toBe(500);
    expect(p.pins?.length).toBe(500);
    expect(p.capped).toBe(true);
    expect(p.total).toBeGreaterThanOrEqual(p.returned);
  });

  test("dataset pošteno opisuje LASTNE podatke (places 106, installed true)", () => {
    for (const zoom of [9, 15]) {
      const p = buildPinsPayload(FULL_BBOX, zoom);
      expect(p.dataset.installed).toBe(true);
      expect(p.dataset.places).toBe(106);
      expect(p.dataset.lastUpdated).toBe("2026-10-07");
      expect(p.dataset.snapshotDate).toBe("2026-10-07");
      expect(p.total).toBeGreaterThanOrEqual(p.returned);
    }
  });

  test("source = lastni kanonski podatki (slug own), generatedAt veljaven ISO", () => {
    const p = buildPinsPayload(FULL_BBOX, 10);
    expect(p.source.slug).toBe("own");
    expect(p.source.label).toBe("Lastni kanonski podatki (rekonstrukcija)");
    expect(p.source.license).toBe("glej /vir-podatkov");
    expect(Number.isNaN(Date.parse(p.generatedAt))).toBe(false);
  });
});
