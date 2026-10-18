/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  indicativePricePerNight,
  nominatimSearchUrl,
  overpassStayQuery,
  overpassStayUrls,
  parseNominatimPlace,
  parsePhotonStays,
  parseStayResults,
} from '../src/lib/stays';
import {
  addStayStop,
  emptyGuideState,
  isStayReserved,
  loadGuideState,
  saveGuideState,
  type GuideStorage,
} from '../src/lib/guide-store';

/** Overpass vzorec: node + way (s center) + brezimen objekt + podvojen id. */
const OVERPASS_FIXTURE = {
  elements: [
    {
      type: 'node',
      id: 1001,
      lat: 41.9981,
      lon: 21.4254,
      tags: { tourism: 'hotel', name: 'Hotel Skopje', stars: '3', website: 'example.com', 'addr:street': 'Maksim Gorki', 'addr:housenumber': '17' },
    },
    {
      type: 'way',
      id: 2002,
      center: { lat: 41.9973, lon: 21.428 },
      tags: { tourism: 'guest_house', name: 'Gostišče Vardar', phone: '+389 2 123 456' },
    },
    { type: 'node', id: 3003, lat: 42.0, lon: 21.43, tags: { tourism: 'hostel' } }, // brez imena → izpuščen
    { type: 'node', id: 1001, lat: 41.9981, lon: 21.4254, tags: { tourism: 'hotel', name: 'Hotel Skopje' } }, // podvojen → izpuščen
    { type: 'way', id: 4004, tags: { tourism: 'resort', name: 'Brez centra' } }, // way brez center → izpuščen
  ],
};

describe('stays — razčlenjevanje Overpass odgovora', () => {
  test('imenovani objekti preživijo, brezimeni/podvojeni/brez-geografije so izpuščeni', () => {
    const stays = parseStayResults(OVERPASS_FIXTURE);
    expect(stays.map((s) => s.id)).toEqual(['n1001', 'w2002']);
    expect(stays[0].name).toBe('Hotel Skopje');
    expect(stays[0].kind).toBe('hotel');
    expect(stays[0].stars).toBe(3);
    expect(stays[0].website).toBe('example.com');
    expect(stays[0].address).toBe('Maksim Gorki 17');
    expect(stays[1].phone).toBe('+389 2 123 456');
  });

  test('neveljaven vhod → [] (fail-clean)', () => {
    expect(parseStayResults(null)).toEqual([]);
    expect(parseStayResults({})).toEqual([]);
    expect(parseStayResults({ elements: 'ne-seznam' })).toEqual([]);
  });

  test('zvezdice "4;AAA" → 4, nesmiselne → null', () => {
    const stays = parseStayResults({
      elements: [
        { type: 'node', id: 1, lat: 41, lon: 21, tags: { tourism: 'hotel', name: 'A', stars: '4;AAA' } },
        { type: 'node', id: 2, lat: 41, lon: 21, tags: { tourism: 'hotel', name: 'B', stars: 'devet' } },
      ],
    });
    expect(stays[0].stars).toBe(4);
    expect(stays[1].stars).toBeNull();
  });

  test('omejitev na 24 zadetkov (pošteno do vira)', () => {
    const many = {
      elements: Array.from({ length: 40 }, (_, i) => ({
        type: 'node',
        id: i + 1,
        lat: 41,
        lon: 21,
        tags: { tourism: 'hotel', name: `Objekt ${i + 1}` },
      })),
    };
    expect(parseStayResults(many)).toHaveLength(24);
  });

  test('neznana vrednost tourism → izpuščena (točnost vrste)', () => {
    const stays = parseStayResults({
      elements: [
        { type: 'node', id: 1, lat: 41, lon: 21, tags: { tourism: 'artwork', name: 'Kip' } },
        { type: 'node', id: 2, lat: 41, lon: 21, tags: { tourism: 'hotel', name: 'Pravi hotel' } },
      ],
    });
    expect(stays.map((s) => s.name)).toEqual(['Pravi hotel']);
  });

  test('Photon rezerva: osm_type/id + lng,lat geometrija → StayResult', () => {
    const stays = parsePhotonStays({
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [21.4297262, 41.9970235] },
          properties: { name: 'Hotel Skopje City Center', osm_type: 'W', osm_id: 613902029, osm_key: 'tourism', osm_value: 'hotel', city: 'Skopje', street: 'Vasil Iljoski' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [21.43, 41.99] },
          properties: { name: 'Neznana vrsta', osm_type: 'W', osm_id: 42, osm_value: 'museum' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [21.44, 41.98] },
          properties: { osm_type: 'W', osm_id: 43, osm_value: 'hotel' }, // brez imena
        },
      ],
    });
    expect(stays).toHaveLength(1);
    expect(stays[0].id).toBe('w613902029');
    expect(stays[0].lat).toBeCloseTo(41.997, 4);
    expect(stays[0].lng).toBeCloseTo(21.4297, 4);
    expect(stays[0].stars).toBeNull();
    expect(stays[0].address).toBe('Vasil Iljoski');
  });
});

