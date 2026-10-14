/**
 * MAP-PINS — čista logika pins API-ja /api/map/pins (rekonstrukcija).
 *
 * OBLIKA 1:1 s produkcije (i-feel-slovenia.vercel.app/api/map/pins,
 * preverjeno živo 2026-10-07):
 *   { mode, cells|pins, total, returned, capped,
 *     dataset: { installed, places, lastUpdated, snapshotDate },
 *     generatedAt, source: { slug, label, license } }
 *
 * Produkcija streže FSQ Open Places (125.445 krajev, Apache-2.0) — te
 * množice v peskovniku NI (nameščena samo na produkciji), zato rekonstrukcija
 * pošteno streže LASTNE kanonske podatke (source.slug "own"):
 *
 *  - 74 destinacij (slovenia-data) → pin precision "exact"
 *  - 26 lokalov s povezavo na destinacijo (lokali-data) → koordinate
 *    IZPELJANE iz središča povezane destinacije, precision
 *    "destination_center" (iskreno označena izpeljava)
 *  - 2 lokala BREZ povezave na destinacijo sta IZPUŠČENA — nimajo
 *    koordinat in jih zato iskreno ne izmišljujemo
 *
 * Zoom vrata (kot v produkciji): zoom < 15 → mode "grid" (agregacija v
 * celice ~0,05°: floor(coord/0,05)), zoom ≥ 15 → mode "pins" (cap 500 +
 * zastavica capped). dataset.places = 38 + 26 = 64 — pošten opis LASTNE
 * množice, ne FSQ 125k.
 *
 * Modul je ČIST (brez stranskih učinkov) — testi ga uvažajo brez
 * strežniških API-jev; route handler ostane tanek.
 */

import { LOKALI } from "./lokali-data";
import { DESTINATIONS } from "./slovenia-data";

// ── Tipi ───────────────────────────────────────────────────────────────

/** En pin na zemljevidu (destinacija ali lokal). */
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  /** "destination" ali kanonska kategorija lokalov (hotel, restaurant …). */
  type: string;
  name: string;
  /** exact = prave koordinate · destination_center = izpeljano središče. */
  precision: "exact" | "destination_center";
}

/** Ovojina pogleda: south,west,north,east (stopinje). */
export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Agregirana celica mreže ~0,05° (grid način, zoom < 15). */
export interface GridCell {
  lat: number;
  lng: number;
  count: number;
  cats: { type: string; count: number }[];
}

export interface MapPinsDataset {
  installed: boolean;
  places: number;
  lastUpdated: string;
  snapshotDate: string;
}

export interface MapPinsSource {
  slug: "own";
  label: string;
  license: string;
}

