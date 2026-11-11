import { NextResponse } from 'next/server';
import { fetchWeatherChain } from '@/lib/open-data-upstream';
import { parseCoordsParam, isValidWeatherPayload } from '@/lib/open-data-server';
import type { WeatherPayload } from '@/lib/open-data';

/**
 * Vreme + kakovost zraka — strežniški posrednik (odprti podatki, brez ključev).
 *
 * Veriga: Open-Meteo forecast → wttr.in (nativno slovensko) + Open-Meteo AQI
 * (neuspeh zraka NE usodi vremena). Rezerva: bun mini storitev open-data-service
 * (3033 — peskovnik blokira Node fetch k nekaterim gostiteljem; izmerjeno).
 * Poštena raba: predpomnilnik 30 min/120 mest + združevanje identičnih zahtevkov.
 *
 * GET /api/open-data/weather?lat=41.9981&lng=21.4254
 *   → 200 { ok:true, weather:{ source, tempC, feelsC, desc, days:[3], aqi, pm25 } }
 *   → 400 { ok:false, error }   (neveljavne koordinate)
 *   → 502 { ok:false, error }   (vira odpovedala)
 */

export const dynamic = 'force-dynamic';

const SERVICE_URL = 'http://127.0.0.1:3033/weather';
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 120;
const SERVICE_TIMEOUT_MS = 15_000;

type CacheEntry = { value: WeatherPayload; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<WeatherPayload>>();

function cacheGet(key: string): WeatherPayload | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: WeatherPayload): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function viaService(lat: number, lng: number): Promise<WeatherPayload> {
  const res = await fetch(`${SERVICE_URL}?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`, {
    signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  const j = (await res.json()) as { ok?: boolean; weather?: unknown };
  if (!j.ok || !isValidWeatherPayload(j.weather)) throw new Error('open-data-service: brez veljavnega vremena');
  return j.weather;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseCoordsParam(url.searchParams.get('lat'), url.searchParams.get('lng'));
  if ('error' in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const key = `${parsed.lat.toFixed(2)},${parsed.lng.toFixed(2)}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json({ ok: true, weather: cached });

  const pending = inFlight.get(key);
  if (pending) return NextResponse.json({ ok: true, weather: await pending });

  const task = (async () => {
    let direct: WeatherPayload | null = null;
    try {
      direct = await fetchWeatherChain(parsed.lat, parsed.lng);
      if (direct.aqi !== null) return direct; // vreme + zrak kompletna
    } catch {
      /* celotna veriga pade na storitev */
    }
    // storitev (bun) lahko doseže gostitelje, ki jih Node ne — npr. AQI;
    // če tudi ona odpove, vrnemo vsaj direktno vreme (brez zraka)
    try {
      return await viaService(parsed.lat, parsed.lng);
    } catch {
      if (direct) return direct;
      throw new Error('vreme ni na voljo (direktno in prek storitve)');
    }
  })();
  inFlight.set(key, task);
  try {
    const weather = await task;
    cacheSet(key, weather);
    return NextResponse.json({ ok: true, weather });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv vira';
    return NextResponse.json(
      { ok: false, error: `Vreme trenutno ni na voljo (${message}).` },
      { status: 502 },
    );
  } finally {
    inFlight.delete(key);
  }
}
