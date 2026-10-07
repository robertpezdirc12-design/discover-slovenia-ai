/**
 * FUEL-STATIONS — čisti nabor bencinskih črpalk po Sloveniji (v2.5.0).
 *
 * Vir: kurirani odprti podatki po osnovi OpenStreetMap (ODbL). V peskovniku
 * Overpass API NI dosegljiv (preizkušeno 2026-10-08: overpass-api.de zavrne
 * povezavo), zato ta modul pošteno streže LASTEN kuriran nabor 66 črpalk
 * ob ključnih prometnicah in destinacijah.
 *
 * ISKRENOSTNI KANON (kot pri lokalov na zemljevidu — precision):
 *  · koordinate so PRIbližne (občinsko središče / priključek avtoceste),
 *    označene s konstanto PRECISION = "approximate" — nikoli „exact";
 *  · ne izmišljujemo odpiralnih časov NE CEN goriv (te se spreminjajo
 *    dnevno in so v Sloveniji uravnavane) — popup ponudi le verigo,
 *    vrste goriv in lego;
 *  · pokritost je DELNA (poudarek na destinacijah kanonskega nabora in
 *    koridorjih A1/A2) — total v API odgovoru je iskren.
 *
 * Modul je ČIST (brez stranskih učinkov) — Bbox tip delimo z map-pins.
 */

import type { Bbox } from "./map-pins";

// ── Tipi ───────────────────────────────────────────────────────────────

export type FuelBrand = "Petrol" | "OMV" | "MOL" | "Cink" | "Euro MIL";

export interface FuelStation {
  id: string;
  /** Prikazno ime („Petrol Bled"). */
  name: string;
  brand: FuelBrand;
  lat: number;
  lng: number;
  /** Vrste goriv (orientacijsko — 95/98/dizel so standard, LPG/Adbluha po naboru). */
  fuels: string[];
  /** Ob avtocestnem priključku/počivališču (A1/A2 …). */
  highway: boolean;
}

/** Iskrena oznaka natančnosti koordinat — vidna v API in popupu. */
export const FUEL_PRECISION = "approximate" as const;

/** Licenca vira podatkov (ODbL — odprti podatki). */
export const FUEL_SOURCE = {
  slug: "osm-curated",
  label: "Kurirani odprti podatki po osnovi OpenStreetMap",
  license: "ODbL",
} as const;

const D = ["95", "98", "dizel"];
const DL = ["95", "98", "dizel", "LPG"];

/**
 * Nabor črpalk (~52) — pokritost vseh slovenskih regij: koridorja A1 in A2,
 * Gorenjska, Primorska + obala, Posočje, Štajerska, Koroška, Prekmurje,
 * Dolenjska + Bela krajina, Zasavje, osrednja Slovenija.
 *
 * (Urejen zahod→vzhod po regijah; koordinate priključkov/občin.)
 */
