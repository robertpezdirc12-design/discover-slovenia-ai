/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  MAX_CUSTOM_STOPS,
  isInBalkanBbox,
  parseCustomStops,
  parsePlaceLines,
  placesToStops,
  serializeCustomStops,
} from '../src/lib/import-places';

describe('import-places — razčlenjevanje vnosa', () => {
  test('vrstice in podpičja, čiščenje, podvojenja', () => {
    const out = parsePlaceLines('  Zagreb ,\nSarajevo; mostar\nZAGREB\n\n  ');
    expect(out).toEqual(['Zagreb', 'Sarajevo', 'mostar']);
  });

  test('omejitev števila', () => {
    expect(parsePlaceLines(Array.from({ length: 40 }, (_, i) => `Kraj ${i}`).join('\n')).length).toBe(
      MAX_CUSTOM_STOPS,
    );
  });

  test('prazen vnos → []', () => {
    expect(parsePlaceLines('')).toEqual([]);
    expect(parsePlaceLines('   \n\t')).toEqual([]);
  });
});

describe('import-places — shranjevanje', () => {
  test('round-trip serialize → parse', () => {
    const stops = [
      { name: 'Zagreb', note: 'iz uvoza', lat: 45.815, lng: 15.9819 },
      { name: 'Mostar', note: '', lat: 43.3438, lng: 17.8078 },
    ];
    expect(parseCustomStops(serializeCustomStops(stops))).toEqual(stops);
  });

  test('pokvarjen/tuj zapis → []', () => {
    expect(parseCustomStops(null)).toEqual([]);
    expect(parseCustomStops('x')).toEqual([]);
    expect(parseCustomStops('{"a":1}')).toEqual([]);
    expect(parseCustomStops('[["a","b",999,1]]')).toEqual([]); // neveljavna širina
  });
});

describe('import-places — sestavljanje postankov', () => {
  const found = [
    { q: 'Zagreb', ok: true, name: 'Zagreb', lat: 45.815, lng: 15.9819 },
    { q: 'Neznano', ok: false, name: '', lat: 0, lng: 0 },
    { q: 'Mostar', ok: true, name: 'Mostar', lat: 43.3438, lng: 17.8078 },
  ];

  test('preskoči ne-najdene; dedupe proti obstoječim', () => {
    const stops = placesToStops(found, new Set(['zagreb']));
    expect(stops).toHaveLength(2);
    expect(stops[0].name).toBe('Zagreb 2'); // konflikt z obstoječim
    expect(stops[1].name).toBe('Mostar');
    expect(stops[0].note.length).toBeGreaterThan(0);
  });

  test('omejitev števila', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      q: `K${i}`,
      ok: true,
      name: `Kraj ${i}`,
      lat: 44,
      lng: 18 + i / 100,
    }));
    expect(placesToStops(many, new Set()).length).toBe(MAX_CUSTOM_STOPS);
  });

  test('isInBalkanBbox', () => {
    expect(isInBalkanBbox(45.8, 15.98)).toBe(true);
    expect(isInBalkanBbox(52.5, 13.4)).toBe(false);
  });
});
