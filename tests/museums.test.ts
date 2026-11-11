/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { MUSEUMS } from '../src/lib/museums';
import { PLACE_CATEGORIES } from '../src/lib/place-categories';

describe('museums — kurirani katalog slovenskih muzejev', () => {
  test('vsaj 30 uradnih muzejev po vsej Sloveniji', () => {
    expect(MUSEUMS.length).toBeGreaterThanOrEqual(30);
    const cities = new Set(MUSEUMS.map((m) => m.city));
    // pokritost po regijah (znana mesta)
    for (const city of ['Ljubljana', 'Maribor', 'Celje', 'Koper', 'Ptuj', 'Idrija', 'Murska Sobota', 'Novo mesto']) {
      expect(cities.has(city), `manjka ${city}`).toBe(true);
    }
  });

  test('unikatni id-ji, veljavne koordinate, opisi in imena', () => {
    const ids = new Set(MUSEUMS.map((m) => m.id));
    expect(ids.size).toBe(MUSEUMS.length);
    for (const m of MUSEUMS) {
      expect(m.name.length).toBeGreaterThan(3);
      expect(m.desc.length).toBeGreaterThan(15);
      expect(m.city.length).toBeGreaterThan(1);
      expect(m.lat).toBeGreaterThan(45.3);
      expect(m.lat).toBeLessThan(46.9);
      expect(m.lng).toBeGreaterThan(13.3);
      expect(m.lng).toBeLessThan(16.8);
    }
  });

  test('znani muzeji so prisotni (Narodni muzej, Tehniški muzej Bistra, Idrija)', () => {
    const names = MUSEUMS.map((m) => m.name).join(' | ').toLowerCase();
    expect(names).toContain('narodni muzej slovenije');
    expect(names).toContain('tehniški muzej slovenije');
    expect(names).toContain('idrijo');
    expect(names).toContain('etnografski');
  });

  test('kategorija muzeji obstaja v Iščem', () => {
    expect(PLACE_CATEGORIES.some((c) => c.id === 'muzeji')).toBe(true);
  });
});

describe('museums-register — uradni REMK razvid', () => {
  test('public/data/museums-register.json obstaja in ima ≥55 geokodiranih muzejev', () => {
    const fs = require('node:fs');
    const raw = JSON.parse(
      fs.readFileSync('public/data/museums-register.json', 'utf-8'),
    );
    expect(raw.format).toBe('remk-museums-v1');
    expect(raw.museums.length).toBeGreaterThanOrEqual(55);
    for (const m of raw.museums.slice(0, 10)) {
      expect(m.name.length).toBeGreaterThan(3);
      expect(m.address.length).toBeGreaterThan(3);
      expect(m.lat).toBeGreaterThan(45.3);
      expect(m.lat).toBeLessThan(46.9);
      expect(m.lng).toBeGreaterThan(13.3);
      expect(m.lng).toBeLessThan(16.8);
    }
  });
});
