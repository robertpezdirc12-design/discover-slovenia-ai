import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { clientKey, photoLimiter } from '@/lib/rate-limit';

/**
 * Zastopne fotografije prenočišča — strežniški posrednik za iskalnico slik
 * (z-ai image-search CLI; vmesnik iz skill dokumentacije, backend-only).
 *
 * Poštenost: fotografije so ZASTOPNE (spletna iskalnica, tematsko ujemajoče
 * z imenom + krajem), NISO uradne objektne fotografije — UI to izrecno piše.
 *
 * Izvedba: CLI izpiše napredkove vrstice (🚀🔎✅) na stdout PRED JSON-om →
 * razčlenjevanje odžviči do prvega `{` (izmerjeno). Pot: bun mini storitev
 * (stays-service, 3032 — dokazano deluje v peskovniku) → rezerva direktno
 * prek Node child_process (produkcija, kjer storitev ne teče).
 *
 * Poštena raba: predpomnilnik (12 h, 100 poizvedb; neuspeh 5 min) + združevanje
 * hkratnih enakih zahtevkov. GET /api/stays/photo?name=…&city=…
 *   → 200 { ok:true, photos:[url…] } | { ok:false, photos:[] }
 */

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const NEG_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const CLI_TIMEOUT_MS = 120_000;
const SERVICE_TIMEOUT_MS = 150_000;
const MAX_PHOTOS = 2;
const SERVICE_URL = 'http://127.0.0.1:3032/stays/photo';

type PhotoResult = { ok: boolean; photos: string[] };

const photoCache = new Map<string, { value: PhotoResult; expiresAt: number }>();
const inFlight = new Map<string, Promise<PhotoResult>>();

function cacheGet(key: string): PhotoResult | null {
  const hit = photoCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    photoCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: PhotoResult, ttl: number): void {
  if (photoCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = photoCache.keys().next().value;
    if (oldest !== undefined) photoCache.delete(oldest);
  }
  photoCache.set(key, { value, expiresAt: Date.now() + ttl });
}

/** Počisti vnos (dolžina + kontrola znakov) ali napaka (slovensko). */
export function parsePhotoQuery(
  name: string | null,
  city: string | null,
): { query: string } | { error: string } {
  const n = (name ?? '').trim();
  const c = (city ?? '').trim();
  if (n.length === 0) return { error: 'Manjka ime prenočišča (npr. ?name=…&city=…).' };
  if (n.length > 120 || c.length > 80) return { error: 'Vnos je predolg.' };
  return { query: `${n} ${c} hotel building`.trim() };
}

/** Iz surovega CLI odziva izlušči slike (odžviči napredkove vrstice). */
export function extractPhotoUrls(stdout: string): string[] {
  const jsonStart = stdout.indexOf('{');
  if (jsonStart < 0) return [];
  try {
    const parsed = JSON.parse(stdout.slice(jsonStart)) as { success?: unknown; results?: unknown };
    if (parsed.success !== true || !Array.isArray(parsed.results)) return [];
    return parsed.results
      .map((r) => (r && typeof r === 'object' ? (r as { original_url?: unknown }).original_url : null))
      .filter((u): u is string => typeof u === 'string' && u.startsWith('https://'))
      .slice(0, MAX_PHOTOS);
  } catch {
    return [];
  }
}

async function photosViaService(query: string): Promise<PhotoResult> {
  const response = await fetch(`${SERVICE_URL}?name=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  const j = (await response.json()) as { ok?: unknown; photos?: unknown };
  if (j.ok === true && Array.isArray(j.photos)) {
    const photos = j.photos.filter((u): u is string => typeof u === 'string' && u.startsWith('https://')).slice(0, MAX_PHOTOS);
    return photos.length > 0 ? { ok: true, photos } : { ok: false, photos: [] };
  }
  return { ok: false, photos: [] };
}

/** Rezerva: direktni CLI klic prek Node child_process (kjer storitev ne teče). */
function photosViaCli(query: string): Promise<PhotoResult> {
  const execFileAsync = promisify(execFile);
  return execFileAsync(
    'z-ai',
    ['image-search', '--query', query, '--count', String(MAX_PHOTOS), '--gl', 'us', '--no-rank'],
    { timeout: CLI_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
  )
    .then(({ stdout }) => {
      const photos = extractPhotoUrls(stdout);
      return photos.length > 0 ? { ok: true, photos } : { ok: false, photos: [] };
    })
    .catch(() => ({ ok: false, photos: [] }));
}

async function photosWithCache(key: string, query: string): Promise<PhotoResult> {
  const cached = cacheGet(key);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = (async () => {
    try {
      return await photosViaService(query);
    } catch {
      return photosViaCli(query);
    }
  })();
  inFlight.set(key, task);
  try {
    const value = await task;
    // neuspeh kratko predpomnimo, da ne stresamo vira ob vsakem kliku
    cacheSet(key, value, value.ok ? CACHE_TTL_MS : NEG_TTL_MS);
    return value;
  } finally {
    inFlight.delete(key);
  }
}

export async function GET(request: Request) {
  const limit = photoLimiter(clientKey(request));
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, photos: [], error: 'Preveč iskanj fotografij v kratkem času.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const parsed = parsePhotoQuery(url.searchParams.get('name'), url.searchParams.get('city'));
  if ('error' in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const key = parsed.query.toLowerCase();
  try {
    const result = await photosWithCache(key, parsed.query);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, photos: [] }, { status: 200 });
  }
}
