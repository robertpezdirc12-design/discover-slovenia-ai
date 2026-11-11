/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  buildPackingList,
  packingProgress,
  packingTypesFor,
  parsePackingState,
  serializePackingList,
} from '../src/lib/packing';

describe('packing — tipi potovanja', () => {
  test('gore (regija) + morje + mesto (interesi)', () => {
    expect(packingTypesFor('gorenjska', [])).toContain('gore');
    expect(packingTypesFor('hrvaska', [])).toContain('morje');
    expect(packingTypesFor('osrednja', ['kultura'])).toContain('mesto');
    expect(packingTypesFor('crna-gora', ['pohodništvo'])).toEqual(
      expect.arrayContaining(['gore', 'morje']),
    );
  });
});

describe('packing — seznam in stanje', () => {
  test('baza + dodatki; unikatnost id-jev', () => {
    const list = buildPackingList('gorenjska:...', 'gorenjska', ['pohodništvo']);
    const ids = new Set(list.items.map((i) => i.id));
    expect(ids.size).toBe(list.items.length);
    expect(list.items.length).toBeGreaterThanOrEqual(17); // baza
    expect(list.items.some((i) => i.id === 'gor1')).toBe(true);
  });

  test('round-trip serialize → parse', () => {
    const list = buildPackingList('k1', 'gorenjska', []);
    const done = new Set(['dok', 'obl1']);
    const saved = serializePackingList({ ...list, done });
    const parsed = parsePackingState(saved);
    expect(parsed?.routeKey).toBe('k1');
    expect(parsed?.done.has('dok')).toBe(true);
    expect(parsed?.done.has('neznano')).toBe(false);
  });

  test('pokvarjen zapis ali napačen ključ → null', () => {
    expect(parsePackingState(null)).toBeNull();
    expect(parsePackingState('x')).toBeNull();
    const other = serializePackingList(buildPackingList('drugi', null, []));
    expect(parsePackingState(other)?.routeKey).toBe('drugi');
  });

  test('packingProgress', () => {
    const list = buildPackingList('k', null, []);
    expect(packingProgress(list)).toBe(0);
    expect(packingProgress({ ...list, done: new Set(list.items.map((i) => i.id)) })).toBe(100);
  });
});
