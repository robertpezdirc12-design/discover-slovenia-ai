import { NextResponse } from 'next/server';
import { osrmRouteUrl, parseOsrmRoute, type OsrmWaypoint } from '@/lib/osrm-route';
import {
  OVERPASS_DEFAULT_BUDGET_MS,
  raceOverpass,
  type OverpassAttempt,
} from '@/lib/overpass';
import { selectCatalogPois } from '@/lib/poi-catalog';
import {
  bboxForRoute,
  clampPoiMax,
  clampRadiusKm,
  mergePois,
  overpassPoiQuery,
  parseOverpassPois,
  selectPoisAlongRoute,
  type LatLng,
  type RoutePoi,
} from '@/lib/route-poi';

/**
 * »VREDNE POSTAJE OB POTI« — zanimivosti ob GEOMETRIJI cestne poti.
 *
 * GET /api/pot/nearby?stops=lat,lng[;lat,lng…][&radius=3][&max=6]
 *   → 200 { ok:true, pois:[{id,name,lat,lng,category,distanceKm,progress,
 *           source:'osm'|'izbor'}], routePoints, radiusKm, osmCount,
 *           catalogCount, degraded, error? }
 *   → 400 { ok:false, error }  (neveljavne postanke)
 *
 * DVA VIRA, vedno pošteno označena:
 *   • živi OpenStreetMap prek Overpassa (globalna zrcala, prvi uspešni
 *     odgovor z imenovanimi zadetki zmaga),
 *   • urejeni izbor slovenskih znamenitosti kot ZAGOTOVLJENA rezerva.
 *
 * Zakaj rezerva: `overpass.osm.ch` (ki ga uporablja iskanje prenočišč) je
 * ŠVICARSKI izvleček OSM — za Slovenijo vrne HTTP 200 s praznim `elements`.
 * Brez rezerve bi UI prikazal »ni zanimivosti«, čeprav jih je ob poti
 * veliko. Praznega odziva zato ne štejemo za uspeh.
 *
 * Poštena raba: 10-min predpomnilnik + združevanje hkratnih zahtevkov,
 * skupni 12-sekundni proračun za Overpass (vsi poskusi se po njem prekličejo),
 * POST + opisen User-Agent, brskalnik nikoli ne kliče tujih virov neposredno.
 * Če OSRM odpove, uporabimo premico med postanki — predlogi ostanejo smiselni.
 *
 * `?debug=1` doda `overpass` z izidom vsakega zrcala (status, število zadetkov,
 * milisekunde) — diagnostika degradiranega načina brez odpiranja logov.
 */

export const dynamic = 'force-dynamic';
/** Overpass zrcala v produkciji odgovarjajo v ~3–12 s; privzetih 10 s funkcije ni dovolj. */
export const maxDuration = 25;

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 30;
const OSRM_TIMEOUT_MS = 5_000;
const OVERPASS_BUDGET_MS = OVERPASS_DEFAULT_BUDGET_MS;
const MAX_STOPS = 8;

