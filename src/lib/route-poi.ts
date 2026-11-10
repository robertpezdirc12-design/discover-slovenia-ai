/**
 * VREDNE POSTAJE OB POTI — POI ob geometriji cestne poti (OSM/Overpass).
 *
 * Raziskava UX vzorcev (Roadtrippers: "najdi najboljše postaje OB poti",
 * Komoot: highlights ob poti) → aplikacija predlaga zanimivosti, ki so
 * dejansko ob že izračunani OSRM poti, ne le v širši okolici.
 *
 * Čisto in testabilno: geometrija, razdalje, kategorije in izbor so brez
 * Reacta, brez `window`, brez omrežja. Strežniški posrednik (/api/pot/nearby)
 * skrbi za Overpass in OSRM; tu samo razčlenjujemo in izbiramo.
 */

export type PoiCategory = 'razgled' | 'kultura' | 'narava' | 'hrana' | 'drugo';

/** Od kod predlog izvira — UI mora vir vedno pošteno navesti. */
export type PoiSource = 'osm' | 'izbor';

export const POI_CATEGORY_LABELS: Record<PoiCategory, string> = {
  razgled: 'Razgledna točka',
  kultura: 'Kultura in zgodovina',
  narava: 'Naravna znamenitost',
  hrana: 'Hrana in kava',
  drugo: 'Zanimivost',
};

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoutePoi extends LatLng {
  /** OSM id ("node/123" ali "way/456"). */
  id: string;
  name: string;
  category: PoiCategory;
  /** Najkrajša razdalja do geometrije poti (km, 1 decimalka). */
  distanceKm: number;
  /** Položaj najbližje točke na poti (0 = začetek, 1 = cilj). */
  progress: number;
  /** 'osm' = živi OpenStreetMap/Overpass, 'izbor' = urejeni lokalni izbor. */
  source: PoiSource;
}

export interface RouteBbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OverpassPoiElement extends LatLng {
  id: string;
  name: string;
  category: PoiCategory;
}

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LNG = 111.32;

/** Odmik od poti; pri eni sami postanki (»okolica«) dovolimo do 15 km. */
export const POI_MAX_RADIUS_KM = 15;
export const POI_DEFAULT_RADIUS_KM = 3;

export function clampRadiusKm(value: unknown, fallback = POI_DEFAULT_RADIUS_KM): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(POI_MAX_RADIUS_KM, Math.max(0.5, n));
}

export function clampPoiMax(value: unknown, fallback = 6): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(12, Math.max(1, Math.round(n)));
}

/** Haversine — uporabno za grobe razdalje in teste. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(s));
}

/**
 * Bbox okoli poti z odmikom `padKm` (privzeto 3 km, omejeno na 0.2..15 km).
 * Odmik v zemljepisni širini je odvisen od cos(lat) — Slovenija ≈ 46°.
 */
export function bboxForRoute(coords: readonly LatLng[], padKm = 3): RouteBbox | null {
  if (coords.length === 0) return null;
  const pad = Math.min(POI_MAX_RADIUS_KM, Math.max(0.2, Number.isFinite(padKm) ? padKm : 3));
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of coords) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  }
  if (!Number.isFinite(minLat)) return null;
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const latPad = pad / KM_PER_DEG_LAT;
  const lngPad = pad / (KM_PER_DEG_LNG * cos);
  return {
    south: Math.max(-85, minLat - latPad),
    north: Math.min(85, maxLat + latPad),
    west: Math.max(-180, minLng - lngPad),
    east: Math.min(180, maxLng + lngPad),
  };
}

