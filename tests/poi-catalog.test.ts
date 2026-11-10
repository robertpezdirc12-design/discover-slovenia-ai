import { describe, expect, test } from 'bun:test';

import {
  CATALOG_ATTRIBUTION,
  POI_CATALOG,
  selectCatalogPois,
} from '@/lib/poi-catalog';
import { POI_CATEGORY_LABELS } from '@/lib/route-poi';

const BLED_BOHINJ = [
  { lat: 46.3625, lng: 14.0936 },
  { lat: 46.2714, lng: 13.9526 },
];
const LJUBLJANA = [{ lat: 46.0569, lng: 14.5058 }];

describe('poi-catalog — celovitost urejenega izbora', () => {
  test('dovolj znamenitosti, vse z veljavnimi koordinatami v Sloveniji', () => {
    expect(POI_CATALOG.length).toBeGreaterThanOrEqual(50);
    for (const p of POI_CATALOG) {
      expect(Number.isFinite(p.lat)).toBe(true);
      expect(Number.isFinite(p.lng)).toBe(true);
      expect(p.lat).toBeGreaterThan(45.4);
      expect(p.lat).toBeLessThan(46.9);
      expect(p.lng).toBeGreaterThan(13.3);
      expect(p.lng).toBeLessThan(16.7);
      expect(p.name.trim().length).toBeGreaterThan(2);
      expect(POI_CATEGORY_LABELS[p.category]).toBeDefined();
      expect(p.id.startsWith('izbor-')).toBe(true);
    }
  });

  test('enolična imena in identitete (ključi označevalcev na karti)', () => {
    expect(new Set(POI_CATALOG.map((p) => p.id)).size).toBe(POI_CATALOG.length);
    expect(new Set(POI_CATALOG.map((p) => p.name)).size).toBe(POI_CATALOG.length);
  });

  test('pokrite so VSE regije vodiča, tudi Koroška', () => {
    const regions = [...new Set(POI_CATALOG.map((p) => p.region))];
    const required = ['gorenjska', 'osrednja', 'primorska', 'stajerska', 'koroska'] as const;
    for (const r of required) {
      expect(regions).toContain(r);
      expect(POI_CATALOG.filter((p) => p.region === r).length).toBeGreaterThanOrEqual(4);
    }
  });

  test('oznaka vira je izrecna (ne lažno pripisovanje OSM)', () => {
    expect(CATALOG_ATTRIBUTION).toBe('urejeni izbor slovenskih znamenitosti');
  });
});

describe('poi-catalog — filtriranje ob poti', () => {
  test('Bled → Bohinj vrne prave znamenitosti, vse označene kot izbor', () => {
    const pois = selectCatalogPois(BLED_BOHINJ, { radiusKm: 3, max: 6 });
    expect(pois.length).toBeGreaterThanOrEqual(3);
    expect(pois.every((p) => p.source === 'izbor')).toBe(true);
    expect(pois.every((p) => p.distanceKm <= 3)).toBe(true);
    expect(pois.some((p) => p.name.includes('Blejski') || p.name.includes('Ojstrica'))).toBe(true);
    expect(pois.every((p) => p.progress >= 0 && p.progress <= 1)).toBe(true);
  });

  test('polmer in max omejita izbor; večji polmer → več kandidatov', () => {
    const tight = selectCatalogPois(BLED_BOHINJ, { radiusKm: 0.5, max: 12 });
    const wide = selectCatalogPois(BLED_BOHINJ, { radiusKm: 15, max: 12 });
    expect(wide.length).toBeGreaterThan(tight.length);
    expect(selectCatalogPois(BLED_BOHINJ, { radiusKm: 15, max: 2 })).toHaveLength(2);
  });

  test('ena postanka = »okolica«: Ljubljana, vsi progress 0', () => {
    const pois = selectCatalogPois(LJUBLJANA, { radiusKm: 12, max: 6 });
    expect(pois.length).toBeGreaterThanOrEqual(4);
    expect(pois.every((p) => p.progress === 0)).toBe(true);
    expect(pois.every((p) => p.distanceKm <= 12)).toBe(true);
    expect(pois.some((p) => p.name === 'Ljubljanski grad')).toBe(true);
  });

  test('regije z enim ciljem imajo predloge: Maribor in Dravograd', () => {
    const mb = selectCatalogPois([{ lat: 46.5547, lng: 15.6459 }], { radiusKm: 12, max: 6 });
    const koroska = selectCatalogPois([{ lat: 46.5864, lng: 15.0019 }], { radiusKm: 12, max: 6 });
    expect(mb.length).toBeGreaterThanOrEqual(3);
    expect(koroska.length).toBeGreaterThanOrEqual(3);
  });

  test('prazna pot → prazen seznam (nikoli napake)', () => {
    expect(selectCatalogPois([], { radiusKm: 12 })).toEqual([]);
  });
});
