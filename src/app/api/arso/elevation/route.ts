import { NextResponse } from 'next/server';
import { PNG } from 'pngjs';
import {
  arsoElevationIdentifyUrl,
  createElevationCache,
  decodeTerrariumElevation,
  ELEVATION_SOURCE_INFO,
  isInSloveniaBbox,
  openMeteoElevationUrl,
  parseArsoElevation,
  parseElevationQuery,
  parseOpenMeteoElevation,
  terrariumTileUrl,
  type ElevationSourceId,
} from '@/lib/arso-lidar';

/**
 * Višina na točko — strežniški posrednik s TREMI VIRI (izmerjeno 18. 10. 2026):
 *
 *   1) ARSO DMR (LiDAR, 1 m) — samo Slovenija; znotraj SI bbox prvi poskus.
 *      Izven extent ARSO vrne value="NoData" (izmerjeno za Zagreb).
 *   2) AWS Terrarium (Mapzen Terrain Tiles) — globalno, brez ključa in brez
 *      dnevne kvote (Open-Meteo ima ~10k/dan; izmerjeno 429 "Daily API request
 *      limit exceeded" na deljenem odhodnem IP-ju peskovnika → zato Terrarium
 *      kot PRVI globalni vir, Open-Meteo kot zadnji rezervni).
 *
 * Zakaj posrednik: ARSO nima CORS glav (izmerjeno) → brskalnik ne more klicati
 * direktno; posrednik vsiljuje pošten odmik — predpomnilnik (10 min, 500 točk)
 * + združevanje hkratnih identičnih zahtevkov.
 *
 * GET /api/arso/elevation?lat=46.36&lon=14.09   → ARSO LiDAR 1 m (Slovenija)
 * GET /api/arso/elevation?lat=45.81&lon=15.98   → DEM ~30 m (Zagreb)
 *   → 200 { ok, elevationM, lat, lon, source, license, label }
 *   → 400 { ok:false, error } (neveljavni vhod)
 *   → 502 { ok:false, error } (vsi viri nedosegljivi)
 */

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const UPSTREAM_TIMEOUT_MS = 10_000;
const TERRARIUM_Z = 11; // ≈ 53 m/piksel pri širini Slovenije

const elevationCache = createElevationCache(CACHE_TTL_MS, CACHE_MAX_ENTRIES);

async function fetchArso(lat: number, lon: number): Promise<number> {
  const response = await fetch(arsoElevationIdentifyUrl(lat, lon), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`ARSO odgovoril HTTP ${response.status}`);
  const elevation = parseArsoElevation(await response.json());
  if (elevation === null) throw new Error('ARSO: NoData (točka izven DMR)');
  return elevation;
}

async function fetchTerrarium(lat: number, lon: number): Promise<number> {
  const response = await fetch(terrariumTileUrl(lat, lon, TERRARIUM_Z), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { accept: 'image/png' },
  });
  if (!response.ok) throw new Error(`Terrarium odgovoril HTTP ${response.status}`);
  const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
  const elevation = decodeTerrariumElevation(png, lat, lon, TERRARIUM_Z);
  if (elevation === null) throw new Error('Terrarium: točka izven ploščice');
  return elevation;
}

async function fetchCopernicus(lat: number, lon: number): Promise<number> {
  const response = await fetch(openMeteoElevationUrl(lat, lon), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Open-Meteo odgovoril HTTP ${response.status}`);
  const elevation = parseOpenMeteoElevation(await response.json());
  if (elevation === null) throw new Error('Open-Meteo odgovor ni vseboval višine');
  return elevation;
}

/** Padalna veriga: ARSO (samo SI) → Terrarium (globalno) → Open-Meteo. */
async function fetchElevation(lat: number, lon: number): Promise<{ elevationM: number; source: ElevationSourceId }> {
  if (isInSloveniaBbox(lat, lon)) {
    try {
      return { elevationM: await elevationCache.get(`si:${lat.toFixed(4)},${lon.toFixed(4)}`, () => fetchArso(lat, lon)), source: 'arso' };
    } catch {
      /* NoData ali nedosegljiv → globalna vira */
    }
  }
  try {
    return { elevationM: await elevationCache.get(`tr:${lat.toFixed(4)},${lon.toFixed(4)}`, () => fetchTerrarium(lat, lon)), source: 'terrarium' };
  } catch {
    /* z napornim odzivom nadaljuj na Open-Meteo */
  }
  return { elevationM: await elevationCache.get(`gl:${lat.toFixed(4)},${lon.toFixed(4)}`, () => fetchCopernicus(lat, lon)), source: 'copernicus' };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseElevationQuery(url.searchParams.get('lat'), url.searchParams.get('lon'));
  if ('error' in query) {
    return NextResponse.json({ ok: false, error: query.error }, { status: 400 });
  }
  const { lat, lon } = query;

  try {
    const { elevationM, source } = await fetchElevation(lat, lon);
    const info = ELEVATION_SOURCE_INFO[source];
    return NextResponse.json({
      ok: true,
      elevationM,
      lat,
      lon,
      label: info.label,
      source: info.source,
      license: info.license,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv vira';
    return NextResponse.json(
      { ok: false, error: `Višina trenutno ni na voljo (${message}). Poskusi znova.` },
      { status: 502 },
    );
  }
}
