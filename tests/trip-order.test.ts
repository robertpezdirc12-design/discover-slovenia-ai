import { describe, expect, test } from 'bun:test';

import {
  MAX_TRIP_ORDER_NAMES,
  applyStopOrder,
  differsFromOrder,
  moveStop,
  moveStopByName,
  nudgeStop,
  parseTripOrderMap,
  regionStopOrder,
  sanitizeOrderNames,
  serializeTripOrderMap,
  stopRouteKey,
  withRegionStopOrder,
} from '@/lib/trip-order';

type Stop = { name: string; lat: number };
const STOPS: Stop[] = [
  { name: 'Bled', lat: 46.36 },
  { name: 'Bohinj', lat: 46.27 },
  { name: 'Kranjska Gora', lat: 46.48 },
];
const names = (s: readonly { name: string }[]): string[] => s.map((x) => x.name);

describe('trip-order — moveStop / nudgeStop', () => {
  test('premakne prvo na zadnjo pozicijo (končni indeks, ne zamenjava)', () => {
    expect(names(moveStop(STOPS, 0, 2))).toEqual(['Bohinj', 'Kranjska Gora', 'Bled']);
  });

  test('premakne zadnjo na prvo', () => {
    expect(names(moveStop(STOPS, 2, 0))).toEqual(['Kranjska Gora', 'Bled', 'Bohinj']);
  });

  test('vmesni premik ohrani vse postanke brez podvajanja', () => {
    const next = moveStop(STOPS, 0, 1);
    expect(names(next)).toEqual(['Bohinj', 'Bled', 'Kranjska Gora']);
    expect(next).toHaveLength(3);
  });

  test('neveljavni indeksi in isti indeks vrnejo ISTO referenco', () => {
    expect(moveStop(STOPS, 0, 0)).toBe(STOPS);
    expect(moveStop(STOPS, -1, 1)).toBe(STOPS);
    expect(moveStop(STOPS, 0, 99)).toBe(STOPS);
    expect(moveStop(STOPS, 1.5, 0)).toBe(STOPS);
    expect(moveStop(STOPS, Number.NaN, 1)).toBe(STOPS);
  });

  test('prazen seznam ne vrže napake', () => {
    expect(moveStop([], 0, 0)).toEqual([]);
  });

  test('ne Mutira vhodnega niza', () => {
    const copy = [...STOPS];
    moveStop(STOPS, 0, 2);
    expect(STOPS).toEqual(copy);
  });

  test('nudgeStop: gor in dol, na robovih brez spremembe', () => {
    expect(names(nudgeStop(STOPS, 1, -1))).toEqual(['Bohinj', 'Bled', 'Kranjska Gora']);
    expect(names(nudgeStop(STOPS, 0, 1))).toEqual(['Bohinj', 'Bled', 'Kranjska Gora']);
    expect(nudgeStop(STOPS, 0, -1)).toBe(STOPS);
    expect(nudgeStop(STOPS, 2, 1)).toBe(STOPS);
  });
});

describe('trip-order — moveStopByName (vmesnik @dnd-kit)', () => {
  test('premakne po imenih aktivne in ciljne postanke', () => {
    expect(names(moveStopByName(STOPS, 'Bled', 'Kranjska Gora'))).toEqual([
      'Bohinj', 'Kranjska Gora', 'Bled',
    ]);
  });

  test('neznano ime (zastareli drag) ne spremeni reda', () => {
    expect(moveStopByName(STOPS, 'Neznano', 'Bled')).toBe(STOPS);
    expect(moveStopByName(STOPS, 'Bled', 'Neznano')).toBe(STOPS);
  });

  test('spust na samega sebe je no-op', () => {
    expect(moveStopByName(STOPS, 'Bled', 'Bled')).toBe(STOPS);
  });
});

describe('trip-order — applyStopOrder (shranjen red)', () => {
  test('null / prazen red ohrani privzeti (ista referenca)', () => {
    expect(applyStopOrder(STOPS, null)).toBe(STOPS);
    expect(applyStopOrder(STOPS, [])).toBe(STOPS);
  });

  test('uveljavi obrnjen red', () => {
    expect(names(applyStopOrder(STOPS, ['Kranjska Gora', 'Bled', 'Bohinj']))).toEqual([
      'Kranjska Gora', 'Bled', 'Bohinj',
    ]);
  });

  test('Nove postanke se dodajo na konec (sprememba TRIP_PLAN ne izgubi destinacije)', () => {
    expect(names(applyStopOrder(STOPS, ['Bohinj']))).toEqual([
      'Bohinj', 'Bled', 'Kranjska Gora',
    ]);
  });

  test('neznana in podvojena imena se prezrejo, nobena postanka ne izgine', () => {
    const next = applyStopOrder(STOPS, ['Bohinj', 'Bohinj', 'Atlantida', 'Bled']);
    expect(names(next)).toEqual(['Bohinj', 'Bled', 'Kranjska Gora']);
    expect(next).toHaveLength(STOPS.length);
  });

  test('ohrani objekte (koordinate, opisi) — ne izdela novih', () => {
    const next = applyStopOrder(STOPS, ['Bohinj']);
    expect(next[0]).toBe(STOPS[1]);
    expect(next[0].lat).toBe(46.27);
  });

  test('prazen plan + poljuben red → prazen plan', () => {
    expect(applyStopOrder([], ['Bled'])).toEqual([]);
  });
});

