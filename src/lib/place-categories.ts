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
  | 'kavarne'
  | 'barji'
  | 'hoteli'
  | 'kampi'
  | 'znamenitosti'
  | 'sakralni'
  | 'sport'
  | 'prevoz'
  | 'bencinske'
  | 'lekarne'
  | 'bankomati'
  | 'posta'
  | 'parkirisca'
  | 'supermarketi';

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
  { id: 'kavarne', label: 'Kavarne', tag: '["amenity"="cafe"]', color: '#a16207' },
  { id: 'barji', label: 'Barji in pubi', tag: '["amenity"~"^(bar|pub|nightclub)$"]', color: '#831843' },
  { id: 'hoteli', label: 'Hoteli', tag: '["tourism"~"^(hotel|hostel)$"]', color: '#d97706' },
  { id: 'kampi', label: 'Kampi', tag: '["tourism"="camp_site"]', color: '#65a30d' },
  { id: 'znamenitosti', label: 'Znamenitosti', tag: '["tourism"="attraction"]', color: '#0891b2' },
  { id: 'sakralni', label: 'Sakralni objekti', tag: '["amenity"="place_of_worship"]', color: '#6d28d9' },
  { id: 'sport', label: 'Športni objekti', tag: '["leisure"~"^(sports_centre|stadium)$"]', color: '#0369a1' },
  { id: 'prevoz', label: 'Prevoz (postaje)', tag: '["public_transport"~"^(stop_position|station)$"]', color: '#2563eb' },
  { id: 'bencinske', label: 'Bencinske', tag: '["amenity"="fuel"]', color: '#4d7c0f' },
  { id: 'lekarne', label: 'Lekarne', tag: '["amenity"="pharmacy"]', color: '#be185d' },
  { id: 'bankomati', label: 'Bankomati', tag: '["amenity"="atm"]', color: '#334155' },
  { id: 'posta', label: 'Pošta', tag: '["amenity"="post_office"]', color: '#57534e' },
  { id: 'parkirisca', label: 'Parkirišča', tag: '["amenity"="parking"]', color: '#52525b' },
  { id: 'supermarketi', label: 'Supermarketi', tag: '["shop"="supermarket"]', color: '#166534' },
];

export function placeCategoryById(id: string): PlaceCategory | null {
  return PLACE_CATEGORIES.find((c) => c.id === id) ?? null;
}

/** Zajetje celega Balkana (za iskanje »po vsem Balkanu«). */
export const BALKAN_BBOX = '39.5,13.0,47.2,24.2';

/** Glavna mesta Balkana — rezerva za predloge območij, ko OSM ni dosegljiv. */
export const FALLBACK_HUBS: readonly { name: string; lat: number; lng: number }[] = [
  { name: 'Ljubljana', lat: 46.0569, lng: 14.5058 },
  { name: 'Zagreb', lat: 45.815, lng: 15.9819 },
  { name: 'Split', lat: 43.5081, lng: 16.4402 },
  { name: 'Sarajevo', lat: 43.8563, lng: 18.4131 },
  { name: 'Mostar', lat: 43.3438, lng: 17.8078 },
  { name: 'Beograd', lat: 44.7866, lng: 20.4489 },
  { name: 'Novi Sad', lat: 45.2671, lng: 19.8335 },
  { name: 'Niš', lat: 43.3209, lng: 21.8956 },
  { name: 'Priština', lat: 42.6629, lng: 21.1655 },
  { name: 'Prizren', lat: 42.2139, lng: 20.7396 },
  { name: 'Podgorica', lat: 42.4304, lng: 19.2594 },
  { name: 'Kotor', lat: 42.4247, lng: 18.7715 },
  { name: 'Tirana', lat: 41.3275, lng: 19.8187 },
  { name: 'Skopje', lat: 41.9973, lng: 21.428 },
  { name: 'Ohrid', lat: 41.1231, lng: 20.8016 },
];

/** Kurirani predlogi območij (»{kategorija} — {mesto}«) — jasno označeni. */
export function buildFallbackPlaces(category: PlaceCategory, categoryId: PlaceCategoryId): PlaceResult[] {
  return FALLBACK_HUBS.map((hub, i) => ({
    id: `fb-${categoryId}-${i + 1}`,
    name: `${category.label} — ${hub.name}`,
    category: categoryId,
    lat: hub.lat,
    lng: hub.lng,
    curated: true,
  }));
}

/** Overpass URL-kompatibilna poizvedba za posamezno kategorijo. */
export function overpassPlacesQuery(category: PlaceCategory, bbox: string, limit = 30): string {
  return `[out:json][timeout:15];nwr[${category.tag}](bbox:${bbox});out center ${limit};`;
}

/** Razčleni Overpass odziv v enotne kraje (varstvo vnosa). */
export interface PlaceResult {
  id: string;
  name: string;
  category: PlaceCategoryId;
  lat: number;
  lng: number;
  /** Rezerva (kurirano območje) — OSM ni bil dosegljiv. */
  curated?: boolean;
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
    if (out.length >= 80) break;
  }
  return out;
}
