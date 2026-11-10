/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  PLACE_CATEGORIES,
  overpassPlacesQuery,
  parseOverpassPlaces,
  placeCategoryById,
} from '../src/lib/place-categories';

describe('place-categories — kategorije in poizvedbe', () => {
  test('vseh 7 kategorij je pokritih z oznako in barvo', () => {
    expect(PLACE_CATEGORIES.length).toBe(7);
    for (const c of PLACE_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(2);
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.tag).toMatch(/^\[/);
    }
    expect(placeCategoryById('muzeji')?.label).toBe('Muzeji');
    expect(placeCategoryById('neznano')).toBeNull();
  });

  test('overpassPlacesQuery zgradi veljavno poizvedbo z bbox', () => {
    const q = overpassPlacesQuery(placeCategoryById('restavracije')!, '45.0,14.0,46.0,15.0');
    expect(q).toContain('[out:json]');
    expect(q).toContain('restaurant');
    expect(q).toContain('bbox:45.0,14.0,46.0,15.0');
  });

  test('parseOverpassPlaces: varstvo vnosa, center za way/relation', () => {
    const raw = {
      elements: [
        { type: 'node', id: 1, lat: 45.5, lon: 14.5, tags: { name: 'Muzej A' } },
        { type: 'way', id: 2, center: { lat: 45.6, lon: 14.6 }, tags: { name: 'Muzej B' } },
        { type: 'node', id: 3, lat: 45.5, lon: 14.5, tags: {} },
        { type: 'node', id: 4, lat: 999, lon: 14, tags: { name: 'Slab' } },
      ],
    };
    const places = parseOverpassPlaces(raw, 'muzeji');
    expect(places).toHaveLength(2);
    expect(places[0].name).toBe('Muzej A');
    expect(places[1].lng).toBe(14.6);
  });
});
