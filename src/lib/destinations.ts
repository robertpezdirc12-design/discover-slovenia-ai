/**
 * DESTINACIJE — čista podatkovna plast za per-destination SEO strani.
 *
 * Ena statična stran na destinacijo iz kataloga vodiča (TRIP_PLAN):
 * `kraj/[slug]` — naslov/opis/JSON-LD za iskalnike, zanimivosti v bližini
 * iz urejenega izbora (POI_CATALOG) in klic k dejanju na zemljevid.
 *
 * Čisto in testabilno: brez Reacta, brez `window`, brez omrežja.
 */

import { GUIDE_REGIONS, type GuideRegionId } from '@/lib/guide-store';
import { TRIP_PLAN, type TripStop } from '@/lib/trip-plan';
import { POI_CATALOG } from '@/lib/poi-catalog';
import { POI_CATEGORY_LABELS } from '@/lib/route-poi';

export interface NearbyAttraction {
  name: string;
  category: string;
  categoryLabel: string;
  distanceKm: number;
}

export interface Destination {
  slug: string;
  name: string;
  regionId: GuideRegionId;
  regionLabel: string;
  /** Kratek opis (iz pojavnega okna zemljevida). */
  note: string;
  lat: number;
  lng: number;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // odstrani diakritike (š/č/ž → s/c/z)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Vse destinacije, izpeljane iz kataloga poti vodiča (stabilen vrstni red). */
export const DESTINATIONS: readonly Destination[] = GUIDE_REGIONS.flatMap(
  (region): Destination[] =>
    TRIP_PLAN[region.id].map((stop: TripStop, idx: number): Destination => {
      const base = slugify(stop.name);
      const slug = base || `${region.id}-${idx + 1}`;
      return {
        slug,
        name: stop.name,
        regionId: region.id,
        regionLabel: region.label,
        note: stop.note,
        lat: stop.lat,
        lng: stop.lng,
      };
    }),
);

export function destinationBySlug(slug: string): Destination | null {
  return DESTINATIONS.find((d) => d.slug === slug) ?? null;
}

/**
 * Zanimivosti iz urejenega izbora znotraj polmera, urejene po razdalji.
 */
export function nearbyAttractions(
  dest: Destination,
  radiusKm = 30,
  limit = 6,
): readonly NearbyAttraction[] {
  const out: NearbyAttraction[] = [];
  for (const poi of POI_CATALOG) {
    const d = haversineKm(dest, poi);
    if (d > radiusKm) continue;
    out.push({
      name: poi.name,
      category: poi.category,
      categoryLabel: POI_CATEGORY_LABELS[poi.category] ?? 'Zanimivost',
      distanceKm: d,
    });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, limit);
}

/** SEO naslov (bogat rezultat: destinacija + regija). */
export function destinationTitle(dest: Destination): string {
  return `${dest.name} · ${dest.regionLabel} — Odkrij Slovenijo`;
}

/**
 * SEO opis: naraven slovenski stavek z imenom destinacije, opisom in
 * bližnjimi znamenitostmi (ključne besede za iskalnike).
 */
export function destinationDescription(dest: Destination): string {
  const attractions = nearbyAttractions(dest, 30, 3);
  const nearby = attractions.length > 0 ? ` V bližini: ${attractions.map((a) => a.name).join(', ')}.` : '';
  return `${dest.name} v ${dest.regionLabel}: ${dest.note}.${nearby} Načrtuj pot, prenočišča in javni prevoz — vse iz enega mesta.`;
}

/** JSON-LD (schema.org Place) za posamezno destinacijo. */
export function destinationJsonLd(dest: Destination, baseUrl: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: dest.name,
    description: destinationDescription(dest),
    url: `${baseUrl}/kraj/${dest.slug}`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: dest.lat,
      longitude: dest.lng,
    },
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: dest.regionLabel,
    },
  };
}
