/**
 * GEOCODIRANJE URADNIH NASLOVOV (AJPES PRS) — Nominatim (OpenStreetMap).
 *
 * PRS vsebuje uradni poslovni naslov (ulica, hišna številka, naselje, pošta),
 * ne pa koordinat. Naslov geokodiramo s strukturiranim iskanjem Nominatim
 * (street/city), z DVOČLENO preveritvijo zadetka (ulica + hišna št.).
 *
 * Vljudnost: ≤ 1 zahteva/sekundo (uradna pravila rabe Nominatim), skupni
 * limiter na nivoju procesa. Največ 2 zahtevi na naslov:
 *   1. street+city  → zadetek »exact« (ulica in hišna št. se ujemata)
 *                     ali »street« (ulica se ujema, hišne št. ni v OSM)
 *   2. samo city    → »settlement« (središče naselja — približek)
 *
 * Geokodiranje je samo pomožni korak: URADNI naslov ostane iz AJPES PRS.
 */

import { normalizeCompare, normalizeHouseNumber } from '@/lib/ajpes-source';

export const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
export const NOMINATIM_USER_AGENT = 'discover-slovenia-ai/1.0 (slovenian travel demo; fair-use)';
export const NOMINATIM_DELAY_MS = 1100;

/** Photon (komoot) — prav tako zgrajen nad OpenStreetMap, obilnejša raba. */
export const PHOTON_BASE = 'https://photon.komoot.io/api';
export const PHOTON_DELAY_MS = 450;

/** Minimalni fetch tip (testabilnost — resnični fetch poda klicatelj). */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<Response>;

/** Rezultat geokodiranja enega uradnega naslova. */
export interface GeocodeOutcome {
  match: 'exact' | 'street' | 'settlement' | 'miss';
  lat: number | null;
  lng: number | null;
  /** Občina iz naslovnih podatkov (Nominatim address.municipality). */
  obcina: string | null;
  /** true, če je Nominatim vrnil hišno številko, ki se ujema. */
  houseNumberVerified: boolean;
  /** true, če je »miss« posledica začasne napake (NE gre v negativni predpomnilnik). */
  transient?: boolean;
}

/** Strukturiran naslov za geokodiranje. */
export interface StructuredAddress {
  ulica: string;
  hs: string;
  hsDodatek: string;
  naselje: string;
}

// ─── Vljudnostni limiterji (celoten proces) ─────────────────────────────────

let lastRequestAt = 0;
let queueTail: Promise<void> = Promise.resolve();
let lastPhotonRequestAt = 0;
let photonQueueTail: Promise<void> = Promise.resolve();

/** Vrne promise, ki se razreši, ko je vrsta na potezi (vsaj delayMs od prejšnje). */
function scheduleRequest(): Promise<void> {
  const job = queueTail.then(async () => {
    const wait = lastRequestAt + NOMINATIM_DELAY_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  queueTail = job.catch(() => undefined);
  return job;
}

/** Ločen vljudnostni limiter za Photon (~2 zahtevi/s). */
function schedulePhotonRequest(): Promise<void> {
  const job = photonQueueTail.then(async () => {
    const wait = lastPhotonRequestAt + PHOTON_DELAY_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastPhotonRequestAt = Date.now();
  });
  photonQueueTail = job.catch(() => undefined);
  return job;
}

// ─── Nominatim klici ─────────────────────────────────────────────────────────

interface NominatimHit {
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
}

/** Rezultat enega Nominatim klica. */
type SearchResult =
  | { kind: 'hit'; hit: NominatimHit }
  | { kind: 'empty' }
  | { kind: 'error' };

/** Napaka, ko Nominatim vztrajno omejuje (429). */
export class RateLimitError extends Error {
  constructor() {
    super('Nominatim: 429 Too Many Requests (začasna blokada)');
    this.name = 'RateLimitError';
  }
}

// Varovalka: ob vztrajnem 429 Nominatim spolh preskočimo (10 min), da
// ne upočasnjujemo cevovoda — Photon (OSM) takrat pokrije geokodiranje.
const NOMINATIM_BREAKER_MS = 10 * 60 * 1000;
let nominatimBlockedUntil = 0;
let consecutiveRateLimits = 0;

/**
 * Photon (OSM) — prostobesedilno iskanje naslova. Vrne enoten SearchResult;
 * težave → 'error' (nikoli ne meče izjeme, razen nevarnega stanja).
 */
async function searchPhoton(doFetch: FetchLike, q: string, timeoutMs = 12_000): Promise<SearchResult> {
  await schedulePhotonRequest();
  // Omejitev na Slovenijo (bbox: minLon,minLat,maxLon,maxLat)
  const url = `${PHOTON_BASE}/?q=${encodeURIComponent(q)}&limit=1&bbox=13.3,45.3,16.7,47.0`;
  try {
    const res = await doFetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
    });
    if (!res.ok) return { kind: 'error' };
    const json: unknown = await res.json();
    const features = (json as { features?: unknown })?.features;
    if (!Array.isArray(features) || features.length === 0) return { kind: 'empty' };
    const f = features[0] as {
      geometry?: { coordinates?: [number, number] };
      properties?: Record<string, string>;
    };
    const coords = f.geometry?.coordinates;
    const props = f.properties ?? {};
    if (!Array.isArray(coords) || coords.length !== 2) return { kind: 'empty' };
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { kind: 'empty' };
    return {
      kind: 'hit',
      hit: {
        lat: String(lat),
        lon: String(lng),
        address: {
          road: props['street'] ?? '',
          house_number: props['housenumber'] ?? '',
          city: props['city'] ?? props['town'] ?? props['village'] ?? props['name'] ?? '',
          municipality: props['county'] ?? '',
          postcode: props['postcode'] ?? '',
        },
      },
    };
  } catch {
    return { kind: 'error' };
  }
}