/** Overpass poizvedba za turistične/naravne/zgodovinske točke v bboxu. */
export function overpassPoiQuery(b: RouteBbox): string {
  const bbox = `${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`;
  const filters = [
    '["tourism"~"viewpoint|attraction|museum|gallery|artwork"]',
    '["historic"~"castle|monument|memorial|ruins|archaeological_site"]',
    '["natural"~"peak|spring|cave_entrance|waterfall"]',
    '["amenity"~"restaurant|cafe"]',
  ];
  const parts: string[] = [];
  for (const f of filters) {
    parts.push(`node${f}(${bbox});`, `way${f}(${bbox});`);
  }
  // Brez kotvic/regularnih omejitev v izpisu: zrcala včasih 500-irajo.
  return `[out:json][timeout:25];(${parts.join('')});out center 300;`;
}

/** Razvrsti OSM tage v slovensko kategorijo (prvi zadetek odloča). */
export function categorizePoi(tags: Record<string, unknown>): PoiCategory {
  const val = (key: string) => (typeof tags[key] === 'string' ? (tags[key] as string) : '');
  if (/^(viewpoint)$/.test(val('tourism'))) return 'razgled';
  if (val('historic') || /^(museum|gallery|artwork|attraction)$/.test(val('tourism'))) return 'kultura';
  if (val('natural')) return 'narava';
  if (/^(restaurant|cafe)$/.test(val('amenity'))) return 'hrana';
  return 'drugo';
}

/**
 * Razčleni Overpass odgovor (fail-clean): samo poimenovane točke z
 * veljavnimi koordinatami, največ 300 (varstvo pred velikim odzivom).
 */
export function parseOverpassPois(raw: unknown): OverpassPoiElement[] {
  if (!raw || typeof raw !== 'object') return [];
  const elements = (raw as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return [];
  const out: OverpassPoiElement[] = [];
  for (const e of elements) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const center = o.center as { lat?: unknown; lon?: unknown; lng?: unknown } | undefined;
    const lat = typeof o.lat === 'number' ? o.lat : typeof center?.lat === 'number' ? center.lat : Number.NaN;
    // Overpass uporablja `lon`; nekateri posredniki `lng` — toleriramo oba.
    const lng = typeof o.lon === 'number' ? o.lon
      : typeof o.lng === 'number' ? o.lng
        : typeof center?.lon === 'number' ? center.lon
          : typeof center?.lng === 'number' ? center.lng : Number.NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) continue;
    const tags = o.tags && typeof o.tags === 'object' ? (o.tags as Record<string, unknown>) : {};
    const rawName = typeof tags.name === 'string' ? tags.name.trim() : '';
    if (!rawName) continue; // brez imena ni uporaben predlog
    const type = typeof o.type === 'string' ? o.type : 'node';
    const id = typeof o.id === 'number' || typeof o.id === 'string' ? String(o.id) : '';
    if (!id) continue;
    out.push({
      id: `${type}/${id}`,
      name: rawName.slice(0, 120),
      lat,
      lng,
      category: categorizePoi(tags),
    });
    if (out.length >= 300) break;
  }
  return out;
}

/** Približek razdalje točke do odseka v km (ekvirektangularna projekcija). */
function segmentDistanceKm(
  a: { x: number; y: number },
  b: { x: number; y: number },
  point: { x: number; y: number },
): { km: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
  return { km: Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)), t };
}

/**
 * Najkrajša razdalja do geometrije poti + položaj najbližje točke na poti.
 * Za eno samo točko poti vrne haversine razdaljo (progress = 0).
 */
