/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { emptyGuideState, type GuideState } from '../src/lib/guide-store';
import {
  TRIP_CODE_ALPHABET,
  TRIP_CODE_LENGTH,
  TRIP_STATELESS_MAX_LENGTH,
  TRIP_STATELESS_PREFIX,
  decodeStatelessTripCode,
  encodeStatelessTripCode,
  generateTripCode,
  hasOwnPlan,
  importSharedState,
  isShareable,
  isShortTripCode,
  parseSharedTrip,
  sharedStopOrder,
  sharedStays,
  sharedTripPayload,
  tripHeadline,
  tripShareDescription,
} from '../src/lib/share-trip';

function stateWith(overrides: Partial<GuideState>): GuideState {
  return { ...emptyGuideState(), ...overrides };
}

const FULL: GuideState = stateWith({
  interests: ['narava', 'hrana'],
  region: 'gorenjska',
  days: 3,
  pace: 'zmeren',
  answered: ["region", "days", "pace"],
  stays: [
    {
      id: 'n123',
      name: 'Guesthouse Jezero',
      city: 'Bled',
      lat: 46.36,
      lng: 14.09,
      priceFrom: 65,
      reservedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
});

describe('share-trip — kodirnik deljene poti', () => {
  test('koda ima pravo dolžino in je iz varne abecede (brez 0/O/1/I/L)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateTripCode();
      expect(code).toHaveLength(TRIP_CODE_LENGTH);
      for (const ch of code) {
        expect(TRIP_CODE_ALPHABET.includes(ch)).toBe(true);
      }
    }
  });

  test('kode so unikatne (50 zaporednih generacij → 50 različnih)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) set.add(generateTripCode());
    expect(set.size).toBe(50);
  });
});

describe('share-trip — payload (nasporne vsebina, ne nastavitve seje)', () => {
  test('payload NE vsebuje glasu in časovnega žiga updatedAt', () => {
    const payload = sharedTripPayload(FULL);
    const obj = JSON.parse(payload) as Record<string, unknown>;
    expect(obj.voiceEnabled).toBeUndefined();
    expect(obj.updatedAt).toBeUndefined();
    expect(obj.region).toBe('gorenjska');
    expect(obj.stays).toHaveLength(1);
  });

  test('prilagojen vrstni red se deli; stare povezave ostanejo brez njega', () => {
    const payload = sharedTripPayload(FULL, ['Bohinj', 'Bled']);
    expect(JSON.parse(payload).stopOrder).toEqual(['Bohinj', 'Bled']);
    expect(sharedStopOrder(payload)).toEqual(['Bohinj', 'Bled']);
    expect(sharedStopOrder(sharedTripPayload(FULL))).toBeNull();
  });

  test('sharedStopOrder prečisti podvojene in neveljavne vnose', () => {
    expect(
      sharedStopOrder(JSON.stringify({ stopOrder: [' Bled ', 42, 'Bled', 'Bohinj'] })),
    ).toEqual(['Bled', 'Bohinj']);
  });

  test('okrogel sprehod: payload → parseSharedTrip → enaka vsebina, sveža seja', () => {
    const parsed = parseSharedTrip(sharedTripPayload(FULL));
    expect(parsed).not.toBeNull();
    expect(parsed?.region).toBe('gorenjska');
    expect(parsed?.days).toBe(3);
    expect(parsed?.pace).toBe('zmeren');
    expect(parsed?.interests).toEqual(['narava', 'hrana']);
    expect(parsed?.stays[0]?.name).toBe('Guesthouse Jezero');
    // prejemnik dobi svojo seja: glas izklopljen, žig nevtralen
    expect(parsed?.voiceEnabled).toBe(false);
  });

  test('hostilen payload → fail-clean (null)', () => {
    expect(parseSharedTrip('nismo json')).toBeNull();
    expect(parseSharedTrip(JSON.stringify(['tabela']))).toBeNull();
    expect(parseSharedTrip(JSON.stringify({ region: 42 }))).toBeNull();
  });

  test('delna pot: uvoz vpraša SAMO manjkajoče korake (vsebina odloča)', () => {
    const partial = sharedTripPayload(stateWith({ region: 'primorska' }));
    const parsed = parseSharedTrip(partial);
    expect(parsed).not.toBeNull();
    // answered je vse odgovorjeno, a isStepAnswered preverja vsebino —
    // days/pace so null, zato vodič nadaljuje pri "days".
    expect(parsed?.answered).toContain('days');
    expect(parsed?.days).toBeNull();
  });
});

