import { NextResponse } from 'next/server';
import {
  STAY_KINDS,
  nominatimSearchUrl,
  overpassStayUrls,
  parseNominatimPlace,
  parsePhotonStays,
  parseStayKindsParam,
  parseStayResults,
  photonStayUrl,
  type StayKind,
  type StayResult,
} from '@/lib/stays';

/**
 * Iskanje prenočišč — strežniški posrednik (Nominatim + Overpass).
 *
 * Zakaj posrednik: poštene rabe javnih OSM virov (Nominatim zahteva
 * User-Agent + ≤ 1 zahteva/s; Overpass ≤ 2 sočasne) → predpomnilnik
 * (10 min, 30 krajev) + združevanje hkratnih identičnih zahtevkov.
 * Pokritost: ves svet (Overpass je globalen) — Skopje deluje enako kot Bled.
 *
 * GET /api/stays/search?q=Skopje
 *   → 200 { ok:true, place:{name,lat,lng}, stays:[StayResult…] }
 *   → 400 { ok:false, error } (prazno/neveljavno iskalno besedilo)
 *   → 404 { ok:false, error } (kraj ni najden)
 *   → 502 { ok:false, error } (vir nedosegljiv)
 */

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 30;
const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_QUERY_LEN = 80;
const USER_AGENT =
  'discover-slovenia-ai-demo/0.2 (slovenian travel guide; fair-use demo)';

interface SearchPayload {
  place: { name: string; lat: number; lng: number };
  stays: StayResult[];
}

const searchCache = new Map<string, { value: SearchPayload; expiresAt: number }>();
const inFlight = new Map<string, Promise<SearchPayload>>();

function cacheGet(key: string): SearchPayload | null {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: SearchPayload): void {
  if (searchCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = searchCache.keys().next().value;
    if (oldest !== undefined) searchCache.delete(oldest);
  }
  searchCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Razčleni iskalno besedilo (neprazno, omejeno) ali napaka (slovensko). */
export function parseSearchQuery(raw: string | null): { q: string } | { error: string } {
  const q = (raw ?? '').trim();
  if (q.length === 0) return { error: 'Manjka iskalno besedilo (npr. ?q=Skopje).' };
  if (q.length > MAX_QUERY_LEN) return { error: `Iskalno besedilo je predolgo (največ ${MAX_QUERY_LEN} znakov).` };
  return { q };
}

async function searchUpstream(q: string, kinds: readonly StayKind[]): Promise<SearchPayload> {
  // 1) Geokodiranje kraja (Nominatim — User-Agent je OBVEZEN po pravilih)
  const geoRes = await fetch(nominatimSearchUrl(q), {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!geoRes.ok) throw new Error(`Nominatim odgovoril HTTP ${geoRes.status}`);
  const place = parseNominatimPlace(await geoRes.json());
  if (!place) {
    const notFound = new Error(`Kraja "${q}" ni bilo mogoče najti.`);
    notFound.name = 'NotFound';
    throw notFound;
  }

  // 2) Prenočišča v bbox kraja — Overpass zrcale po vrsti (failover);
  //    če vse odpove → Photon (Komoot) rezerva (izmerjeno v peskovniku)
  let stays: StayResult[] = [];
  let lastErr: unknown = null;
  for (const url of overpassStayUrls(...place.bbox, kinds)) {
    try {
      const ovRes = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!ovRes.ok) throw new Error(`Overpass odgovoril HTTP ${ovRes.status}`);
      const parsed = parseStayResults(await ovRes.json());
      if (parsed.length > 0) {
        stays = parsed;
        lastErr = null;
        break;
      }
      lastErr = new Error('Overpass brez zadetkov');
    } catch (e) {
      lastErr = e;
    }
  }
  if (stays.length === 0) {
    try {
      const phRes = await fetch(photonStayUrl(place.name, kinds), {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (phRes.ok) stays = parsePhotonStays(await phRes.json());
    } catch {
      /* rezerva ne uspe → ostane lastErr */
    }
  }
  if (lastErr && stays.length === 0) throw lastErr;

  return { place: { name: place.name, lat: place.lat, lng: place.lng }, stays };
}

async function searchWithCache(key: string, q: string, kinds: readonly StayKind[]): Promise<SearchPayload> {
  const cached = cacheGet(key);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = searchUpstream(q, kinds);
  inFlight.set(key, task);
  try {
    const value = await task;
    if (value.stays.length > 0) cacheSet(key, value); // praznih ne predpomnimo (viri so včasih trenutno utišani)
    return value;
  } finally {
    inFlight.delete(key);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchQuery(url.searchParams.get('q'));
  if ('error' in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  // kinds filter (npr. ?kinds=apartment) — neveljavne vrednosti → vse vrste
  const kinds = parseStayKindsParam(url.searchParams.get('kinds')) ?? STAY_KINDS;
  const key = `${parsed.q.toLowerCase()}|${kinds.join(',')}`;
  try {
    const payload = await searchWithCache(key, parsed.q, kinds);
    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFound') {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : 'neznan odziv vira';
    return NextResponse.json(
      { ok: false, error: `Iskanje trenutno ni na voljo (${message}). Poskusi znova.` },
      { status: 502 },
    );
  }
}
