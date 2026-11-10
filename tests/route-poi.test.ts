import { describe, expect, test } from 'bun:test';

import {
  POI_CATEGORY_LABELS,
  POI_MAX_RADIUS_KM,
  bboxForRoute,
  categorizePoi,
  clampPoiMax,
  clampRadiusKm,
  distanceToRouteKm,
  distributePois,
  haversineKm,
  mergePois,
  overpassPoiQuery,
  parseOverpassPois,
  poiDistanceLabel,
  selectPoisAlongRoute,
  type RoutePoi,
} from '@/lib/route-poi';

const ROUTE = [
  { lat: 46.3625, lng: 14.0936 }, // Bled
  { lat: 46.2714, lng: 13.9526 }, // Bohinj
];

const element = (id: number, lat: number, lng: number, tags: Record<string, string>, name = `POI ${id}`) => ({
  type: 'node',
  id,
  lat,
  lng,
  tags: { name, ...tags },
});

describe('route-poi — geometrija in razdalje', () => {
  test('haversine Bled → Bohinj ≈ 15 km (zrak; OSRM cesta ≈ 18,7 km)', () => {
    const km = haversineKm(ROUTE[0], ROUTE[1]);
    expect(km).toBeGreaterThan(13);
    expect(km).toBeLessThan(17);
  });

  test('bbox vsebuje pot in ima odmik', () => {
    const b = bboxForRoute(ROUTE, 3)!;
    expect(b.south).toBeLessThan(ROUTE[1].lat);
    expect(b.north).toBeGreaterThan(ROUTE[0].lat);
    expect(b.west).toBeLessThan(ROUTE[1].lng);
    expect(b.east).toBeGreaterThan(ROUTE[0].lng);
    expect(bboxForRoute([], 3)).toBeNull();
  });

  test('točka NA poti → 0 km; 0.05° stran → ~4–5 km', () => {
    const on = distanceToRouteKm({ lat: 46.32, lng: 14.02 }, ROUTE)!;
    expect(on.distanceKm).toBeLessThan(1);
    expect(on.progress).toBeGreaterThan(0);
    expect(on.progress).toBeLessThan(1);
    const off = distanceToRouteKm({ lat: 46.37, lng: 14.09 }, ROUTE)!;
    expect(off.distanceKm).toBeGreaterThan(0);
  });

  test('ena točka poti → haversine, progress 0', () => {
    const d = distanceToRouteKm({ lat: 46.37, lng: 14.10 }, [ROUTE[0]])!;
    expect(d.distanceKm).toBeGreaterThan(0);
    expect(d.progress).toBe(0);
    expect(distanceToRouteKm(ROUTE[0], [])).toBeNull();
  });
});

describe('route-poi — Overpass poizvedba in razčlenjevanje', () => {
  test('poizvedba vsebuje bbox, turistične filtre in omejitev izpisa', () => {
    const q = overpassPoiQuery(bboxForRoute(ROUTE, 3)!);
    expect(q).toContain('[out:json][timeout:25]');
    expect(q).toContain('tourism');
    expect(q).toContain('historic');
    expect(q).toContain('natural');
    expect(q).toContain('out center 300;');
    expect(q).toContain('46.');
  });

  test('kategorije iz OSM tagov', () => {
    expect(categorizePoi({ tourism: 'viewpoint' })).toBe('razgled');
    expect(categorizePoi({ historic: 'castle' })).toBe('kultura');
    expect(categorizePoi({ tourism: 'museum' })).toBe('kultura');
    expect(categorizePoi({ natural: 'waterfall' })).toBe('narava');
    expect(categorizePoi({ amenity: 'cafe' })).toBe('hrana');
    expect(categorizePoi({ shop: 'bakery' })).toBe('drugo');
    expect(POI_CATEGORY_LABELS.razgled).toBe('Razgledna točka');
  });

  test('node + way(center), neveljavni/brezimenski se izločijo', () => {
    const raw = {
      elements: [
        element(1, 46.32, 14.02, { tourism: 'viewpoint' }),
        { type: 'way', id: 2, center: { lat: 46.30, lon: 13.98 }, tags: { name: 'Grad', historic: 'castle' } },
        { type: 'node', id: 3, lat: 46.31, lng: 14.00, tags: { tourism: 'viewpoint' } },
        { type: 'node', id: 4, lat: 999, lng: 14.00, tags: { name: 'X' } },
        { type: 'node', id: 5, lat: 46.31, lng: 14.00, tags: { name: '' } },
        { junk: true },
      ],
    };
    const pois = parseOverpassPois(raw);
    expect(pois).toHaveLength(2);
    expect(pois[0].id).toBe('node/1');
    expect(pois[0].category).toBe('razgled');
    expect(pois[1].id).toBe('way/2');
    expect(pois[1].category).toBe('kultura');
    expect(parseOverpassPois(null)).toEqual([]);
    expect(parseOverpassPois({})).toEqual([]);
  });
});

