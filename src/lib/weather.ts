/**
 * WEATHER — vreme na postanku za Go Mode (rekonstrukcija FAZE 3, Task 51-a).
 *
 * Kanon ZASEBNOSTI izvirnika (go-weather.ts): poizvedba po vremenu vedno
 * nosi koordinate POSTANKA NAČRTA — NIKOLI uporabnikove GPS lege. Odgovor
 * se ne shranjuje v bazo (0 persistenc); strežniška pot /api/weather je
 * le proxy na Open-Meteo z začasnim pomnilniškim predpomnilnikom, ki
 * ključe zaokroži na 2 decimalki (~1,1 km mreža — iz predpomnilnika ni
 * mogoče rekonstruirati točne lege).
 *
 * Ta modul je CLIENT-SAFE: čiste funkcije in tipi brez Node API-jev —
 * uporabljajo ga tako strežniška pot (validacija, ključ) kot Go Mode UI.
 */

/** Trenutno vreme na postanku (kanonska oblika odgovora, camelCase). */
export interface WeatherNow {
  time: string;
  temperatureC: number;
  apparentC: number;
  weatherCode: number;
  windKmh: number;
  precipitationMm: number;
}

/** Odgovor /api/weather ob uspehu — samo pretak resničnih polj Open-Meteo. */
export interface WeatherResponse {
  ok: true;
  source: "open-meteo";
  fetchedAt: string;
  current: WeatherNow;
}

/**
 * WMO weather_code → oznaka [sl, en, it, de, fr, es]. Samo nabor, ki ga
 * znamo POŠTENO imenovati (jasno/oblačno/megla/rosenje/dež/plohe/sneg/nevihta);
 * NERAZPOZNANA koda → "vreme"/"weather" brez lažne natančnosti.
 */
const WMO_LABELS: Readonly<
  Record<number, readonly [string, string, string, string, string, string]>
> = {
  0: ["jasno", "clear", "sereno", "klar", "ciel dégagé", "despejado"],
  1: ["pretežno jasno", "mainly clear", "prevalentemente sereno", "überwiegend klar", "peu nuageux", "poco nuboso"],
  2: ["delno oblačno", "partly cloudy", "parzialmente nuvoloso", "teilweise bewölkt", "partiellement nuageux", "parcialmente nublado"],
  3: ["oblačno", "overcast", "nuvoloso", "bewölkt", "nuageux", "nublado"],
  45: ["megla", "fog", "nebbia", "nebel", "brouillard", "niebla"],
  48: ["megla", "fog", "nebbia", "nebel", "brouillard", "niebla"],
  51: ["rosenje", "drizzle", "pioviggine", "nieselregen", "bruine", "llovizna"],
  53: ["rosenje", "drizzle", "pioviggine", "nieselregen", "bruine", "llovizna"],
  55: ["rosenje", "drizzle", "pioviggine", "nieselregen", "bruine", "llovizna"],
  56: ["rosenje", "drizzle", "pioviggine", "nieselregen", "bruine", "llovizna"],
  57: ["rosenje", "drizzle", "pioviggine", "nieselregen", "bruine", "llovizna"],
  61: ["dež", "rain", "pioggia", "regen", "pluie", "lluvia"],
  63: ["dež", "rain", "pioggia", "regen", "pluie", "lluvia"],
  65: ["dež", "rain", "pioggia", "regen", "pluie", "lluvia"],
  66: ["dež", "rain", "pioggia", "regen", "pluie", "lluvia"],
  67: ["dež", "rain", "pioggia", "regen", "pluie", "lluvia"],
  71: ["sneg", "snow", "neve", "schnee", "neige", "nieve"],
  73: ["sneg", "snow", "neve", "schnee", "neige", "nieve"],
  75: ["sneg", "snow", "neve", "schnee", "neige", "nieve"],
  77: ["sneg", "snow", "neve", "schnee", "neige", "nieve"],
  85: ["sneg", "snow", "neve", "schnee", "neige", "nieve"],
  86: ["sneg", "snow", "neve", "schnee", "neige", "nieve"],
  80: ["plohe", "rain showers", "rovesci di pioggia", "regenschauer", "averses de pluie", "chubascos"],
  81: ["plohe", "rain showers", "rovesci di pioggia", "regenschauer", "averses de pluie", "chubascos"],
  82: ["plohe", "rain showers", "rovesci di pioggia", "regenschauer", "averses de pluie", "chubascos"],
  95: ["nevihta", "thunderstorm", "temporale", "gewitter", "orage", "tormenta"],
  96: ["nevihta", "thunderstorm", "temporale", "gewitter", "orage", "tormenta"],
  99: ["nevihta", "thunderstorm", "temporale", "gewitter", "orage", "tormenta"],
};

