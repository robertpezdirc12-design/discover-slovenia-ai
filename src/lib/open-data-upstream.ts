/**
 * ODPRTI PODATKI — pridobevalne verige (deljeno med bun mini storitvijo IN
 * Next.js posredniki). Zaobjema failover vire, ki so živo izmerjeni:
 *
 *  • vreme:     Open-Meteo forecast → wttr.in (lang=sl) + Open-Meteo AQI (neuspeh ne usodi vremena)
 *  • wiki:      Wikipedia REST summary (404 → null, mrežna napaka → throw)
 *  • tečaji:    open.er-api.com → @fawazahmed0/currency-api (jsDelivr)
 *  • prazniki:  Nager.Date NextPublicHolidays (brez praznikov → throw)
 *  • reverse:   Nominatim reverse (manjkajoče ime → null)
 *
 * Ta modul ne uvaža ničesar Node/domačega specifičnega (samo `fetch`), torej
 * ga lahko poganjata oba runtime-a (bun mini storitev + Node Next ruta).
 */

import {
  OPEN_DATA_UA,
  currencyApiUrl,
  erApiUrl,
  mergeWeather,
  nagerNextUrl,
  nominatimReverseUrl,
  openMeteoAqiUrl,
  openMeteoUrl,
  parseAqi,
  parseCurrencyApiRates,
  parseErApiRates,
  parseHolidays,
  parseOpenMeteoWeather,
  parseReverse,
  parseWikiSummary,
  parseWttrWeather,
  wikiUrl,
  wttrUrl,
  type Holiday,
  type ReversePlace,
  type WeatherBase,
  type WeatherPayload,
  type WikiSummary,
} from './open-data';

export const UPSTREAM_TIMEOUT_MS = 10_000;
/** Nominatim zahteva pravila iskanja — isti UA kot /api/stays/search. */
const NOMINATIM_UA = 'discover-slovenia-ai-demo/0.2 (slovenian travel guide; fair-use demo)';

async function upstream(url: string, ua: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'user-agent': ua, accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new UpstreamHttpError(`${new URL(url).host} HTTP ${res.status}`, res.status);
  return res.json();
}

/** HTTP napaka z statusom — verige razlikujejo 404 (manjka) od ostalih napak. */
export class UpstreamHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'UpstreamHttpError';
    this.status = status;
  }
}

/** Vreme za koordinato: Open-Meteo → wttr.in rezerva + AQI (prijetnost). */
export async function fetchWeatherChain(lat: number, lng: number): Promise<WeatherPayload> {
  let base: WeatherBase | null = null;
  try {
    base = parseOpenMeteoWeather(await upstream(openMeteoUrl(lat, lng), OPEN_DATA_UA));
  } catch {
    /* pade na wttr.in */
  }
  if (!base) {
    base = parseWttrWeather(await upstream(wttrUrl(lat, lng), OPEN_DATA_UA));
  }
  if (!base) throw new Error('Vreme ni na voljo (oba vira odpovedala).');
  let aqi: { aqi: number; pm25: number | null } | null = null;
  try {
    aqi = parseAqi(await upstream(openMeteoAqiUrl(lat, lng), OPEN_DATA_UA));
  } catch {
    /* zrak je prijetnost */
  }
  return mergeWeather(base, aqi);
}

/** Wikipedia povzetek; članek ne obstaja (404) → null (mrežna napaka → throw). */
export async function fetchWikiChain(title: string, lang: string): Promise<WikiSummary | null> {
  try {
    return parseWikiSummary(await upstream(wikiUrl(title, lang), OPEN_DATA_UA));
  } catch (e) {
    if (e instanceof UpstreamHttpError && e.status === 404) return null; // članka ni — ni napaka
    throw e;
  }
}

/** EUR tečaji: er-api → currency-api rezerva; oba odpovesta → throw. */
export async function fetchRatesChain(): Promise<Record<string, number>> {
  try {
    const parsed = parseErApiRates(await upstream(erApiUrl('EUR'), OPEN_DATA_UA));
    if (parsed) return parsed;
  } catch {
    /* pade na currency-api */
  }
  const parsed = parseCurrencyApiRates(await upstream(currencyApiUrl('eur'), OPEN_DATA_UA));
  if (!parsed) throw new Error('Tečaji niso na voljo (oba vira odpovedala).');
  return parsed;
}

/** Naslednji javni prazniki države; prazno/ne podprto → throw (npr. XK=500). */
export async function fetchHolidaysChain(country: string): Promise<Holiday[]> {
  const parsed = parseHolidays(await upstream(nagerNextUrl(country), OPEN_DATA_UA));
  if (parsed.length === 0) throw new Error('ni praznikov/ni podprto');
  return parsed;
}

/** Obratno geokodiranje; brez imena → null (mrežna napaka → throw). */
export async function fetchReverseChain(lat: number, lng: number): Promise<ReversePlace | null> {
  return parseReverse(await upstream(nominatimReverseUrl(lat, lng), NOMINATIM_UA));
}