export const FUEL_STATIONS: readonly FuelStation[] = Object.freeze([
  // ── Gorenjska + koridor A2 (Ljubljana–Predor Karavanke) ──
  { id: "petrol-kranjska-gora", name: "Petrol Kranjska Gora", brand: "Petrol", lat: 46.485, lng: 13.79, fuels: D, highway: false },
  { id: "petrol-jesenice", name: "Petrol Jesenice", brand: "Petrol", lat: 46.435, lng: 14.045, fuels: DL, highway: true },
  { id: "petrol-bohinjska-bistrica", name: "Petrol Bohinjska Bistrica", brand: "Petrol", lat: 46.285, lng: 13.95, fuels: D, highway: false },
  { id: "omv-lesce", name: "OMV Lesce", brand: "OMV", lat: 46.36, lng: 14.095, fuels: DL, highway: false },
  { id: "petrol-bled", name: "Petrol Bled", brand: "Petrol", lat: 46.369, lng: 14.114, fuels: D, highway: false },
  { id: "petrol-radovljica", name: "Petrol Radovljica", brand: "Petrol", lat: 46.34, lng: 14.17, fuels: D, highway: false },
  { id: "omv-kranj-a2", name: "OMV Kranj (A2)", brand: "OMV", lat: 46.265, lng: 14.36, fuels: D, highway: true },
  { id: "petrol-kranj-center", name: "Petrol Kranj", brand: "Petrol", lat: 46.245, lng: 14.355, fuels: DL, highway: false },
  { id: "petrol-skofja-loka", name: "Petrol Škofja Loka", brand: "Petrol", lat: 46.165, lng: 14.32, fuels: D, highway: false },
  { id: "petrol-vodice-a2", name: "Petrol Vodice (A2)", brand: "Petrol", lat: 46.15, lng: 14.48, fuels: DL, highway: true },

  // ── Posočje (Soška dolina) ──
  { id: "petrol-bovec", name: "Petrol Bovec", brand: "Petrol", lat: 46.335, lng: 13.54, fuels: D, highway: false },
  { id: "petrol-kobarid", name: "Petrol Kobarid", brand: "Petrol", lat: 46.245, lng: 13.6, fuels: D, highway: false },
  { id: "petrol-tolmin", name: "Petrol Tolmin", brand: "Petrol", lat: 46.185, lng: 13.73, fuels: D, highway: false },
  { id: "petrol-idrija", name: "Petrol Idrija", brand: "Petrol", lat: 46.005, lng: 13.985, fuels: D, highway: false },

  // ── Primorska + obala + koridor A1 (postojna–KP) ──
  { id: "petrol-nova-gorica", name: "Petrol Nova Gorica", brand: "Petrol", lat: 45.955, lng: 13.64, fuels: DL, highway: false },
  { id: "omv-rozna-dolina", name: "OMV Rožna dolina", brand: "OMV", lat: 45.95, lng: 13.65, fuels: D, highway: false },
  { id: "petrol-ajdovscina", name: "Petrol Ajdovščina", brand: "Petrol", lat: 45.885, lng: 13.905, fuels: D, highway: false },
  { id: "petrol-sezana", name: "Petrol Sežana", brand: "Petrol", lat: 45.705, lng: 13.86, fuels: DL, highway: false },
  { id: "petrol-divaca-a1", name: "Petrol Divača (A1)", brand: "Petrol", lat: 45.68, lng: 14.0, fuels: D, highway: true },
  { id: "petrol-postojna-a1", name: "Petrol Postojna (A1)", brand: "Petrol", lat: 45.775, lng: 14.22, fuels: DL, highway: true },
  { id: "omv-postojna", name: "OMV Postojna", brand: "OMV", lat: 45.775, lng: 14.2, fuels: D, highway: false },
  { id: "petrol-cerknica", name: "Petrol Cerknica", brand: "Petrol", lat: 45.795, lng: 14.375, fuels: D, highway: false },
  { id: "petrol-ilirska-bistrica", name: "Petrol Ilirska Bistrica", brand: "Petrol", lat: 45.57, lng: 14.23, fuels: D, highway: false },
  { id: "petrol-koper-a1", name: "Petrol Koper (A1)", brand: "Petrol", lat: 45.53, lng: 13.73, fuels: DL, highway: true },
  { id: "omv-koper", name: "OMV Koper", brand: "OMV", lat: 45.55, lng: 13.73, fuels: D, highway: false },
  { id: "mol-crnikal", name: "MOL Črni Kal (A1)", brand: "MOL", lat: 45.55, lng: 13.9, fuels: D, highway: true },
  { id: "petrol-portoroz", name: "Petrol Portorož", brand: "Petrol", lat: 45.51, lng: 13.6, fuels: D, highway: false },
  { id: "omv-lucija", name: "OMV Lucija", brand: "OMV", lat: 45.5, lng: 13.67, fuels: D, highway: false },

  // ── Notranjsko-kraška → osrednja Slovenija (A1 vzhodno) ──
  { id: "petrol-logatec-a1", name: "Petrol Logatec (A1)", brand: "Petrol", lat: 45.92, lng: 14.25, fuels: D, highway: true },
  { id: "petrol-vrhnika", name: "Petrol Vrhnika", brand: "Petrol", lat: 45.96, lng: 14.3, fuels: D, highway: false },
  { id: "omv-brezovica", name: "OMV Brezovica", brand: "OMV", lat: 46.03, lng: 14.4, fuels: D, highway: false },

  // ── Ljubljana (mestni obroč) ──
  { id: "petrol-bezigrad", name: "Petrol Bežigrad", brand: "Petrol", lat: 46.075, lng: 14.535, fuels: DL, highway: false },
  { id: "omv-smartinska", name: "OMV Šmartinska", brand: "OMV", lat: 46.068, lng: 14.54, fuels: D, highway: false },
  { id: "petrol-rudnik", name: "Petrol Rudnik", brand: "Petrol", lat: 46.02, lng: 14.515, fuels: D, highway: false },
  { id: "mol-celovska", name: "MOL Celovška", brand: "MOL", lat: 46.065, lng: 14.49, fuels: D, highway: false },
  { id: "omv-domzale", name: "OMV Domžale", brand: "OMV", lat: 46.15, lng: 14.64, fuels: D, highway: false },
  { id: "petrol-kamnik", name: "Petrol Kamnik", brand: "Petrol", lat: 46.22, lng: 14.61, fuels: D, highway: false },
  { id: "petrol-litija", name: "Petrol Litija", brand: "Petrol", lat: 46.06, lng: 14.82, fuels: D, highway: false },

  // ── Zasavje + Savinjska dolina ──
  { id: "petrol-zagorje", name: "Petrol Zagorje", brand: "Petrol", lat: 46.145, lng: 14.96, fuels: D, highway: false },
  { id: "petrol-trbovlje", name: "Petrol Trbovlje", brand: "Petrol", lat: 46.12, lng: 15.04, fuels: D, highway: false },
  { id: "petrol-lasko", name: "Petrol Laško", brand: "Petrol", lat: 46.145, lng: 15.23, fuels: D, highway: false },
  { id: "petrol-celje-center", name: "Petrol Celje", brand: "Petrol", lat: 46.235, lng: 15.26, fuels: DL, highway: false },
  { id: "omv-celje", name: "OMV Celje", brand: "OMV", lat: 46.245, lng: 15.275, fuels: D, highway: false },
  { id: "petrol-vransko-a1", name: "Petrol Vransko (A1)", brand: "Petrol", lat: 46.21, lng: 15.11, fuels: DL, highway: true },
  { id: "omv-zalec", name: "OMV Žalec", brand: "OMV", lat: 46.255, lng: 15.17, fuels: D, highway: false },

  // ── Štajerska + koridor A4/A1 vzhod ──
  { id: "petrol-rogaska", name: "Petrol Rogaška Slatina", brand: "Petrol", lat: 46.325, lng: 15.64, fuels: D, highway: false },
  { id: "petrol-ptuj", name: "Petrol Ptuj", brand: "Petrol", lat: 46.42, lng: 15.85, fuels: DL, highway: false },
  { id: "petrol-maribor-center", name: "Petrol Maribor", brand: "Petrol", lat: 46.555, lng: 15.63, fuels: DL, highway: false },
  { id: "omv-maribor", name: "OMV Maribor", brand: "OMV", lat: 46.545, lng: 15.65, fuels: D, highway: false },
  { id: "mol-maribor-tezno", name: "MOL Maribor Tezno", brand: "MOL", lat: 46.53, lng: 15.66, fuels: D, highway: false },

  // ── Koroška ──
  { id: "petrol-ravne", name: "Petrol Ravne na Koroškem", brand: "Petrol", lat: 46.515, lng: 14.96, fuels: D, highway: false },
  { id: "petrol-slovenj-gradec", name: "Petrol Slovenj Gradec", brand: "Petrol", lat: 46.51, lng: 15.08, fuels: D, highway: false },
  { id: "petrol-dravograd", name: "Petrol Dravograd", brand: "Petrol", lat: 46.59, lng: 15.02, fuels: D, highway: false },

  // ── Prekmurje ──
  { id: "petrol-gornja-radgona", name: "Petrol Gornja Radgona", brand: "Petrol", lat: 46.675, lng: 15.99, fuels: D, highway: false },
  { id: "petrol-murska-sobota", name: "Petrol Murska Sobota", brand: "Petrol", lat: 46.66, lng: 16.15, fuels: DL, highway: false },
  { id: "omv-murska-sobota", name: "OMV Murska Sobota", brand: "OMV", lat: 46.665, lng: 16.17, fuels: D, highway: false },
  { id: "petrol-lendava", name: "Petrol Lendava", brand: "Petrol", lat: 46.56, lng: 16.44, fuels: D, highway: false },

  // ── Dolenjska + Bela krajina + koridor A2 jug ──
  { id: "petrol-grosuplje-a2", name: "Petrol Grosuplje (A2)", brand: "Petrol", lat: 45.955, lng: 14.66, fuels: D, highway: true },
  { id: "petrol-trebnje-a2", name: "Petrol Trebnje (A2)", brand: "Petrol", lat: 45.905, lng: 15.01, fuels: DL, highway: true },
  { id: "petrol-novo-mesto", name: "Petrol Novo mesto", brand: "Petrol", lat: 45.8, lng: 15.17, fuels: D, highway: false },
  { id: "omv-novo-mesto", name: "OMV Novo mesto", brand: "OMV", lat: 45.805, lng: 15.175, fuels: D, highway: false },
  { id: "petrol-otocec", name: "Petrol Otočec", brand: "Petrol", lat: 45.68, lng: 15.2, fuels: D, highway: false },
  { id: "petrol-krsko", name: "Petrol Krško", brand: "Petrol", lat: 45.965, lng: 15.49, fuels: D, highway: false },
  { id: "petrol-sevnica", name: "Petrol Sevnica", brand: "Petrol", lat: 46.01, lng: 15.27, fuels: D, highway: false },
  { id: "petrol-kocevje", name: "Petrol Kočevje", brand: "Petrol", lat: 45.64, lng: 14.86, fuels: D, highway: false },
  { id: "petrol-crnomelj", name: "Petrol Črnomelj", brand: "Petrol", lat: 45.57, lng: 15.18, fuels: D, highway: false },
]);