/** Indeks jezika v tercah WMO_LABELS ([sl, en, it, de, fr, es]). */
const WMO_INDEX: Record<"sl" | "en" | "it" | "de" | "fr" | "es", number> = {
  sl: 0,
  en: 1,
  it: 2,
  de: 3,
  fr: 4,
  es: 5,
};

/** Oznaka za neznano WMO kodo po jeziku (iskren fallback). */
const WMO_FALLBACK: Record<"sl" | "en" | "it" | "de" | "fr" | "es", string> = {
  sl: "vreme",
  en: "weather",
  it: "meteo",
  de: "Wetter",
  fr: "météo",
  es: "tiempo",
};

/**
 * WMO vremenska koda → oznaka (6 jezikov od 2.21.0/4-c; prej sl/en).
 * Vrstni red terc WMO_LABELS: [sl, en, it, de, fr, es] — identičen
 * vrstnemu redu PICK_LOCALES.
 */
export function weatherLabel(code: number, locale: "sl" | "en" | "it" | "de" | "fr" | "es"): string {
  const entry = WMO_LABELS[code];
  const idx = WMO_INDEX[locale] ?? 0;
  if (!entry) return WMO_FALLBACK[locale] ?? "vreme";
  return entry[idx] ?? entry[0];
}

/** Zaokroži na 2 decimalki in normaliziraj −0 (da je ključ determinističen). */
function fixed2(v: number): string {
  const s = v.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
}

/**
 * Ključ predpomnilnika: koordinati zaokroženi na 2 decimalki (~1,1 km) —
 * ZASEBNOST: iz ključa ni mogoče rekonstruirati točne uporabnikove lege.
 */
export function cacheKeyFor(lat: number, lng: number): string {
  return `${fixed2(lat)},${fixed2(lng)}`;
}

/**
 * Čista razčlenitev + validacija query paramatrov ?lat&lng.
 * Veljavno: lat ∈ [-90, 90], lng ∈ [-180, 180] (desetiški števili).
 * Manjka / neštevilska / izven obsega / prazen niz → null (kliče strežnik
 * odgovori 400 s slovenskim sporočilom).
 */
export function parseWeatherParams(search: string): { lat: number; lng: number } | null {
  const params = new URLSearchParams(search);
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
  if (latRaw === null || lngRaw === null) return null;
  if (latRaw.trim() === "" || lngRaw.trim() === "") return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Tipovska straža odgovora /api/weather (klient ne zaupa slepo obliki). */
export function isWeatherResponse(v: unknown): v is WeatherResponse {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.ok !== true) return false;
  if (o.source !== "open-meteo") return false;
  if (typeof o.fetchedAt !== "string" || o.fetchedAt === "") return false;
  const c = o.current;
  if (typeof c !== "object" || c === null) return false;
  const cur = c as Record<string, unknown>;
  return (
    typeof cur.time === "string" &&
    typeof cur.temperatureC === "number" &&
    Number.isFinite(cur.temperatureC) &&
    typeof cur.apparentC === "number" &&
    Number.isFinite(cur.apparentC) &&
    typeof cur.weatherCode === "number" &&
    Number.isFinite(cur.weatherCode) &&
    typeof cur.windKmh === "number" &&
    Number.isFinite(cur.windKmh) &&
    typeof cur.precipitationMm === "number" &&
    Number.isFinite(cur.precipitationMm)
  );
}

/**
 * Odjemalec: pridobi vreme na postanku prek /api/weather?lat&lng.
 * Vrača null ob KATERI koli napaki (omrežje, 4xx/5xx, napačna oblika) —
 * klicatelj pokaže iskreno stanje napake; NIKOLI ne izmišljamo podatkov.
 * `signal` omogoča prekinitev ob odklopu komponente (unmount).
 */
