/**
 * STAYS SERVICE (bun) — iskanje prenočišč + zastopne fotografije.
 *
 * ZAKAJ OBSTAJA (izmerjeno v peskovniku; isti razlog kot route-service 3031):
 *   Node fetch (Next.js strežnik) → nominatim/overpass = fetch failed
 *   bun fetch → isti gostitelji = HTTP 200
 *   → peskovnik filtrira odhodne povezave procesa Node za te gostitelje.
 * Next posrednika (/api/stays/search, /api/stays/photo) zato ob neuspehu
 * padata na to storitev (http://127.0.0.1:3032/...). V produkciji padanje
 * ni potrebno — direktni klici delujejo.
 *
 * Viri (poštena raba): Nominatim (User-Agent obvezen, ≤ 1/s), Overpass
 * (≤ 2 sočasne), z-ai image-search CLI (zastopne fotografije).
 * Predpomnilnik: iskanje 10 min / 30, fotografije 12 h / 100.
 *
 * GET /stays/search?q=Skopje
 *   → { ok:true, place:{name,lat,lng}, stays:[…] } | { ok:false, error, notFound? }
 * GET /stays/photo?name=…&city=…
 *   → { ok:true, photos:[url…] } | { ok:false, photos:[] }
 */

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
} from '../../src/lib/stays';

const PORT = 3032;
const USER_AGENT = 'discover-slovenia-ai-demo/0.2 (slovenian travel guide; fair-use demo)';
const UPSTREAM_TIMEOUT_MS = 20_000;
const SEARCH_TTL_MS = 10 * 60 * 1000;
const SEARCH_MAX = 30;
const PHOTO_TTL_MS = 12 * 60 * 60 * 1000;
const PHOTO_NEG_TTL_MS = 5 * 60 * 1000;
const PHOTO_MAX = 100;
const PHOTO_COUNT = 2;

interface SearchPayload {
  place: { name: string; lat: number; lng: number };
  stays: StayResult[];
}

const searchCache = new Map<string, { value: SearchPayload; expiresAt: number }>();
const searchInFlight = new Map<string, Promise<SearchPayload>>();
const photoCache = new Map<string, { value: { ok: boolean; photos: string[] }; expiresAt: number }>();
const photoInFlight = new Map<string, Promise<{ ok: boolean; photos: string[] }>>();

function cacheGet<T>(map: Map<string, { value: T; expiresAt: number }>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet<T>(map: Map<string, { value: T; expiresAt: number }>, key: string, value: T, max: number, ttl: number): void {
  if (map.size >= max) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, { value, expiresAt: Date.now() + ttl });
}

function parseQuery(raw: string | null, max: number): string | null {
  const q = (raw ?? '').trim();
  if (q.length === 0 || q.length > max) return null;
  return q;
}

