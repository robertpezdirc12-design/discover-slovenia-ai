import {
  DESTINATIONS,
  getDestination,
  type Destination,
} from "@/lib/slovenia-data";
import {
  loadStoContent,
  type StoLoadResult,
} from "@/lib/supply/providers/sto/content";
import type { SharedPlan } from "@/lib/shared-plan";
import { mapUpstreamDaily, type WeatherDay } from "@/lib/weather";

/**
 * ADVISOR CONTEXT — DETERMINISTIČNI podatkovni plan skriptnega @AI
 * svetovalca (2.24.0; nadomestek načrtovanega LLM sloja — kanon P1:
 * 100 % deterministično, 0 AI modelov, 0 AI žetonov).
 *
 * Skriptni svetovalec odgovarja IZKLJUČNO iz kanonskih virov:
 *  · register 74 destinacij (src/lib/slovenia-data.ts — zaupan vir),
 *  · STO slovenia.info vsebina (data/sto-content.json — LOKALNA datoteka,
 *    0 omrežja; napisal jo je ingest cron),
 *  · trenutno vreme Open-Meteo (javni PODATKOVNI API, ne AI — enak vir
 *    kot /api/weather za Go Mode; iskreno označeno, fail-quiet),
 *  · pot in rezervacije uporabnika (prek SYSTEM_DATA_GUARD sanitizacije,
 *    ki jo opravi jedro trip-chat-engine).
 *
 * Vse zunanje odvisnosti so injicirane (deps) → čisti deterministični
 * testi brez omrežja. Privzete implementacije so fail-quiet: napaka vira
 * = podatek IZPade, svetovalec pade na iskreni odgovor jedra
 * („NEZNANO"), NIKOLI ne izmišljuje.
 */

// ── odvisnosti (injicirane za teste) ────────────────────────────────────

/** Trenutno vreme (podatkovni vir Open-Meteo; null = vir ni vrnil nič). */
export type FetchCurrentWeather = (
  lat: number,
  lng: number
) => Promise<{ temperatureC: number; weatherCode: number } | null>;

/**
 * Dnevna napoved 16 dni (QA U5, 2026-10-11; podatkovni vir Open-Meteo —
 * isti vir in isti preslikavi kot /api/weather?daily=1, a STREŽNIŠKO:
 * svetovalec teče v ruti messages in ne more klicati relativnega URL-ja).
 * null = vir ni vrnil nič uporabnega (fail-quiet — NIKOLI ne izmišljujemo).
 */
export type FetchDailyWeather = (
  lat: number,
  lng: number
) => Promise<WeatherDay[] | null>;

type LoadSto = () => Promise<StoLoadResult>;

export interface AdvisorDeps {
  fetchCurrentWeather?: FetchCurrentWeather;
  fetchDailyWeather?: FetchDailyWeather;
  loadSto?: LoadSto;
}

/** Default: trenutno vreme z Open-Meteo (javni API, brez ključa, fail-quiet). */
async function defaultFetchCurrentWeather(
  lat: number,
  lng: number
): Promise<{ temperatureC: number; weatherCode: number } | null> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${lat}&longitude=${lng}` +
      "&current=temperature_2m,weather_code";
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    if (
      typeof data?.current?.temperature_2m !== "number" ||
      typeof data?.current?.weather_code !== "number" ||
      !Number.isFinite(data.current.temperature_2m) ||
      !Number.isFinite(data.current.weather_code)
    ) {
      return null;
    }
    return {
      temperatureC: data.current.temperature_2m,
      weatherCode: data.current.weather_code,
    };
  } catch {
    return null; // timeout / omrežje / napačna oblika → iskrena izpustitev
  }
}

/** Default: STO vsebina iz data/sto-content.json (lokalna datoteka). */
async function defaultLoadSto(): Promise<StoLoadResult> {
  return loadStoContent();
}

/** Dnevna polja za Open-Meteo (ista kot pot /api/weather?daily=1). */
const OPEN_METEO_DAILY_FIELDS =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum";

/**
 * Default: dnevna napoved z Open-Meteo (javni API, brez ključa, fail-quiet).
 * Preslikava v kanonske WeatherDay opravi ČISTA funkcija mapUpstreamDaily
 * iz lib/weather.ts (ista oblika kot /api/weather?daily=1 — 0 odstopanj).
 */
async function defaultFetchDailyWeather(
  lat: number,
  lng: number
): Promise<WeatherDay[] | null> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${lat}&longitude=${lng}` +
      `&daily=${OPEN_METEO_DAILY_FIELDS}&timezone=auto&forecast_days=16`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      daily?: Parameters<typeof mapUpstreamDaily>[0];
    };
    if (!data.daily) return null; // brez dnevnega bloka → iskrena izpustitev
    return mapUpstreamDaily(data.daily);
  } catch {
    return null; // timeout / omrežje / napačna oblika → iskrena izpustitev
  }
}

export function advisorDeps(deps?: AdvisorDeps): {
  fetchCurrentWeather: FetchCurrentWeather;
  fetchDailyWeather: FetchDailyWeather;
  loadSto: LoadSto;
} {
  return {
    fetchCurrentWeather: deps?.fetchCurrentWeather ?? defaultFetchCurrentWeather,
    fetchDailyWeather: deps?.fetchDailyWeather ?? defaultFetchDailyWeather,
    loadSto: deps?.loadSto ?? defaultLoadSto,
  };
}

// ── orodja (deterministično, brez stanja) ───────────────────────────────

export function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/č|ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");
}

/**
 * Vse destinacije, omenjene v besedilu po imenu ali slugu (ista logika
 * kot jedro trip-chat-engine — natančno podniz ujemanje na normaliziranem
 * besedilu; „na Bledu“ vsebuje „bled“ ✓).
 */
export function mentionedDestinations(body: string): Destination[] {
  const nb = stripDiacritics(body);
  const found: Destination[] = [];
  for (const d of DESTINATIONS) {
    const byName = stripDiacritics(d.name);
    const bySlug = stripDiacritics(d.slug.replace(/-/g, " "));
    if (nb.includes(byName) || nb.includes(bySlug)) {
      found.push(d);
    }
  }
  // Stabilni vrstni red registra (determinizem — nikoli naključno).
  return found;
}

/** Postanek poti, obogaten s kanonsko destinacijo (če se poveže). */
export interface PlanStopInfo {
  day: number;
  name: string;
  slug?: string;
  dest?: Destination;
}

/** Postanki pote z registrskimi destinacijami (koordinate za vreme). */
export function planStopInfos(plan: SharedPlan | null): PlanStopInfo[] {
  if (!plan) return [];
  const out: PlanStopInfo[] = [];
  for (const day of plan.days ?? []) {
    for (const loc of day.locations ?? []) {
      out.push({
        day: day.day,
        name: loc.name,
        slug: loc.destSlug,
        dest: loc.destSlug ? getDestination(loc.destSlug) : undefined,
      });
    }
  }
  return out;
}
