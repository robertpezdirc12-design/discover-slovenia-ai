/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  aqiLabel,
  balkanCurrencyLines,
  countryFromDisplayName,
  erApiUrl,
  fmtThousand,
  formatHolidayDate,
  holidaysLine,
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
  REVERSE_TYPE_SL,
  reverseTypeLabel,
  weatherOneLiner,
  wikiShort,
  wikiUrl,
  wmoDesc,
  wttrUrl,
  BALKAN_CURRENCIES,
} from '../src/lib/open-data';
import {
  fetchHolidaysChain,
  fetchRatesChain,
  fetchReverseChain,
  fetchWeatherChain,
  fetchWikiChain,
} from '../src/lib/open-data-upstream';
import { MAP_GUIDE_PLACES } from '../src/lib/map-guide';
import { parseCoordsParam, parseWikiParam, parseCountryParam, isValidWeatherPayload, isValidHolidays, isValidRates, isValidReversePlace } from '../src/lib/open-data-server';

// ————————————————————————————— VREME —————————————————————————————

/** Živi odziv (schema Open-Meteo; peskovnik ima danes 429 dnevno kvoto — v produkciji 200). */
const OPEN_METEO_FIXTURE = {
  current: { time: '2026-10-18T19:00', temperature_2m: 13.2, apparent_temperature: 11.8, weather_code: 3 },
  daily: {
    time: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'],
    temperature_2m_max: [23.4, 22.1, 20.0, 18.5],
    temperature_2m_min: [7.1, 6.8, 8.2, 9.0],
    weather_code: [61, 3, 0, 80],
  },
};

/** Živi odziv wttr.in j1 (izmerjeno: lang_sl nativno slovensko; dnevi brez kode). */
const WTTR_FIXTURE = {
  current_condition: [
    {
      temp_C: '13',
      FeelsLikeC: '12',
      weatherCode: '122',
      weatherDesc: [{ value: 'Overcast ' }],
      lang_sl: [{ value: 'Pretežno oblačno' }],
    },
  ],
  weather: [
    { date: '2026-10-18', mintempC: '7', maxtempC: '16' },
    { date: '2026-10-19', mintempC: '7', maxtempC: '23' },
    { date: '2026-10-20', mintempC: '8', maxtempC: '23' },
    { date: '2026-10-21', mintempC: '9', maxtempC: '21' },
  ],
};

describe('open-data — WMO / wttr opisi', () => {
  test('znane WMO kode → slovensko, neznane → null', () => {
    expect(wmoDesc(0)).toBe('jasno');
    expect(wmoDesc(3)).toBe('preobláčno');
    expect(wmoDesc(61)).toBe('lahko dežuje');
    expect(wmoDesc(95)).toBe('nevreme z grmenjem');
    expect(wmoDesc(999)).toBeNull();
    expect(wmoDesc('nisi')).toBeNull();
  });

  test('wttr kode (113/116/119/122 …) → slovensko', () => {
    expect(wmoDesc(113, true)).toBe('jasno');
    expect(wmoDesc(116, true)).toBe('delno oblačno');
    expect(wmoDesc(122, true)).toBe('preobláčno');
    expect(wmoDesc(296, true)).toBe('dežuje');
  });
});