async function searchUpstream(q: string, kinds: readonly StayKind[]): Promise<SearchPayload> {
  const geoRes = await fetch(nominatimSearchUrl(q), {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!geoRes.ok) throw new Error(`Nominatim HTTP ${geoRes.status}`);
  const place = parseNominatimPlace(await geoRes.json());
  if (!place) throw new Error(`Kraja "${q}" ni bilo mogoče najti.`);

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
      if (!ovRes.ok) throw new Error(`Overpass HTTP ${ovRes.status}`);
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
  const cached = cacheGet(searchCache, key);
  if (cached) return cached;
  const pending = searchInFlight.get(key);
  if (pending) return pending;
  const task = searchUpstream(q, kinds);
  searchInFlight.set(key, task);
  try {
    const value = await task;
    if (value.stays.length > 0) cacheSet(searchCache, key, value, SEARCH_MAX, SEARCH_TTL_MS); // praznih ne predpomnimo
    return value;
  } finally {
    searchInFlight.delete(key);
  }
}

/** Zastopne fotografije prek z-ai image-search CLI (iskalnica slik). */
async function photosUpstream(query: string): Promise<{ ok: boolean; photos: string[] }> {
  try {
    const proc = Bun.spawn(
      ['z-ai', 'image-search', '--query', query, '--count', String(PHOTO_COUNT), '--gl', 'us', '--no-rank'],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const timer = setTimeout(() => proc.kill(), 120_000);
    try {
      const exit = await proc.exited;
      if (exit !== 0) return { ok: false, photos: [] };
      const stdout = await new Response(proc.stdout).text();
      // CLI izpiše napredkove vrstice (🚀🔎✅) PRED JSON-om → odžviči do prvega `{`
      const jsonStart = stdout.indexOf('{');
      if (jsonStart < 0) return { ok: false, photos: [] };
      const parsed = JSON.parse(stdout.slice(jsonStart)) as { success?: unknown; results?: unknown };
      if (parsed.success !== true || !Array.isArray(parsed.results)) return { ok: false, photos: [] };
      const photos = parsed.results
        .map((r) => (r && typeof r === 'object' ? (r as { original_url?: unknown }).original_url : null))
        .filter((u): u is string => typeof u === 'string' && u.startsWith('https://'))
        .slice(0, PHOTO_COUNT);
      return photos.length > 0 ? { ok: true, photos } : { ok: false, photos: [] };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { ok: false, photos: [] };
  }
}

async function photosWithCache(key: string, query: string): Promise<{ ok: boolean; photos: string[] }> {
  const cached = cacheGet(photoCache, key);
  if (cached) return cached;
  const pending = photoInFlight.get(key);
  if (pending) return pending;
  const task = photosUpstream(query);
  photoInFlight.set(key, task);
  try {
    const value = await task;
    // neuspeh kratko predpomnimo, da ne stresamo vira ob vsakem kliku
    cacheSet(photoCache, key, value, PHOTO_MAX, value.ok ? PHOTO_TTL_MS : PHOTO_NEG_TTL_MS);
    return value;
  } finally {
    photoInFlight.delete(key);
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const cors = {
      'access-control-allow-origin': '*',
      'content-type': 'application/json; charset=utf-8',
    };
    try {
      if (url.pathname === '/stays/search') {
        const q = parseQuery(url.searchParams.get('q'), 80);
        if (!q) {
          return new Response(JSON.stringify({ ok: false, error: 'Manjka/neveljavno iskalno besedilo.' }), { status: 400, headers: cors });
        }
        const kinds = parseStayKindsParam(url.searchParams.get('kinds')) ?? STAY_KINDS;
        const payload = await searchWithCache(`${q.toLowerCase()}|${kinds.join(',')}`, q, kinds);
        return new Response(JSON.stringify({ ok: true, ...payload }), { headers: cors });
      }
      if (url.pathname === '/stays/photo') {
        const name = parseQuery(url.searchParams.get('name'), 120);
        const city = parseQuery(url.searchParams.get('city'), 80);
        if (!name) {
          return new Response(JSON.stringify({ ok: false, photos: [] }), { status: 400, headers: cors });
        }
        const photos = await photosWithCache(`${name} ${city ?? ''}`.toLowerCase(), `${name} ${city ?? ''} hotel building`.trim());
        return new Response(JSON.stringify(photos), { headers: cors });
      }
      return new Response(JSON.stringify({ ok: false, error: 'Neznana pot.' }), { status: 404, headers: cors });
    } catch (err) {
      const chain: string[] = [];
      let cur: unknown = err;
      while (cur instanceof Error) {
        chain.push(`${cur.name}: ${cur.message}${(cur as Error & { code?: string }).code ? ` [${(cur as Error & { code?: string }).code}]` : ''}`);
        cur = (cur as Error).cause;
      }
      console.error(`[stays-service] napaka: ${chain.join(' ← ')}`);
      const message = err instanceof Error ? err.message : 'neznan odziv vira';
      const notFound = message.includes('ni bilo mogoče najti');
      return new Response(JSON.stringify({ ok: false, error: message, notFound }), { status: 200, headers: cors });
    }
  },
});

console.log(`stays-service: poslušam na http://127.0.0.1:${PORT} (search + photo)`);