describe('route-poi — izbor predlogov ob poti', () => {
  test('samo znotraj polmera, urejeni po poteku poti', () => {
    const raw = {
      elements: [
        element(1, 46.361, 14.094, { tourism: 'viewpoint' }, 'Razgled Bled'),
        element(2, 46.272, 13.953, { natural: 'waterfall' }, 'Slap Bohinj'),
        element(3, 46.55, 14.50, { historic: 'castle' }, 'Dalec'),
      ],
    };
    const pois = selectPoisAlongRoute(raw, ROUTE, { radiusKm: 3, max: 6 });
    expect(pois.map((p) => p.name)).toEqual(['Razgled Bled', 'Slap Bohinj']);
    expect(pois[0].progress).toBeLessThan(pois[1].progress);
    expect(pois.every((p) => p.distanceKm <= 3)).toBe(true);
    expect(pois.every((p) => p.source === 'osm')).toBe(true);
  });

  test('podvojeni nazivi se izločijo (case-insensitive)', () => {
    const raw = {
      elements: [
        element(1, 46.361, 14.094, { tourism: 'viewpoint' }, 'Bledski grad'),
        element(2, 46.362, 14.095, { historic: 'castle' }, 'bledski grad'),
      ],
    };
    expect(selectPoisAlongRoute(raw, ROUTE)).toHaveLength(1);
  });

  test('max omeji število predlogov', () => {
    const raw = {
      elements: Array.from({ length: 12 }, (_, i) =>
        element(i + 1, 46.30 + i * 0.005, 13.97 + i * 0.005, { tourism: 'attraction' }, `Znamenitost ${i + 1}`)),
    };
    const pois = selectPoisAlongRoute(raw, ROUTE, { radiusKm: 10, max: 4 });
    expect(pois).toHaveLength(4);
  });

  test('prazen odziv → prazen seznam (nikoli napake)', () => {
    expect(selectPoisAlongRoute({ elements: [] }, ROUTE)).toEqual([]);
    expect(selectPoisAlongRoute(null, ROUTE)).toEqual([]);
  });

  test('slovenska decimalna vejica', () => {
    expect(poiDistanceLabel(1.2)).toBe('1,2 km od poti');
  });
});

describe('route-poi — meje, razpršitev in združevanje obeh virov', () => {
  const rp = (
    id: string,
    name: string,
    distanceKm: number,
    progress: number,
    source: 'osm' | 'izbor' = 'osm',
  ): RoutePoi => ({
    id, name, lat: 46.3, lng: 14.0, category: 'drugo', distanceKm, progress, source,
  });

  test('clamp polmera in števila predlogov (eno postanko = do 15 km)', () => {
    expect(POI_MAX_RADIUS_KM).toBe(15);
    expect(clampRadiusKm(undefined)).toBe(3);
    expect(clampRadiusKm(-5)).toBe(0.5);
    expect(clampRadiusKm(100)).toBe(15);
    expect(clampRadiusKm(Number.NaN)).toBe(3);
    expect(clampRadiusKm(12)).toBe(12);
    expect(clampPoiMax(undefined)).toBe(6);
    expect(clampPoiMax(0)).toBe(1);
    expect(clampPoiMax(100)).toBe(12);
    expect(clampPoiMax(3.6)).toBe(4);
    expect(bboxForRoute(ROUTE, 15)!.north).toBeGreaterThan(bboxForRoute(ROUTE, 3)!.north);
  });

  test('distributePois izloči podvojena imena in omeji število', () => {
    const out = distributePois([
      rp('a', 'Blejski grad', 0.5, 0.1),
      rp('b', 'blejski grad', 0.2, 0.2),
      rp('c', 'Slap Savica', 1.2, 0.9),
    ], 6);
    // Najbližji kandidat (b) zmaga, podvojeni naziv se izloči ne glede na velikost črk.
    expect(out.map((p) => p.id)).toEqual(['b', 'c']);
    expect(distributePois([rp('a', 'A', 1, 0), rp('b', 'B', 2, 0.5), rp('c', 'C', 3, 1)], 2)).toHaveLength(2);
  });

  test('mergePois: OSM ima prednost pri enakem imenu, izbor zapolni vrzeli', () => {
    const osm = [rp('node/1', 'Blejski grad', 0.4, 0.1)];
    const catalog = [
      rp('izbor-1', 'blejski grad', 0.3, 0.1, 'izbor'),
      rp('izbor-2', 'Mostniška soteska', 1.1, 0.8, 'izbor'),
    ];
    const merged = mergePois(osm, catalog, 6);
    expect(merged.map((p) => p.id)).toEqual(['node/1', 'izbor-2']);
    expect(merged[0].source).toBe('osm');
    expect(merged[1].source).toBe('izbor');
  });

  test('mergePois brez OSM = čisti urejeni izbor, še vedno uporaben', () => {
    const merged = mergePois([], [rp('izbor-1', 'Ljubljanski grad', 0.2, 0, 'izbor')], 6);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('izbor');
  });
});
