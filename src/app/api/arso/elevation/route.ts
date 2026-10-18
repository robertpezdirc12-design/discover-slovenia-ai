import { NextResponse } from 'next/server';
import {
  arsoElevationIdentifyUrl,
  createElevationCache,
  parseArsoElevation,
  parseElevationQuery,
} from '@/lib/arso-lidar';

/**
 * ARSO DMR (LiDAR, 1 m) — višina na točko, strežniški posrednik.
 *
 * Zakaj posrednik: ARSO odgovor nima CORS glav (izmerjeno) → brskalnik ne more
 * klicati direktno; poleg tega posrednik vsiljuje pošten odmik — predpomnilnik
 * (10 min, največ 500 točk) + združevanje hkratnih identičnih zahtevkov.
 *
 * GET /api/arso/elevation?lat=46.36&lon=14.09
 *   → 200 { ok, elevationM, lat, lon, source, license }
 *   → 400 { ok:false, error } (neveljavni vhod)
 *   → 502 { ok:false, error } (ARSO nedosegljiv / neveljaven odgovor)
 */

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const UPSTREAM_TIMEOUT_MS = 10_000;

const elevationCache = createElevationCache(CACHE_TTL_MS, CACHE_MAX_ENTRIES);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseElevationQuery(url.searchParams.get('lat'), url.searchParams.get('lon'));
  if ('error' in query) {
    return NextResponse.json({ ok: false, error: query.error }, { status: 400 });
  }

  const key = `${query.lat.toFixed(5)},${query.lon.toFixed(5)}`;
  try {
    const elevationM = await elevationCache.get(key, async () => {
      const response = await fetch(arsoElevationIdentifyUrl(query.lat, query.lon), {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`ARSO odgovoril HTTP ${response.status}`);
      }
      const elevation = parseArsoElevation(await response.json());
      if (elevation === null) {
        throw new Error('ARSO odgovor ni vseboval veljavne višine');
      }
      return elevation;
    });

    return NextResponse.json({
      ok: true,
      elevationM,
      lat: query.lat,
      lon: query.lon,
      source: 'ARSO Slovenija_DMR_D96TM (LiDAR, 1 m)',
      license: 'CC BY 4.0 — GURS/ARSO',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv vira';
    return NextResponse.json(
      { ok: false, error: `Višina trenutno ni na voljo (${message}). Poskusi znova.` },
      { status: 502 },
    );
  }
}
