/**
 * PRENOČIŠČA — čista podatkovna plast (iskanje → podrobnosti → rezervacija).
 *
 * Izrazita želja uporabnika: na zemljevidu poišče prenočišča kjerkoli
 * (npr. Skopje — Balkan), klikne, PREGLEDA SLIKE IN CENO, klikne
 * »Rezerviraj«, aplikacija ga OPOZORI in zapis SAMODEJNO shrani v
 * »Mojo pot«.
 *
 * Viri (brez ključev, poštena raba):
 *  • Nominatim (nominatim.openstreetmap.org) — geokodiranje kraja,
 *  • Overpass API (overpass-api.de) — prava OSM objekta s tag-om
 *    tourism=hotel|guest_house|hostel|motel|apartment|resort
 *    (pokritost: ves svet, torej tudi celoten Balkan).
 *
 * Poštenost (iskreno označeno v UI):
 *  • cena je INDIKATIVNA (ocena iz vrste + zvezdic, ne uradni cenik),
 *  • fotografije so zastopne s spletne iskalnice (ne uradne objektne),
 *  • »Rezerviraj« shrani objekt v »Mojo pot« (+ zapis v bazo); pravo
 *    plačilo poteka pri objektu / uradni strani (povezava je vidna).
 *
 * Čisto in testabilno: gradnja URL + razčlenjevanje odgovorov brez `fetch`.
 */

export const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
/**
 * Overpass končnice — poskusimo po vrsti (failover).
 * Izmerjeno v peskovniku (18. 10. 2026): overpass-api.de je blokiran
 * (ConnectionRefused), overpass.osm.ch (švicarsko zrcalo, isti podatki
 * OSM) odgovarja 200. V produkciji dela tudi primarni.
 */
export const OVERPASS_ENDPOINTS = [
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass-api.de/api/interpreter',
] as const;

/** Vrste prenočišč, ki jih iščemo (OSM tag tourism=*). */
export const STAY_KINDS = ['hotel', 'guest_house', 'hostel', 'motel', 'apartment', 'resort'] as const;
export type StayKind = (typeof STAY_KINDS)[number];

/** Slovenski izpisi vrst (UI). */
export const STAY_KIND_LABELS: Record<StayKind, string> = {
  hotel: 'Hotel',
  guest_house: 'Gostišče',
  hostel: 'Mladinski hotel',
  motel: 'Motel',
  apartment: 'Apartma',
  resort: 'Rezort',
};

export interface StayResult {
  /** OSM id ("n123" node, "w456" way) — enoličen ključ rezervacije. */
  id: string;
  name: string;
  kind: StayKind;
  lat: number;
  lng: number;
  stars: number | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  /** Indikativna cena od (EUR / noč) — v UI jasno označena kot ocena. */
  priceFrom: number;
}

/** URL Nominatim iskanja (User-Agent nastavi strežnik — obvezna pravila). */
export function nominatimSearchUrl(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `${NOMINATIM_BASE}/search?q=${q}&format=jsonv2&limit=1&accept-language=sl`;
}

/** URL Overpass poizvedbe za bbox (zapis south,west,north,east). */
export function overpassStayQuery(south: number, west: number, north: number, east: number): string {
  const bbox = `${south},${west},${north},${east}`;
  // brez kotvic `$` in brez limita v poizvedbi (izmerjeno: nekatera zrcale
  // 500-irajo pri obeh) — točnost zagarantira razčlenjevalnik (točen seznam vrst)
  const filter = `["tourism"~"hotel|guest_house|hostel|apartment|motel|resort"]`;
  return `[out:json][timeout:25];(node${filter}(${bbox});way${filter}(${bbox}););out center;`;
}

/** URL-ji Overpass poizvedbe za bbox (zapis south,west,north,east) — failover po vrsti. */
export function overpassStayUrls(south: number, west: number, north: number, east: number): string[] {
  return OVERPASS_ENDPOINTS.map((base) => `${base}?data=${encodeURIComponent(overpassStayQuery(south, west, north, east))}`);
}

export const PHOTON_BASE = 'https://photon.komoot.io/api';

/**
 * URL Photon iskanja (Komoot) — REZERVA, ko vse Overpass zrcale zavrnejo
 * (izmerjeno: zrcala tekom intenzivnega testiranja 500/limitiranja, Photon
 * odgovarja 200 z pravimi imeni + koordinatami + osm id).
 */
export function photonStayUrl(placeName: string): string {
  const tags = STAY_KINDS.map((k) => `osm_tag=tourism:${k}`).join('&');
  return `${PHOTON_BASE}?q=${encodeURIComponent(`hotel ${placeName}`)}&${tags}&limit=24`;
}