/** Strukturirano iskanje (street + city). Loči prazen zadetek od napake. */
async function searchNominatim(
  doFetch: FetchLike,
  params: Record<string, string>,
  timeoutMs = 15_000,
): Promise<SearchResult> {
  if (Date.now() < nominatimBlockedUntil) throw new RateLimitError();
  await scheduleRequest();
  const query = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
    countrycodes: 'si',
    'accept-language': 'sl',
    ...params,
  });
  const url = `${NOMINATIM_BASE}/search?${query.toString()}`;

  // Ena ponovitev ob 429 (kratka blokada) — naslednja zahteva je počakala
  // vsaj NOMINATIM_DELAY_MS, tako da je zamik skupaj že razumen.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await doFetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      });
      if (res.status === 429 || res.status === 503) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 5_000));
          continue;
        }
        consecutiveRateLimits += 1;
        if (consecutiveRateLimits >= 3) {
          nominatimBlockedUntil = Date.now() + NOMINATIM_BREAKER_MS;
        }
        throw new RateLimitError();
      }
      consecutiveRateLimits = 0;
      if (!res.ok) return { kind: 'error' };
      const json: unknown = await res.json();
      if (!Array.isArray(json) || json.length === 0) return { kind: 'empty' };
      const first = json[0];
      return first && typeof first === 'object' ? { kind: 'hit', hit: first as NominatimHit } : { kind: 'empty' };
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      return { kind: 'error' }; // omrežje/timeout — ne gre v negativni predpomnilnik
    }
  }
  return { kind: 'error' };
}

// ─── Preverjanje zadetka ─────────────────────────────────────────────────────

const SETTLEMENT_KEYS = ['city', 'town', 'village', 'hamlet', 'suburb', 'borough'] as const;

/** Naselje iz naslovnih podatkov (prvi podan ključ). */
function settlementFromAddress(address: Record<string, string>): string | null {
  for (const key of SETTLEMENT_KEYS) {
    const v = (address[key] ?? '').trim();
    if (v) return v;
  }
  return null;
}

/** Občina iz naslovnih podatkov (municipality, sicer naselje). */
function obcinaFromAddress(address: Record<string, string>): string | null {
  const mun = (address['municipality'] ?? '').trim();
  if (mun) return mun;
  return settlementFromAddress(address);
}

/** Kvaliteten lat/lon iz zadetka ali null. */
function coordsFromHit(hit: NominatimHit): { lat: number; lng: number } | null {
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 45.2 || lat > 47.1 || lng < 13.1 || lng > 16.9) return null;
  return { lat, lng };
}

/**
 * Geokodiraj en uradni naslov (AJPES PRS) z največ 2 zahtevama.
 *
 *  1) street (»Ulica 17a«) + city (naselje): preverimo ulico in hišno št.
 *     → »exact« (ujemata se) oz. »street« (ulica se ujema, hišne št. ni v OSM
 *       oz. jo je OSM prikazala drugače — približek na raven ulice).
 *  2) rezerva: samo city → središče naselja → »settlement«.
 *  3) »miss« — naslova ni mogoče preveriti (prikaže se brez pina).
 */
