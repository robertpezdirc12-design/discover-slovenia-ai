import { describe, expect, test } from 'bun:test';

import { buildDayTrack } from '@/lib/day-track';
import { buildTripPrintHtml, printTripFileName, type PrintStay } from '@/lib/print-trip';
import type { RoutePoi } from '@/lib/route-poi';
import { buildTripBudget } from '@/lib/trip-budget';
import type { TripStop } from '@/lib/trip-plan';

const STOPS: TripStop[] = [
  { name: 'Bled', note: 'Jezerski otok', lat: 46.3625, lng: 14.0936 },
  { name: 'Bohinj', note: 'Ledeniško jezero', lat: 46.2714, lng: 13.9526 },
];

const STAYS: PrintStay[] = [
  { name: 'Hotel Bled', city: 'Bled', lat: 46.36, lng: 14.09, priceFrom: 120 },
];

const POIS: RoutePoi[] = [
  {
    id: 'node/1',
    name: 'Razgledna točka',
    category: 'razgled',
    lat: 46.4,
    lng: 14.1,
    distanceKm: 1.2,
    progress: 0.4,
    source: 'osm',
  },
];

const GENERATED_AT = new Date('2026-11-10T12:00:00.000Z');

describe('print-trip — načrt za tisk', () => {
  test('vključi vrstni red, dnevno vožnjo, prenočišča, proračun in zanimivosti', () => {
    const budget = buildTripBudget(STAYS, 2, 2);
    const dayTrack = buildDayTrack(STOPS, 1, 'zmeren', [{ distanceKm: 26.4, durationMin: 38 }]);
    const html = buildTripPrintHtml({
      stops: STOPS,
      dayTrack,
      pois: POIS,
      budget,
      stays: STAYS,
      regionLabel: 'Gorenjska',
      generatedAt: GENERATED_AT,
    });

    expect(html).toContain('<html lang="sl">');
    expect(html).toContain('Gorenjska');
    expect(html.indexOf('Bled')).toBeLessThan(html.indexOf('Bohinj'));
    expect(html).toContain('38 min');
    expect(html).toContain('26,4 km');
    expect(html).toContain('Hotel Bled');
    expect(html).toContain('240 €');
    expect(html).toContain('120 € na osebo');
    expect(html).toContain('Razgledna točka');
    expect(html).toContain('OpenStreetMap contributors');
    expect(html).toContain('2026');
  });

  test('uporabniški podatki so HTML-escapani in dokument ne izvaja skript', () => {
    const maliciousStops: TripStop[] = [
      { name: '<img src=x onerror=alert(1)>', note: 'A & B', lat: 46, lng: 14 },
    ];
    const maliciousStays: PrintStay[] = [
      { name: 'Hotel <script>alert(1)</script>', city: '"Bled" & okolica', lat: 46, lng: 14, priceFrom: null },
    ];
    const maliciousPois: RoutePoi[] = [
      { ...POIS[0], name: '<script>alert(2)</script>' },
    ];
    const html = buildTripPrintHtml({
      stops: maliciousStops,
      dayTrack: [],
      pois: maliciousPois,
      budget: buildTripBudget(maliciousStays, 1, 1),
      stays: maliciousStays,
      regionLabel: '<script>regija</script>',
      generatedAt: GENERATED_AT,
    });

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;Bled&quot; &amp; okolica');
    expect(html).not.toMatch(/<script(?:\s|>)/i);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('cena ni objavljena');
  });

  test('prazen načrt jasno pove, da ni postankov', () => {
    const html = buildTripPrintHtml({
      stops: [],
      dayTrack: [],
      pois: [],
      budget: buildTripBudget([], null, 2),
      stays: [],
      generatedAt: GENERATED_AT,
    });

    expect(html).toContain('V načrtu še ni postankov.');
    expect(html).not.toContain('Zanimivosti ob poti');
    expect(html).not.toContain('Rezervirana prenočišča');
  });

  test('ime prenesene HTML datoteke vsebuje datum', () => {
    expect(printTripFileName(GENERATED_AT)).toBe('pot-po-sloveniji-2026-11-10.html');
  });
});