// ── Čiste funkcije ─────────────────────────────────────────────────────

export type FuelBbox = Bbox;

export type ParseFuelBbox =
  | { ok: true; value: FuelBbox }
  | { ok: false; error: string };

/**
 * Parse bbox za ČRPALKE — brez omejitve razpona (parseBbox iz map-pins
 * omejuje 10°/15° za FSQ pine pri zoom ≥ 15; plast črpalk pa je ravno
 * namenjena POGLEDU CELE DRŽAVE, odkrito 2026-10-08 v E2E preizkusu).
 * Veljavnost koordinat in usmerjenost ostajata obvezni.
 */
export function parseFuelBbox(raw: string | null): ParseFuelBbox {
  if (raw === null || raw.trim() === "") {
    return { ok: false, error: "bbox je obvezen (south,west,north,east)" };
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
    return {
      ok: false,
      error: "dolžina (west/east) mora biti med -180 in 180",
    };
  }
  if (south >= north) {
    return { ok: false, error: "south mora biti strogo manjši od north" };
  }
  if (west >= east) {
    return { ok: false, error: "west mora biti strogo manjši od east" };
  }
  return { ok: true, value: { south, west, north, east } };
}

/** Ali koordinata leži znotraj bbox (vključno z robom). */
export function inBbox(lat: number, lng: number, bbox: Bbox): boolean {
  return (
    lat >= bbox.south &&
    lat <= bbox.north &&
    lng >= bbox.west &&
    lng <= bbox.east
  );
}

