/**
 * RKD — Register nepremične kulturne dediščine (RNPD), kompaktni nabor.
 *
 * Podatki: podatki.gov.si (CKAN), vir JSON `rnpd.json`, 31.107 enot.
 * Licenca: OPSI (CC BY 4.0), MOP/GURS. Predobdelavo izvaja
 * `research/rkd/transform.py` → `public/data/rkd.json`.
 *
 * Ta datoteka je ČISTA podatkovna plast (brez Reacta, brez Leafleta):
 * tipi, filtri in mrežno gručenje. Leaflet adapter je v `rkd-layer.ts`.
 */

/** Indeks tipa v RKD_TYPE_LABELS — kompaktna shramba (0–8). */
export type RkdTypeIndex = number;

export interface RkdFeature {
  /** Ime (npr. "Dobova — Arheološko najdišče Gomilice"). */
  n: string;
  /** Indeks tipa (RKD_TYPE_LABELS). */
  t: RkdTypeIndex;
  /** Opis (odrezan na 96 znakov). */
  d: string;
  /** Občina (velike črke), lahko prazno. */
  m: string;
  lat: number;
  lng: number;
  /** Ime datoteke fotografije na ised.gov.si (prazno = ni fotografije). */
  ph: string;
  /** EŠD — enolična identifikacijska številka dediščine. */
  e: number;
}

export interface RkdDataset {
  features: readonly RkdFeature[];
  typeLabels: readonly string[];
}

export const RKD_ATTRIBUTION =
  'Vir: Register nepremične kulturne dediščine (RKD), MOP/GURS — OPSI (CC BY 4.0)';

export const RKD_PHOTO_BASE = 'https://ised.gov.si/statika/KF_RNPD/';

/** Javna povezava do enote (eID). */
export function rkdUnitUrl(esd: number | string): string {
  return `https://eid.gov.si/S/${encodeURIComponent(String(esd))}`;
}

/** Polna URL fotografije (prazno → null). */
export function rkdPhotoUrl(photoFile: string): string | null {
  if (!photoFile) return null;
  return RKD_PHOTO_BASE + encodeURIComponent(photoFile);
}

/** Varna razčlenitev nabora (tuj/poškodovan vnos → null). */
export function parseRkdData(raw: unknown): RkdDataset | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const meta = obj.meta as Record<string, unknown> | undefined;
  const labels = meta?.typeLabels;
  const features = obj.features;
  if (!Array.isArray(features) || !Array.isArray(labels)) return null;
  if (labels.length < 1 || labels.length > 64) return null;
  if (features.length > 200000) return null; // varstvo pred zlorabo

  const out: RkdFeature[] = [];
  for (const item of features) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    const lat = typeof f.lat === 'number' ? f.lat : NaN;
    const lng = typeof f.lng === 'number' ? f.lng : NaN;
    const type = typeof f.t === 'number' ? f.t : -1;
    const esd = typeof f.e === 'number' ? f.e : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    if (type < 0 || type >= labels.length) continue;
    if (!Number.isFinite(esd)) continue;
    out.push({
      n: typeof f.n === 'string' ? f.n : '',
      t: type,
      d: typeof f.d === 'string' ? f.d : '',
      m: typeof f.m === 'string' ? f.m : '',
      lat,
      lng,
      ph: typeof f.ph === 'string' ? f.ph : '',
      e: esd,
    });
  }
  return { features: out, typeLabels: labels as readonly string[] };
}

/** Filter po tipu + besedilu (ime/opis/občina; brez diakritike ni nujno). */
export function filterRkd(
  features: readonly RkdFeature[],
  opts: { type?: number | null; query?: string } = {},
): readonly RkdFeature[] {
  const { type, query } = opts;
  let out = features;
  if (type !== null && type !== undefined) {
    out = out.filter((f) => f.t === type);
  }
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    out = out.filter(
      (f) =>
        f.n.toLowerCase().includes(q) ||
        f.d.toLowerCase().includes(q) ||
        f.m.toLowerCase().includes(q),
    );
  }
  return out;
}

