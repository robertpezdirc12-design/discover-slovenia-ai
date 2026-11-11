import { describe, expect, test } from 'bun:test';

import {
  navChipText,
  navFirst,
  navIsLast,
  navNext,
  navPrev,
  navProgressLabel,
} from '@/lib/route-guidance';
import { osrmRouteUrl, parseOsrmRoute } from '@/lib/osrm-route';
import fixture from './osrm-route.fixture.json';

const STOPS = [
  { name: 'Bled', note: 'Jezerski otok' },
  { name: 'Bohinj', note: 'Pod Triglavom' },
];

const ONE = [{ name: 'Dravograd', note: 'Vrata Koroške' }];

describe('route-guidance — vodi po poti do destinacije', () => {
  test('navFirst: prva postanka; prazna pot → null', () => {
    expect(navFirst(STOPS)).toBe(0);
    expect(navFirst([])).toBeNull();
  });

  test('navNext: korak naprej, na zadnji ostane (obisk)', () => {
    expect(navNext(STOPS, 0)).toBe(1);
    expect(navNext(STOPS, 1)).toBe(1); // zadnja postanka — ne skače čez
    expect(navNext(STOPS, null)).toBeNull();
  });

  test('navPrev: korak nazaj, na prvi ostane', () => {
    expect(navPrev(STOPS, 1)).toBe(0);
    expect(navPrev(STOPS, 0)).toBe(0);
    expect(navPrev(STOPS, null)).toBeNull();
  });

  test('navIsLast: prava zadnja postanka', () => {
    expect(navIsLast(STOPS, 1)).toBe(true);
    expect(navIsLast(STOPS, 0)).toBe(false);
    expect(navIsLast([], 0)).toBe(false);
  });

  test('napredek je izrečen: "Postanek 1 od 2: Bled"', () => {
    expect(navProgressLabel(STOPS, 0)).toBe('Postanek 1 od 2: Bled — Jezerski otok');
  });

  test('OBVIS (izrazita želja): zadnja postanka = "Destinacija dosežena"', () => {
    expect(navProgressLabel(STOPS, 1)).toContain('Destinacija dosežena');
    expect(navProgressLabel(STOPS, 1)).toContain('Bohinj');
    expect(navProgressLabel(ONE, 0)).toBe('Destinacija dosežena — Dravograd. Vrata Koroške');
  });

  test('čip na traku: "1/2 · Bled" / "obisk · Bohinj"', () => {
    expect(navChipText(STOPS, 0)).toBe('1/2 · Bled');
    expect(navChipText(STOPS, 1)).toBe('obisk · Bohinj');
    expect(navChipText(STOPS, null)).toBe('');
  });
});

describe('osrm-route — cestna pot (živ vzorec Bled→Bohinj, 18,7 km)', () => {
  test('URL: koordinate v OSRM vrstnem redu lng,lat', () => {
    const url = osrmRouteUrl([
      { lat: 46.3625, lng: 14.0936 },
      { lat: 46.2714, lng: 13.9526 },
    ]);
    expect(url).toContain('/route/v1/driving/14.0936,46.3625;13.9526,46.2714');
    expect(url).toContain('overview=full');
    expect(url).toContain('geometries=geojson');
  });

  test('razčlenjevanje živega vzorca: [lat,lng] para + nožice', () => {
    const parsed = parseOsrmRoute(fixture);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    const [first] = parsed.coords;
    expect(first[0]).toBeCloseTo(46.36, 1); // lat prvi (zamenjano iz geojson lng,lat)
    expect(first[1]).toBeCloseTo(14.09, 1);
    expect(parsed.legs.length).toBe(1);
    expect(parsed.legs[0].distanceKm).toBe(18.7);
    expect(parsed.legs[0].durationMin).toBe(18);
    expect(parsed.totalKm).toBe(18.7);
  });

  test('fail-clean: slab kodek / prazna geometrija / ne-objekt → null', () => {
    expect(parseOsrmRoute({ code: 'NoRoute', routes: [] })).toBeNull();
    expect(parseOsrmRoute({ code: 'Ok', routes: [] })).toBeNull();
    expect(parseOsrmRoute({ code: 'Ok', routes: [{ geometry: { coordinates: [[14.09]] }, legs: [{ distance: 1, duration: 1 }] }] })).toBeNull();
    expect(parseOsrmRoute(null)).toBeNull();
    expect(parseOsrmRoute('ni objekt')).toBeNull();
  });

  test('ne-številske koordinate v geometriji → null (nikoli ne meče)', () => {
    const bad = { code: 'Ok', routes: [{ geometry: { coordinates: [['x', 'y'], [14, 46]] }, legs: [{ distance: 1, duration: 1 }] }] };
    expect(parseOsrmRoute(bad)).toBeNull();
  });
});
