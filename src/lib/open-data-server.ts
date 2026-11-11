/**
 * ODPRTI PODATKI — skupni strežniški pomožniki (ČISTO: brez `next/server`,
 * da jih bun testi in bun mini storitev lahko uvažata brez Next runtime).
 *
 * Vsebuje vhodne razčlenjevalnike + oblikovne validatorje za posredniške
 * rute /api/open-data/*. Fail-clean filozofija: karkoli odmika → null/false.
 */

import type { Holiday, ReversePlace, WeatherPayload } from './open-data';

/** Razčleni koordinati ali napaka (slovensko). */
export function parseCoordsParam(latRaw: string | null, lngRaw: string | null): { lat: number; lng: number } | { error: string } {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (latRaw === null || lngRaw === null || latRaw.trim() === '' || lngRaw.trim() === '') {
    return { error: 'Manjkata koordinati (npr. ?lat=41.9981&lng=21.4254).' };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
    return { error: 'Neveljavna koordinata — pričakovano lat (±85) in lng (±180).' };
  }
  return { lat, lng };
}

/** Preveri obliko WeatherPayload (iz storitve/upstreama) — fail-clean. */
export function isValidWeatherPayload(w: unknown): w is WeatherPayload {
  if (!w || typeof w !== 'object') return false;
  const j = w as { source?: unknown; tempC?: unknown; desc?: unknown; days?: unknown; aqi?: unknown; pm25?: unknown };
  return (
    (j.source === 'open-meteo' || j.source === 'wttr.in') &&
    typeof j.tempC === 'number' && Number.isFinite(j.tempC) &&
    typeof j.desc === 'string' && j.desc.length > 0 &&
    Array.isArray(j.days) &&
    (j.aqi === null || typeof j.aqi === 'number') &&
    (j.pm25 === null || typeof j.pm25 === 'number')
  );
}

/** Razčleni wiki naslov+jezik ali napaka (slovensko). */
export function parseWikiParam(titleRaw: string | null, langRaw: string | null): { title: string; lang: string } | { error: string } {
  const title = (titleRaw ?? '').trim();
  const lang = (langRaw ?? 'sl').trim().toLowerCase();
  if (title.length === 0) return { error: 'Manjka naslov članka (npr. ?title=Bled).' };
  if (title.length > 120) return { error: 'Naslov članka je predolg (največ 120 znakov).' };
  if (!/^[a-z]{2,3}$/.test(lang)) return { error: 'Neveljaven jezik (pričakovano 2–3 črke, npr. sl).' };
  return { title, lang };
}

/** Razčleni ISO kodo države ali napaka (slovensko). */
export function parseCountryParam(raw: string | null): { country: string } | { error: string } {
  const country = (raw ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return { error: 'Manjka/neveljavna država — pričakovana 2-mestna ISO koda (npr. ?country=SI).' };
  }
  return { country };
}

/** Preveri obliko seznama praznikov — fail-clean. */
export function isValidHolidays(v: unknown): v is Holiday[] {
  return (
    Array.isArray(v) &&
    v.every((h) => {
      if (!h || typeof h !== 'object') return false;
      const j = h as { date?: unknown; localName?: unknown };
      return typeof j.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.date) && typeof j.localName === 'string' && j.localName.length > 0;
    })
  );
}

/** Preveri obliko obratno geokodirane točke — fail-clean. */
export function isValidReversePlace(v: unknown): v is ReversePlace {
  if (!v || typeof v !== 'object') return false;
  const j = v as { name?: unknown; type?: unknown };
  return typeof j.name === 'string' && j.name.length > 0 && (j.type === null || typeof j.type === 'string');
}

/** Preveri obliko tabele tečajev { RSD: 117.4, … } — fail-clean. */
export function isValidRates(r: unknown): r is Record<string, number> {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  const entries = Object.entries(r as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every(([k, v]) => /^[A-Z]{3}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0);
}
