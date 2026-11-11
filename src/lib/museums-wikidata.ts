/**
 * WIKIDATA muzeji — nalagalnik odprtih podatkov (CC0).
 *
 * Vir: public/data/museums-wikidata.json (SPARQL query.wikidata.org,
 * P31/P279* Q33506 + P625; generira research/remk/wikidata-museums.py).
 * Združi se s kuriranimi opisi (museums-balkan.ts / museums.ts) po
 * imenskem ujemanju — tako pini dobijo tudi opise kjer so znani.
 *
 * Strežniško (fs read) — uporablja ga /api/pot/places.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { PlaceCategoryId, PlaceResult } from '@/lib/place-categories';

interface WikidataEntry {
  item: string;
  name: string;
  lat: number;
  lng: number;
  wikiSl?: string | null;
  wikiEn?: string | null;
}

interface WikidataFile {
  format: string;
  countries: Record<string, WikidataEntry[]>;
}

/** Normalizacija imena za ujemanje (brez diakritik, velike črke). */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Naloži Wikidata muzeje za državo (manjka/prazno → null). */
function loadWikidataCountry(countryId: string): WikidataEntry[] | null {
  try {
    const file = path.join(process.cwd(), 'public', 'data', 'museums-wikidata.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as WikidataFile;
    const list = raw.countries?.[countryId];
    if (!Array.isArray(list) || list.length < 5) return null;
    return list;
  } catch {
    return null;
  }
}

/**
 * Wikidata muzeji + kurirani opisi (po imenskem ujemanju).
 * Vrne null, če Wikidata podatki za državo niso na voljo.
 */
export function buildWikidataMuseums(
  countryId: string,
  curated: readonly { name: string; desc: string; city: string; website?: string }[],
): PlaceResult[] | null {
  const wikidata = loadWikidataCountry(countryId);
  if (!wikidata) return null;

  const curatedNorm = curated.map((c) => ({
    ...c,
    norm: normalizeName(c.name),
  }));

  return wikidata.map((entry) => {
    const norm = normalizeName(entry.name);
    const match =
      curatedNorm.find((c) => norm.includes(c.norm) || c.norm.includes(norm)) ?? null;
    return {
      id: `wd-${entry.item}`,
      name: entry.name,
      category: 'muzeji' as PlaceCategoryId,
      lat: entry.lat,
      lng: entry.lng,
      curated: true,
      note: match?.desc,
      city: match?.city,
      website: match?.website,
      source: 'wikidata',
      // Natančen naslov Wikipedijinega članka — popup ga uporabi za
      // enrichment z `exact=1` (brez ugibanja, npr. ne »Stone Museum« → Oliver Stone).
      wikiTitle: entry.wikiSl ?? entry.wikiEn ?? undefined,
    };
  });
}
