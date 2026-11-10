/**
 * DELJENA POT — čista logika (Wanderlogov vzorec "poglej moj načrt").
 *
 * Uporabnikova "Moja pot" (voden tok + rezervirana prenočišča) dobi
 * kratko povezavo /pot/[koda], ki jo lahko pošlje sopotnikom. Prejemnik
 * vidi povzetek poti in jo z enim klikom uvozi v svoj vodeni tok —
 * aplikacija ga vodi naprej, brez ročnega prepisovanja.
 *
 * Čisto in testabilno: brez Reacta, brez `window`, brez baze. Baza in
 * mreža sta sloj API rute; uvoz v shrambo je sloj komponente.
 */

import {
  GUIDE_REGIONS,
  sanitizeGuideState,
  type GuideState,
  type GuideStayStop,
} from '@/lib/guide-store';
import { sanitizeOrderNames } from '@/lib/trip-order';

/** Kodirnik brez zablodljivih znakov (brez 0/O/1/I/L) — diktiranje po telefonu. */
export const TRIP_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const TRIP_CODE_LENGTH = 10;

/**
 * Kratka koda ima JAJKO črke/številke iz zgoraj omenjenega abecede. Vsaka
 * koda izven tega vzorca (npr. "x" + base64url) je STATELESS samozadostna
 * koda: payload je zakodiran v samo povezavo in ne potrebuje baze. To je
 * rezervni način deljenja, kadar strežnik nima baze (npr. Vercel serverless
 * brez provisionirane baze).
 */
export const TRIP_CODE_RE = /^[2-9A-Z]{6,16}$/;

/** Predpona stateless kod — zunaj kratkega abecede, zato brez kolizij. */
export const TRIP_STATELESS_PREFIX = 'x';
/** Zgornja meja dolžine stateless kode (pribl. 1 KB payloada v base64url). */
export const TRIP_STATELESS_MAX_LENGTH = 1200;

/**
 * Kratka koda deljene poti (npr. "K7M2XRQ4ZP"). Uporablja Web Crypto
 * (Node 18+ in brskalniki jo imajo); povratno Math.random samo če crypto
 * ni na voljo (nikoli v produkciji).
 */
export function generateTripCode(len: number = TRIP_CODE_LENGTH): string {
  const pick = (byte: number): string =>
    TRIP_CODE_ALPHABET[byte % TRIP_CODE_ALPHABET.length];
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(len);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, pick).join('');
  }
  let out = '';
  for (let i = 0; i < len; i++) {
    out += pick(Math.floor(Math.random() * 256));
  }
  return out;
}

/**
 * Payload za deljenje: NASPORNEJE vsebina poti, NE nastavitve seje.
 * Glas (voiceEnabled), časovni žigi in "answered" se ne prenašajo —
 * prejemnik dobi vsebino, tok pa ga vodi po njegovem tempu.
 */
export function sharedTripPayload(
  state: GuideState,
  stopOrder?: readonly string[] | null,
): string {
  const clean = sanitizeGuideState(state);
  if (!clean) throw new Error('shared-trip: neveljavno stanje');
  // Vrstni red je NEOBVEZEN dodatek: stare deljene poti brez polja ostanejo
  // veljavne, prejemnik brez prilagojenega reda pa dobi privzetega.
  const order = sanitizeOrderNames(stopOrder);
  return JSON.stringify({
    interests: clean.interests,
    region: clean.region,
    extraRegions: clean.extraRegions,
    days: clean.days,
    pace: clean.pace,
    stays: clean.stays,
    completedAt: clean.completedAt,
    ...(order ? { stopOrder: order } : {}),
  });
}

/** Prebere neobvezni vrstni red postankov iz (tujega) payloada. */
export function sharedStopOrder(payload: string): readonly string[] | null {
  try {
    const raw: unknown = JSON.parse(payload);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return sanitizeOrderNames((raw as Record<string, unknown>).stopOrder);
  } catch {
    return null;
  }
}

/**
 * STATELESS KODIRANJE — rezervni način deljenja brez baze.
 *
 * Koda = "x" + base64url(JSON payloada). Uporabniku se URL pokaže enako
 * (`/pot/x<koda>`), le da je daljši. Vsebina je že sanitizirana in javna
 * (ista kot tista, ki bi šla v bazo), zato podpis ni potreben; stran ob
 * dekodiranju znova SANITIZIRA — noben tuj vnos ne preživi.
 */