describe('stays — indikativna cena (jasno označena kot OCENA)', () => {
  test('osnova po vrsti (zaokroženo na 5 EUR)', () => {
    expect(indicativePricePerNight('hostel', null)).toBe(30);
    expect(indicativePricePerNight('motel', null)).toBe(60);
    expect(indicativePricePerNight('hotel', null)).toBe(95);
    expect(indicativePricePerNight('resort', null)).toBe(130);
  });

  test('zvezdice množijo: 5★ hotel 200, 1★ hotel 65, 4★ rezort 190', () => {
    expect(indicativePricePerNight('hotel', 5)).toBe(200);
    expect(indicativePricePerNight('hotel', 1)).toBe(65);
    expect(indicativePricePerNight('resort', 4)).toBe(190);
  });

  test('spodnja meja 20 EUR (hostel 1★ ostane realen)', () => {
    expect(indicativePricePerNight('hostel', 1)).toBeGreaterThanOrEqual(20);
  });
});

describe('stays — geokodiranje (Nominatim)', () => {
  test('boundingbox [s,n,w,e] → Overpass vrstni red [s,w,n,e]', () => {
    const place = parseNominatimPlace([
      {
        name: 'Skopje',
        display_name: 'Skopje, Severna Makedonija',
        lat: '41.9973',
        lon: '21.428',
        boundingbox: ['41.9', '42.1', '21.3', '21.6'],
      },
    ]);
    expect(place?.name).toBe('Skopje');
    expect(place?.bbox).toEqual([41.9, 21.3, 42.1, 21.6]);
  });

  test('prazen/neveljaven odgovor → null', () => {
    expect(parseNominatimPlace([])).toBeNull();
    expect(parseNominatimPlace([{ lat: 'nisi' }])).toBeNull();
  });

  test('URL-ja vsebujeta poizvedbo in bbox', () => {
    expect(nominatimSearchUrl('Skopje')).toContain('q=Skopje');
    const urls = overpassStayUrls(41.9, 21.3, 42.1, 21.6);
    expect(urls.length).toBeGreaterThanOrEqual(2);
    expect(urls.every((u) => u.includes('overpass'))).toBe(true);
    expect(overpassStayQuery(41.9, 21.3, 42.1, 21.6)).toContain('41.9,21.3,42.1,21.6');
    expect(overpassStayQuery(41.9, 21.3, 42.1, 21.6)).toContain('tourism');
  });
});

describe('guide-store — rezervirana prenočišča v »Moji poti«', () => {
  function memStorage(): GuideStorage {
    const data = new Map<string, string>();
    return {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  }

  test('stari zapisi brez stays → sanitizacija doda prazen seznam', () => {
    const raw = JSON.stringify({ version: 1, interests: ['narava'], answered: ['interests'] });
    const s = memStorage();
    s.setItem('dsa.guide.v1', raw);
    const loaded = loadGuideState(s);
    expect(loaded?.stays).toEqual([]);
  });

  test('neveljavni vnosi (brez imena / koordinat) so odstranjeni', () => {
    const raw = JSON.stringify({
      version: 1,
      answered: [],
      stays: [
        { id: 'n1', name: 'Hotel', city: 'Skopje', lat: 41.99, lng: 21.42, priceFrom: 95, reservedAt: '2026-01-01T00:00:00Z' },
        { id: 'n2', name: '', city: 'Skopje', lat: 41.99, lng: 21.42 },
        { id: 'n3', name: 'Nič', city: 'Skopje', lat: 200, lng: 21.42 },
      ],
    });
    const s = memStorage();
    s.setItem('dsa.guide.v1', raw);
    const loaded = loadGuideState(s);
    expect(loaded?.stays).toHaveLength(1);
    expect(loaded?.stays[0].id).toBe('n1');
  });

  test('addStayStop doda + je idempotenten (isti id ne podvoji)', () => {
    const base = emptyGuideState();
    const withStay = addStayStop(base, { id: 'n1', name: 'Hotel Skopje', city: 'Skopje', lat: 41.99, lng: 21.42, priceFrom: 95 });
    expect(withStay.stays).toHaveLength(1);
    expect(withStay.stays[0].reservedAt).toBeTruthy();
    const again = addStayStop(withStay, { id: 'n1', name: 'Hotel Skopje', city: 'Skopje', lat: 41.99, lng: 21.42, priceFrom: 95 });
    expect(again.stays).toHaveLength(1);
  });

  test('rezervacija preživi shranjevanje + nalaganje (Komoot spomin)', () => {
    const s = memStorage();
    saveGuideState(s, addStayStop(emptyGuideState(), { id: 'w9', name: 'Gostišče Vardar', city: 'Skopje', lat: 41.997, lng: 21.428, priceFrom: 65 }));
    const loaded = loadGuideState(s);
    expect(isStayReserved(loaded, 'w9')).toBe(true);
    expect(isStayReserved(loaded, 'ne-obstaja')).toBe(false);
  });
});