/** ————— MREŽNO GRUČENJE ————— */

/**
 * Web Mercator svetovne koordinate (0..256 pri zoom 0, x2 na zoom).
 * Ena celica gručenja = 256 svetovnih enot → pri zoom z je vidnih
 * največ (vidno polje) celic; število označevalcev ostane majhno.
 */
export function worldXY(lat: number, lng: number): [number, number] {
  const x = (lng + 180) / 360;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return [x, y];
}

export interface RkdCluster {
  lat: number;
  lng: number;
  count: number;
  /** Povprečje koordinat članov (stabilno, neodvisno od vrstnega reda). */
  centerLat: number;
  centerLng: number;
  /** Posamezna enota, ko count === 1 (sicer nedefinirano). */
  feature?: RkdFeature;
}

function clusterKey(x: number, y: number, zoom: number): string {
  const size = 1 / Math.pow(2, zoom);
  const cx = Math.floor(x / size);
  const cy = Math.floor(y / size);
  return `${cx}:${cy}`;
}

/**
 * Gruči značke v mrežne celice pri danem zoomu. `limit` omeji število
 * vrnjenih gruč (najgostejše najprej) — za ogromne poglede (npr. vsa
 * Slovenija) ostane UI odziven.
 */
export function clusterRkd(
  features: readonly RkdFeature[],
  zoom: number,
  limit = 600,
): readonly RkdCluster[] {
  if (features.length === 0) return [];
  const z = Math.max(0, Math.min(20, Math.round(zoom)));
  const size = 1 / Math.pow(2, z);
  // Determinizem: enolični predstavnik posamezne enote = najmanjši EŠD
  // (neodvisno od vrstnega reda vnosa → stabilen rezultat tudi ob preureditvi).
  const sorted = [...features].sort((a, b) => a.e - b.e);
  const buckets = new Map<
    string,
    { latSum: number; lngSum: number; count: number; first?: RkdFeature }
  >();
  for (const f of sorted) {
    const [x, y] = worldXY(f.lat, f.lng);
    const key = clusterKey(x, y, z);
    const b = buckets.get(key);
    if (b) {
      b.latSum += f.lat;
      b.lngSum += f.lng;
      b.count += 1;
    } else {
      buckets.set(key, { latSum: f.lat, lngSum: f.lng, count: 1, first: f });
    }
  }
  const clusters: RkdCluster[] = [];
  for (const b of buckets.values()) {
    const count = b.count;
    const centerLat = b.latSum / count;
    const centerLng = b.lngSum / count;
    clusters.push({
      lat: centerLat,
      lng: centerLng,
      count,
      centerLat,
      centerLng,
      feature: count === 1 ? b.first : undefined,
    });
  }
  clusters.sort((a, b) => b.count - a.count);
  return clusters.slice(0, limit);
}

/**
 * Ali se pravokotnik (južni/zahodni/vzhodni/severni rob) seka z
 * okolico točke. Uporabljeno za izbiro vidnih značk pri nizkem zoomu.
 */
export function inBounds(
  f: RkdFeature,
  bounds: { south: number; west: number; east: number; north: number },
): boolean {
  return f.lat >= bounds.south && f.lat <= bounds.north && f.lng >= bounds.west && f.lng <= bounds.east;
}

export interface RkdBounds {
  south: number;
  west: number;
  east: number;
  north: number;
}

/**
 * Filtrira na vidno polje + tip/besedilo. KLJUČNO za gručenje: omejitev
 * števila gruč ima smisel samo na VIDNIH značkah — sicer bi omejitev odvrgla
 * posamezne enote (count 1) v korist velikih gruč izven pogleda.
 */
export function filterRkdInBounds(
  features: readonly RkdFeature[],
  bounds: RkdBounds,
  opts: { type?: number | null; query?: string } = {},
): readonly RkdFeature[] {
  const filtered = filterRkd(features, opts);
  return filtered.filter((f) => inBounds(f, bounds));
}
