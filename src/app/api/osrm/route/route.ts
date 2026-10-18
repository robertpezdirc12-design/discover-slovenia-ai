import { NextResponse } from 'next/server';
import { osrmRouteUrl, parseOsrmRoute, type OsrmRouteResult, type OsrmWaypoint } from '@/lib/osrm-route';

/**
 * Cestna pot med postanki "Moje poti" — strežniški posrednik za OSRM.
 *
 * Zakaj posrednik: javni demo strežnik router.project-osrm.org ima politiko
 * poštene rabe (≤ 1 zahteva/s, izmerjeno 18. 10. 2026: Bled→Bohinj 18,7 km,
 * 514 točk, HTTP 200). Posrednik vsiljuje odmik — predpomnilnik (10 min,
 * 50 poti) + združevanje hkratnih identičnih zahtevkov. Brskalnik ne kliče
 * direktno (tudi če OSRM demo ima CORS *, je poštenje strežniško skromen).
 *
 * GET /api/osrm/route?stops=lat,lng;lat,lng[;lat,lng…]
 *   → 200 { ok:true, coords:[ [lat,lng]… ], legs:[{distanceKm,durationMin}…], totalKm }
 *   → 400 { ok:false, error }  (neveljavni vhod: manj kot 2 postanki / napačen zapis)
 *   → 502 { ok:false, error }  (OSRM nedosegljiv ali neveljaven odziv)
 */

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_STOPS = 8;

interface CacheEntry {
  value: OsrmRouteResult;
  expiresAt: number;
}

const routeCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<OsrmRouteResult>>();

function cacheGet(key: string): OsrmRouteResult | null {
  const hit = routeCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    routeCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: OsrmRouteResult): void {
  if (routeCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = routeCache.keys().next().value;
    if (oldest !== undefined) routeCache.delete(oldest);
  }
  routeCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Razčleni "lat,lng;lat,lng[;…]" → točke ali napaka (slovensko sporočilo). */
export function parseStopsParam(raw: string | null): { stops: OsrmWaypoint[] } | { error: string } {
  if (!raw || raw.trim().length === 0) {
    return { error: 'Manjka parameter stops (zapis: lat,lng;lat,lng).' };
  }
  const parts = raw.split(';');
  if (parts.length < 2) {
    return { error: 'Pot potrebuje vsaj dve postanki (lat,lng;lat,lng).' };
  }
  if (parts.length > MAX_STOPS) {
    return { error: `Največ ${MAX_STOPS} postankov na zahtevo.` };
  }
  const stops: OsrmWaypoint[] = [];
  for (const part of parts) {
    const [latRaw, lngRaw] = part.split(',');
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (
      latRaw === undefined || lngRaw === undefined || latRaw.trim() === '' || lngRaw.trim() === '' ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -85 || lat > 85 || lng < -180 || lng > 180
    ) {
      return { error: `Neveljavna postanka "${part}" — pričakovano lat,lng.` };
    }
    stops.push({ lat, lng });
  }
  return { stops };
}

async function fetchDirect(stops: OsrmWaypoint[]): Promise<OsrmRouteResult> {
  const response = await fetch(osrmRouteUrl(stops), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`OSRM odgovoril HTTP ${response.status}`);
  const parsed = parseOsrmRoute(await response.json());
  if (!parsed) throw new Error('OSRM odgovor ni vseboval veljavne poti');
  return parsed;
}

/**
 * Rezerva (peskovnik, izmerjeno): Node fetch → router.project-osrm.org je
 * včasih blokiran (ETIMEDOUT), bun mini storitev pa doseže isti gostitelj.
 * V produkciji rezerva ni sprožena (direktni klic uspe).
 */
async function fetchViaService(stops: OsrmWaypoint[]): Promise<OsrmRouteResult> {
  const stopsParam = stops.map((s) => `${s.lat},${s.lng}`).join(';');
  const response = await fetch(`http://127.0.0.1:3031/osrm/route?stops=${encodeURIComponent(stopsParam)}`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  const j = (await response.json()) as {
    ok: boolean;
    coords?: [number, number][];
    legs?: { distanceKm: number; durationMin: number }[];
    totalKm?: number;
  };
  if (!response.ok || !j.ok || !Array.isArray(j.coords) || j.coords.length < 2 || !Array.isArray(j.legs) || j.legs.length === 0) {
    throw new Error('route-service: brez veljavne poti');
  }
  return { coords: j.coords, legs: j.legs, totalKm: j.totalKm ?? 0 };
}

async function fetchRoute(key: string, stops: OsrmWaypoint[]): Promise<OsrmRouteResult> {
  const cached = cacheGet(key);
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    try {
      return await fetchDirect(stops);
    } catch (directError) {
      try {
        return await fetchViaService(stops);
      } catch {
        throw directError;
      }
    }
  })();

  inFlight.set(key, task);
  try {
    const result = await task;
    cacheSet(key, result);
    return result;
  } finally {
    inFlight.delete(key);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseStopsParam(url.searchParams.get('stops'));
  if ('error' in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const stops = parsed.stops;
  const key = stops.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join(';');

  try {
    const route = await fetchRoute(key, stops);
    return NextResponse.json({ ok: true, coords: route.coords, legs: route.legs, totalKm: route.totalKm });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv vira';
    return NextResponse.json(
      { ok: false, error: `Cestna pot trenutno ni na voljo (${message}). Poskusi znova.` },
      { status: 502 },
    );
  }
}
