/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  clusterRkd,
  filterRkd,
  inBounds,
  parseRkdData,
  rkdPhotoUrl,
  rkdUnitUrl,
  worldXY,
  type RkdDataset,
  type RkdFeature,
} from '../src/lib/rkd';

function feature(overrides: Partial<RkdFeature> = {}): RkdFeature {
  return {
    n: 'Dobova — Arheološko najdišče Gomilice',
    t: 2,
    d: 'Veliko grobišče s poznobronastodobnimi žarnimi pokopi.',
    m: 'BREŽICE',
    lat: 45.8993,
    lng: 15.67,
    ph: 'kf_1_00096.jpg',
    e: 96,
    ...overrides,
  };
}

const DATASET: RkdDataset = {
  typeLabels: ['stavbe', 'spominski objekti in kraji', 'arheološka najdišča', 'ostalo'],
  features: [
    feature({ e: 96, lat: 45.8993, lng: 15.67 }),
    feature({ e: 97, t: 0, lat: 46.05, lng: 14.5, n: 'Bled — grad', m: 'BLED' }),
    feature({ e: 98, t: 1, lat: 46.12, lng: 14.82, n: 'Ljubljana — Tromostovje', m: 'LJUBLJANA' }),
    feature({ e: 99, t: 3, lat: 45.5, lng: 13.7, n: 'Piran — obzidje', m: 'PIRAN' }),
    feature({ e: 100, t: 2, lat: 46.36, lng: 14.09, n: 'Bled — Blejski grad', m: 'BLED' }),
  ],
};

describe('rkd — razčlenitev nabora (tuj vnos)', () => {
  test('veljaven nabor → features + typeLabels', () => {
    const parsed = parseRkdData({ meta: { typeLabels: DATASET.typeLabels }, features: DATASET.features });
    expect(parsed).not.toBeNull();
    expect(parsed!.features).toHaveLength(5);
    expect(parsed!.typeLabels).toEqual(DATASET.typeLabels);
  });

  test('prazen/napačen vnos → null', () => {
    expect(parseRkdData(null)).toBeNull();
    expect(parseRkdData('x')).toBeNull();
    expect(parseRkdData({ features: [] })).toBeNull();
    expect(parseRkdData({ meta: { typeLabels: ['a'] }, features: 'x' })).toBeNull();
  });

  test('zavrže neveljavne koordinate, tip in EŠD', () => {
    const parsed = parseRkdData({
      meta: { typeLabels: DATASET.typeLabels },
      features: [
        feature({ lat: 999 }),
        feature({ t: 99 }),
        feature({ e: Number.NaN }),
        feature({ n: 'OK', t: 0, e: 1, lat: 46, lng: 14 }),
      ],
    });
    expect(parsed!.features).toHaveLength(1);
    expect(parsed!.features[0].n).toBe('OK');
  });
});

describe('rkd — filter', () => {
  test('brez filtrov vrne vse', () => {
    expect(filterRkd(DATASET.features)).toHaveLength(5);
  });

  test('filter po tipu', () => {
    const out = filterRkd(DATASET.features, { type: 2 });
    expect(out.map((f) => f.e)).toEqual([96, 100]);
  });

  test('besedilni filter (ime/opis/občina, brez velikih črk)', () => {
    const out = filterRkd(DATASET.features, { query: 'bled' });
    expect(out.map((f) => f.e).sort((a, b) => a - b)).toEqual([97, 100]);
    expect(filterRkd(DATASET.features, { query: 'brežice' })).toHaveLength(1);
    expect(filterRkd(DATASET.features, { query: 'Tromostovje' })).toHaveLength(1);
  });

  test('kombinacija tipa in besedila', () => {
    const out = filterRkd(DATASET.features, { type: 0, query: 'bled' });
    expect(out).toHaveLength(1);
    expect(out[0].e).toBe(97);
  });
});

describe('rkd — mrežno gručenje', () => {
  test('pri zoom 0 so vse značke v eni gruči', () => {
    const clusters = clusterRkd(DATASET.features, 0);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(5);
  });

  test('pri visokem zoomu je vsaka enota svoja gruča (count 1, feature set)', () => {
    const clusters = clusterRkd(DATASET.features, 16);
    expect(clusters).toHaveLength(5);
    for (const c of clusters) {
      expect(c.count).toBe(1);
      expect(c.feature).toBeDefined();
    }
  });

  test('limit omeji število gruč (najgostejše najprej)', () => {
    const clusters = clusterRkd(DATASET.features, 8, 2);
    expect(clusters.length).toBeLessThanOrEqual(2);
    expect(clusters[0].count).toBeGreaterThanOrEqual(clusters[1]?.count ?? 0);
  });

  test('prazen seznam → prazno', () => {
    expect(clusterRkd([], 10)).toHaveLength(0);
  });

  test('gručenje je deterministično', () => {
    const a = clusterRkd(DATASET.features, 10);
    const b = clusterRkd([...DATASET.features].reverse(), 10);
    expect(a).toEqual(b);
  });

  test('worldXY: robovi sveta so 0..1', () => {
    const [x0, y0] = worldXY(0, -180);
    const [x1, y1] = worldXY(0, 180);
    expect(x0).toBeCloseTo(0);
    expect(x1).toBeCloseTo(1);
    expect(y0).toBeCloseTo(0.5);
    expect(y1).toBeCloseTo(0.5);
  });
});

describe('rkd — pripomočki', () => {
  test('rkdUnitUrl uporabi EŠD', () => {
    expect(rkdUnitUrl(96)).toBe('https://eid.gov.si/S/96');
  });

  test('rkdPhotoUrl: prazna → null, sicer polna URL', () => {
    expect(rkdPhotoUrl('')).toBeNull();
    expect(rkdPhotoUrl('kf_1_00096.jpg')).toBe('https://ised.gov.si/statika/KF_RNPD/kf_1_00096.jpg');
  });

  test('inBounds', () => {
    const f = feature();
    expect(inBounds(f, { south: 45, west: 15, east: 16, north: 46 })).toBe(true);
    expect(inBounds(f, { south: 46, west: 15, east: 16, north: 47 })).toBe(false);
  });
});