describe('open-data — razčlenjevanje vremena', () => {
  test('Open-Meteo: trenutna + največ 3 dnevi', () => {
    const w = parseOpenMeteoWeather(OPEN_METEO_FIXTURE);
    expect(w?.source).toBe('open-meteo');
    expect(w?.tempC).toBeCloseTo(13.2);
    expect(w?.feelsC).toBeCloseTo(11.8);
    expect(w?.desc).toBe('preobláčno');
    expect(w?.days).toHaveLength(3);
    expect(w?.days[0]).toEqual({ date: '2026-10-19', minC: 7.1, maxC: 23.4, desc: 'lahko dežuje' });
  });

  test('wttr.in: slovenski opis iz lang_sl, dnevi brez opisa → null', () => {
    const w = parseWttrWeather(WTTR_FIXTURE);
    expect(w?.source).toBe('wttr.in');
    expect(w?.tempC).toBe(13);
    expect(w?.feelsC).toBe(12);
    expect(w?.desc).toBe('Pretežno oblačno');
    expect(w?.days).toHaveLength(3);
    expect(w?.days[0]?.desc).toBeNull();
    expect(w?.days[2]?.maxC).toBe(23);
  });

  test('fail-clean: neveljavni odgovori → null', () => {
    expect(parseOpenMeteoWeather(null)).toBeNull();
    expect(parseOpenMeteoWeather({})).toBeNull();
    expect(parseWttrWeather(null)).toBeNull();
    expect(parseWttrWeather({ current_condition: [] })).toBeNull();
    expect(parseWttrWeather({ current_condition: [{ temp_C: 'nisi' }] })).toBeNull();
  });

  test('AQI razčlenjevanje + združevanje (zrak je prijetnost)', () => {
    const aqi = parseAqi({ current: { time: '2026-10-18T19:00', european_aqi: 46, pm2_5: 26.3 } });
    expect(aqi).toEqual({ aqi: 46, pm25: 26.3 });
    expect(parseAqi({ current: { european_aqi: 'nisi' } })).toBeNull();
    expect(parseAqi(null)).toBeNull();

    const base = parseOpenMeteoWeather(OPEN_METEO_FIXTURE)!;
    const merged = mergeWeather(base, null);
    expect(merged.aqi).toBeNull();
    const merged2 = mergeWeather(base, aqi);
    expect(merged2.aqi).toBe(46);
  });

  test('aqiLabel pasovi (evropski AQI)', () => {
    expect(aqiLabel(10)).toBe('dobro');
    expect(aqiLabel(30)).toBe('sprejemljivo');
    expect(aqiLabel(50)).toBe('zmerno');
    expect(aqiLabel(70)).toBe('slabo');
    expect(aqiLabel(90)).toBe('zelo slabo');
    expect(aqiLabel(120)).toBe('izjemno slabo');
  });

  test('weatherOneLiner: enovrstični povzetek', () => {
    const base = parseOpenMeteoWeather(OPEN_METEO_FIXTURE)!;
    expect(weatherOneLiner(null)).toBe('');
    expect(weatherOneLiner(mergeWeather(base, null))).toBe('13 °C · preobláčno · jutri 7–23 °C');
    expect(weatherOneLiner(mergeWeather(base, { aqi: 46.2, pm25: 26.3 }))).toBe(
      '13 °C · preobláčno · jutri 7–23 °C · zrak 46 (zmerno)',
    );
  });
});

describe('open-data — URL-ji virov', () => {
  test('vsebina URL-jev', () => {
    expect(openMeteoUrl(41.9981, 21.4254)).toContain('api.open-meteo.com');
    expect(openMeteoUrl(41.9981, 21.4254)).toContain('forecast_days=3');
    expect(openMeteoAqiUrl(41.9981, 21.4254)).toContain('european_aqi');
    expect(wttrUrl(46.3625, 14.0936)).toContain('wttr.in/46.36');
    expect(wttrUrl(46.3625, 14.0936)).toContain('lang=sl');
    expect(wikiUrl('Postojnska jama')).toContain('sl.wikipedia.org');
    expect(wikiUrl('Postojnska jama')).toContain('Postojnska_jama');
    expect(wikiUrl('Bled', 'hr')).toContain('hr.wikipedia.org');
    expect(erApiUrl()).toContain('open.er-api.com/v6/latest/EUR');
    expect(nagerNextUrl('si')).toContain('NextPublicHolidays/SI');
    expect(nominatimReverseUrl(46.3683, 14.1144)).toContain('nominatim.openstreetmap.org/reverse');
    expect(nominatimReverseUrl(46.3683, 14.1144)).toContain('accept-language=sl');
  });
});

