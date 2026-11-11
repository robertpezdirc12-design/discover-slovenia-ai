/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { BALKAN_MUSEUMS, balkanMuseumsForCountry } from '../src/lib/museums-balkan';

const EXPECTED_COUNTRIES = [
  'hrvaska',
  'bosna-hercegovina',
  'srbija',
  'kosovo',
  'crna-gora',
  'albanija',
  'severna-makedonija',
] as const;

describe('museums-balkan — kurirani muzeji po državah', () => {
  test('vseh 7 balkanskih držav je pokritih z vsaj 6 muzeji', () => {
    for (const country of EXPECTED_COUNTRIES) {
      const list = balkanMuseumsForCountry(country);
      expect(list.length, `premalo muzejev za ${country}`).toBeGreaterThanOrEqual(6);
    }
  });

  test('unikatni id-ji, veljavne koordinate in opisi', () => {
    const ids = new Set(BALKAN_MUSEUMS.map((m) => m.id));
    expect(ids.size).toBe(BALKAN_MUSEUMS.length);
    for (const m of BALKAN_MUSEUMS) {
      expect(m.name.length).toBeGreaterThan(3);
      expect(m.desc.length).toBeGreaterThan(10);
      expect(m.city.length).toBeGreaterThan(1);
      expect(m.lat).toBeGreaterThan(39.5);
      expect(m.lat).toBeLessThan(47.2);
      expect(m.lng).toBeGreaterThan(13);
      expect(m.lng).toBeLessThan(24.2);
    }
  });

  test('znani muzeji so prisotni (Tesla, Zemaljski, Onufri, Mimara)', () => {
    const names = BALKAN_MUSEUMS.map((m) => m.name).join(' | ').toLowerCase();
    expect(names).toContain('tesle');
    expect(names).toContain('zemaljski');
    expect(names).toContain('onufri');
    expect(names).toContain('mimara');
  });

  test('balkanMuseumsForCountry: neznana država → prazno', () => {
    expect(balkanMuseumsForCountry('slovenija')).toEqual([]); // SI ima svoj REMK katalog
    expect(balkanMuseumsForCountry('neznana')).toEqual([]);
  });
});