describe('trip-order — differsFromOrder', () => {
  test('privzeti red ali null ni prilagojen', () => {
    expect(differsFromOrder(STOPS, null)).toBe(false);
    expect(differsFromOrder(STOPS, ['Bled', 'Bohinj', 'Kranjska Gora'])).toBe(false);
  });

  test('spremenjen red je prilagojen', () => {
    expect(differsFromOrder(STOPS, ['Bohinj', 'Bled', 'Kranjska Gora'])).toBe(true);
  });

  test('red, ki vsebuje le neznana imena, ni prilagojen', () => {
    expect(differsFromOrder(STOPS, ['Atlantida'])).toBe(false);
  });
});

describe('trip-order — sanitizeOrderNames (tuj vnos)', () => {
  test('odstrani ne-nize, praznine in podvojenja', () => {
    expect(sanitizeOrderNames([' Bled ', 'Bled', '', 42, null, 'Bohinj'])).toEqual(['Bled', 'Bohinj']);
  });

  test('neveljavna oblika → null', () => {
    expect(sanitizeOrderNames(null)).toBeNull();
    expect(sanitizeOrderNames('Bled')).toBeNull();
    expect(sanitizeOrderNames([])).toBeNull();
    expect(sanitizeOrderNames([1, 2])).toBeNull();
  });

  test('omeji dolžino imena in število vnosov', () => {
    const long = 'X'.repeat(200);
    expect(sanitizeOrderNames([long])![0]).toHaveLength(80);
    const many = Array.from({ length: 100 }, (_, i) => `Kraj ${i}`);
    expect(sanitizeOrderNames(many)).toHaveLength(MAX_TRIP_ORDER_NAMES);
  });
});

describe('trip-order — localStorage zapis po regijah', () => {
  test('pokvarjen JSON / napačna oblika → prazna mapa', () => {
    expect(parseTripOrderMap('{neveljaven')).toEqual({});
    expect(parseTripOrderMap('[]')).toEqual({});
    expect(parseTripOrderMap('null')).toEqual({});
    expect(parseTripOrderMap(null)).toEqual({});
  });

  test('zapis in branje ene regije', () => {
    const raw = withRegionStopOrder(null, 'gorenjska', ['Bohinj', 'Bled']);
    expect(regionStopOrder(raw, 'gorenjska')).toEqual(['Bohinj', 'Bled']);
    expect(regionStopOrder(raw, 'primorska')).toBeNull();
  });

  test('druga regija ne prepiše prve', () => {
    const a = withRegionStopOrder(null, 'gorenjska', ['Bohinj', 'Bled']);
    const b = withRegionStopOrder(a, 'primorska', ['Piran', 'Dolina Soče']);
    expect(regionStopOrder(b, 'gorenjska')).toEqual(['Bohinj', 'Bled']);
    expect(regionStopOrder(b, 'primorska')).toEqual(['Piran', 'Dolina Soče']);
  });

  test('ponastavitev zadnje regije → null (ključ se odstrani)', () => {
    const a = withRegionStopOrder(null, 'gorenjska', ['Bohinj', 'Bled']);
    expect(withRegionStopOrder(a, 'gorenjska', null)).toBeNull();
    expect(withRegionStopOrder(a, 'gorenjska', [])).toBeNull();
  });

  test('ponastavitev ene regije ohrani ostale', () => {
    const a = withRegionStopOrder(null, 'gorenjska', ['Bohinj', 'Bled']);
    const b = withRegionStopOrder(a, 'primorska', ['Piran']);
    const c = withRegionStopOrder(b, 'gorenjska', null);
    expect(regionStopOrder(c, 'gorenjska')).toBeNull();
    expect(regionStopOrder(c, 'primorska')).toEqual(['Piran']);
  });

  test('serilizacija je stabilna ne glede na vrstni red ključev', () => {
    expect(serializeTripOrderMap({ b: ['X'], a: ['Y'] })).toBe(
      serializeTripOrderMap({ a: ['Y'], b: ['X'] }),
    );
  });

  test('zlonamerni zapis ne preživi (ne-nizi, predolga imena regij)', () => {
    const raw = JSON.stringify({ gorenjska: [1, 'Bled', 'Bled'], x: [{}] });
    expect(parseTripOrderMap(raw)).toEqual({ gorenjska: ['Bled'] });
  });

  test('prazna regija ne spremeni zapisa', () => {
    const raw = withRegionStopOrder(null, 'gorenjska', ['Bohinj']);
    expect(withRegionStopOrder(raw, '', null)).toBe(raw);
  });
});

describe('trip-order — stopRouteKey', () => {
  test('brez regije → null', () => {
    expect(stopRouteKey(null, STOPS)).toBeNull();
  });

  test('vključuje regijo IN vrstni red (preureditev sproži nov OSRM/POI izračun)', () => {
    const a = stopRouteKey('gorenjska', STOPS);
    const b = stopRouteKey('gorenjska', moveStop(STOPS, 0, 2));
    expect(a).not.toBe(b);
    expect(a).toBe('gorenjska:Bled>Bohinj>Kranjska Gora');
  });

  test('isti red → isti ključ (stabilen useEffect odvisnik)', () => {
    expect(stopRouteKey('gorenjska', STOPS)).toBe(stopRouteKey('gorenjska', [...STOPS]));
  });
});
