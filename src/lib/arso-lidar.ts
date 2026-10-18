/**
 * ARSO LiDAR — visokoločljivostni relief (hladčenje) kot dodatni sloj.
 *
 * VIR (izmerjeno 18. 10. 2026, glej research/arso-lidar/SUMMARY.md):
 *   • Storitev: http://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer
 *   • Dinamični izvoz: /export?bbox=…&bboxSR=3857&imageSR=3857&size=256,256&format=png&f=image
 *     (test: HTTP 200, PNG 256×256, območje Bleda — pravi LiDAR relief)
 *   • Licenca: CC BY 4.0 (OPSI "Digitalni model višin", MOP/GURS)
 *   • Suha gradnja DMV0050 (5 m, LiDAR izpeljan): 4 četrtine, ≈ 3,47 GB — potrjeno z HEAD.
 *
 * Fair-use disciplina: ena zahteva na ploščico (256×256), brez prefetcha,
 * `updateWhenIdle` — strežnik ni CDN. Produkcija: proxy + lokalni predpomnilnik.
 */

/** Zemepisna širina/dolžina ploščice XYZ (Web Mercator tiling scheme). */
function tileLonLat(x: number, y: number, z: number): { lon1: number; latTop: number; lon2: number; latBottom: number } {
  const n = Math.pow(2, z);
  const lon1 = (x / n) * 360 - 180;
  const lon2 = ((x + 1) / n) * 360 - 180;
  // zgornji rob ploščice (y) ima večjo širino kot spodnji (y+1)
  const latTop = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const latBottom = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return { lon1, latTop, lon2, latBottom };
}

/** BBox ploščice v EPSG:3857 (metri) — čista funkcija, testirana. */
export function tileBbox3857(x: number, y: number, z: number): { xmin: number; ymin: number; xmax: number; ymax: number } {
  const R = 6378137;
  const { lon1, latTop, lon2, latBottom } = tileLonLat(x, y, z);
  const x1 = R * (lon1 * (Math.PI / 180));
  const x2 = R * (lon2 * (Math.PI / 180));
  const yTop = R * Math.log(Math.tan(Math.PI / 4 + latTop / 2));
  const yBottom = R * Math.log(Math.tan(Math.PI / 4 + latBottom / 2));
  return { xmin: Math.min(x1, x2), ymin: Math.min(yBottom, yTop), xmax: Math.max(x1, x2), ymax: Math.max(yBottom, yTop) };
}

/** URL dinamičnega izvoza ARSO LiDAR hladčenja za XYZ ploščico. */
export function arsoLidarTileUrl(x: number, y: number, z: number, size = 256): string {
  const b = tileBbox3857(x, y, z);
  const p = (v: number) => Math.round(v * 100) / 100;
  const params = new URLSearchParams({
    bbox: `${p(b.xmin)},${p(b.ymin)},${p(b.xmax)},${p(b.ymax)}`,
    bboxSR: '3857',
    imageSR: '3857',
    size: `${size},${size}`,
    format: 'png',
    f: 'image',
    transparent: 'true',
  });
  return `https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export?${params.toString()}`;
}

export const ARSO_LIDAR_ATTRIBUTION =
  'LiDAR relief &copy; <a href="https://www.gov.si/drzavni-organi/organi-v-sestavi/geodetska-uprava/" rel="noopener">GURS</a>/<a href="https://www.arso.gov.si" rel="noopener">ARSO</a> (CC BY 4.0)';

/* ————————————————————————————————————————————————————————————————————————
 * VIŠINA NA TOČKO (izmerjeno 18. 10. 2026):
 *   • `Slovenija_DMR_D96TM/ImageServer/identify` → HTTP 200, `value` = višina (m)
 *     (Bled 475,86 · Ljubljana 297,74 · Piran −0,02 · Triglav pobočje 2273,7;
 *     odziv ~0,6 s)
 *   • Odgovor NIMA CORS glav → brskalnik NE sme klicati ARSO direktno; zahtevek
 *     gre čez /api/arso/elevation (pošten odmik + predpomnilnik na strežniku).
 *   • Licenca: CC BY 4.0 (izmerjeno za DMV na OPSI; DMR je isti izdajatelj
 *     GURS/ARSO — atribucija enaka).
 * ———————————————————————————————————————————————————————————————————————— */

/** Okvirna meja Slovenije (z robom) — zavrne očitno tuje točke. */
export const SLO_BBOX = { minLat: 45.2, maxLat: 47.1, minLon: 13.2, maxLon: 16.8 } as const;

export function isInSloveniaBbox(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= SLO_BBOX.minLat &&
    lat <= SLO_BBOX.maxLat &&
    lon >= SLO_BBOX.minLon &&
    lon <= SLO_BBOX.maxLon
  );
}

/** URL točkovnega poizvedovanja (identify) DMR ImageServerja — čista funkcija. */
export function arsoElevationIdentifyUrl(lat: number, lon: number): string {
  const geometry = JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } });
  const params = new URLSearchParams({
    geometry,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    returnGeometry: 'false',
    f: 'json',
  });
  return `https://gis.arso.gov.si/arcgis/rest/services/Slovenija_DMR_D96TM/ImageServer/identify?${params.toString()}`;
}

/** Iz ARSO identify odgovora izlušči višino v metrih (null, če ni števila). */
export function parseArsoElevation(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = (raw as { value?: unknown }).value;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Slovensko oblikovanje višine: 475.858 → "475,9 m" (tudi −0,015 → "0,0 m"). */
export function formatElevation(m: number): string {
  if (!Number.isFinite(m)) return '— m';
  const r = Math.round(m * 10) / 10;
  const v = Object.is(r, -0) ? 0 : r;
  return `${v.toFixed(1).replace('.', ',')} m`;
}

/** Paranje vhodnih parametrov (iz query stringa) → {lat,lon} ali besedilna napaka. */
export function parseElevationQuery(
  latRaw: string | null,
  lonRaw: string | null,
): { lat: number; lon: number } | { error: string } {
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { error: 'Parametra lat in lon morata biti števili (npr. ?lat=46.36&lon=14.09).' };
  }
  if (!isInSloveniaBbox(lat, lon)) {
    return { error: 'Točka je izven meja Slovenije (DMR pokriva samo Slovenijo).' };
  }
  return { lat, lon };
}

/* ————————————————————————————————————————————————————————————————————————
 * PREDPOMNILNIK + pošten odmik: identična točka v oknu TTL → 1 klic ARSO,
 * hkratne iste zahteve se zložijo v enega (in-flight). Čista tovarna z
 * vbrizganim `now` → deterministično testirana.
 * ———————————————————————————————————————————————————————————————————————— */

export interface ElevationCache {
  get(key: string, loader: () => Promise<number>): Promise<number>;
}

export function createElevationCache(
  ttlMs: number,
  maxEntries: number,
  now: () => number = () => Date.now(),
): ElevationCache {
  const entries = new Map<string, { value: number; at: number }>();
  const inFlight = new Map<string, Promise<number>>();
  return {
    get(key, loader) {
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttlMs) return Promise.resolve(hit.value);
      const running = inFlight.get(key);
      if (running) return running;
      const p = loader()
        .then((value) => {
          entries.set(key, { value, at: now() });
          if (entries.size > maxEntries) {
            // Map ohranja vrstni red vstavljanja → najstarejši je prvi ključ.
            const oldest = entries.keys().next().value;
            if (oldest !== undefined && oldest !== key) entries.delete(oldest);
          }
          return value;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, p);
      return p;
    },
  };
}
