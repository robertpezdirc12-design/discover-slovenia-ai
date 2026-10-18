/**
 * OPEN DATA SERVICE (bun, 3033) — vsi viri, ki delujejo BREZ poverilnic.
 *
 * ZAKAJ OBSTAJA (isti vzorec kot route-service 3031 / stays-service 3032):
 *   Node fetch (Next.js strežnik) → nekateri gostitelji = fetch failed,
 *   bun fetch → isti gostitelji = HTTP 200 → peskovnik filtrira odhodne
 *   povezave procesa Node. Next posredniki (/api/open-data/*) zato ob
 *   neuspehu padata sem. V produkciji direktni klici delujejo.
 *
 * Viri (vsi brez ključev, poštena raba, živo izmerjeni 18. 10. 2026):
 *  • /weather   Open-Meteo forecast → rezerva wttr.in (lang=sl) + Open-Meteo AQI
 *               (peskovnik: forecast dnevna kvota 429 → wttr.in 200; AQI 200)
 *  • /wiki      Wikipedia REST summary (opisni User-Agent OBVEZEN — brez njega 403)
 *  • /rates     open.er-api.com (RSD/MKD/ALL/BAM) → rezerva currency-api (jsDelivr)
 *  • /holidays  date.nager.at NextPublicHolidays (SI/HR/BA/RS/ME/MK/AL; XK=500)
 *  • /reverse   Nominatim reverse (User-Agent pravila kot iskanje)
 *
 * Predpomnilnik: vreme 30 min/120, wiki 24 h/200, tečaji 6 h,
 * prazniki 12 h/40, reverse 24 h/200.
 */

import {
  fetchHolidaysChain,
  fetchRatesChain,
  fetchReverseChain,
  fetchWeatherChain,
  fetchWikiChain,
} from '../../src/lib/open-data-upstream';
import type { Holiday, ReversePlace, WeatherPayload, WikiSummary } from '../../src/lib/open-data';

const PORT = 3033;
const NEG_TTL_MS = 5 * 60 * 1000;
const WEATHER_TTL_MS = 30 * 60 * 1000;
const WEATHER_MAX = 120;
const WIKI_TTL_MS = 24 * 60 * 60 * 1000;
const WIKI_MAX = 200;
const RATES_TTL_MS = 6 * 60 * 60 * 1000;
const HOLIDAYS_TTL_MS = 12 * 60 * 60 * 1000;
const HOLIDAYS_MAX = 40;
const REVERSE_TTL_MS = 24 * 60 * 60 * 1000;
const REVERSE_MAX = 200;

type CacheEntry<T> = { value: T; expiresAt: number };
function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    map.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, max: number, ttl: number): void {
  if (map.size >= max) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, { value, expiresAt: Date.now() + ttl });
}

const weatherCache = new Map<string, CacheEntry<WeatherPayload>>();
const weatherInFlight = new Map<string, Promise<WeatherPayload>>();
const wikiCache = new Map<string, CacheEntry<WikiSummary | null>>();
const wikiInFlight = new Map<string, Promise<WikiSummary | null>>();
const ratesCache = new Map<string, CacheEntry<Record<string, number>>>();
const ratesInFlight = new Map<string, Promise<Record<string, number>>>();
const holidaysCache = new Map<string, CacheEntry<Holiday[]>>();
const holidaysInFlight = new Map<string, Promise<Holiday[]>>();
const reverseCache = new Map<string, CacheEntry<ReversePlace | null>>();
const reverseInFlight = new Map<string, Promise<ReversePlace | null>>();

function validCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180;
}

