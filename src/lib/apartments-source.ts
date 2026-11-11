/**
 * APARTMAJI V SLOVENIJI — REZERVNA podatkovna plast (OpenStreetMap).
 *
 * GLAVNI VIR aplikacije je URADNI AJPES PRS (glej `ajpes-source.ts`);
 * ta modul je rezervna pot prek OpenStreetMap, če uradni vir ni dosegljiv:
 *
 *  1) OVERPASS API (overpass-api.de + zrcalo) — prava OSM objekta
 *     tourism=apartment z bbox celotne Slovenije; vrača tudi zvezdice,
 *     spletno stran in telefon (najbogatejši vir). Če je dosegljiv,
 *     je to primarna rezervna pot (ena sama zahteva).
 *
 *  2) NOMINATIM (nominatim.openstreetmap.org) — iskalnik nad OSM z
 *     podporo za viewbox + bounded + countrycodes: mreža celic čez
 *     Slovenijo, za vsako celico poizvedujemo besede "apartma",
 *     "apartment" in "apartmaji". Presežek 50 zadetkov → celica se
 *     kvadratno razdeli (quadtree). Zagotovljena vljudnost: ≤ 1 zahteva/s.
 *
 * Odgovori se razčlenijo v enotno obliko `ApartmentRecord` z OSM ključem
 * ("n123" / "w456"), zato je usklajevanje idempotentno.
 */

/** Normaliziran zapis apartmaja (OSM ključ kot id). */
export interface ApartmentRecord {
  /** OSM ključ: "n123" (node) ali "w456" (way) — enoličen, idempotenten. */
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  street: string | null;
  postcode: string | null;
  website: string | null;
  phone: string | null;
  stars: number | null;
  source: 'overpass' | 'nominatim';
}

/** Bbox Slovenije [south, west, north, east] — meja z malo rezerve. */
export const SLOVENIA_BBOX: readonly [number, number, number, number] = [45.4, 13.35, 46.9, 16.65];

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
] as const;

export const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
export const NOMINATIM_USER_AGENT = 'discover-slovenia-ai/1.0 (slovenian travel demo; fair-use)';

/** Iskalne besede: slovenska ednina, angleška, slovenska množina. */
export const APARTMENT_QUERY_WORDS = ['apartma', 'apartment', 'apartmaji'] as const;

/** Zmogljivost: največje število apartmajev, ki jih shranimo. */
export const MAX_APARTMENTS = 600;

/** Nominatim vljudnost: največ 1 zahteva/sekundo (uradna pravila rabe). */
export const NOMINATIM_DELAY_MS = 1100;

// ─── Overpass ────────────────────────────────────────────────────────────────

