import { NextResponse } from "next/server";

import {
  cacheKeyFor,
  mapUpstreamDaily,
  parseWeatherParams,
  type WeatherDailyResponse,
  type WeatherResponse,
} from "@/lib/weather";

export const dynamic = "force-dynamic";

/**
 * /api/weather — GET ?lat&lng[&daily=1]: proxy na Open-Meteo.
 *   brez daily → TRENUTNO vreme (Go Mode kanon, Faza 3);
 *   daily=1    → DNEVNA napoved 16 dni (P0-E — vreme po dnevih poti).
 *
 * Kanoni FAZE 3 (Task 51-a, rekonstrukcija izvirnika v1.190.0) + P0-E:
 * - ZASEBNOST: 0 persistenc (NIKOLI v bazo); ključ predpomnilnika je
 *   zaokrožen na 2 decimalki, da iz njega ni mogoče rekonstruirati točne lege
 *   (dnevna veja nosi ločen predponjen ključ "d:").
 * - ISKRENOST: ob napaki gorovja (timeout/napačen JSON/HTTP napaka) odgovori
 *   502 fail-closed — VREMENSKIH PODATKOV NIKOLI NE IZMIŠLJAMO; horizont
 *   napovedi omejuje VIR (16 dni) — ne obljubimo več, kot ga ima.
 * - Omejitev: 60 zahtev/min (pomnilniški drseči okvir).
 * - Predpomnilnik: TTL 10 min, največ 200 vnosov (izmet najstarejšega).
 *
 * Čista logika (validacija, ključ, WMO oznake, preslikava daily) živi v
 * src/lib/weather.ts (client-safe) — ta pot ostaja tanka.
 */

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_CURRENT_FIELDS =
  "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation";
/** Dnevna polja (P0-E): WMO koda, min/max temp, padavine + verjetnost. */
const OPEN_METEO_DAILY_FIELDS =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum";
const UPSTREAM_TIMEOUT_MS = 8_000;

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_CAP = 200;

/** Pomnilniški predpomnilnik (0 persistenc): ključ → { potek, odgovor }. */
const cache = new Map<
  string,
  { expiresAt: number; payload: WeatherResponse | WeatherDailyResponse }
>();

/** Globalni drseči okvir omejitve 60 zahtev/min (enostaven števec časov). */
let rateHits: number[] = [];

function takeRateSlot(now: number): boolean {
  while (rateHits.length > 0 && now - rateHits[0] > RATE_WINDOW_MS) rateHits.shift();
  if (rateHits.length >= RATE_LIMIT) return false;
  rateHits.push(now);
  return true;
}

function cacheGet(
  key: string,
  now: number
): WeatherResponse | WeatherDailyResponse | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

function cacheSet(
  key: string,
  payload: WeatherResponse | WeatherDailyResponse,
  now: number
): void {
  cache.delete(key); // osveži mesto v vrstnem redu vmapiravanja
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, payload });
  while (cache.size > CACHE_CAP) {
    const oldest = cache.keys().next().value; // Map ohranja vrstni red vnosa
    if (oldest === undefined) break;
    cache.delete(oldest); // izmet najstarejšega vnosa
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Pretvori odgovor Open-Meteo v kanonsko obliko (camelCase, zaokroženo na
 * 1 decimalko). Vrača null, kadar gorovje ni vrnilo pričakovane oblike —
 * klicatelj tedaj odgovori 502 (fail-closed, brez izmišljanja).
 */
function mapUpstreamCurrent(data: unknown, fetchedAt: string): WeatherResponse | null {
  if (typeof data !== "object" || data === null) return null;
  const root = data as Record<string, unknown>;
  const cur = root.current;
  if (typeof cur !== "object" || cur === null) return null;
  const c = cur as Record<string, unknown>;
  const time = c.time;
  const temperatureC = c.temperature_2m;
  const apparentC = c.apparent_temperature;
  const weatherCode = c.weather_code;
  const windKmh = c.wind_speed_10m;
  const precipitationMm = c.precipitation;
  if (
    typeof time !== "string" ||
    time === "" ||
    !isFiniteNumber(temperatureC) ||
    !isFiniteNumber(apparentC) ||
    !isFiniteNumber(weatherCode) ||
    !isFiniteNumber(windKmh) ||
    !isFiniteNumber(precipitationMm)
  ) {
    return null;
  }
  return {
    ok: true,
    source: "open-meteo",
    fetchedAt,
    current: {
      time,
      temperatureC: round1(temperatureC),
      apparentC: round1(apparentC),
      weatherCode: Math.round(weatherCode),
      windKmh: round1(windKmh),
      precipitationMm: round1(precipitationMm),
    },
  };
}

/**
 * Pretvori DNEVNI odgovor Open-Meteo v kanonsko obliko (P0-E).
 * Vrača null, kadar gorovje ni vrnilo pričakovane oblike — klicatelj
 * tedaj odgovori 502 (fail-closed, brez izmišljanja). Preslikava polj
 * sama živi v lib/weather.ts (mapUpstreamDaily, client-safe, testirana).
 */
function mapUpstreamDailyResponse(
  data: unknown,
  fetchedAt: string
): WeatherDailyResponse | null {
  if (typeof data !== "object" || data === null) return null;
  const root = data as Record<string, unknown>;
  const rawDaily = root.daily;
  if (typeof rawDaily !== "object" || rawDaily === null) return null;
  const daily = mapUpstreamDaily(rawDaily as Parameters<typeof mapUpstreamDaily>[0]);
  if (!daily || daily.length === 0) return null;
  return { ok: true, source: "open-meteo", fetchedAt, daily };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseWeatherParams(searchParams.toString());
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Neveljavni ali manjkajoči parametra 'lat' in 'lng' (pričakovani decimalni števili: lat ±90, lng ±180).",
      },
      { status: 400 }
    );
  }
  const { lat, lng } = parsed;

  if (!takeRateSlot(Date.now())) {
    return NextResponse.json({ error: "Presežena omejitev zahtev (60/min)." }, { status: 429 });
  }

  const daily = searchParams.get("daily") === "1";

  // Predpomnilnik (zasebnost: ključ zaokrožen na 2 decimalki; ločeno
  // trenutno/dnevno — drugačna teža odgovorov).
  const now = Date.now();
  const key = (daily ? "d:" : "c:") + cacheKeyFor(lat, lng);
  const cached = cacheGet(key, now);
  if (cached) return NextResponse.json(cached);

  // Proxy na Open-Meteo z 8-sekundno prekinitvijo (AbortController).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let payload: WeatherResponse | WeatherDailyResponse | null = null;
  try {
    const url = daily
      ? `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lng}` +
        `&daily=${OPEN_METEO_DAILY_FIELDS}&timezone=auto&forecast_days=16`
      : `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lng}` +
        `&current=${OPEN_METEO_CURRENT_FIELDS}&timezone=auto&forecast_days=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const json = await res.json();
      payload = daily
        ? mapUpstreamDailyResponse(json, new Date().toISOString())
        : mapUpstreamCurrent(json, new Date().toISOString());
    }
  } catch {
    payload = null; // timeout / omrežna napaka → fail-closed spodaj
  } finally {
    clearTimeout(timer);
  }

  if (!payload) {
    // FAIL-CLOSED: vremenski servis ni dosegljiv → NIKOLI izmišljenih podatkov.
    return NextResponse.json({ error: "Vremenski servis trenutno ni dosegljiv." }, { status: 502 });
  }

  cacheSet(key, payload, now);
  return NextResponse.json(payload);
}