export async function fetchStopWeather(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<WeatherResponse | null> {
  try {
    const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`, { signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isWeatherResponse(data) ? data : null;
  } catch {
    return null;
  }
}

// ── DNEVNA NAPOVED (P0-E — vreme po dnevih poti, issue #1 §10) ──────────────

/** En dan dnevne napovedi (camelCase kanon, isti vir Open-Meteo). */
export interface WeatherDay {
  /** Lokalni datum dneva "YYYY-MM-DD" (vir: daily.time v coni lokacije). */
  date: string;
  /** WMO vremenska koda (weather_code). */
  code: number;
  /** Najvišja dnevna temperatura °C. */
  tMaxC: number;
  /** Najnižja dnevna temperatura °C. */
  tMinC: number;
  /** Verjetnost padavin % (0–100; 0, če vir ne izda vrednosti). */
  precipProbPct: number;
  /** Količina padavin mm. */
  precipMm: number;
}

/** Odgovor /api/weather?daily=1 ob uspehu — samo pretok resničnih polj. */
export interface WeatherDailyResponse {
  ok: true;
  source: "open-meteo";
  fetchedAt: string;
  daily: WeatherDay[];
}

/** Tipovska straža dnevnega odgovora (klient ne zaupa slepo obliki). */
export function isWeatherDailyResponse(v: unknown): v is WeatherDailyResponse {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.ok !== true || o.source !== "open-meteo") return false;
  if (typeof o.fetchedAt !== "string" || o.fetchedAt === "") return false;
  if (!Array.isArray(o.daily) || o.daily.length === 0) return false; // prazna napoved NI veljavna
  return o.daily.every((d) => {
    if (typeof d !== "object" || d === null) return false;
    const day = d as Record<string, unknown>;
    return (
      typeof day.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
      typeof day.code === "number" &&
      Number.isFinite(day.code) &&
      typeof day.tMaxC === "number" &&
      Number.isFinite(day.tMaxC) &&
      typeof day.tMinC === "number" &&
      Number.isFinite(day.tMinC) &&
      typeof day.precipProbPct === "number" &&
      Number.isFinite(day.precipProbPct) &&
      typeof day.precipMm === "number" &&
      Number.isFinite(day.precipMm)
    );
  });
}

/**
 * Preslikava gorvodnega `daily` bloka Open-Meteo v kanonsko obliko.
 * Namerno tanka: vse validacije oblike opravlja KLICATELJ (ta funkcija je
 * čista preslikava polj — fail-closed ostaja na poti API).
 * Nepoznana polja se NE izmišljujejo: manjkajoča verjetnost → 0 je edina
 * izjema, ki jo vir dopušča (precipitation_probability_max je opcijsko).
 */
export function mapUpstreamDaily(raw: {
  time: unknown;
  weather_code: unknown;
  temperature_2m_max: unknown;
  temperature_2m_min: unknown;
  precipitation_probability_max: unknown;
  precipitation_sum: unknown;
}): WeatherDay[] | null {
  const { time, weather_code, temperature_2m_max, temperature_2m_min } = raw;
  const prob = raw.precipitation_probability_max;
  const sum = raw.precipitation_sum;
  if (
    !Array.isArray(time) ||
    !Array.isArray(weather_code) ||
    !Array.isArray(temperature_2m_max) ||
    !Array.isArray(temperature_2m_min)
  ) {
    return null;
  }
  const n = time.length;
  if (
    n === 0 ||
    weather_code.length !== n ||
    temperature_2m_max.length !== n ||
    temperature_2m_min.length !== n
  ) {
    return null;
  }
  const out: WeatherDay[] = [];
  for (let i = 0; i < n; i++) {
    const date = time[i];
    const code = weather_code[i];
    const tMax = temperature_2m_max[i];
    const tMin = temperature_2m_min[i];
    const probV = Array.isArray(prob) ? prob[i] : null;
    const sumV = Array.isArray(sum) ? sum[i] : null;
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof code !== "number" ||
      !Number.isFinite(code) ||
      typeof tMax !== "number" ||
      !Number.isFinite(tMax) ||
      typeof tMin !== "number" ||
      !Number.isFinite(tMin)
    ) {
      return null; // neberljiv dan = pokvarjen odgovor (celota fail-closed)
    }
    out.push({
      date,
      code: Math.round(code),
      tMaxC: Math.round(tMax * 10) / 10,
      tMinC: Math.round(tMin * 10) / 10,
      precipProbPct:
        typeof probV === "number" && Number.isFinite(probV)
          ? Math.max(0, Math.min(100, Math.round(probV)))
          : 0,
      precipMm:
        typeof sumV === "number" && Number.isFinite(sumV)
          ? Math.round(sumV * 10) / 10
          : 0,
    });
  }
  return out;
}

/**
 * Odjemalec: dnevna napoved za koordinate postanka.
 * Vrača null ob napaki — NIKOLI ne izmišljamo; horizont je omejen z virom
 * (FORECAST_MAX_DAYS v trip-dates — UI ga spoštuje prek forecastAvailabilityFor).
 */
export async function fetchDailyWeather(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<WeatherDailyResponse | null> {
  try {
    const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}&daily=1`, {
      signal,
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isWeatherDailyResponse(data) ? data : null;
  } catch {
    return null;
  }
}
