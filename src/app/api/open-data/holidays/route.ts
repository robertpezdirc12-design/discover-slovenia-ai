import { NextResponse } from 'next/server';
import { fetchHolidaysChain } from '@/lib/open-data-upstream';
import { parseCountryParam, isValidHolidays } from '@/lib/open-data-server';
import type { Holiday } from '@/lib/open-data';

/**
 * Naslednji javni prazniki države — strežniški posrednik (Nager.Date, brez ključev).
 *
 * Podprto: SI HR BA RS ME MK AL (živo 200); Kosovo (XK) NI podprto (500 — izmerjeno,
 * pošteno izpuščeno). Predpomnilnik 12 h/40 držav. Rezerva: bun storitev 3033.
 *
 * GET /api/open-data/holidays?country=SI
 *   → 200 { ok:true, holidays:[{ date:'2026-10-31', localName:'dan reformacije' } …] }
 *   → 400 { ok:false, error }   (neveljavna država)
 *   → 502 { ok:false, error }   (vir nedosegljiv / država ni podprta)
 */

export const dynamic = 'force-dynamic';

const SERVICE_URL = 'http://127.0.0.1:3033/holidays';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 40;
const SERVICE_TIMEOUT_MS = 15_000;

type CacheEntry = { value: Holiday[]; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Holiday[]>>();

function cacheGet(key: string): Holiday[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: Holiday[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function viaService(country: string): Promise<Holiday[]> {
  const res = await fetch(`${SERVICE_URL}?country=${country}`, {
    signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  const j = (await res.json()) as { ok?: boolean; holidays?: unknown };
  if (!j.ok || !isValidHolidays(j.holidays)) throw new Error('open-data-service: brez praznikov');
  return j.holidays;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseCountryParam(url.searchParams.get('country'));
  if ('error' in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const country = parsed.country;
  const cached = cacheGet(country);
  if (cached) return NextResponse.json({ ok: true, holidays: cached });

  const pending = inFlight.get(country);
  if (pending) return NextResponse.json({ ok: true, holidays: await pending });

  const task = (async () => {
    try {
      return await fetchHolidaysChain(country);
    } catch (directError) {
      try {
        return await viaService(country);
      } catch {
        throw directError;
      }
    }
  })();
  inFlight.set(country, task);
  try {
    const holidays = await task;
    cacheSet(country, holidays);
    return NextResponse.json({ ok: true, holidays });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv vira';
    return NextResponse.json(
      { ok: false, error: `Prazniki trenutno niso na voljo (${message}).` },
      { status: 502 },
    );
  } finally {
    inFlight.delete(country);
  }
}
