/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  DESTINATIONS,
  destinationBySlug,
  destinationDescription,
  destinationJsonLd,
  destinationTitle,
  nearbyAttractions,
} from '../src/lib/destinations';
import { TRIP_PLAN } from '../src/lib/trip-plan';
import { GUIDE_REGIONS } from '../src/lib/guide-store';

describe('destinations — katalog', () => {
  test('pokrije VSE destinacije vseh regij vodiča (enolični slugi)', () => {
    const totalStops = GUIDE_REGIONS.reduce((n, r) => n + TRIP_PLAN[r.id].length, 0);
    expect(DESTINATIONS.length).toBe(totalStops);
    const slugs = new Set(DESTINATIONS.map((d) => d.slug));
    expect(slugs.size).toBe(DESTINATIONS.length); // enoličnost
    for (const d of DESTINATIONS) {
      expect(d.slug).toMatch(/^[a-z0-9-]+$/);
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.note.length).toBeGreaterThan(0);
      expect(Math.abs(d.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(d.lng)).toBeLessThanOrEqual(180);
    }
  });

  test('destinationBySlug: obstoječi → objekt, neznani → null', () => {
    const bled = destinationBySlug('bled');
    expect(bled).not.toBeNull();
    expect(bled!.name).toBe('Bled');
    expect(destinationBySlug('neobstaja')).toBeNull();
  });

  test('slugi so ASCII (š/č/ž → s/c/z)', () => {
    const soca = destinationBySlug('dolina-soce');
    expect(soca?.name).toBe('Dolina Soče');
  });
});

describe('destinations — SEO vsebina', () => {
  test('naslov vsebuje ime in regijo', () => {
    const bled = destinationBySlug('bled')!;
    expect(destinationTitle(bled)).toContain('Bled');
    expect(destinationTitle(bled)).toContain('Gorenjska');
  });

  test('opis vsebuje ime, regijo in bližnje znamenitosti', () => {
    const bled = destinationBySlug('bled')!;
    const desc = destinationDescription(bled);
    expect(desc).toContain('Bled');
    expect(desc).toContain('Gorenjska');
    // Bled ima zagotovljene znamenitosti v 30 km (Blejski grad/otok …)
    expect(desc).toMatch(/V bližini:/);
  });

  test('JSON-LD: Place z GeoCoordinates in pravilnim URL-jem', () => {
    const bled = destinationBySlug('bled')!;
    const ld = destinationJsonLd(bled, 'https://example.com') as Record<string, unknown>;
    expect(ld['@type']).toBe('Place');
    expect((ld.geo as Record<string, unknown>)['@type']).toBe('GeoCoordinates');
    expect(ld.url).toBe('https://example.com/kraj/bled');
  });
});

describe('destinations — zanimivosti v bližini', () => {
  test('vrne urejene po razdalji in znotraj polmera', () => {
    const bled = destinationBySlug('bled')!;
    const near = nearbyAttractions(bled, 30, 6);
    expect(near.length).toBeGreaterThan(0);
    expect(near.length).toBeLessThanOrEqual(6);
    for (let i = 1; i < near.length; i++) {
      expect(near[i].distanceKm).toBeGreaterThanOrEqual(near[i - 1].distanceKm);
    }
    for (const a of near) {
      expect(a.distanceKm).toBeLessThanOrEqual(30);
      expect(a.categoryLabel.length).toBeGreaterThan(0);
    }
  });

  test('omejitev števila', () => {
    const bled = destinationBySlug('bled')!;
    expect(nearbyAttractions(bled, 30, 2).length).toBeLessThanOrEqual(2);
  });
});
