/**
 * ODPRTI PODATKI BREZ POVERILNIC — čista podatkovna plast (URL-ji + razčlenjevalniki).
 *
 * Izrazita želja uporabnika: "vstavi vse kaj je brez poverilnic" — vsi viri
 * spodaj so živo izmerjeni (18. 10. 2026, bun fetch) in delujejo brez API
 * ključev ali prijave:
 *
 *  • Vreme:      Open-Meteo forecast (peskovnik: dnevna kvota 429 → v produkciji deluje)
 *                → rezerva wttr.in `?format=j1&lang=sl` (nativno slovenski opis, 200)
 *  • Zrak:       Open-Meteo Air Quality (european_aqi + pm2_5, 200)
 *  • Opisi:      Wikipedia REST summary (sl; 403 brez opisnega User-Agenta,
 *                z njim 200 — 29/30 naslovov vodiča resolva)
 *  • Valute:     open.er-api.com (RSD/MKD/ALL/BAM — ECB frankfurter jih NIMA!)
 *                → rezerva @fawazahmed0/currency-api prek jsDelivr CDN (200)
 *  • Prazniki:   date.nager.at NextPublicHolidays (SI/HR/BA/RS/ME/MK/AL = 200;
 *                XK Kosovo = 500 → pošteno izpuščeno)
 *  • Obratno     Nominatim reverse (z User-Agentom iskanja = 200; drugače 403)
 *    geokodiranje
 *
 * Čisto in testabilno: gradnja URL + razčlenjevanje odgovorov brez `fetch`;
 * oblikovanje (zaokroževanje, ločila tisočic) je določeno tukaj, da so testi
 * določljivi (ne odvisni od locale).
 */

import { NOMINATIM_BASE } from './stays';

// ——————————————————————————————— VIROVI (baza) ———————————————————————————————

export const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_AQI_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
export const WTTR_BASE = 'https://wttr.in';
export const ER_API_BASE = 'https://open.er-api.com/v6/latest';
export const CURRENCY_API_BASE =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';
export const NAGER_BASE = 'https://date.nager.at/api/v3';

/** Opisni User-Agent (Wikipedia ga ZAHTEVA — brez njega 403, izmerjeno). */
export const OPEN_DATA_UA =
  'i-feel-slovenia-demo/0.3 (https://i-feel-slovenia.vercel.app; kontakt: demo@example.com) bun-fetch/1';

// ————————————————————————— VREME + ZRAK (Open-Meteo / wttr.in) —————————————————————————

export interface WeatherDay {
  date: string;
  minC: number;
  maxC: number;
  desc: string | null;
}

export interface WeatherBase {
  source: 'open-meteo' | 'wttr.in';
  tempC: number;
  feelsC: number | null;
  desc: string;
  days: WeatherDay[];
}

export interface WeatherPayload extends WeatherBase {
  aqi: number | null;
  pm25: number | null;
}

/**
 * WMO vremenske kode → slovensko (Open-Meteo `weather_code`).
 * Neznane → null (UI pade na '—'); wttr.in uporablja svoje razširitve
 * (113/116/119/122 …), ki jih pokrijemo z LASTNIM slovarjem.
 */
export const WMO_DESC_SL: Record<number, string> = {
  0: 'jasno',
  1: 'pretežno jasno',
  2: 'delno oblačno',
  3: 'preobláčno',
  45: 'megla',
  48: 'megla z žledom',
  51: 'lahko rosenje',
  53: 'rosenje',
  55: 'gosto rosenje',
  56: 'zaledenelo rosenje',
  57: 'gosto zaledenelo rosenje',
  61: 'lahko dežuje',
  63: 'dežuje',
  65: 'močno dežuje',
  66: 'zaledenelo deževje',
  67: 'močno zaledenelo deževje',
  71: 'lahko sneži',
  73: 'sneži',
  75: 'močno sneži',
  77: 'snežna zrna',
  80: 'plohe',
  81: 'močnejše plohe',
  82: 'hude plohe',
  85: 'snežne plohe',
  86: 'močne snežne plohe',
  95: 'nevreme z grmenjem',
  96: 'nevreme s točo',
  99: 'hudo nevreme s točo',
};

