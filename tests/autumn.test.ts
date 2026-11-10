/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  AUTUMN_CATEGORY_LABELS,
  AUTUMN_DESTINATIONS,
  autumnByCategory,
} from '../src/lib/autumn';

describe('autumn — jesenske destinacije', () => {
  test('pokrite obe kategoriji z vsaj nekaj vnosi', () => {
    const vino = autumnByCategory('vino');
    const kostanj = autumnByCategory('kostanj');
    expect(vino.length).toBeGreaterThanOrEqual(4);
    expect(kostanj.length).toBeGreaterThanOrEqual(3);
    expect(AUTUMN_DESTINATIONS.length).toBe(vino.length + kostanj.length);
  });

  test('vsi vnosi so veljavni (unikatni id-ji, koordinate, opisi)', () => {
    const ids = new Set(AUTUMN_DESTINATIONS.map((d) => d.id));
    expect(ids.size).toBe(AUTUMN_DESTINATIONS.length);
    for (const d of AUTUMN_DESTINATIONS) {
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.note.length).toBeGreaterThan(10);
      expect(Math.abs(d.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(d.lng)).toBeLessThanOrEqual(180);
      expect(AUTUMN_CATEGORY_LABELS[d.category]).toBeDefined();
    }
  });

  test('null kategorija vrne vse', () => {
    expect(autumnByCategory(null)).toEqual(AUTUMN_DESTINATIONS);
  });
});
