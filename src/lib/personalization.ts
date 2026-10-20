import {
  GUIDE_REGIONS,
  type GuideInterest,
  type GuidePace,
  type GuideRegionId,
  type GuideState,
} from '@/lib/guide-store';

/**
 * Poštena personalizacija: ocena je izračunana iz uporabnikovih interesov,
 * izbrane regije in tempa — brez skritih "94 %" konstant. Vsak odstotek ima
 * razlago, ki jo UI tudi pokaže.
 *
 * Katalog so doživetja (ne nujno iste točke kot TRIP_PLAN), da priporočila
 * dopolnijo načrt in se ne ponavljajo.
 */
export interface PersonalSuggestion {
  id: string;
  name: string;
  region: GuideRegionId;
  regionLabel: string;
  note: string;
  match: number;
  reasons: string[];
}

export interface PersonalizationInput {
  guide: GuideState | null;
  /** Imena že rezerviranih prenočišč (iz baze in/ali lokalne poti). */
  reservedNames?: readonly string[];
  limit?: number;
}

interface CatalogEntry {
  id: string;
  name: string;
  region: GuideRegionId;
  note: string;
  tags: readonly GuideInterest[];
}

const CATALOG: readonly CatalogEntry[] = [
  // Gorenjska
  { id: 'vintgar', name: 'Vintgar', region: 'gorenjska', note: 'Lesena pot ob reki Radovni', tags: ['narava', 'pohodništvo', 'družina'] },
  { id: 'pokljuka', name: 'Pokljuka', region: 'gorenjska', note: 'Gozdne poti in biatlonski center', tags: ['narava', 'pohodništvo', 'romantika'] },
  { id: 'kranjska-gora', name: 'Kranjska Gora', region: 'gorenjska', note: 'Izhodišče za Julijce in jezera', tags: ['pohodništvo', 'družina', 'narava'] },
  { id: 'radovljica', name: 'Radovljica', region: 'gorenjska', note: 'Staro mestno jedro in čokoladnice', tags: ['hrana', 'kultura', 'družina'] },
  // Osrednja Slovenija
  { id: 'skofja-loka', name: 'Škofja Loka', region: 'osrednja', note: 'Srednjeveško mesto ob Sori', tags: ['kultura', 'zgodovina', 'družina'] },
  { id: 'velika-planina', name: 'Velika Planina', region: 'osrednja', note: 'Pašniške koče in razgledi', tags: ['narava', 'pohodništvo', 'družina'] },
  { id: 'kamnik', name: 'Kamnik', region: 'osrednja', note: 'Stara mestna jedra in gradovi', tags: ['zgodovina', 'kultura', 'hrana'] },
  // Primorska
  { id: 'kobarid', name: 'Kobarid', region: 'primorska', note: 'Soška fronta in gorska kuhinja', tags: ['zgodovina', 'pohodništvo', 'hrana'] },
  { id: 'bovec', name: 'Bovec', region: 'primorska', note: 'Soča, slapovi in adrenalinski športi', tags: ['pohodništvo', 'narava', 'romantika'] },
  { id: 'stanjel', name: 'Štanjel', region: 'primorska', note: 'Kamnita vas in kraški vrt', tags: ['kultura', 'romantika', 'vino'] },
  { id: 'portoroz', name: 'Portorož', region: 'primorska', note: 'Obala, soline in morski sprehod', tags: ['romantika', 'hrana', 'družina'] },
  // Štajerska
  { id: 'pohorje', name: 'Pohorje', region: 'stajerska', note: 'Gozdovi, kolesarske in smučarske poti', tags: ['narava', 'pohodništvo', 'družina'] },
  { id: 'ptuj', name: 'Ptuj', region: 'stajerska', note: 'Najstarejše mesto in vinski hram', tags: ['zgodovina', 'kultura', 'vino'] },
  { id: 'jeruzalem', name: 'Jeruzalem', region: 'stajerska', note: 'Vinske gorice in kleti', tags: ['vino', 'hrana', 'romantika'] },
  // Koroška
  { id: 'slovenj-gradec', name: 'Slovenj Gradec', region: 'koroska', note: 'Glasbeno mesto in stare ulice', tags: ['kultura', 'hrana', 'družina'] },
  { id: 'radlje', name: 'Radlje ob Dravi', region: 'koroska', note: 'Dravska dolina in gozdne poti', tags: ['narava', 'pohodništvo'] },
];

const INTEREST_WEIGHT = 50;
const REGION_WEIGHT = 25;
const PACE_WEIGHT = 15;
const BASE_WEIGHT = 10;

function pacePoints(entry: CatalogEntry, pace: GuidePace | null): number {
  if (!pace) return 0;
  if (pace === 'športen') {
    return entry.tags.includes('pohodništvo') ? PACE_WEIGHT : 5;
  }
  if (pace === 'počasen') {
    return entry.tags.some((t) => t === 'romantika' || t === 'hrana' || t === 'kultura')
      ? PACE_WEIGHT
      : 5;
  }
  return entry.tags.some((t) => t === 'narava' || t === 'kultura' || t === 'hrana') ? 12 : 8;
}

function regionLabel(id: GuideRegionId): string {
  const region = GUIDE_REGIONS.find((g) => g.id === id);
  return region ? region.label.split(' (')[0] : id;
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('sl');
}

export function buildPersonalSuggestions({
  guide,
  reservedNames = [],
  limit = 3,
}: PersonalizationInput): PersonalSuggestion[] {
  if (!guide) return [];
  if (guide.interests.length === 0 && !guide.region) return [];

  const max = Math.max(1, Math.min(6, Number.isFinite(limit) ? Math.round(limit) : 3));
  const reserved = new Set(
    [...reservedNames, ...guide.stays.map((s) => s.name)]
      .map(normalizeName)
      .filter(Boolean),
  );

  return CATALOG.map((entry) => {
    if (reserved.has(normalizeName(entry.name))) return null;

    const matched = entry.tags.filter((tag) => guide.interests.includes(tag));
    const regionMatch = guide.region === entry.region;
    if (matched.length === 0 && !regionMatch) return null;

    const interestPoints =
      guide.interests.length > 0
        ? Math.round((matched.length / guide.interests.length) * INTEREST_WEIGHT)
        : 0;
    const regionPoints = regionMatch ? REGION_WEIGHT : 0;
    const pace = pacePoints(entry, guide.pace);
    const match = Math.min(100, BASE_WEIGHT + interestPoints + regionPoints + pace);

    const reasons: string[] = [];
    if (matched.length > 0) reasons.push(`Interesi: ${matched.join(', ')}`);
    if (regionMatch) reasons.push('V tvoji regiji');
    if (pace >= 12) reasons.push('Ustreza tempu');

    return {
      id: entry.id,
      name: entry.name,
      region: entry.region,
      regionLabel: regionLabel(entry.region),
      note: entry.note,
      match,
      reasons,
    } satisfies PersonalSuggestion;
  })
    .filter((s): s is PersonalSuggestion => s !== null)
    .sort((a, b) => b.match - a.match || a.name.localeCompare(b.name, 'sl'))
    .slice(0, max);
}