export function distanceToRouteKm(point: LatLng, coords: readonly LatLng[]): { distanceKm: number; progress: number } | null {
  const valid = coords.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
  if (valid.length === 0) return null;
  // Enaka natančnost (1 decimalka) kot pri večtočkovni poti — stabilen JSON in izpis.
  if (valid.length === 1) {
    return { distanceKm: Math.round(haversineKm(point, valid[0]) * 10) / 10, progress: 0 };
  }

  const midLat = valid.reduce((s, c) => s + c.lat, 0) / valid.length;
  const cos = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const proj = valid.map((c) => ({ x: c.lng * cos * KM_PER_DEG_LNG, y: c.lat * KM_PER_DEG_LAT }));
  const p = { x: point.lng * cos * KM_PER_DEG_LNG, y: point.lat * KM_PER_DEG_LAT };

  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < proj.length; i += 1) {
    const len = Math.hypot(proj[i].x - proj[i - 1].x, proj[i].y - proj[i - 1].y);
    segLens.push(len);
    total += len;
  }
  if (total <= 0) return { distanceKm: haversineKm(point, valid[0]), progress: 0 };

  let best = { km: Infinity, t: 0, index: 0 };
  for (let i = 0; i < segLens.length; i += 1) {
    const d = segmentDistanceKm(proj[i], proj[i + 1], p);
    if (d.km < best.km) best = { km: d.km, t: d.t, index: i };
  }
  let before = 0;
  for (let i = 0; i < best.index; i += 1) before += segLens[i];
  const progress = Math.min(1, (before + best.t * segLens[best.index]) / total);
  return {
    distanceKm: Math.round(best.km * 10) / 10,
    progress: Math.round(progress * 1000) / 1000,
  };
}

export interface SelectPoisOptions {
  /** Največja oddaljenost od poti v km (privzeto 3, omejeno 0.5..15). */
  radiusKm?: number;
  /** Največ predlogov (privzeto 6, omejeno 1..12). */
  max?: number;
}

/**
 * Skupni razprševalnik za OBA vira (OSM in urejeni izbor):
 *   • podvojeni nazivi (case-insensitive) se izločijo,
 *   • najprej po bližini, nato bucket po `progress`, da vseh 6 predlogov
 *     ne pade na isti kilometer ob izhodišču,
 *   • preostala mesta se zapolnijo z najbližjimi kandidati.
 */
export function distributePois(candidates: readonly RoutePoi[], max: number): RoutePoi[] {
  const limit = clampPoiMax(max);
  const sorted = [...candidates].sort(
    (a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'sl'),
  );

  const seenNames = new Set<string>();
  const deduped: RoutePoi[] = [];
  for (const c of sorted) {
    const key = c.name.toLocaleLowerCase('sl').trim();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    deduped.push(c);
  }

  const buckets = new Map<number, RoutePoi>();
  for (const c of deduped) {
    const bucket = Math.min(limit - 1, Math.floor(c.progress * limit));
    if (!buckets.has(bucket)) buckets.set(bucket, c);
  }
  const picked = [...buckets.values()];
  const pickedIds = new Set(picked.map((p) => p.id));
  for (const c of deduped) {
    if (picked.length >= limit) break;
    if (pickedIds.has(c.id)) continue;
    pickedIds.add(c.id);
    picked.push(c);
  }
  return picked.sort((a, b) => a.progress - b.progress || a.distanceKm - b.distanceKm).slice(0, limit);
}

/** OSM ima pri enakem imenu prednost; oba vira se nato porazdelita po poti. */
export function mergePois(
  osm: readonly RoutePoi[],
  catalog: readonly RoutePoi[],
  max: number,
): RoutePoi[] {
  const osmNames = new Set(osm.map((p) => p.name.toLocaleLowerCase('sl').trim()));
  const extra = catalog.filter((p) => !osmNames.has(p.name.toLocaleLowerCase('sl').trim()));
  return distributePois([...osm, ...extra], max);
}

/** Izberi žive OSM predloge znotraj `radiusKm` od geometrije poti. */
export function selectPoisAlongRoute(
  raw: unknown,
  coords: readonly LatLng[],
  options: SelectPoisOptions = {},
): RoutePoi[] {
  const radius = clampRadiusKm(options.radiusKm);
  const max = clampPoiMax(options.max);
  const candidates: RoutePoi[] = [];
  for (const e of parseOverpassPois(raw)) {
    const d = distanceToRouteKm(e, coords);
    if (!d || d.distanceKm > radius) continue;
    candidates.push({ ...e, distanceKm: d.distanceKm, progress: d.progress, source: 'osm' });
  }
  return distributePois(candidates, max);
}

/** "1,2 km od poti" — slovenska decimalna vejica. */
export function poiDistanceLabel(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km od poti`;
}