// ————————————————————————————— WIKIPEDIA —————————————————————————————

describe('open-data — Wikipedia povzetki', () => {
  const WIKI_FIXTURE = {
    type: 'standard',
    title: 'Bled',
    description: 'mesto v Sloveniji',
    extract: 'Bléd je mesto in turistično središče z okoli 5200 prebivalci na Gorenjskem.',
    thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/bled.jpg' },
  };

  test('razčlenjevanje: naslov + izvleček + sličica', () => {
    const w = parseWikiSummary(WIKI_FIXTURE);
    expect(w?.title).toBe('Bled');
    expect(w?.description).toBe('mesto v Sloveniji');
    expect(w?.thumb).toBe('https://upload.wikimedia.org/wikipedia/commons/bled.jpg');
  });

  test('fail-clean: 404-ta tip, brez izvlečka, neveljavno → null', () => {
    expect(parseWikiSummary({ type: 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found', title: 'x', extract: 'x' })).toBeNull();
    expect(parseWikiSummary({ title: 'Bled' })).toBeNull();
    expect(parseWikiSummary(null)).toBeNull();
    expect(parseWikiSummary('niz')).toBeNull();
  });

  test('sličica brez https → null, opis brez vsebine → null', () => {
    const w = parseWikiSummary({ ...WIKI_FIXTURE, thumbnail: { source: 'http://x' }, description: '  ' });
    expect(w?.thumb).toBeNull();
    expect(w?.description).toBeNull();
  });

  test('wikiShort: prelomi na besedi +TriTocke', () => {
    const long = 'Bléd je mesto in turistično središče z okoli 5200 prebivalci na Gorenjskem.';
    const short = wikiShort(long, 40);
    expect(short.length).toBeLessThanOrEqual(42);
    expect(short.endsWith('…')).toBe(true);
    expect(wikiShort('Kratek', 40)).toBe('Kratek');
    expect(wikiShort('a   b\n  c', 40)).toBe('a b c');
  });
});

// ————————————————————————————— VALUTE —————————————————————————————

describe('open-data — tečaji (er-api / currency-api)', () => {
  const ER_FIXTURE = {
    result: 'success',
    base_code: 'EUR',
    rates: { RSD: 117.44, MKD: 61.5, ALL: 91.3, BAM: 1.95583, TRY: 55.7, NUL: 'nisi' },
  };
  const CURRENCY_API_FIXTURE = { date: '2026-10-18', eur: { rsd: 117.29, mkd: 61.52, all: 91.19, bam: 1.95583 } };

  test('parseErApiRates: filtrira neštevilčne, zahteva result=success', () => {
    const r = parseErApiRates(ER_FIXTURE);
    expect(r?.RSD).toBeCloseTo(117.44);
    expect(r?.BAM).toBeCloseTo(1.95583);
    expect(r?.NUL).toBeUndefined();
    expect(parseErApiRates({ result: 'error', rates: { RSD: 1 } })).toBeNull();
    expect(parseErApiRates({ result: 'success' })).toBeNull();
    expect(parseErApiRates(null)).toBeNull();
  });

  test('parseCurrencyApiRates: male črke → velike', () => {
    const r = parseCurrencyApiRates(CURRENCY_API_FIXTURE);
    expect(r?.RSD).toBeCloseTo(117.29);
    expect(parseCurrencyApiRates({ date: 'x' })).toBeNull();
    expect(parseCurrencyApiRates(null)).toBeNull();
  });

  test('fmtThousand: pika za tisočice (določljivo)', () => {
    expect(fmtThousand(137)).toBe('137');
    expect(fmtThousand(8220)).toBe('8.220');
    expect(fmtThousand(1234567)).toBe('1.234.567');
  });

  test('balkanCurrencyLines: RSD/MKD/ALL na 10, BAM (peg) na 1', () => {
    const r = parseErApiRates(ER_FIXTURE)!;
    expect(balkanCurrencyLines(70, r)).toBe('≈ 8.220 RSD · 4.310 MKD · 6.390 ALL · 137 BAM');
    expect(balkanCurrencyLines(95, r)).toBe('≈ 11.160 RSD · 5.840 MKD · 8.670 ALL · 186 BAM');
  });

  test('balkanCurrencyLines: manjkajoči tečaji izpuščeni, prazno → prazen niz', () => {
    expect(balkanCurrencyLines(70, { RSD: 117.44 })).toBe('≈ 8.220 RSD');
    expect(balkanCurrencyLines(70, {})).toBe('');
    expect(balkanCurrencyLines(70, null)).toBe('');
    expect(balkanCurrencyLines(0, { RSD: 117.44 })).toBe('');
    expect(balkanCurrencyLines(-5, { RSD: 117.44 })).toBe('');
    expect(balkanCurrencyLines(Number.NaN, { RSD: 117.44 })).toBe('');
  });

  test('BALKAN_CURRENCIES pokrijejo ne-ECB balkanske valute', () => {
    expect(BALKAN_CURRENCIES).toEqual(['RSD', 'MKD', 'ALL', 'BAM']);
  });
});

// ————————————————————————————— PRAZNIKI —————————————————————————————

describe('open-data — prazniki (Nager.Date)', () => {
  const NAGER_FIXTURE = [
    { date: '2026-10-31', localName: 'dan reformacije', name: 'Reformation Day', countryCode: 'SI' },
    { date: '2026-11-01', localName: 'dan spomina na mrtve', name: 'Day of the Dead', countryCode: 'SI' },
    { date: '2026-12-25', localName: '   ', name: 'Christmas', countryCode: 'SI' }, // brez imena → izpuščen
    { date: 'napačen', localName: 'x' }, // napačen datum → izpuščen
    { date: '2026-12-26', localName: 'dan samostojnosti' },
  ];

  test('parseHolidays: prvih N veljavnih', () => {
    expect(parseHolidays(NAGER_FIXTURE, 2)).toEqual([
      { date: '2026-10-31', localName: 'dan reformacije' },
      { date: '2026-11-01', localName: 'dan spomina na mrtve' },
    ]);
    expect(parseHolidays(null)).toEqual([]);
    expect(parseHolidays('niz')).toEqual([]);
  });

  test('formatHolidayDate: brez vodilnih ničel, brez leta', () => {
    expect(formatHolidayDate('2026-10-31')).toBe('31. 10.');
    expect(formatHolidayDate('2026-01-05')).toBe('5. 1.');
    expect(formatHolidayDate('napačen')).toBe('');
  });

  test('holidaysLine: enovrstični izpis', () => {
    expect(holidaysLine(parseHolidays(NAGER_FIXTURE, 2))).toBe('dan reformacije, 31. 10. · dan spomina na mrtve, 1. 11.');
    expect(holidaysLine([])).toBe('');
  });

  test('countryFromDisplayName: slovenska + angleška imena, Kosovo izpuščeno', () => {
    expect(countryFromDisplayName('Mlino, Bled, 4260, Slovenija')).toBe('SI');
    expect(countryFromDisplayName('Skopje, Severna Makedonija')).toBe('MK');
    expect(countryFromDisplayName('Zagreb, Hrvatska'.replace('Hrvatska', 'Hrvaška'))).toBe('HR');
    expect(countryFromDisplayName('Sarajevo, Federation of Bosnia and Herzegovina, Bosnia and Herzegovina')).toBe('BA');
    expect(countryFromDisplayName('Pristina, Kosovo')).toBeNull();
    expect(countryFromDisplayName(null)).toBeNull();
    expect(countryFromDisplayName('')).toBeNull();
  });
});

// ————————————————————————————— REVERSE —————————————————————————————

describe('open-data — obratno geokodiranje', () => {
  test('parseReverse: name iz polja ali prvega segmenta display_name', () => {
    expect(parseReverse({ name: 'Mlino', display_name: 'Mlino, Bled, 4260, Slovenija', addresstype: 'hamlet' })).toEqual({
      name: 'Mlino',
      type: 'hamlet',
    });
    expect(parseReverse({ display_name: 'Triglav, Slovenija', addresstype: 'peak' })).toEqual({ name: 'Triglav', type: 'peak' });
    expect(parseReverse({ error: 'Unable to geocode' })).toBeNull();
    expect(parseReverse({})).toBeNull();
    expect(parseReverse(null)).toBeNull();
  });

  test('reverseTypeLabel: znane + neznane vrste', () => {
    expect(reverseTypeLabel('hamlet')).toBe('zaselek');
    expect(reverseTypeLabel('village')).toBe('vas');
    expect(reverseTypeLabel('peak')).toBe('vrh');
    expect(reverseTypeLabel('unknown_kind')).toBe('unknown_kind');
    expect(reverseTypeLabel(null)).toBe('');
    expect(REVERSE_TYPE_SL['city']).toBe('mesto');
  });
});

// ————————————————————————————— VHODNI PARAMETRI RUT —————————————————————————————

describe('open-data — vhodni parametri Next rut', () => {
  test('parseCoordsParam', () => {
    expect(parseCoordsParam('41.9981', '21.4254')).toEqual({ lat: 41.9981, lng: 21.4254 });
    expect(parseCoordsParam(null, '21')).toEqual({ error: expect.stringContaining('Manjkata') });
    expect(parseCoordsParam('95', '21')).toEqual({ error: expect.stringContaining('Neveljavna') });
    expect(parseCoordsParam('nisi', '21')).toEqual({ error: expect.stringContaining('Neveljavna') });
  });

  test('parseWikiParam', () => {
    expect(parseWikiParam('Bled', null)).toEqual({ title: 'Bled', lang: 'sl' });
    expect(parseWikiParam(null, null)).toEqual({ error: expect.stringContaining('Manjka') });
    expect(parseWikiParam('x'.repeat(121), null)).toEqual({ error: expect.stringContaining('predolg') });
    expect(parseWikiParam('Bled', 'slovenščina')).toEqual({ error: expect.stringContaining('Neveljaven') });
  });

  test('parseCountryParam', () => {
    expect(parseCountryParam('si')).toEqual({ country: 'SI' });
    expect(parseCountryParam('SI')).toEqual({ country: 'SI' });
    expect(parseCountryParam('XKG')).toEqual({ error: expect.stringContaining('ISO') });
    expect(parseCountryParam(null)).toEqual({ error: expect.stringContaining('ISO') });
  });

  test('oblikovni validatorji (fail-clean)', () => {
    expect(isValidWeatherPayload({ source: 'wttr.in', tempC: 13, desc: 'Pretežno oblačno', days: [], aqi: null, pm25: null })).toBe(true);
    expect(isValidWeatherPayload({ source: 'x', tempC: 13, desc: 'a', days: [], aqi: null, pm25: null })).toBe(false);
    expect(isValidWeatherPayload({ source: 'open-meteo', tempC: 'nisi', desc: 'a', days: [], aqi: null, pm25: null })).toBe(false);
    expect(isValidWeatherPayload(null)).toBe(false);
    expect(isValidHolidays([{ date: '2026-10-31', localName: 'dan reformacije' }])).toBe(true);
    expect(isValidHolidays([{ date: 'x', localName: 'x' }])).toBe(false);
    expect(isValidHolidays([])).toBe(true);
    expect(isValidRates({ RSD: 117.4 })).toBe(true);
    expect(isValidRates({ rsd: 117.4 })).toBe(false);
    expect(isValidRates({ RSD: -1 })).toBe(false);
    expect(isValidRates({})).toBe(false);
    expect(isValidReversePlace({ name: 'Mlino', type: 'hamlet' })).toBe(true);
    expect(isValidReversePlace({ name: 'Mlino', type: null })).toBe(true);
    expect(isValidReversePlace({ name: '' })).toBe(false);
  });
});

// ————————————————————————————— KATALOG ↔ WIKI —————————————————————————————

describe('open-data — vodič ima wiki naslove (odprti podatki)', () => {
  test('večina krajev ima wikiTitle (15 mest + 7 narave + 4/5 vasi + 4 kmečki)', () => {
    const withWiki = MAP_GUIDE_PLACES.filter((p) => typeof p.wikiTitle === 'string' && p.wikiTitle.length > 0);
    expect(withWiki.length).toBeGreaterThanOrEqual(29);
  });

  test('wikiTitle so enolični in brez presledkov na robovih', () => {
    const titles = MAP_GUIDE_PLACES.map((p) => p.wikiTitle).filter((t): t is string => typeof t === 'string');
    expect(new Set(titles).size).toBe(titles.length);
    for (const t of titles) expect(t.trim()).toBe(t);
  });
});

// ————————————————————————— ŽIVE VERIGE (mreža — bun v peskovniku) —————————————————————————

describe('open-data — žive verige (realni viri, brez ključev)', () => {
  // Peskovnik: Open-Meteo forecast ima dnevno kvoto 429 → veriga MORA pasti na
  // wttr.in (200). AQI je ločen vir (200). To je preizkus ODPRNOSTI: vsaj en
  // vir vremena + AQI morata delovati brez poverilnic.
  test('vreme: veriga vrne veljaven odgovor (open-meteo ali wttr.in rezerva)', async () => {
    const weather = await fetchWeatherChain(41.9981, 21.4254); // Skopje
    expect(weather.source === 'open-meteo' || weather.source === 'wttr.in').toBe(true);
    expect(Number.isFinite(weather.tempC)).toBe(true);
    expect(weather.desc.length).toBeGreaterThan(0);
    expect(weather.days.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  test('zrak: Open-Meteo AQI živo (european_aqi)', async () => {
    const res = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=41.9981&longitude=21.4254&current=european_aqi,pm2_5', {
      headers: { 'user-agent': 'i-feel-slovenia-demo/0.3 (fair-use demo)' },
      signal: AbortSignal.timeout(15_000),
    });
    expect(res.ok).toBe(true);
    const j = (await res.json()) as { current?: { european_aqi?: number } };
    expect(typeof j.current?.european_aqi).toBe('number');
  }, 30_000);

  test('wiki: Bled živo (opisni User-Agent) + manjkajoči članek → null', async () => {
    const bled = await fetchWikiChain('Bled', 'sl');
    expect(bled?.title).toBe('Bled');
    expect(bled?.extract.length).toBeGreaterThan(20);
    const brez = await fetchWikiChain('Smarkno-ni-ta-clanek-xyz', 'sl');
    expect(brez).toBeNull();
  }, 30_000);

  test('tečaji: veriga vrne RSD/MKD/ALL/BAM (er-api ali currency-api)', async () => {
    const rates = await fetchRatesChain();
    for (const cur of BALKAN_CURRENCIES) {
      expect(rates[cur]).toBeGreaterThan(0);
    }
  }, 30_000);

  test('prazniki: SI živo (naslednji javni)', async () => {
    const holidays = await fetchHolidaysChain('SI');
    expect(holidays.length).toBeGreaterThanOrEqual(1);
    expect(/^\d{4}-\d{2}-\d{2}$/.test(holidays[0].date)).toBe(true);
  }, 30_000);

  test('reverse: Bled živo (name + type)', async () => {
    const place = await fetchReverseChain(46.3683, 14.1144);
    expect(place?.name.length ?? 0).toBeGreaterThan(0);
  }, 30_000);
});