/** Preveri ulični zadetek (ulica [+ hišna št.]) — vrne rezultat ali null. */
function acceptStreetHit(
  hit: NominatimHit,
  ulicaN: string,
  hsFullN: string,
): GeocodeOutcome | null {
  const address = hit.address ?? {};
  const road = normalizeCompare(address['road'] ?? '');
  const houseNumber = address['house_number'] ? normalizeHouseNumber(address['house_number']) : '';
  const houseMatch = Boolean(houseNumber) && normalizeCompare(houseNumber) === hsFullN;
  if (road && road === ulicaN && (!houseNumber || houseMatch)) {
    const coords = coordsFromHit(hit);
    if (coords) {
      return {
        match: houseMatch ? 'exact' : 'street',
        lat: coords.lat,
        lng: coords.lng,
        obcina: obcinaFromAddress(address),
        houseNumberVerified: houseMatch,
      };
    }
  }
  return null;
}

/** Preveri zadetek naselja (središče naselja — približek) ali vrne null. */
function acceptSettlementHit(hit: NominatimHit, naselje: string): GeocodeOutcome | null {
  const coords = coordsFromHit(hit);
  if (!coords) return null;
  const address = hit.address ?? {};
  const settlement = settlementFromAddress(address);
  const matches = Boolean(settlement) && normalizeCompare(settlement ?? '') === normalizeCompare(naselje);
  if (!matches) return null;
  return {
    match: 'settlement',
    lat: coords.lat,
    lng: coords.lng,
    obcina: obcinaFromAddress(address),
    houseNumberVerified: false,
  };
}

/**
 * Geokodiraj en uradni naslov (AJPES PRS).
 *
 * Potek (obračunava tudi blokade posamezne storitve):
 *  1) Photon: »ulica hs, naselje" → »exact« / »street« (preverjena ulica)
 *  2) Nominatim strukturirano (street+city) → »exact« / »street«
 *  3) Photon/Nominatim: samo naselje → »settlement« (približek)
 *  4) »miss« — če je bila katera storitev nedosegljiva, je rezultat
 *     `transient: true` (NE gre v negativni predpomnilnik).
 */
export async function geocodeStructuredAddress(
  doFetch: FetchLike,
  addr: StructuredAddress,
): Promise<GeocodeOutcome> {
  const miss: GeocodeOutcome = { match: 'miss', lat: null, lng: null, obcina: null, houseNumberVerified: false, transient: false };
  const ulica = normalizeCompare(addr.ulica);
  const hs = normalizeHouseNumber(addr.hs);
  const hsFull = normalizeCompare(hs + addr.hsDodatek);
  if (!ulica || !addr.naselje) return miss;

  const cityQ = addr.naselje.trim();
  const streetQuery = [addr.ulica.trim(), hs + addr.hsDodatek.trim()].filter(Boolean).join(' ');
  let anyError = false;

  // 1) Photon: ulica + hišna št.
  const ph = await searchPhoton(doFetch, `${streetQuery}, ${cityQ}`);
  if (ph.kind === 'error') anyError = true;
  else if (ph.kind === 'hit') {
    const accepted = acceptStreetHit(ph.hit, ulica, hsFull);
    if (accepted) return accepted;
  }

  // 2) Nominatim: strukturirano street + city (429 → ne kritično)
  let nom: SearchResult;
  try {
    nom = await searchNominatim(doFetch, { street: streetQuery, city: cityQ });
  } catch (err) {
    if (err instanceof RateLimitError) {
      anyError = true;
      nom = { kind: 'error' };
    } else {
      throw err;
    }
  }
  if (nom.kind === 'error') anyError = true;
  else if (nom.kind === 'hit') {
    const accepted = acceptStreetHit(nom.hit, ulica, hsFull);
    if (accepted) return accepted;
  }

  // 3) Photon: središče naselja (približek)
  const phc = await searchPhoton(doFetch, cityQ);
  if (phc.kind === 'error') anyError = true;
  else if (phc.kind === 'hit') {
    const accepted = acceptSettlementHit(phc.hit, cityQ);
    if (accepted) return accepted;
  }

  // 4) Nominatim: središče naselja (približek)
  let nomc: SearchResult;
  try {
    nomc = await searchNominatim(doFetch, { city: cityQ });
  } catch (err) {
    if (err instanceof RateLimitError) {
      anyError = true;
      nomc = { kind: 'error' };
    } else {
      throw err;
    }
  }
  if (nomc.kind === 'error') anyError = true;
  else if (nomc.kind === 'hit') {
    const accepted = acceptSettlementHit(nomc.hit, cityQ);
    if (accepted) return accepted;
  }

  return anyError ? { ...miss, transient: true } : miss;
}
