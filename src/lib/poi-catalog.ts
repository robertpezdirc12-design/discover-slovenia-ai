/**
 * UREJENI IZBOR SLOVENSKIH ZNAMENITOSTI — zagotovljena rezerva za »vredne
 * postaje ob poti«.
 *
 * Zakaj: javna Overpass zrcala so občasno nedosegljiva ali rate-limitana,
 * `overpass.osm.ch` pa je ŠVICARSKI izvleček OSM in za Slovenijo vedno
 * vrne prazen `elements`. Funkcija zato ne sme biti odvisna izključno od
 * živega vira — uporabnik nikoli ne sme dobiti praznega zaslona.
 *
 * Vir podatkov: javno znane lokacije slovenskih znamenitosti (približne
 * koordinate središča objekta, natančnost ~100 m). To NI OSM podatek, zato
 * se v UI označi z `source: 'izbor'` in ne pripisuje © OpenStreetMap.
 * Koordinate so informativne — za navigacijo uporabi GPX izvoz ali karto.
 *
 * Čista logika: brez Reacta, brez `window`, brez omrežja. Filtriranje po
 * razdalji do poti uporablja iste funkcije kot živi OSM vir.
 */

import {
  clampPoiMax,
  clampRadiusKm,
  distributePois,
  distanceToRouteKm,
  type LatLng,
  type PoiCategory,
  type RoutePoi,
} from '@/lib/route-poi';

interface CatalogEntry {
  name: string;
  lat: number;
  lng: number;
  category: PoiCategory;
  /** Regija vodiča — olajša pregled pokritosti v testih. */
  region: 'gorenjska' | 'osrednja' | 'primorska' | 'stajerska' | 'koroska';
}

