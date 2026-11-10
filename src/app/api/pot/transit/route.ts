import { NextResponse } from 'next/server';
import {
  buildTransitUrl,
  parseTransitResponse,
  type TransitMode,
} from '@/lib/public-transport';

interface UpstreamStop {
  id: string;
  gtfs_id: string | null;
  name: string;
  lat: number;
  lon: number;
  type: string;
}

interface StopLookup {
  stop: UpstreamStop | null;
  distanceKm: number;
}

/**
 * GET /api/pot/transit?from=lat,lng&to=lat,lng&mode=BUS
 *
 * Posrednik do Brezavta.si backend-a (OJPP): klient ne kliče tretje stranke
 * neposredno (ni CORS težav, ena točka napak). Vrne samo razčlenjene
 * načrte (brez surovih stranskih podatkov). Časovna omejitev kot pri
 * Overpass: 15 s, drugače prijazna slovenska napaka.
 */

const UPSTREAM = 'https://api.beta.brezavta.si';
const TIMEOUT_MS = 15000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const MODES: readonly TransitMode[] = ['BUS', 'TRAIN', 'BUS,TRAIN'];

/** Največja razdalja do postaje (prosto stoječe točke pogosto nimajo postaje). */
const MAX_STOP_DISTANCE_KM = 8;

/** Predpomnilnik seznama postaj (en nalaganj na cold start). */
let stopsCachePromise: Promise<readonly UpstreamStop[]> | null = null;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function fetchStops(): Promise<readonly UpstreamStop[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${UPSTREAM}/stops/`, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) return [];
    const out: UpstreamStop[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const lat = typeof o.lat === 'number' ? o.lat : NaN;
      const lon = typeof o.lon === 'number' ? o.lon : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      out.push({
        id: typeof o.id === 'string' ? o.id : '',
        gtfs_id: typeof o.gtfs_id === 'string' ? o.gtfs_id : null,
        name: typeof o.name === 'string' ? o.name : '',
        lat,
        lon,
        type: typeof o.type === 'string' ? o.type : '',
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function getStops(): Promise<readonly UpstreamStop[]> {
  if (!stopsCachePromise) stopsCachePromise = fetchStops();
  return stopsCachePromise;
}

/** Najbližja postaja za točko; če je predaleč, null (uporabimo prvotno točko). */
async function nearestStop(point: { lat: number; lng: number }): Promise<StopLookup> {
  const stops = await getStops();
  if (stops.length === 0) return { stop: null, distanceKm: Infinity };
  let best: UpstreamStop | null = null;
  let bestKm = Infinity;
  for (const s of stops) {
    const km = haversineKm(point, s);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  if (!best || bestKm > MAX_STOP_DISTANCE_KM) return { stop: null, distanceKm: bestKm };
  return { stop: best, distanceKm: bestKm };
}

function parseCoord(raw: string): { lat: number; lng: number } | null {
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');
  const modeRaw = (url.searchParams.get('mode') ?? 'BUS').toUpperCase();

  const from = fromRaw ? parseCoord(fromRaw) : null;
  const to = toRaw ? parseCoord(toRaw) : null;
  const mode = MODES.includes(modeRaw as TransitMode) ? (modeRaw as TransitMode) : null;

  if (!from || !to) {
    return NextResponse.json(
      { ok: false, error: 'Manjka parameter from/to (zapis: lat,lng).' },
      { status: 400 },
    );
  }
  if (!mode) {
    return NextResponse.json(
      { ok: false, error: 'Neveljaven način prevoza (BUS | TRAIN | BUS,TRAIN).' },
      { status: 400 },
    );
  }

  // Načrtuj do NAJBLIŽJE postaje (zahteve na prosto stoječe točke pogosto
  // vrnejo prazen odziv; postaja da tudi pravo ime v povzetku).
  const lookup = await nearestStop(to);
  const dest = lookup.stop ? { lat: lookup.stop.lat, lng: lookup.stop.lon } : to;
  const destName = lookup.stop ? lookup.stop.name : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstreamUrl = buildTransitUrl(UPSTREAM, mode, from, dest);
    const res = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: 'Vir javnega prevoza trenutno ni dosegljiv, poskusi znova.' },
        { status: 502 },
      );
    }
    const bodyText = await res.text();
    if (!bodyText.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Za to relacijo trenutno ni povezav z javnim prevozom.' },
        { status: 200 },
      );
    }
    let parsed: ReturnType<typeof parseTransitResponse>;
    try {
      parsed = parseTransitResponse(JSON.parse(bodyText));
    } catch {
      parsed = null;
    }
    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: 'Vir javnega prevoza ni vrnil načrtov.' },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, ...parsed, destName, waitDistanceKm: lookup.distanceKm });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      {
        ok: false,
        error: aborted ? 'Vir javnega prevoza je presegel časovno omejitev.' : 'Napaka pri poizvedbi javnega prevoza.',
      },
      { status: 504 },
    );
  } finally {
    clearTimeout(timer);
  }
}
