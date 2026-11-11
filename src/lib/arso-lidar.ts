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

/** Paranje vhodnih parametrov (iz query stringa) → {lat,lon} ali besedilna napaka.
 *  Pokritost: celega sveta (vir se izbere samodejno — glej nižje). */
export function parseElevationQuery(
  latRaw: string | null,
  lonRaw: string | null,
): { lat: number; lon: number } | { error: string } {
  // Pozor: Number(null) === 0 → manjkajoči parameter moraš zavrniti IZRECNO.
  if (latRaw === null || lonRaw === null || latRaw.trim() === '' || lonRaw.trim() === '') {
    return { error: 'Parametra lat in lon sta obvezna (npr. ?lat=46.36&lon=14.09).' };
  }
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
    return { error: 'Parametra lat in lon morata biti veljavni koordinati (npr. ?lat=46.36&lon=14.09).' };
  }
  return { lat, lon };
}

/* ————————————————————————————————————————————————————————————————————————
 * DVA VIRA VIŠINE (izmerjeno 18. 10. 2026):
 *   1) ARSO DMR (LiDAR, 1 m) — samo Slovenija; izven extent → "NoData"
 *      (izmerjeno za Zagreb: value="NoData").
 *   2) Copernicus DEM GLO-90 prek Open-Meteo — celega sveta (Balkan!), brez
 *      ključa, 90 m ločljivost (izmerjeno: Ljubljana 299 · Zagreb 142 ·
 *      Sarajevo 543 · Beograd 138 · Podgorica 48 · Tirana 110 · Skopje 249 ·
 *      Sofija 548 m). Fair-use: brez predpomnilnika NE klicati (10k/dan limit).
 *   Logika: znotraj SI bbox → ARSO; če ARSO vrne NoData → samodejno Copernicus.
 * ———————————————————————————————————————————————————————————————————————— */

export type ElevationSourceId = 'arso' | 'terrarium' | 'copernicus';

export const ELEVATION_SOURCE_INFO = {
  arso: {
    label: 'ARSO LiDAR 1 m',
    source: 'ARSO Slovenija_DMR_D96TM (LiDAR, 1 m)',
    license: 'CC BY 4.0 — GURS/ARSO',
  },
  terrarium: {
    label: 'DEM ~30 m',
    source: 'Mapzen Terrain Tiles (AWS Open Data, SRTM/GMTED)',
    license: 'prosto dostopno (AWS Open Data)',
  },
  copernicus: {
    label: 'Copernicus 90 m',
    source: 'Copernicus DEM GLO-90 (prek Open-Meteo)',
    license: 'prosto dostopno (Copernicus/ESA)',
  },
} as const;

/** URL višine prek Open-Meteo (Copernicus GLO-90) — čista funkcija. */
export function openMeteoElevationUrl(lat: number, lon: number): string {
  return `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}`;
}

/** Iz Open-Meteo odgovora izlušči višino ({"elevation":[x]}) ali null. */
export function parseOpenMeteoElevation(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const arr = (raw as { elevation?: unknown }).elevation;
  if (Array.isArray(arr) && typeof arr[0] === 'number' && Number.isFinite(arr[0])) return arr[0];
  return null;
}

/* ————————————————————————————————————————————————————————————————————————
 * 3) AWS TERRARIUM (Mapzen Terrain Tiles, AWS Open Data) — globalne DEM
 *    ploščice brez ključa in brez dnevne kvote (izmerjeno: Zagreb 123 m,
 *    Triglav ploščica 110–2707 m; SRTM/GMTED sestavek, ~30–90 m).
 *    Format: RGB PNG, višina = R*256 + G + B/256 − 32768.
 * ———————————————————————————————————————————————————————————————————————— */

/** XYZ ploščica za točko (isti tiling kot zemljevid) — čista funkcija. */
export function latLonToTile(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = Math.pow(2, z);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x: Math.min(Math.max(x, 0), n - 1), y: Math.min(Math.max(y, 0), n - 1) };
}

export function terrariumTileUrl(lat: number, lon: number, z = 11): string {
  const { x, y } = latLonToTile(lat, lon, z);
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
}

/** Slika (dekodirana s pngjs: {width,height,data RGBA}) → višina na točki ali null.
 *  Pozor: piksel je IZRAČUNAN LOKALNO znotraj ploščice (globalni − izvor ploščice). */
export function decodeTerrariumElevation(
  img: { width: number; height: number; data: Uint8Array | Uint8ClampedArray },
  lat: number,
  lon: number,
  z: number,
): number | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const n = Math.pow(2, z);
  const lonX = ((lon + 180) / 360) * n * 256;
  const latRad = (lat * Math.PI) / 180;
  const latY = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n * 256;
  const { x, y } = latLonToTile(lat, lon, z);
  const px = Math.floor(lonX) - x * 256;
  const py = Math.floor(latY) - y * 256;
  if (px < 0 || py < 0 || px >= img.width || py >= img.height) return null;
  const i = (py * img.width + px) * 4;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  if (r === undefined || g === undefined || b === undefined) return null;
  return r * 256 + g + b / 256 - 32768;
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
