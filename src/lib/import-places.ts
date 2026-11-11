/**
 * START ANYWHERE — uvoz krajev iz besedila (skriptni ekvivalent Mindtripove
 * funkcije »Start Anywhere«). Uporabnik prilepi seznam krajev (npr. iz
 * Google Maps ali zapiskov), mi jih geokodiraMo (Photon) in iz njih
 * sestavimo pot — povsem deterministično, brez AI modela.
 *
 * Ta datoteka je ČISTA: razčlenjevanje, varstvo vnosa, shranjevanje.
 */

import type { TripStop } from '@/lib/trip-plan';

export const CUSTOM_STOPS_KEY = 'dsa.custom.stops.v1';
export const CUSTOM_STOPS_EVENT = 'dsa:custom-stops';
export const MAX_CUSTOM_STOPS = 20;

/** Razčleni vnos (vrstice ali podpičja); počisti, omeji, odpravi podvojenja. */
export function parsePlaceLines(input: string): string[] {
  if (typeof input !== 'string') return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.split(/[\n\r;]+/)) {
    const clean = raw.replace(/,+\s*$/, '').trim().replace(/\s+/g, ' ');
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= MAX_CUSTOM_STOPS) break;
  }
  return out;
}

/** Približen Balkan bbox (za opozorilo, ne zavrnitev). */
export function isInBalkanBbox(lat: number, lng: number): boolean {
  return lat >= 39.5 && lat <= 47.2 && lng >= 13 && lng <= 24.2;
}

export interface GeocodedPlace {
  /** Izvirni poizvedbeni niz. */
  q: string;
  ok: boolean;
  name: string;
  lat: number;
  lng: number;
  country?: string | null;
  /** Res izven Balkan bboxa (ni napaka, le informacija). */
  outsideBalkan?: boolean;
}

/** Serializiraj shranjene postanke (stabilen, sortiran zapis). */
export function serializeCustomStops(stops: readonly TripStop[]): string {
  return JSON.stringify(stops.map((s) => [s.name, s.note, s.lat, s.lng]));
}

/** Razčleni shranjene postanke; pokvarjen/tuj zapis → []. */
export function parseCustomStops(raw: string | null): readonly TripStop[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const out: TripStop[] = [];
    for (const item of value) {
      if (!Array.isArray(item) || item.length < 4) continue;
      const [name, note, lat, lng] = item as [unknown, unknown, unknown, unknown];
      if (typeof name !== 'string' || !name.trim()) continue;
      if (typeof note !== 'string') continue;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      out.push({ name: name.trim().slice(0, 80), note: note.trim().slice(0, 120), lat, lng });
      if (out.length >= MAX_CUSTOM_STOPS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Iz geokodiranih zadetkov sestavimo TripStop[] (imena enolična). */
export function placesToStops(
  places: readonly GeocodedPlace[],
  dedupeAgainst: ReadonlySet<string>,
): readonly TripStop[] {
  const used = new Set(dedupeAgainst);
  const out: TripStop[] = [];
  for (const p of places) {
    if (!p.ok || out.length >= MAX_CUSTOM_STOPS) continue;
    let name = p.name.trim() || p.q.trim();
    if (used.has(name.toLowerCase())) {
      let i = 2;
      while (used.has(`${name.toLowerCase()} ${i}`)) i += 1;
      name = `${name} ${i}`;
    }
    used.add(name.toLowerCase());
    out.push({ name, note: 'Iz tvojega uvoza krajev', lat: p.lat, lng: p.lng });
  }
  return out;
}