/** wttr.in kode (razširjene WMO) → slovensko; pokriva običajne trenutne vrednosti. */
export const WTTR_DESC_SL: Record<number, string> = {
  113: 'jasno',
  116: 'delno oblačno',
  119: 'obláčno',
  122: 'preobláčno',
  143: 'megla',
  176: 'plohe',
  179: 'snežne plohe',
  182: 'plohe z dežjem',
  185: 'plohe z dežjem',
  200: 'nevihta',
  227: 'podravjanje',
  230: 'metavica',
  248: 'megla',
  260: 'megla z rosenjem',
  263: 'lahko rosenje',
  266: 'rosenje',
  281: 'zaledenelo rosenje',
  284: 'gosto zaledenelo rosenje',
  293: 'plohe z dežjem',
  296: 'dežuje',
  299: 'močnejše plohe',
  302: 'močno dežuje',
  305: 'hude plohe',
  308: 'plaz dežja',
  311: 'zaledenelo deževje',
  314: 'močno zaledenelo deževje',
  317: 'plohe s snegom',
  320: 'močne plohe s snegom',
  323: 'lahko sneži',
  326: 'sneži',
  329: 'močno sneži',
  332: 'močno sneži',
  335: 'plaz snega',
  338: 'plaz snega',
  350: 'plohe z dežjem',
  353: 'plohe',
  356: 'močnejše plohe',
  359: 'hude plohe',
  362: 'plohe s snegom',
  365: 'močne plohe s snegom',
  368: 'lahko sneži',
  371: 'močno sneži',
  374: 'plohe z dežjem',
  377: 'plohe z dežjem',
  386: 'nevihta s plohami',
  389: 'huda nevihta',
  392: 'nevihta s snegom',
  395: 'huda nevihta s snegom',
};

