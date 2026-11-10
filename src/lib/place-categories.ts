/**
 * KATEGORIJE KRAJEV (»Iščem:«) — preslikava v Overpass/Osm poizvedbe.
 *
 * Skriptno: uporabnik izbere kategorijo (muzeji, restavracije, hoteli …)
 * in območje (država/zemljevid), mi poiščemo kraje prek Overpassa in jih
 * pokažemo na zemljevidu. Brez AI, brez ključev.
 */

export type PlaceCategoryId =
  | 'muzeji'
  | 'restavracije'
  | 'hoteli'
  | 'znamenitosti'
  | 'prevoz'
  | 'bencinske'
  | 'lekarne';

export interface PlaceCategory {
  id: PlaceCategoryId;
  label: string;
  /** Overpass tag-fragment, npr. ["tourism"="museum"]. */
  tag: string;
  /** Barva markerja (hex). */
  color: string;
}

export const PLACE_CATEGORIES: readonly PlaceCategory[] = [
  { id: 'muzeji', label: 'Muzeji', tag: '["tourism"="museum"]', color: '#7c3aed' },
  { id: 'restavracije', label: 'Restavracije', tag: '["amenity"="restaurant"]', color: '#b91c1c' },
  { id: 'hoteli', label: 'Hoteli', tag: '["tourism"~"^(hotel|hostel)$"]', color: '#d97706' },
  { id: 'znamenitosti', label: 'Znamenitosti', tag: '["tourism"="attraction"]', color: '#0891b2' },
  { id: 'prevoz', label: 'Prevoz (postaje)', tag: '["public_transport"~"^(stop_position|station)$"]', color: '#2563eb' },
  { id: 'bencinske', label: 'Bencinske', tag: '["amenity"="fuel"]', color: '#4d7c0f' },
  { id: 'lekarne', label: 'Lekarne', tag: '["amenity"="pharmacy"]', color: '#be185d' },
];

export function placeCategoryById(id: string): PlaceCategory | null {
  return PLACE_CATEGORIES.find((c) => c.id === id) ?? null;
}

/** Overpass URL-kompatibilna poizvedba za posamezno kategorijo. */
export function overpassPlacesQuery(category: PlaceCategory, bbox: string): string {
  return `[out:json][timeout:12];nwr[${category.tag}](bbox:${bbox});out center 30;`;
}

/** Razčleni Overpass odziv v enotne kraje (varstvo vnosa). */
export interface PlaceResult {
  id: string;
  name: string;
  category: PlaceCategoryId;
  lat: number;
  lng: number;
}

export function parseOverpassPlaces(raw: unknown, categoryId: PlaceCategoryId): PlaceResult[] {
  if (!raw || typeof raw !== 'object') return [];
  const elements = (raw as { elements?: unknown[] }).elements;
  if (!Array.isArray(elements)) return [];
  const out: PlaceResult[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;
    const e = el as Record<string, unknown>;
    const id = typeof e.id === 'number' ? String(e.id) : '';
    if (!id || seen.has(id)) continue;
    const props = (e.tags ?? {}) as Record<string, unknown>;
    const name = typeof props.name === 'string' ? props.name.trim() : '';
    if (!name) continue;
    let lat = Number(e.lat);
    let lng = Number(e.lon);
    if (!Number.isFinite(lat) && e.center && typeof e.center === 'object') {
      const c = e.center as Record<string, unknown>;
      lat = Number(c.lat);
      lng = Number(c.lon);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    seen.add(id);
    out.push({ id, name: name.slice(0, 120), category: categoryId, lat, lng });
    if (out.length >= 30) break;
  }
  return out;
}