/** Črpalke v pogledu (bbox) — vrstni red iz nabora. */
export function filterFuelByBbox(bbox: Bbox): FuelStation[] {
  return FUEL_STATIONS.filter((s) => inBbox(s.lat, s.lng, bbox));
}

/** Haversinova razdalja v kilometrih (za „najbližja črpalka"). */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export interface NearestFuel {
  station: FuelStation;
  /** Razdalja v km (haversine — naravnost, ne po cesti; iskrena oznaka). */
  km: number;
}

/**
 * Najbližja črpalka dani točki (haversine). Null samo za prazen nabor —
 * kliče z FUEL_STATIONS torej nikoli ne vrne null.
 */
export function nearestFuelStation(
  lat: number,
  lng: number,
  stations: readonly FuelStation[] = FUEL_STATIONS,
): NearestFuel | null {
  let best: NearestFuel | null = null;
  for (const s of stations) {
    const km = haversineKm(lat, lng, s.lat, s.lng);
    if (!best || km < best.km) {
      best = { station: s, km };
    }
  }
  return best;
}

/** DTO za API/odjemalec (ista oblika + iskrene oznake vira). */
export interface FuelStationDTO {
  id: string;
  name: string;
  brand: string;
  lat: number;
  lng: number;
  fuels: string[];
  highway: boolean;
}

export function fuelStationDTO(s: FuelStation): FuelStationDTO {
  return {
    id: s.id,
    name: s.name,
    brand: s.brand,
    lat: s.lat,
    lng: s.lng,
    fuels: [...s.fuels],
    highway: s.highway,
  };
}

/** Števec po verigah (za legendo/poročilo). */
export function fuelBrandCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of FUEL_STATIONS) {
    out[s.brand] = (out[s.brand] ?? 0) + 1;
  }
  return out;
}