/** Opis iz WMO/wttr kode; neznana → null. */
export function wmoDesc(code: unknown, wttr = false): string | null {
  const n = typeof code === 'number' ? code : Number(code);
  if (!Number.isInteger(n) || n < 0 || n > 999) return null;
  return (wttr ? WTTR_DESC_SL[n] : WMO_DESC_SL[n]) ?? null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** URL Open-Meteo napovedi (trenutno + 3-dnevna, časovni pas samodejno). */
export function openMeteoUrl(lat: number, lng: number): string {
  return `${OPEN_METEO_BASE}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3`;
}

/** URL Open-Meteo kakovosti zraka (evropski AQI + PM2.5). */
export function openMeteoAqiUrl(lat: number, lng: number): string {
  return `${OPEN_METEO_AQI_BASE}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=european_aqi,pm2_5&timezone=auto`;
}

/** URL wttr.in (j1 JSON, slovenski opis — izmerjeno `lang=sl` nativno deluje). */
export function wttrUrl(lat: number, lng: number): string {
  return `${WTTR_BASE}/${lat.toFixed(3)},${lng.toFixed(3)}?format=j1&lang=sl`;
}

/** Razčlenjevanje Open-Meteo odgovora (napoved 3 dni). Fail-clean: null. */
export function parseOpenMeteoWeather(raw: unknown): WeatherBase | null {
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as {
    current?: { temperature_2m?: unknown; apparent_temperature?: unknown; weather_code?: unknown };
    daily?: { time?: unknown; temperature_2m_max?: unknown; temperature_2m_min?: unknown; weather_code?: unknown };
  };
  const tempC = num(j.current?.temperature_2m);
  if (tempC === null) return null;
  const dailyTime = Array.isArray(j.daily?.time) ? j.daily.time : [];
  const dailyMax = Array.isArray(j.daily?.temperature_2m_max) ? j.daily.temperature_2m_max : [];
  const dailyMin = Array.isArray(j.daily?.temperature_2m_min) ? j.daily.temperature_2m_min : [];
  const dailyCode = Array.isArray(j.daily?.weather_code) ? j.daily.weather_code : [];
  const days: WeatherDay[] = [];
  for (let i = 0; i < Math.min(3, dailyTime.length); i++) {
    const minC = num(dailyMin[i]);
    const maxC = num(dailyMax[i]);
    if (minC === null || maxC === null) continue;
    days.push({ date: String(dailyTime[i]), minC, maxC, desc: wmoDesc(dailyCode[i]) });
  }
  return {
    source: 'open-meteo',
    tempC,
    feelsC: num(j.current?.apparent_temperature),
    desc: wmoDesc(j.current?.weather_code) ?? 'vreme',
    days,
  };
}

/** Razčlenjevanje wttr.in j1 odgovora (slovenski opis prek lang_sl). Fail-clean: null. */
export function parseWttrWeather(raw: unknown): WeatherBase | null {
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as {
    current_condition?: {
      temp_C?: unknown; FeelsLikeC?: unknown; weatherCode?: unknown;
      lang_sl?: { value?: unknown }[]; weatherDesc?: { value?: unknown }[];
    }[];
    weather?: { date?: unknown; mintempC?: unknown; maxtempC?: unknown }[];
  };
  const cur = j.current_condition?.[0];
  const tempC = num(cur?.temp_C);
  if (!cur || tempC === null) return null;
  const slDesc = typeof cur.lang_sl?.[0]?.value === 'string' ? cur.lang_sl[0].value.trim() : '';
  const enDesc = typeof cur.weatherDesc?.[0]?.value === 'string' ? cur.weatherDesc[0].value.trim() : '';
  const codeDesc = wmoDesc(cur.weatherCode, true);
  const desc = slDesc || codeDesc || enDesc || 'vreme';
  const days: WeatherDay[] = [];
  for (const d of (j.weather ?? []).slice(0, 3)) {
    const minC = num(d.mintempC);
    const maxC = num(d.maxtempC);
    if (!d.date || minC === null || maxC === null) continue;
    days.push({ date: String(d.date), minC, maxC, desc: null });
  }
  return { source: 'wttr.in', tempC, feelsC: num(cur.FeelsLikeC), desc, days };
}

/** Razčlenjevanje Open-Meteo AQI odgovora. Fail-clean: null. */
export function parseAqi(raw: unknown): { aqi: number; pm25: number | null } | null {
  if (!raw || typeof raw !== 'object') return null;
  const cur = (raw as { current?: { european_aqi?: unknown; pm2_5?: unknown } }).current;
  const aqi = num(cur?.european_aqi);
  if (aqi === null || aqi < 0) return null;
  const pm25 = num(cur?.pm2_5);
  return { aqi, pm25: pm25 !== null && pm25 >= 0 ? pm25 : null };
}

/** Združi vreme + zrak (zrak je lahko manjkajoč — ne usodi vremena). */
export function mergeWeather(base: WeatherBase, aqi: { aqi: number; pm25: number | null } | null): WeatherPayload {
  return { ...base, aqi: aqi?.aqi ?? null, pm25: aqi?.pm25 ?? null };
}

/** Evropski AQI (0–100+) → slovenska oznaka pasu. */
export function aqiLabel(aqi: number): string {
  if (aqi <= 20) return 'dobro';
  if (aqi <= 40) return 'sprejemljivo';
  if (aqi <= 60) return 'zmerno';
  if (aqi <= 80) return 'slabo';
  if (aqi <= 100) return 'zelo slabo';
  return 'izjemno slabo';
}

/** Ločila tisočic s piko (določljivo, brez locale). */
export function fmtThousand(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Enovrstični povzetek vremena za UI ("13 °C · preobláčno · jutri 7–16 °C · zrak 46 (zmerno)"). */
export function weatherOneLiner(w: WeatherPayload | null): string {
  if (!w) return '';
  const parts = [`${Math.round(w.tempC)} °C`, w.desc];
  // Viri začnejo z današnjim dnem: [0] = danes, [1] = jutri.
  const tomorrow = w.days[1];
  const today = w.days[0];
  const day = tomorrow ?? today;
  if (day) {
    parts.push(
      `${tomorrow ? 'jutri' : 'danes'} ${Math.round(day.minC)}-${Math.round(day.maxC)} °C`,
    );
  }
  if (w.aqi !== null) parts.push(`zrak ${Math.round(w.aqi)} (${aqiLabel(w.aqi)})`);
  return parts.join(' · ');
}

// ——————————————————————————— WIKIPEDIA POVZETKI ————————————————————————————

export interface WikiSummary {
  title: string;
  description: string | null;
  extract: string;
  thumb: string | null;
}

/** URL Wikipedia REST povzetka (naslovi z presledki → podčrtaj; redirect sledi). */
export function wikiUrl(title: string, lang = 'sl'): string {
  const t = encodeURIComponent(title.trim().replace(/ /g, '_'));
  return `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${t}?redirect=true`;
}

/** Razčlenjevanje REST summary odgovora. Fail-clean: null (404 → null). */
export function parseWikiSummary(raw: unknown): WikiSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as {
    type?: unknown; title?: unknown; description?: unknown; extract?: unknown;
    thumbnail?: { source?: unknown };
  };
  if (j.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;
  const title = typeof j.title === 'string' ? j.title.trim() : '';
  const extract = typeof j.extract === 'string' ? j.extract.trim() : '';
  if (!title || !extract) return null;
  const thumb = typeof j.thumbnail?.source === 'string' && j.thumbnail.source.startsWith('https://') ? j.thumbnail.source : null;
  const description = typeof j.description === 'string' && j.description.trim().length > 0 ? j.description.trim() : null;
  return { title, description, extract, thumb };
}

/** Kratek izvleček za UI — prelomi na besedi, največ `max` znakov + '…'. */
export function wikiShort(extract: string, max = 120): string {
  const clean = extract.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()} …`;
}

// ——————————————————————————————— VALUTE ————————————————————————————————

/** Balkanske valute, ki jih ECB (frankfurter) NE pokriva — er-api jih ima vse. */
export const BALKAN_CURRENCIES = ['RSD', 'MKD', 'ALL', 'BAM'] as const;
export type BalkanCurrency = (typeof BALKAN_CURRENCIES)[number];

export function erApiUrl(base = 'EUR'): string {
  return `${ER_API_BASE}/${encodeURIComponent(base.toUpperCase())}`;
}

export function currencyApiUrl(base = 'eur'): string {
  return `${CURRENCY_API_BASE}/${base.toLowerCase()}.min.json`;
}

/** Razčlenjevanje open.er-api.com odziva → seznam pozitivnih tečajev. Fail-clean: null. */
export function parseErApiRates(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const rates = (raw as { result?: unknown; rates?: Record<string, unknown> }).rates;
  if ((raw as { result?: unknown }).result !== 'success' || !rates || typeof rates !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates)) {
    const n = num(v);
    if (n !== null && n > 0) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Razčlenjevanje @fawazahmed0/currency-api odziva ({ eur: { rsd: … } }). Fail-clean: null. */
export function parseCurrencyApiRates(raw: unknown, base = 'eur'): Record<string, number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const rates = (raw as Record<string, unknown>)[base.toLowerCase()];
  if (!rates || typeof rates !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates)) {
    const n = num(v);
    if (n !== null && n > 0) out[k.toUpperCase()] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Indikativna cena v balkanskih valutah ("≈ 8.220 RSD · 4.300 MKD · 6.390 ALL · 137 BAM").
 * Zaokroževanje: RSD/MKD/ALL na 10, BAM (peg!) na 1. Manjkajoči tečaji izpuščeni;
 * eur <= 0 ali brez tečajev → ''. Pošteno: tečaji so referenčni (ECB prek er-api).
 */
export function balkanCurrencyLines(eur: number, rates: Record<string, number> | null): string {
  if (!Number.isFinite(eur) || eur <= 0 || !rates) return '';
  const parts: string[] = [];
  for (const cur of BALKAN_CURRENCIES) {
    const rate = rates[cur];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) continue;
    const value = eur * rate;
    const rounded = cur === 'BAM' ? Math.round(value) : Math.round(value / 10) * 10;
    parts.push(`${fmtThousand(rounded)} ${cur}`);
  }
  return parts.length > 0 ? `≈ ${parts.join(' · ')}` : '';
}

// ——————————————————————————————— PRAZNIKI ————————————————————————————————

export interface Holiday {
  date: string;
  localName: string;
}

/** URL naslednjih javnih praznikov (Nager.Date; XK/Kosovo ni podprt — izmerjeno 500). */
export function nagerNextUrl(country: string): string {
  return `${NAGER_BASE}/NextPublicHolidays/${encodeURIComponent(country.toUpperCase())}`;
}

/** Razčlenjevanje Nager odgovora → prvih `max` praznikov z imenom. Fail-clean: []. */
export function parseHolidays(raw: unknown, max = 3): Holiday[] {
  if (!Array.isArray(raw)) return [];
  const out: Holiday[] = [];
  for (const h of raw) {
    if (out.length >= max) break;
    if (!h || typeof h !== 'object') continue;
    const date = (h as { date?: unknown }).date;
    const localName = (h as { localName?: unknown }).localName;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (typeof localName !== 'string' || localName.trim().length === 0) continue;
    out.push({ date, localName: localName.trim() });
  }
  return out;
}

/** "2026-10-31" → "31. 10." (brez vodilnih ničel; leto izpuščeno — naslednji prazniki). */
export function formatHolidayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const day = Number(m[3]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return '';
  return `${day}. ${month}.`;
}

/** Enovrstični izpis praznikov za UI ("dan reformacije, 31. 10. · …"). */
export function holidaysLine(holidays: Holiday[]): string {
  return holidays
    .map((h) => `${h.localName}, ${formatHolidayDate(h.date)}`)
    .filter((s) => !s.endsWith(', '))
    .join(' · ');
}

/** Ime države (slovensko/angleško iz Nominatim display_name) → ISO-3166 za Nager. */
export const COUNTRY_ISO: Record<string, string> = {
  slovenija: 'SI',
  slovenia: 'SI',
  hrvaška: 'HR',
  croatia: 'HR',
  'bosna in hercegovina': 'BA',
  'bosnia and herzegovina': 'BA',
  srbija: 'RS',
  serbia: 'RS',
  'črna gora': 'ME',
  montenegro: 'ME',
  'severna makedonija': 'MK',
  makedonija: 'MK',
  'north macedonia': 'MK',
  albanija: 'AL',
  albania: 'AL',
  // Kosovo (XK) je pri Nager 500 — izmerjeno, zato ga namerno NE preslikavamo.
};

/** Zadnji segment display_name ("Mlino, Bled, 4260, Slovenija" → SI). */
export function countryFromDisplayName(display: string | null): string | null {
  if (!display) return null;
  const last = display.split(',').pop()?.trim().toLowerCase() ?? '';
  return COUNTRY_ISO[last] ?? null;
}

// ———————————————————————— OBRATNO GEOCODIRANJE (Nominatim) ————————————————————————

export interface ReversePlace {
  name: string;
  type: string | null;
}

/** URL Nominatim reverse (isti User-Agent pravila kot iskanje; zoom 14 = naselje). */
export function nominatimReverseUrl(lat: number, lng: number): string {
  return `${NOMINATIM_BASE}/reverse?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&format=jsonv2&accept-language=sl&zoom=14`;
}

/** Razčlenjevanje Nominatim reverse odgovora. Fail-clean: null. */
export function parseReverse(raw: unknown): ReversePlace | null {
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as { name?: unknown; display_name?: unknown; addresstype?: unknown; error?: unknown };
  if (typeof j.error === 'string') return null;
  const name =
    typeof j.name === 'string' && j.name.trim().length > 0
      ? j.name.trim()
      : typeof j.display_name === 'string' && j.display_name.trim().length > 0
        ? j.display_name.split(',')[0].trim()
        : '';
  if (!name) return null;
  const type = typeof j.addresstype === 'string' && j.addresstype.length > 0 ? j.addresstype : null;
  return { name, type };
}

/** OSM addresstype → slovensko (znana podmnožica; neznano → surova vrednost). */
export const REVERSE_TYPE_SL: Record<string, string> = {
  city: 'mesto',
  town: 'mesto',
  municipality: 'občina',
  borough: 'četrt',
  suburb: 'predmestje',
  village: 'vas',
  hamlet: 'zaselek',
  farm: 'kmetija',
  peak: 'vrh',
  lake: 'jezero',
  river: 'reka',
  valley: 'dolina',
  park: 'park',
  island: 'otok',
  beach: 'plaža',
  forest: 'gozd',
  hill: 'hrib',
  hotel: 'hotel',
  attraction: 'zanimivost',
  house: 'hiša',
  allotments: 'vrtna naselja',
  neighbourhood: 'soseska',
  quarter: 'četrt',
};

export function reverseTypeLabel(type: string | null): string {
  if (!type) return '';
  return REVERSE_TYPE_SL[type] ?? type;
}