/** URL Overpass poizvedbe: vsi apartmaji (node + way, out center) v bbox. */
export function overpassApartmentsUrl(
  base: string,
  south: number,
  west: number,
  north: number,
  east: number,
): string {
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:60];(node["tourism"="apartment"](${bbox});way["tourism"="apartment"](${bbox}););out center;`;
  return `${base}?data=${encodeURIComponent(query)}`;
}

/** Zvezdice iz OSM tag-a ("3", "3;AAA" → 3; izven 1–5 → null). */
function parseStars(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const n = Number(String(raw).trim().split(/[;,]/)[0]);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Naslov iz addr tag-ov ali null. */
function parseAddress(tags: Record<string, string>): string | null {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ').trim();
  const city = (tags['addr:city'] ?? '').trim();
  const line = [street, city].filter(Boolean).join(', ').trim();
  return line.length > 0 ? line : null;
}

/**
 * Razčlenjevanje Overpass odgovora (out center) → ApartmentRecord[].
 * Brezimni objekti izpuščeni, podvojeni id-ji odstranjeni. Fail-clean: [].
 */
export function parseOverpassApartments(raw: unknown): ApartmentRecord[] {
  if (!raw || typeof raw !== 'object') return [];
  const elements = (raw as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return [];

  const out: ApartmentRecord[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;
    const e = el as {
      type?: unknown;
      id?: unknown;
      lat?: unknown;
      lon?: unknown;
      center?: { lat?: unknown; lon?: unknown };
      tags?: Record<string, string>;
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
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (
      lat < SLOVENIA_BBOX[0] - 0.05 ||
      lat > SLOVENIA_BBOX[2] + 0.05 ||
      lng < SLOVENIA_BBOX[1] - 0.05 ||
      lng > SLOVENIA_BBOX[3] + 0.05
    ) {
      continue;
    }

    const websiteRaw = tags.website ?? tags['contact:website'] ?? null;
    const website = typeof websiteRaw === 'string' && websiteRaw.trim().length > 0 ? websiteRaw.trim() : null;
    const phoneRaw = tags.phone ?? tags['contact:phone'] ?? null;
    const phone = typeof phoneRaw === 'string' && phoneRaw.trim().length > 0 ? phoneRaw.trim() : null;

    seen.add(key);
    out.push({
      id: key,
      name: name.slice(0, 140),
      lat,
      lng,
      city: (tags['addr:city'] ?? '').trim() || null,
      street: parseAddress(tags),
      postcode: (tags['addr:postcode'] ?? '').trim() || null,
      website,
      phone,
      stars: parseStars(tags.stars),
      source: 'overpass',
    });
    if (out.length >= MAX_APARTMENTS) break;
  }
  return out;
}

// ─── Nominatim (rezerva) ─────────────────────────────────────────────────────

/** Celica mreže (viewbox): [west, north, east, south] (levi, zgornji, desni, spodnji). */
export interface GridCell {
  west: number;
  north: number;
  east: number;
  south: number;
  depth: number;
}

/**
 * Začetna mreža celic čez Slovenijo (celica ≈ 0,35° × 0,30° → ~50 celic).
 * Gostota je dovolj drobna, da večina celic ne doseže limita 50 zadetkov,
 * presežki pa se kvadratno razdelijo (quadtree).
 */
export function initialGrid(
  south = SLOVENIA_BBOX[0],
  west = SLOVENIA_BBOX[1],
  north = SLOVENIA_BBOX[2],
  east = SLOVENIA_BBOX[3],
  lonStep = 0.35,
  latStep = 0.3,
): GridCell[] {
  const cells: GridCell[] = [];
  for (let lat = south; lat < north - 1e-9; lat += latStep) {
    for (let lon = west; lon < east - 1e-9; lon += lonStep) {
      cells.push({
        west: lon,
        north: Math.min(lat + latStep, north),
        east: Math.min(lon + lonStep, east),
        south: lat,
        depth: 0,
      });
    }
  }
  return cells;
}

/** Kvadratna delitev celice na štiri podcelice (quadtree, največ globina 3). */
export function splitCell(cell: GridCell): GridCell[] | null {
  if (cell.depth >= 3) return null;
  const midLat = (cell.south + cell.north) / 2;
  const midLon = (cell.west + cell.east) / 2;
  return [
    { west: cell.west, north: cell.north, east: midLon, south: midLat, depth: cell.depth + 1 },
    { west: midLon, north: cell.north, east: cell.east, south: midLat, depth: cell.depth + 1 },
    { west: cell.west, north: midLat, east: midLon, south: cell.south, depth: cell.depth + 1 },
    { west: midLon, north: midLat, east: cell.east, south: cell.south, depth: cell.depth + 1 },
  ];
}

/** URL Nominatim iskanja apartmajev v celici (ena beseda = ena zahteva). */
export function nominatimApartmentsUrl(
  cell: GridCell,
  word: string,
  limit = 50,
): string {
  const params = new URLSearchParams({
    q: word,
    viewbox: `${cell.west},${cell.north},${cell.east},${cell.south}`,
    bounded: '1',
    countrycodes: 'si',
    limit: String(limit),
    format: 'jsonv2',
    addressdetails: '1',
    extratags: '1',
    'accept-language': 'sl',
  });
  return `${NOMINATIM_BASE}/search?${params.toString()}`;
}

/** Prva naselbina iz Nominatim naslova (city > town > village > hamlet > municipality). */
function cityFromAddress(address: Record<string, string>): string | null {
  const value = address['city'] ?? address['town'] ?? address['village'] ?? address['hamlet'] ?? address['municipality'];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 80) : null;
}

/** Ulični naslov iz Nominatim naslova (road + house_number) ali null. */
function streetFromAddress(address: Record<string, string>): string | null {
  const road = (address['road'] ?? '').trim();
  const num = (address['house_number'] ?? '').trim();
  const line = [road, num].filter(Boolean).join(' ').trim();
  return line.length > 0 ? line : null;
}

/**
 * Razčlenjevanje Nominatim (jsonv2) odgovora → ApartmentRecord[].
 *
 * Sprejmemo:
 *  • type=apartment (tourism=apartment) — ne glede na ime,
 *  • type=chalet, IME pa vsebuje "apartm" (pogost OSM zapis za apartmaje).
 * Ostale vrste (hotel, guest_house …) izpuščene — uporabnik je zahteval
 * apartmaje. Fail-clean: karkoli odmika → izpuščeno.
 */
export function parseNominatimApartments(raw: unknown): ApartmentRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ApartmentRecord[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const rec = r as {
      osm_type?: unknown;
      osm_id?: unknown;
      lat?: unknown;
      lon?: unknown;
      name?: unknown;
      category?: unknown;
      type?: unknown;
      address?: unknown;
      extratags?: unknown;
    };

    // Nominatim jsonv2 vrača celotne besede ("node"/"way") → preslikava v
    // enotne OSM ključe ("n123"/"w456"), skladne z Overpass id-ji.
    const osmTypeRaw = typeof rec.osm_type === 'string' ? rec.osm_type.toLowerCase() : '';
    const osmType = osmTypeRaw === 'node' ? 'n' : osmTypeRaw === 'way' ? 'w' : '';
    const osmId = typeof rec.osm_id === 'number' ? rec.osm_id : Number(rec.osm_id);
    if ((osmType !== 'n' && osmType !== 'w') || !Number.isFinite(osmId)) continue;

    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!name) continue;

    const category = typeof rec.category === 'string' ? rec.category : '';
    const type = typeof rec.type === 'string' ? rec.type : '';
    if (category !== 'tourism') continue;
    const isApartment = type === 'apartment';
    const isChaletNamed = type === 'chalet' && /apartm/i.test(name);
    if (!isApartment && !isChaletNamed) continue;

    const lat = typeof rec.lat === 'number' ? rec.lat : Number(rec.lat);
    const lng = typeof rec.lon === 'number' ? rec.lon : Number(rec.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (
      lat < SLOVENIA_BBOX[0] - 0.05 ||
      lat > SLOVENIA_BBOX[2] + 0.05 ||
      lng < SLOVENIA_BBOX[1] - 0.05 ||
      lng > SLOVENIA_BBOX[3] + 0.05
    ) {
      continue;
    }

    const address = (rec.address ?? {}) as Record<string, string>;
    const extratags = (rec.extratags ?? {}) as Record<string, string>;
    const websiteRaw = extratags['website'] ?? extratags['contact:website'] ?? null;
    const website = typeof websiteRaw === 'string' && websiteRaw.trim().length > 0 ? websiteRaw.trim() : null;
    const phoneRaw = extratags['phone'] ?? extratags['contact:phone'] ?? null;
    const phone = typeof phoneRaw === 'string' && phoneRaw.trim().length > 0 ? phoneRaw.trim() : null;
    const stars = parseStars(extratags['stars']);

    out.push({
      id: `${osmType}${osmId}`,
      name: name.slice(0, 140),
      lat,
      lng,
      city: cityFromAddress(address),
      street: streetFromAddress(address),
      postcode: (address['postcode'] ?? '').trim() || null,
      website,
      phone,
      stars,
      source: 'nominatim',
    });
  }
  return out;
}

// ─── Usklajevanje (fetch + združevanje) ─────────────────────────────────────

/** Minimalni fetch tip (testabilnost — resnični fetch poda klicatelj). */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<Response>;

/** Združi zapise: Overpass prepiše Nominatim pri istem id-u; brez podvojitev. */
export function mergeApartmentRecords(...groups: ApartmentRecord[][]): ApartmentRecord[] {
  const byId = new Map<string, ApartmentRecord>();
  // Overpass skupine gredo prve (bogatejše), Nominatim dopolni
  for (const group of groups) {
    for (const rec of group) {
      const existing = byId.get(rec.id);
      if (!existing || (existing.source === 'nominatim' && rec.source === 'overpass')) {
        byId.set(rec.id, rec);
      } else if (existing.source === rec.source && rec.city && !existing.city) {
        byId.set(rec.id, { ...existing, city: rec.city });
      }
    }
  }
  return Array.from(byId.values()).slice(0, MAX_APARTMENTS);
}

/** Overpass: poskusi zrcala po vrsti; vrne zapise ali null (nič ne dela). */
export async function fetchOverpassApartments(
  doFetch: FetchLike,
  timeoutMs: number,
): Promise<ApartmentRecord[] | null> {
  const [south, west, north, east] = SLOVENIA_BBOX;
  for (const base of OVERPASS_ENDPOINTS) {
    try {
      const res = await doFetch(overpassApartmentsUrl(base, south, west, north, east), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      const json: unknown = await res.json();
      const parsed = parseOverpassApartments(json);
      if (parsed.length > 0) return parsed;
    } catch {
      // naslednje zrcalo
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Nominatim: mreža celic × besede, kvadratna delitev pri saturaciji.
 *
 * Zaporedno z vljudnostnim zamikom (≤ 1 zahteva/s — uradna pravila).
 * Po 5 zaporednih neuspehih prekine (mrtvo omrežje → takojšnja rezerva).
 * Vrne zapise + statistiko za pošteno poročanje v UI.
 */
export async function fetchNominatimApartments(
  doFetch: FetchLike,
  options: { delayMs?: number; timeoutMs?: number; maxFailuresStreak?: number } = {},
): Promise<{ records: ApartmentRecord[]; requests: number; failures: number; aborted: boolean }> {
  const delayMs = options.delayMs ?? NOMINATIM_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxFailureStreak = options.maxFailuresStreak ?? 5;

  const records: ApartmentRecord[] = [];
  const seen = new Set<string>();
  let requests = 0;
  let failures = 0;
  let failureStreak = 0;
  let aborted = false;

  // VRSTA: (celica × beseda) — kvadratna delitev doda nove vnose med tekom
  const queue: { cell: GridCell; word: string }[] = [];
  for (const cell of initialGrid()) {
    for (const word of APARTMENT_QUERY_WORDS) queue.push({ cell, word });
  }

  const pushRecords = (parsed: ApartmentRecord[]) => {
    for (const rec of parsed) {
      if (seen.has(rec.id)) continue;
      seen.add(rec.id);
      records.push(rec);
      if (records.length >= MAX_APARTMENTS) return false;
    }
    return true;
  };

  while (queue.length > 0) {
    if (records.length >= MAX_APARTMENTS) break;
    const job = queue.shift();
    if (!job) break;

    await sleep(delayMs);
    if (failureStreak >= maxFailureStreak) {
      aborted = true;
      break;
    }

    requests += 1;
    try {
      const res = await doFetch(nominatimApartmentsUrl(job.cell, job.word), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: unknown = await res.json();
      const parsed = parseNominatimApartments(json);
      failureStreak = 0;

      // Saturacija (limit 50) → celica prevelika: kvadratna delitev
      if (Array.isArray(json) && json.length >= 50) {
        const subCells = splitCell(job.cell);
        if (subCells) {
          for (const sub of subCells) queue.push({ cell: sub, word: job.word });
          continue;
        }
      }

      if (!pushRecords(parsed)) break;
    } catch {
      failures += 1;
      failureStreak += 1;
    }
  }

  return { records, requests, failures, aborted };
}

/** Rezultat usklajevanja — za UI poročanje (izvor, števila, trajanje). */
export interface SyncOutcome {
  records: ApartmentRecord[];
  source: 'overpass' | 'nominatim';
  failedRequests: number;
  totalRequests: number;
  durationMs: number;
}
