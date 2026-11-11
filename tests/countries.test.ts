/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { BALKAN_COUNTRY_VIEWS, REGION_COUNTRY, countryInfoForRegion } from '../src/lib/countries';
import { GUIDE_REGIONS } from '../src/lib/guide-store';

describe('countries — pokritost in celovitost', () => {
  test('vsaka non-SI regija ima informacije o državi', () => {
    const nonSi = GUIDE_REGIONS.filter((r) => r.id !== 'gorenjska' && r.id !== 'osrednja' && r.id !== 'primorska' && r.id !== 'stajerska' && r.id !== 'koroska');
    expect(nonSi.length).toBe(7);
    for (const region of nonSi) {
      const info = REGION_COUNTRY[region.id];
      expect(info, `manjka info za ${region.id}`).toBeDefined();
      expect(info!.name.length).toBeGreaterThan(2);
      expect(typeof info!.eu).toBe('boolean');
      expect(typeof info!.schengen).toBe('boolean');
      expect(info!.transport.length).toBeGreaterThanOrEqual(2);
      expect(info!.tips.length).toBeGreaterThanOrEqual(2);
      expect(info!.links.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('Slovenija nima informacij (domača država)', () => {
    expect(countryInfoForRegion('gorenjska')).toBeNull();
    expect(countryInfoForRegion(null)).toBeNull();
  });

  test('povezave so veljavne (https) in označene', () => {
    for (const info of Object.values(REGION_COUNTRY)) {
      for (const link of info.links) {
        expect(link.url.startsWith('https://')).toBe(true);
        expect(link.label.length).toBeGreaterThan(0);
      }
    }
  });

  test('imena držav so enolična', () => {
    const names = Object.values(REGION_COUNTRY).map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('countries — pogledi za navigacijo (Država select)', () => {
  test('vsaka država ima veljaven center in zoom', () => {
    expect(BALKAN_COUNTRY_VIEWS.length).toBe(8);
    for (const c of BALKAN_COUNTRY_VIEWS) {
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lng)).toBeLessThanOrEqual(180);
      expect(c.zoom).toBeGreaterThanOrEqual(5);
      expect(c.zoom).toBeLessThanOrEqual(10);
      expect(c.name.length).toBeGreaterThan(2);
    }
    const ids = new Set(BALKAN_COUNTRY_VIEWS.map((c) => c.id));
    expect(ids.size).toBe(BALKAN_COUNTRY_VIEWS.length);
  });
});