/** Zvezdice iz OSM tag-a ("3", "3;AAA" → 3; izven 1–5 → null). */
function parseStars(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const n = Number(String(raw).trim().split(/[;,]/)[0]);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Izpiši naslov iz addr tag-ov (ali null, če jih ni). */
function parseAddress(tags: Record<string, string>): string | null {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ').trim();
  const city = (tags['addr:city'] ?? '').trim();
  const line = [street, city].filter(Boolean).join(', ').trim();
  return line.length > 0 ? line : null;
}

/**
 * Indikativna cena od (EUR/noč): osnova po vrsti × multiplikator zvezdic,
 * zaokroženo na 5 EUR. JASNO označeno kot ocena, ne uradni cenik.
 */
export function indicativePricePerNight(kind: StayKind, stars: number | null): number {
  const base: Record<StayKind, number> = {
    hostel: 28,
    motel: 60,
    guest_house: 65,
    apartment: 70,
    hotel: 95,
    resort: 130,
  };
  const factor = stars === 1 ? 0.7 : stars === 2 ? 0.85 : stars === 4 ? 1.45 : stars === 5 ? 2.1 : 1.0;
  return Math.max(20, Math.round((base[kind] * factor) / 5) * 5);
}

/**
 * Razčlenjevanje Overpass odgovora (out center) → StayResult[].
 * Brezimni objekti so izpuščeni (rezervacija brez imena ni uporabna),
 * podvojeni id-ji odstranjeni, največ 24 rezultatov. Fail-clean: napake → [].
 */
export function parseStayResults(raw: unknown): StayResult[] {
  if (!raw || typeof raw !== 'object') return [];
  const elements = (raw as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return [];

  const out: StayResult[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (!el || typeof el !== 'object' || out.length >= 24) break;
    const e = el as {
      type?: unknown; id?: unknown; lat?: unknown; lon?: unknown;
      center?: { lat?: unknown; lon?: unknown };
      tags?: Record<string, unknown>;
    };
    const type = typeof e.type === 'string' ? e.type : '';
    const id = typeof e.id === 'number' && Number.isFinite(e.id) ? e.id : null;
    if ((type !== 'node' && type !== 'way') || id === null) continue;
    const key = `${type[0]}${id}`;
    if (seen.has(key)) continue;

    const tags = (e.tags ?? {}) as Record<string, string>;
    const name = (tags.name ?? '').trim();
    if (!name) continue;

    const latRaw = type === 'node' ? e.lat : e.center?.lat;
    const lngRaw = type === 'node' ? e.lon : e.center?.lon;
    const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
    const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) continue;

    const kindRaw = (tags.tourism ?? '') as StayKind;
    // natančna vrsta obvezna — regex/brez tegetov ne sme zaznamovati tujih vrednosti
    if (!(STAY_KINDS as readonly string[]).includes(kindRaw)) continue;
    const kind: StayKind = kindRaw;

    const websiteRaw = tags.website ?? tags['contact:website'] ?? null;
    const website = typeof websiteRaw === 'string' && websiteRaw.trim().length > 0 ? websiteRaw.trim() : null;
    const phoneRaw = tags.phone ?? tags['contact:phone'] ?? null;
    const phone = typeof phoneRaw === 'string' && phoneRaw.trim().length > 0 ? phoneRaw.trim() : null;
    const stars = parseStars(tags.stars);

    seen.add(key);
    out.push({
      id: key,
      name,
      kind,
      lat,
      lng,
      stars,
      website,
      phone,
      address: parseAddress(tags),
      priceFrom: indicativePricePerNight(kind, stars),
    });
  }
  return out;
}

/**
 * Razčlenjevanje Photon (Komoot) GeoJSON odgovora → StayResult[].
 * Photon ne vrača zvezdic/spletne strani/telefona → ti polja ostanejo null
 * (UI to pošteno prikaže). Fail-clean: karkoli odmika → izpuščeno.
 */
export function parsePhotonStays(raw: unknown): StayResult[] {
  if (!raw || typeof raw !== 'object') return [];
  const features = (raw as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const out: StayResult[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    if (out.length >= 24) break;
    if (!f || typeof f !== 'object') continue;
    const p = (f as { properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } }).properties ?? {};
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name) continue;
    const osmType = typeof p.osm_type === 'string' ? p.osm_type.toLowerCase() : '';
    const osmId = typeof p.osm_id === 'number' ? p.osm_id : null;
    if ((osmType !== 'n' && osmType !== 'w') || osmId === null) continue;
    const id = `${osmType}${osmId}`;
    if (seen.has(id)) continue;
    const coords = (f as { geometry?: { coordinates?: unknown } }).geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lng = coords[0];
    const lat = coords[1];
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const valueRaw = typeof p.osm_value === 'string' ? p.osm_value : '';
    if (!(STAY_KINDS as readonly string[]).includes(valueRaw)) continue;
    const kind = valueRaw as StayKind;
    const city = [p.city, p.district].find((v): v is string => typeof v === 'string' && v.trim().length > 0) ?? '';
    const street = typeof p.street === 'string' ? p.street.trim() : '';
    seen.add(id);
    out.push({
      id,
      name: name.slice(0, 120),
      kind,
      lat,
      lng,
      stars: null,
      website: null,
      phone: null,
      address: street.length > 0 ? street : null,
      priceFrom: indicativePricePerNight(kind, null),
    });
  }
  return out;
}

export interface StayPlace {
  /** Kratek izpis kraja (ime mesta / display_name prvi del). */
  name: string;
  lat: number;
  lng: number;
  /** [south, west, north, east] — za Overpass bbox. */
  bbox: [number, number, number, number];
}

/**
 * Razčlenjevanje Nominatim odgovora (jsonv2, limit 1) → StayPlace ali null.
 */
export function parseNominatimPlace(raw: unknown): StayPlace | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const p = raw[0] as {
    name?: unknown; display_name?: unknown; lat?: unknown; lon?: unknown; boundingbox?: unknown;
  };
  const lat = Number(p.lat);
  const lng = Number(p.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Array.isArray(p.boundingbox) || p.boundingbox.length !== 4) return null;
  const bb = p.boundingbox.map(Number) as [number, number, number, number];
  if (bb.some((v) => !Number.isFinite(v))) return null;
  // Nominatim: [south, north, west, east] → pretvori v (south, west, north, east)
  const bbox: [number, number, number, number] = [bb[0], bb[2], bb[1], bb[3]];
  const display = typeof p.display_name === 'string' ? p.display_name : '';
  const name = typeof p.name === 'string' && p.name.trim().length > 0 ? p.name.trim() : display.split(',')[0].trim();
  return { name: name || 'Kraj', lat, lng, bbox };
}
