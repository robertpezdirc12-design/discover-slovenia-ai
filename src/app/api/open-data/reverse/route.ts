import { NextResponse } from 'next/server';
import { fetchReverseChain } from '@/lib/open-data-upstream';
import { isValidReversePlace } from '@/lib/open-data-server';
import type { ReversePlace } from '@/lib/open-data';

/**
 * Obratno geokodiranje ("kaj je tukaj?") — strežniški posrednik (Nominatim).
 *
 * Nominatim zahteva opisni User-Agent + ≤ 1 zahtevo/s (pravila OSMF) — brskalnik
 * NE sme klicati direktno. Predpomnilnik 24 h/200 točk (zaokroženih na 3 decimalke
 * ≈ 100 m). Rezerva: bun storitev 3033. Manjkajoče ime → ok:true, place:null.
 *
 * GET /api/open-data/reverse?lat=46.3683&lng=14.1144
 *   → 200 { ok:true, place:{ name, type } | null }
 *   → 400 { ok:false, error }   (neveljavne koordinate)
 *   → 502 { ok:false, error }   (Nominatim nedosegljiv)
 */

export const dynamic = 'force-dynamic';

const SERVICE_URL = 'http://127.0.0.1:3033/reverse';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const SERVICE_TIMEOUT_MS = 15_000;

type CacheEntry = { value: ReversePlace | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<ReversePlace | null>>();

function cacheGet(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function cacheSet(key: string, value: ReversePlace | null): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function viaService(lat: number, lng: number): Promise<ReversePlace | null> {
  const res = await fetch(`${SERVICE_URL}?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`, {
    signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  const j = (await res.json()) as { ok?: boolean; place?: unknown };
  if (j.ok !== true) throw new Error('open-data-service: obratno geokodiranje ni na voljo');
  return j.place === null ? null : isValidReversePlace(j.place) ? j.place : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (
    url.searchParams.get('lat') === null || url.searchParams.get('lng') === null ||
    !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180
  ) {
    return NextResponse.json(
      { ok: false, error: 'Manjkata/neveljavna koordinati (npr. ?lat=46.3683&lng=14.1144).' },
      { status: 400 },
    );
  }
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json({ ok: true, place: cached.value });

  const pending = inFlight.get(key);
  if (pending) return NextResponse.json({ ok: true, place: await pending });

  const task = (async () => {
    try {
      return await fetchReverseChain(lat, lng);
    } catch (directError) {
      try {
        return await viaService(lat, lng);
      } catch {
        throw directError;
      }
    }
  })();
  inFlight.set(key, task);
  try {
    const place = await task;
    cacheSet(key, place);
    return NextResponse.json({ ok: true, place });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv vira';
    return NextResponse.json(
      { ok: false, error: `Obratno geokodiranje trenutno ni na voljo (${message}).` },
      { status: 502 },
    );
  } finally {
    inFlight.delete(key);
  }
}