export interface MapPinsResponse {
  mode: "grid" | "pins";
  cells?: GridCell[];
  pins?: MapPin[];
  total: number;
  returned: number;
  capped: boolean;
  dataset: MapPinsDataset;
  generatedAt: string;
  source: MapPinsSource;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

// ── Konstante ──────────────────────────────────────────────────────────

/** Napaka ob manjkajočem bboxu — DOSEDNJA oblika produkcije (1:1). */
export const BBOX_REQUIRED_ERROR = "bbox required (south,west,north,east)";

/** Velikost celice mreže v stopinjah (grid način). */
export const CELL_SIZE_DEG = 0.05;

/** Prag zoom za preklop grid → pins (kot v produkciji). */
export const PINS_ZOOM_THRESHOLD = 15;

/** Največje število pinov v odgovoru (pins način). */
export const PINS_CAP = 500;

export const DEFAULT_ZOOM = 10;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 19;

/** Največji dovoljeni razpon bboxa po širini (sever–jug). */
export const BBOX_MAX_LAT_SPAN = 10;
/** Največji dovoljeni razpon bboxa po dolžini (vzhod–zahod). */
export const BBOX_MAX_LNG_SPAN = 15;

/** Datum potrditve kanonskih podatkov (živo preverjeno; glej RECONSTRUCTION-PLAN). */
export const PINS_LAST_UPDATED = "2026-10-07";
export const PINS_SNAPSHOT_DATE = "2026-10-07";

export const PINS_SOURCE: MapPinsSource = {
  slug: "own",
  label: "Lastni kanonski podatki (rekonstrukcija)",
  license: "glej /vir-podatkov",
};

// ── bbox / zoom parsing ────────────────────────────────────────────────

/** Zaokroži na 4 decimalke (natančnost koordinat kanona). */
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Parse bbox CSV "south,west,north,east" (4 števila).
 * - manjka → produkciji DOSEDNA napaka BBOX_REQUIRED_ERROR
 * - veljavnost: 4 končna števila, lat ∈ [-90,90], lng ∈ [-180,180],
 *   south < north, west < east, razpon ≤ 10° (širina) oziroma ≤ 15° (dolžina)
 * - vsa ostala sporočila so slovenska (kanon rekonstrukcije)
 */
export function parseBbox(raw: string | null): ParseResult<Bbox> {
  if (raw === null || raw.trim() === "") {
    return { ok: false, error: BBOX_REQUIRED_ERROR };
  }
  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length !== 4) {
    return {
      ok: false,
      error: "bbox mora vsebovati natanko 4 vrednosti (south,west,north,east)",
    };
  }
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) {
    return { ok: false, error: "bbox vsebuje neveljavno število" };
  }
  const [south, west, north, east] = nums;
  if (south < -90 || south > 90 || north < -90 || north > 90) {
    return { ok: false, error: "širina (south/north) mora biti med -90 in 90" };
  }
  if (west < -180 || west > 180 || east < -180 || east > 180) {
    return { ok: false, error: "dolžina (west/east) mora biti med -180 in 180" };
  }
  if (south >= north) {
    return { ok: false, error: "south mora biti strogo manjši od north" };
  }
  if (west >= east) {
    return { ok: false, error: "west mora biti strogo manjši od east" };
  }
  if (north - south > BBOX_MAX_LAT_SPAN) {
    return {
      ok: false,
      error: "razpon bbox po širini presega 10° (north − south ≤ 10)",
    };
  }
  if (east - west > BBOX_MAX_LNG_SPAN) {
    return {
      ok: false,
      error: "razpon bbox po dolžini presega 15° (east − west ≤ 15)",
    };
  }
  return { ok: true, value: { south, west, north, east } };
}

/**
 * Parse zoom: celo število 3–19, privzeto 10 (kot v produkciji).
 * Prazna vrednost se šteje za manjkajočo → privzetek.
 */
export function parseZoom(raw: string | null): ParseResult<number> {
  if (raw === null || raw.trim() === "") {
    return { ok: true, value: DEFAULT_ZOOM };
  }
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < MIN_ZOOM || n > MAX_ZOOM) {
    return { ok: false, error: "zoom mora biti celo število med 3 in 19" };
  }
  return { ok: true, value: n };
}

// ── Gradnja pinov iz kanonskih podatkov ────────────────────────────────

/**
 * Zgradi VSE pine iz lastnih kanonskih podatkov (deterministično):
 * 74 destinacij (precision "exact") + 32 lokalov s povezavo na destinacijo
 * (precision "destination_center" — koordinate izpeljane iz središča
 * destinacije, iskreno označene). Lokali brez destinationSlug so izpuščeni.
 */
export function buildAllPins(): MapPin[] {
  const destPins: MapPin[] = DESTINATIONS.map((d) => ({
    id: d.slug,
    lat: d.coords.lat,
    lng: d.coords.lng,
    type: "destination",
    name: d.name,
    precision: "exact",
  }));

  const bySlug = new Map(DESTINATIONS.map((d) => [d.slug, d]));
  const lokalPins: MapPin[] = [];
  for (const x of LOKALI) {
    if (!x.destinationSlug) continue; // brez koordinat → iskrena odsotnost
    const d = bySlug.get(x.destinationSlug);
    if (!d) continue; // defensivno (obstoj zagotavljajo testi lokali-data)
    lokalPins.push({
      id: x.id,
      lat: d.coords.lat,
      lng: d.coords.lng,
      type: x.category,
      name: x.name,
      precision: "destination_center",
    });
  }

  return [...destPins, ...lokalPins];
}