interface CacheEntry {
  pois: RoutePoi[];
  routePoints: number;
  radiusKm: number;
  osmCount: number;
  catalogCount: number;
  degraded: boolean;
  /** Mirno obvestilo za UI (ne napaka), ko živi vir ni dosegljiv. */
  error?: string;
  /** Izid poskusov na posameznih zrcalih (samo za `?debug=1`). */
  overpassAttempts: OverpassAttempt[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

function cacheSet(key: string, entry: Omit<CacheEntry, 'expiresAt'>): CacheEntry {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  const full: CacheEntry = { ...entry, expiresAt: Date.now() + CACHE_TTL_MS };
  cache.set(key, full);
  return full;
}

function payload(entry: CacheEntry, debug = false) {
  return {
    ok: true,
    pois: entry.pois,
    routePoints: entry.routePoints,
    radiusKm: entry.radiusKm,
    osmCount: entry.osmCount,
    catalogCount: entry.catalogCount,
    degraded: entry.degraded,
    error: entry.error,
    ...(debug ? { overpass: entry.overpassAttempts } : {}),
  };
}

/**
 * Za razliko od /api/osrm/route dovolimo tudi ENO postanko: tri od petih
 * regij vodiča imajo en sam cilj (Ljubljana, Maribor, Dravograd), zato
 * tedaj iščemo »v okolici« z večjim polmerom, ne pa »ob poti«.
 */
function parseStops(raw: string | null): { stops: OsrmWaypoint[] } | { error: string } {
  if (!raw || raw.trim().length === 0) {
    return { error: 'Manjka parameter stops (zapis: lat,lng[;lat,lng]).' };
  }
  const parts = raw.split(';');
  if (parts.length > MAX_STOPS) return { error: `Največ ${MAX_STOPS} postankov na zahtevo.` };
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
  if (stops.length === 0) return { error: 'Pot potrebuje vsaj eno postanko.' };
  return { stops };
}

/** OSRM geometrija ali premična rezerva med postanki. */
async function routeCoords(stops: OsrmWaypoint[]): Promise<LatLng[]> {
  const fallback = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  if (stops.length < 2) return fallback;
  try {
    const response = await fetch(osrmRouteUrl(stops), {
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    const parsed = parseOsrmRoute(await response.json());
    if (parsed && parsed.coords.length > 1) {
      return parsed.coords.map(([lat, lng]) => ({ lat, lng }));
    }
  } catch {
    // padec na premico — predlogi so še vedno uporabni
  }
  return fallback;
}

function finish(
  key: string,
  pois: RoutePoi[],
  routePoints: number,
  radiusKm: number,
  osmLive: boolean,
  overpassAttempts: OverpassAttempt[] = [],
): CacheEntry {
  const osmCount = pois.filter((p) => p.source === 'osm').length;
  const catalogCount = pois.length - osmCount;
  const error = !osmLive
    ? 'OpenStreetMap trenutno ni dosegljiv — prikazan je urejeni izbor slovenskih znamenitosti.'
    : pois.length === 0
      ? 'V bližini poti ni najdenih zanimivosti. Poskusi drugo regijo.'
      : undefined;
  return cacheSet(key, {
    pois,
    routePoints,
    radiusKm,
    osmCount,
    catalogCount,
    degraded: !osmLive,
    error,
    overpassAttempts,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseStops(url.searchParams.get('stops'));
  if ('error' in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const { stops } = parsed;

  // Ena postanka = »okolica« (12 km); dve ali več = »ob poti« (3 km).
  const radiusRaw = url.searchParams.get('radius');
  const maxRaw = url.searchParams.get('max');
  const radiusKm = clampRadiusKm(
    radiusRaw === null ? (stops.length === 1 ? 12 : 3) : Number(radiusRaw),
  );
  const max = clampPoiMax(maxRaw === null ? 6 : Number(maxRaw));
  const debug = url.searchParams.get('debug') === '1';
  const key = `${stops.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join(';')}|${radiusKm}|${max}`;

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return NextResponse.json(payload(hit, debug));
  const pending = inFlight.get(key);
  if (pending) return NextResponse.json(payload(await pending, debug));

  const task = (async (): Promise<CacheEntry> => {
    const coords = await routeCoords(stops);
    const bbox = bboxForRoute(coords, radiusKm + 1);
    if (!bbox) {
      return finish(key, [], coords.length, radiusKm, false);
    }

    const race = await raceOverpass(
      overpassPoiQuery(bbox),
      (raw) => parseOverpassPois(raw).length,
      { budgetMs: OVERPASS_BUDGET_MS },
    );
    const osm = race.result ? selectPoisAlongRoute(race.result.raw, coords, { radiusKm, max }) : [];
    const catalog = selectCatalogPois(coords, { radiusKm, max });
    const pois = mergePois(osm, catalog, max);
    return finish(key, pois, coords.length, radiusKm, race.result !== null, race.attempts);
  })();

  inFlight.set(key, task);
  try {
    return NextResponse.json(payload(await task, debug));
  } finally {
    inFlight.delete(key);
  }
}