function base64UrlEncode(data: string): string {
  return btoa(unescape(encodeURIComponent(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(data: string): string | null {
  try {
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return null;
  }
}

/**
 * Zakodira deljeno pot v stateless kodo. Vrne null, če je vsebina
 * predolga ali neveljavna (potem je edina pot baza).
 */
export function encodeStatelessTripCode(
  state: GuideState,
  stopOrder?: readonly string[] | null,
): string | null {
  try {
    const payload = sharedTripPayload(state, stopOrder);
    const code = TRIP_STATELESS_PREFIX + base64UrlEncode(payload);
    return code.length <= TRIP_STATELESS_MAX_LENGTH ? code : null;
  } catch {
    return null; // neveljavno stanje — edina pot je baza
  }
}

/** Razčleni stateless kodo (hostilen vnos → null). */
export function decodeStatelessTripCode(
  code: string,
): { state: GuideState; stopOrder: readonly string[] | null } | null {
  if (!code.startsWith(TRIP_STATELESS_PREFIX)) return null;
  if (code.length < 8 || code.length > TRIP_STATELESS_MAX_LENGTH) return null;
  const payload = base64UrlDecode(code.slice(TRIP_STATELESS_PREFIX.length));
  if (payload === null) return null;
  const state = parseSharedTrip(payload);
  if (!state) return null;
  return { state, stopOrder: sharedStopOrder(payload) };
}

/** Ali je koda kratka (baza) ali stateless (samozadostna)? */
export function isShortTripCode(code: string): boolean {
  return TRIP_CODE_RE.test(code);
}

/** Prejemnikova stran: razčleni payload (hostilen vnos → null). */
export function parseSharedTrip(payload: string): GuideState | null {
  try {
    const raw: unknown = JSON.parse(payload);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const state = sanitizeGuideState({ ...(raw as object), version: 1, answered: GUIDE_STEPS_ALL });
    if (!state || !isShareable(state)) return null;
    return { ...state, voiceEnabled: false, updatedAt: new Date(0).toISOString() };
  } catch {
    return null;
  }
}

/** Ali payload sploh vreden deljenja (vsaj regija ALI interesi ALI prenočišča)? */
export function isShareable(state: GuideState | null): state is GuideState {
  if (!state) return false;
  return state.region !== null || state.interests.length > 0 || state.stays.length > 0;
}

const GUIDE_STEPS_ALL = ['interests', 'region', 'days', 'pace'] as const;

/** Naslov deljene poti (OG + pogled): "Gorenjska · 3 dni · 2 prenočišči". */
export function tripHeadline(state: GuideState): string {
  const region = GUIDE_REGIONS.find((g) => g.id === state.region);
  const parts: string[] = [region ? region.label.replace(/\s*\(.*\)$/, '') : 'Slovenija'];
  if (state.days) parts.push(`${state.days} ${state.days === 1 ? 'dan' : 'dni'}`);
  if (state.stays.length > 0) {
    const n = state.stays.length;
    parts.push(`${n} ${n === 1 ? 'prenočišče' : n === 2 ? 'prenočišči' : n === 3 || n === 4 ? 'prenočišča' : 'prenočišč'}`);
  }
  return parts.join(' · ');
}

/** Opis deljene poti (OG metapodatki) — interesi + tempo. */
export function tripShareDescription(state: GuideState): string {
  const bits: string[] = [];
  if (state.interests.length > 0) bits.push(state.interests.join(', '));
  if (state.pace) bits.push(`tempo: ${state.pace}`);
  return bits.length > 0
    ? `${bits.join(' · ')} — odpri pot na zemljevidu.`
    : 'Odpri pot na zemljevidu.';
}

/** Pogled plovbe po rezerviranih prenočiščih na strani deljene poti. */
export interface SharedTripStay {
  id: string;
  name: string;
  city: string;
  priceFrom: number | null;
}

export function sharedStays(state: GuideState): readonly SharedTripStay[] {
  return state.stays.map((s: GuideStayStop) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    priceFrom: s.priceFrom,
  }));
}

/**
 * Pravilo uvoza (čisto, brez UI): vsebina deljene poti zamenja prejemnikov
 * načrt; glas se VEDNO vzame od prejemnika (njegova naprava, njegov glas).
 * Če prejemnik že ima lasten načrt, komponenta vpraša (window.confirm) —
 * nikoli tiho ne prepišemo.
 */
export function importSharedState(
  current: GuideState | null,
  incoming: GuideState,
): GuideState {
  const base = current ?? {
    version: 1 as const,
    interests: [],
    region: null,
    days: null,
    pace: null,
    answered: [],
    stays: [],
    voiceEnabled: false,
    completedAt: null,
    updatedAt: new Date(0).toISOString(),
  };
  return {
    ...incoming,
    voiceEnabled: base.voiceEnabled,
  };
}

/** Ali prejemnik že ima lasten načrt (potreben bo potrditveni dialog)? */
export function hasOwnPlan(current: GuideState | null): boolean {
  return current !== null && current.answered.length > 0;
}
