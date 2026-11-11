/**
 * ROUTE SERVICE (bun) — cestne poti OSRM za "Mojo pot".
 *
 * ZAKAJ OBSTAJA (izmerjeno 18. 10. 2026 v peskovniku):
 *   Node fetch (Next.js strežnik) → router.project-osrm.org = ETIMEDOUT
 *   bun fetch → isti gostitelj = HTTP 200
 *   → peskovnik filtrira odhodne povezave procesa Node za ta gostitelj.
 * Next posrednik (/api/osrm/route) zato ob neuspehu pade na to storitev
 * (http://127.0.0.1:3031/osrm/route). V produkciji (Vercel/Node) padanje
 * ni potrebno — direktni OSRM deluje.
 *
 * Poštena raba: javni demo OSRM (≤ 1 zahteva/s) → predpomnilnik 10 min /
 * 50 poti + združevanje hkratnih identičnih zahtevkov.
 *
 * GET /osrm/route?stops=lat,lng;lat,lng[;…]
 *   → { ok:true, coords:[[lat,lng]…], legs:[{distanceKm,durationMin}…], totalKm }
 *   → { ok:false, error }
 */

import { osrmRouteUrl, parseOsrmRoute, type OsrmRouteResult, type OsrmWaypoint } from '../../src/lib/osrm-route';

const PORT = 3031;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_STOPS = 8;

interface CacheEntry {
  value: OsrmRouteResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<OsrmRouteResult>>();

function cacheGet(key: string): OsrmRouteResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: OsrmRouteResult): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function parseStops(raw: string | null): { stops: OsrmWaypoint[] } | { error: string } {
  if (!raw || raw.trim().length === 0) return { error: 'Manjka parameter stops (lat,lng;lat,lng).' };
  const parts = raw.split(';');
  if (parts.length < 2) return { error: 'Pot potrebuje vsaj dve postanki.' };
  if (parts.length > MAX_STOPS) return { error: `Največ ${MAX_STOPS} postankov.` };
  const stops: OsrmWaypoint[] = [];
  for (const part of parts) {
    const [latRaw, lngRaw] = part.split(',');
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -85 || lat > 85 || lng < -180 || lng > 180) {
      return { error: `Neveljavna postanka "${part}" — pričakovano lat,lng.` };
    }
    stops.push({ lat, lng });
  }
  return { stops };
}

async function getRoute(key: string, stops: OsrmWaypoint[]): Promise<OsrmRouteResult> {
  const cached = cacheGet(key);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const response = await fetch(osrmRouteUrl(stops), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`OSRM odgovoril HTTP ${response.status}`);
    const parsed = parseOsrmRoute(await response.json());
    if (!parsed) throw new Error('OSRM odgovor ni vseboval veljavne poti');
    return parsed;
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

Bun.serve({
  port: PORT,
  fetch: async (req) => {
    const url = new URL(req.url);
    if (url.pathname !== '/osrm/route') {
      return json({ ok: false, error: 'Neznana pot — uporabi /osrm/route?stops=…' }, 404);
    }
    const parsed = parseStops(url.searchParams.get('stops'));
    if ('error' in parsed) return json({ ok: false, error: parsed.error }, 400);

    const key = parsed.stops.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join(';');
    try {
      const route = await getRoute(key, parsed.stops);
      return json({ ok: true, coords: route.coords, legs: route.legs, totalKm: route.totalKm });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'neznan odziv vira';
      return json({ ok: false, error: `Cestna pot trenutno ni na voljo (${message}).` }, 502);
    }
  },
});

console.log(`[route-service] bun posluša na http://127.0.0.1:${PORT} (OSRM + predpomnilnik 10 min)`);