const ENTRIES: readonly CatalogEntry[] = [
  // ——— Gorenjska / Julijske Alpe ———
  { name: 'Blejski grad', lat: 46.3697, lng: 14.1067, category: 'kultura', region: 'gorenjska' },
  { name: 'Blejski otok', lat: 46.3622, lng: 14.0866, category: 'kultura', region: 'gorenjska' },
  { name: 'Soteska Vintgar', lat: 46.3903, lng: 14.0853, category: 'narava', region: 'gorenjska' },
  { name: 'Razgledna točka Ojstrica', lat: 46.3647, lng: 14.1082, category: 'razgled', region: 'gorenjska' },
  { name: 'Radovljica — stari trg', lat: 46.3421, lng: 14.1739, category: 'kultura', region: 'gorenjska' },
  { name: 'Bohinjsko jezero', lat: 46.282, lng: 13.855, category: 'narava', region: 'gorenjska' },
  { name: 'Cerkev sv. Janeza Krstnika, Bohinj', lat: 46.2737, lng: 13.8597, category: 'kultura', region: 'gorenjska' },
  { name: 'Mostniška soteska', lat: 46.274, lng: 13.923, category: 'narava', region: 'gorenjska' },
  { name: 'Slap Savica', lat: 46.2431, lng: 13.8012, category: 'narava', region: 'gorenjska' },
  { name: 'Vogel — razgledna ploščad', lat: 46.2772, lng: 13.8389, category: 'razgled', region: 'gorenjska' },
  { name: 'Slap Peričnik', lat: 46.3945, lng: 13.8917, category: 'narava', region: 'gorenjska' },
  { name: 'Triglav', lat: 46.378, lng: 13.8366, category: 'narava', region: 'gorenjska' },
  { name: 'Jezero Jasna', lat: 46.438, lng: 13.841, category: 'narava', region: 'gorenjska' },
  { name: 'Prelaz Vršič', lat: 46.4336, lng: 13.7461, category: 'razgled', region: 'gorenjska' },
  { name: 'Ruska kapelica pod Vršičem', lat: 46.426, lng: 13.746, category: 'kultura', region: 'gorenjska' },
  { name: 'Škofjeloški grad', lat: 46.1652, lng: 14.3031, category: 'kultura', region: 'gorenjska' },
  { name: 'Stari grad nad Kamnikom', lat: 46.225, lng: 14.61, category: 'kultura', region: 'gorenjska' },
  { name: 'Velika planina', lat: 46.312, lng: 14.652, category: 'narava', region: 'gorenjska' },
  { name: 'Arboretum Volčji Potok', lat: 46.183, lng: 14.61, category: 'narava', region: 'gorenjska' },

  // ——— Osrednja Slovenija ———
  { name: 'Ljubljanski grad', lat: 46.0489, lng: 14.5089, category: 'kultura', region: 'osrednja' },
  { name: 'Tromostovje', lat: 46.051, lng: 14.5065, category: 'kultura', region: 'osrednja' },
  { name: 'Zmajski most', lat: 46.052, lng: 14.5095, category: 'kultura', region: 'osrednja' },
  { name: 'Prešernov trg', lat: 46.0513, lng: 14.506, category: 'kultura', region: 'osrednja' },
  { name: 'Narodna galerija', lat: 46.051, lng: 14.503, category: 'kultura', region: 'osrednja' },
  { name: 'Park Tivoli', lat: 46.053, lng: 14.494, category: 'narava', region: 'osrednja' },
  { name: 'Rožnik — razgledna točka', lat: 46.052, lng: 14.483, category: 'razgled', region: 'osrednja' },
  { name: 'Postojnska jama', lat: 45.816, lng: 14.204, category: 'narava', region: 'osrednja' },
  { name: 'Predjamski grad', lat: 45.815, lng: 14.128, category: 'kultura', region: 'osrednja' },
  { name: 'Cerkniško jezero', lat: 45.748, lng: 14.383, category: 'narava', region: 'osrednja' },
  { name: 'Grad Žužemberk', lat: 45.83, lng: 14.93, category: 'kultura', region: 'osrednja' },
  { name: 'Grad Otočec', lat: 45.838, lng: 15.222, category: 'kultura', region: 'osrednja' },

  // ——— Primorska / Soča / Obala / Kras ———
  { name: 'Tolminska korita', lat: 46.192, lng: 13.744, category: 'narava', region: 'primorska' },
  { name: 'Slap Kozjak', lat: 46.19, lng: 13.742, category: 'narava', region: 'primorska' },
  { name: 'Trdnjava Kluže', lat: 46.3583, lng: 13.588, category: 'kultura', region: 'primorska' },
  { name: 'Slap Boka', lat: 46.325, lng: 13.593, category: 'narava', region: 'primorska' },
  { name: 'Kobariški muzej', lat: 46.2463, lng: 13.5786, category: 'kultura', region: 'primorska' },
  { name: 'Šmartno v Brdih', lat: 45.999, lng: 13.558, category: 'kultura', region: 'primorska' },
  { name: 'Vipavski Križ', lat: 45.882, lng: 13.862, category: 'kultura', region: 'primorska' },
  { name: 'Škocjanske jame', lat: 45.665, lng: 13.992, category: 'narava', region: 'primorska' },
  { name: 'Lipica — kobilarna', lat: 45.665, lng: 13.883, category: 'kultura', region: 'primorska' },
  { name: 'Tartinijev trg, Piran', lat: 45.528, lng: 13.568, category: 'kultura', region: 'primorska' },
  { name: 'Piransko obzidje', lat: 45.5295, lng: 13.567, category: 'razgled', region: 'primorska' },
  { name: 'Sečoveljske soline', lat: 45.478, lng: 13.604, category: 'narava', region: 'primorska' },
  { name: 'Cerkev sv. Trojice, Hrastovlje', lat: 45.51, lng: 13.9, category: 'kultura', region: 'primorska' },

  // ——— Štajerska / Savinjska ———
  { name: 'Logarska dolina', lat: 46.383, lng: 14.636, category: 'narava', region: 'stajerska' },
  { name: 'Slap Rinka', lat: 46.367, lng: 14.634, category: 'narava', region: 'stajerska' },
  { name: 'Celjski grad', lat: 46.231, lng: 15.259, category: 'kultura', region: 'stajerska' },
  { name: 'Lent, Maribor', lat: 46.556, lng: 15.646, category: 'kultura', region: 'stajerska' },
  { name: 'Najstarejša trta na svetu', lat: 46.5565, lng: 15.645, category: 'kultura', region: 'stajerska' },
  { name: 'Mariborski grad', lat: 46.5605, lng: 15.6438, category: 'kultura', region: 'stajerska' },
  { name: 'Piramida nad Mariborom', lat: 46.563, lng: 15.645, category: 'razgled', region: 'stajerska' },
  { name: 'Mariborsko Pohorje', lat: 46.53, lng: 15.6, category: 'narava', region: 'stajerska' },
  { name: 'Ptujski grad', lat: 46.42, lng: 15.871, category: 'kultura', region: 'stajerska' },
  { name: 'Rogaška Slatina — park', lat: 46.243, lng: 15.704, category: 'narava', region: 'stajerska' },

  // ——— Koroška ———
  { name: 'Sotočje Drave in Meže', lat: 46.5864, lng: 15.0019, category: 'narava', region: 'koroska' },
  { name: 'Grad Dravograd', lat: 46.5886, lng: 15.0047, category: 'kultura', region: 'koroska' },
  { name: 'Črneško jezero', lat: 46.579, lng: 14.975, category: 'narava', region: 'koroska' },
  { name: 'Cerkev sv. Martina, Libeliče', lat: 46.608, lng: 14.949, category: 'kultura', region: 'koroska' },
  { name: 'Slovenj Gradec — stari trg', lat: 46.508, lng: 15.08, category: 'kultura', region: 'koroska' },
  { name: 'Velika Kopa, Kope', lat: 46.51, lng: 14.95, category: 'razgled', region: 'koroska' },
  { name: 'Peca', lat: 46.503, lng: 14.802, category: 'narava', region: 'koroska' },
] as const;

/** Stabilna, berljiva identiteta iz imena (č/š/ž → c/s/z). */
function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface CatalogPoi extends CatalogEntry {
  id: string;
}

export const POI_CATALOG: readonly CatalogPoi[] = ENTRIES.map((e) => ({
  ...e,
  id: `izbor-${slug(e.name)}`,
}));

export const CATALOG_ATTRIBUTION = 'urejeni izbor slovenskih znamenitosti';

export interface CatalogOptions {
  radiusKm?: number;
  max?: number;
}

/**
 * Izbor znamenitosti znotraj `radiusKm` od geometrije poti — enaka pravila
 * (razdalja, razpršitev, omejitev) kot pri živih OSM predlogih.
 */
export function selectCatalogPois(
  coords: readonly LatLng[],
  options: CatalogOptions = {},
): RoutePoi[] {
  const radius = clampRadiusKm(options.radiusKm);
  const max = clampPoiMax(options.max);
  const candidates: RoutePoi[] = [];
  for (const entry of POI_CATALOG) {
    const d = distanceToRouteKm(entry, coords);
    if (!d || d.distanceKm > radius) continue;
    candidates.push({
      id: entry.id,
      name: entry.name,
      lat: entry.lat,
      lng: entry.lng,
      category: entry.category,
      distanceKm: d.distanceKm,
      progress: d.progress,
      source: 'izbor',
    });
  }
  return distributePois(candidates, max);
}
