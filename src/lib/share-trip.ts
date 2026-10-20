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
  formatDaysCount,
  formatStayCount,
  sanitizeGuideState,
  type GuideState,
  type GuideStayStop,
} from '@/lib/guide-store';

/** Kodirnik brez zablodljivih znakov (brez 0/O/1/I/L) — diktiranje po telefonu. */
export const TRIP_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const TRIP_CODE_LENGTH = 10;

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
export function sharedTripPayload(state: GuideState): string {
  const clean = sanitizeGuideState(state);
  if (!clean) throw new Error('shared-trip: neveljavno stanje');
  return JSON.stringify({
    interests: clean.interests,
    region: clean.region,
    days: clean.days,
    pace: clean.pace,
    stays: clean.stays,
    completedAt: clean.completedAt,
  });
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
  if (state.days) parts.push(formatDaysCount(state.days));
  if (state.stays.length > 0) parts.push(formatStayCount(state.stays.length));
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