/** Vsi pinu (modul-nivo constant — 38 + 26 = 64). */
export const ALL_PINS: MapPin[] = buildAllPins();

/** Število krajev v LASTNI množici (dataset.places). */
export const PINS_DATASET_PLACES = ALL_PINS.length;

// ── Filtre in agregacija ───────────────────────────────────────────────

/** Pine znotraj bboxa (vključno z robovi; deterministični vrstni red). */
export function pinsInBbox(pins: MapPin[], bbox: Bbox): MapPin[] {
  return pins.filter(
    (p) =>
      p.lat >= bbox.south &&
      p.lat <= bbox.north &&
      p.lng >= bbox.west &&
      p.lng <= bbox.east
  );
}

/**
 * Agregiraj pine v celice mreže ~0,05° (indeks celice = floor(coord/0,05)).
 * Celica: središče = POVPREČJE članov (ne središče kvadrata mreže — bolj
 * pošteno glede na dejansko gostoto), count = število članov,
 * cats po tipu razvrščene po številu padajoče (izenačenja po abecedi —
 * determinizem). Celice razvrščene po count padajoče, nato po lat/lng.
 */
export function aggregateCells(pins: MapPin[]): GridCell[] {
  const groups = new Map<string, MapPin[]>();
  for (const p of pins) {
    const key = `${Math.floor(p.lat / CELL_SIZE_DEG)}:${Math.floor(p.lng / CELL_SIZE_DEG)}`;
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  const cells: GridCell[] = [];
  for (const members of groups.values()) {
    const lat = round4(
      members.reduce((s, p) => s + p.lat, 0) / members.length
    );
    const lng = round4(
      members.reduce((s, p) => s + p.lng, 0) / members.length
    );
    const byType = new Map<string, number>();
    for (const m of members) {
      byType.set(m.type, (byType.get(m.type) ?? 0) + 1);
    }
    const cats = [...byType.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
    cells.push({ lat, lng, count: members.length, cats });
  }

  cells.sort((a, b) => b.count - a.count || a.lat - b.lat || a.lng - b.lng);
  return cells;
}

// ── Sestava odgovora ───────────────────────────────────────────────────

/**
 * Zgradi celoten odgovor pins API-ja za (bbox, zoom).
 * - zoom < PINS_ZOOM_THRESHOLD → grid: celice, returned = št. celic,
 *   capped = false (celice niso omejene — lastna množica je majhna)
 * - zoom ≥ prag → pins: cap PINS_CAP, capped = true ob prirezanem
 *   seznamu, returned = dejansko vrnjenih
 *
 * Čisti parametri: allPins (injekcija za teste) + now (generiranje ISO).
 */
export function buildPinsPayload(
  bbox: Bbox,
  zoom: number,
  allPins: MapPin[] = ALL_PINS,
  now: () => Date = () => new Date()
): MapPinsResponse {
  const matching = pinsInBbox(allPins, bbox);
  const dataset: MapPinsDataset = {
    installed: true,
    places: allPins.length,
    lastUpdated: PINS_LAST_UPDATED,
    snapshotDate: PINS_SNAPSHOT_DATE,
  };
  const generatedAt = now().toISOString();

  if (zoom >= PINS_ZOOM_THRESHOLD) {
    const capped = matching.length > PINS_CAP;
    const pins = capped ? matching.slice(0, PINS_CAP) : matching;
    return {
      mode: "pins",
      pins,
      total: matching.length,
      returned: pins.length,
      capped,
      dataset,
      generatedAt,
      source: PINS_SOURCE,
    };
  }

  const cells = aggregateCells(matching);
  return {
    mode: "grid",
    cells,
    total: matching.length,
    returned: cells.length,
    capped: false,
    dataset,
    generatedAt,
    source: PINS_SOURCE,
  };
}