async function withCache<T>(
  cache: Map<string, CacheEntry<T>>,
  inflight: Map<string, Promise<T>>,
  key: string,
  max: number,
  okTtl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = cacheGet(cache, key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;
  const task = fetcher();
  inflight.set(key, task);
  try {
    const value = await task;
    cacheSet(cache, key, value, max, okTtl);
    return value;
  } finally {
    inflight.delete(key);
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
    const bad = (message: string, status = 400) =>
      new Response(JSON.stringify({ ok: false, error: message }), { status, headers: cors });

    try {
      if (url.pathname === '/weather') {
        const lat = Number(url.searchParams.get('lat'));
        const lng = Number(url.searchParams.get('lng'));
        if (!validCoords(lat, lng)) return bad('Manjkata/neveljavna koordinati (lat, lng).');
        const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
        const hit = cacheGet(weatherCache, key);
        if (hit) return new Response(JSON.stringify({ ok: true, weather: hit }), { headers: cors });
        try {
          const weather = await withCache(weatherCache, weatherInFlight, key, WEATHER_MAX, WEATHER_TTL_MS, () =>
            fetchWeatherChain(lat, lng),
          );
          return new Response(JSON.stringify({ ok: true, weather }), { headers: cors });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'vreme ni na voljo' }),
            { status: 200, headers: cors },
          );
        }
      }

      if (url.pathname === '/wiki') {
        const title = (url.searchParams.get('title') ?? '').trim();
        const lang = (url.searchParams.get('lang') ?? 'sl').trim().toLowerCase();
        if (title.length === 0 || title.length > 120 || !/^[a-z]{2,3}$/.test(lang)) {
          return bad('Manjka/neveljaven naslov ali jezik.');
        }
        const key = `${lang}:${title.toLowerCase()}`;
        const hit = cacheGet(wikiCache, key);
        if (hit !== null) return new Response(JSON.stringify({ ok: true, wiki: hit }), { headers: cors });
        try {
          const wiki = await withCache(wikiCache, wikiInFlight, key, WIKI_MAX, WIKI_TTL_MS, () =>
            fetchWikiChain(title, lang),
          );
          // wiki === null pomeni "članka ni" (negativno predpomnjeno enako kot ostalo)
          return new Response(JSON.stringify({ ok: true, wiki }), { headers: cors });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'wikipedia ni dosegljiva' }),
            { status: 200, headers: cors },
          );
        }
      }

      if (url.pathname === '/rates') {
        const hit = cacheGet(ratesCache, 'EUR');
        if (hit) return new Response(JSON.stringify({ ok: true, base: 'EUR', rates: hit }), { headers: cors });
        try {
          const rates = await withCache(ratesCache, ratesInFlight, 'EUR', 4, RATES_TTL_MS, fetchRatesChain);
          return new Response(JSON.stringify({ ok: true, base: 'EUR', rates }), { headers: cors });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'tečaji niso na voljo' }),
            { status: 200, headers: cors },
          );
        }
      }

      if (url.pathname === '/holidays') {
        const country = (url.searchParams.get('country') ?? '').trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(country)) return bad('Manjka/neveljavna država (ISO-3166, npr. SI).');
        const hit = cacheGet(holidaysCache, country);
        if (hit) return new Response(JSON.stringify({ ok: true, holidays: hit }), { headers: cors });
        try {
          const holidays = await withCache(holidaysCache, holidaysInFlight, country, HOLIDAYS_MAX, HOLIDAYS_TTL_MS, () =>
            fetchHolidaysChain(country),
          );
          return new Response(JSON.stringify({ ok: true, holidays }), { headers: cors });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'prazniki niso na voljo' }),
            { status: 200, headers: cors },
          );
        }
      }

      if (url.pathname === '/reverse') {
        const lat = Number(url.searchParams.get('lat'));
        const lng = Number(url.searchParams.get('lng'));
        if (!validCoords(lat, lng)) return bad('Manjkata/neveljavna koordinati (lat, lng).');
        const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
        const hit = cacheGet(reverseCache, key);
        if (hit !== null) return new Response(JSON.stringify({ ok: true, place: hit }), { headers: cors });
        try {
          const place = await withCache(reverseCache, reverseInFlight, key, REVERSE_MAX, REVERSE_TTL_MS, () =>
            fetchReverseChain(lat, lng),
          );
          return new Response(JSON.stringify({ ok: true, place }), { headers: cors });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'obratno geokodiranje ni na voljo' }),
            { status: 200, headers: cors },
          );
        }
      }

      return bad('Neznana pot.', 404);
    } catch (err) {
      console.error(`[open-data-service] napaka: ${err instanceof Error ? err.message : err}`);
      return new Response(JSON.stringify({ ok: false, error: 'notranja napaka storitve' }), { status: 200, headers: cors });
    }
  },
});

console.log(`open-data-service: poslušam na http://127.0.0.1:${PORT} (weather · wiki · rates · holidays · reverse)`);