describe('share-trip — pogoj deljenja in naslovi', () => {
  test('prazno stanje NI deljivo; regija/interesi/prenočišča posamično so', () => {
    expect(isShareable(emptyGuideState())).toBe(false);
    expect(isShareable(stateWith({ region: 'osrednja' }))).toBe(true);
    expect(isShareable(stateWith({ interests: ['vino'] }))).toBe(true);
    expect(
      isShareable(stateWith({ stays: [{ id: 'n1', name: 'H', city: 'B', lat: 46, lng: 14, priceFrom: null, reservedAt: '' }] })),
    ).toBe(true);
    expect(isShareable(null)).toBe(false);
  });

  test('naslov: regija + dnevi + prenočišča (slovensko sklanjanje)', () => {
    expect(tripHeadline(FULL)).toBe('Gorenjska · 3 dni · 1 prenočišče');
    const two = stateWith({ region: 'primorska', days: 5, stays: FULL.stays.concat(FULL.stays[0]!) });
    expect(tripHeadline(two)).toBe('Primorska · 5 dni · 2 prenočišči');
    const none = stateWith({});
    expect(tripHeadline(none)).toBe('Slovenija');
    const oneDay = stateWith({ days: 1 });
    expect(tripHeadline(oneDay)).toBe('Slovenija · 1 dan');
  });

  test('opis vsebuje interese in tempo; brez njiju spodbuda na zemljevid', () => {
    expect(tripShareDescription(FULL)).toContain('narava, hrana');
    expect(tripShareDescription(FULL)).toContain('tempo: zmeren');
    expect(tripShareDescription(stateWith({}))).toContain('zemljevidu');
  });

  test('sharedStays izpostavi le prikazna polja', () => {
    const stays = sharedStays(FULL);
    expect(stays).toEqual([
      { id: 'n123', name: 'Guesthouse Jezero', city: 'Bled', priceFrom: 65 },
    ]);
  });
});

describe('share-trip — stateless koda (rezerva brez baze)', () => {
  test('round-trip: zakodirano → dekodirano ohrani vso vsebino in stopOrder', () => {
    const order = ['Bohinj', 'Bled'] as const;
    const code = encodeStatelessTripCode(FULL, order)!;
    expect(code).not.toBeNull();
    expect(code.startsWith(TRIP_STATELESS_PREFIX)).toBe(true);
    expect(code.length).toBeLessThanOrEqual(TRIP_STATELESS_MAX_LENGTH);
    expect(isShortTripCode(code)).toBe(false);

    const decoded = decodeStatelessTripCode(code)!;
    expect(decoded).not.toBeNull();
    expect(decoded.state.region).toBe('gorenjska');
    expect(decoded.state.interests).toEqual(['narava', 'hrana']);
    expect(decoded.state.days).toBe(3);
    expect(decoded.state.stays).toHaveLength(1);
    expect(decoded.stopOrder).toEqual(['Bohinj', 'Bled']);
  });

  test('brez stopOrder: koda deluje in red je null', () => {
    const code = encodeStatelessTripCode(FULL)!;
    const decoded = decodeStatelessTripCode(code)!;
    expect(decoded.stopOrder).toBeNull();
    expect(decoded.state.region).toBe('gorenjska');
  });

  test('vsaka kratka koda se NE more dekodirati kot stateless', () => {
    const short = generateTripCode();
    expect(isShortTripCode(short)).toBe(true);
    expect(decodeStatelessTripCode(short)).toBeNull();
  });

  test('hostilni vnosi → null (nikoli izjema)', () => {
    expect(decodeStatelessTripCode('')).toBeNull();
    expect(decodeStatelessTripCode('x')).toBeNull();
    expect(decodeStatelessTripCode('x@@@')).toBeNull();
    expect(decodeStatelessTripCode('x' + 'A'.repeat(TRIP_STATELESS_MAX_LENGTH + 1))).toBeNull();
    expect(decodeStatelessTripCode('x!!not-base64!!')).toBeNull();
  });

  test('neveljavno stanje → encode vrne null (edina pot je baza)', () => {
    const broken = stateWith({ version: 2 as never });
    expect(encodeStatelessTripCode(broken)).toBeNull();
  });
});

describe('share-trip — pravilo uvoza', () => {
  test('prejemnik brez lastnega načrta: uvozi vsebino, glas OSTANE prejemnikov', () => {
    const incoming = parseSharedTrip(sharedTripPayload(FULL))!;
    const current = stateWith({ voiceEnabled: true });
    const next = importSharedState(current, incoming);
    expect(next.region).toBe('gorenjska');
    expect(next.stays).toHaveLength(1);
    expect(next.voiceEnabled).toBe(true); // naprava prejemnika, njegov glas
  });

  test('prejemnik brez seje: uvoz deluje tudi brez obstoječega stanja', () => {
    const incoming = parseSharedTrip(sharedTripPayload(FULL))!;
    const next = importSharedState(null, incoming);
    expect(next.region).toBe('gorenjska');
    expect(next.voiceEnabled).toBe(false);
  });

  test('hasOwnPlan: samo odgovorjeni koraki štejejo (prazna seja → brez dialoga)', () => {
    expect(hasOwnPlan(null)).toBe(false);
    expect(hasOwnPlan(emptyGuideState())).toBe(false);
    expect(hasOwnPlan(FULL)).toBe(true);
  });
});

describe('share-trip — extraRegions (večdržavna pot)', () => {
  test('round-trip: payload prenese extraRegions, sanitizacija jih omeji', () => {
    const multi = stateWith({
      region: 'srbija',
      extraRegions: ['hrvaska', 'crna-gora'],
    });
    const payload = sharedTripPayload(multi);
    const decoded = parseSharedTrip(payload)!;
    expect(decoded.region).toBe('srbija');
    expect(decoded.extraRegions).toEqual(['hrvaska', 'crna-gora']);
  });

  test('neveljavne dodatne regije se zavržejo', () => {
    const bad = stateWith({
      region: 'srbija',
      extraRegions: ['hrvaska', 'neznana'] as never[],
    });
    const decoded = parseSharedTrip(sharedTripPayload(bad))!;
    expect(decoded.extraRegions).toEqual(['hrvaska']);
  });
});
