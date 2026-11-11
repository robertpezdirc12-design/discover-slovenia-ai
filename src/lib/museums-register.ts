/**
 * URADNI REGISTER MUZEJEV (REMK) + kurirani opisi — združevalnik.
 *
 * Register: public/data/museums-register.json (REMK — Razvid muzejev RS,
 * Ministrstvo za kulturo; geokodirano prek Photon iz naslovov).
 * Opisi: src/lib/museums.ts (kurirani katalog) — po imenskem ujemanju.
 *
 * Strežniško (fs read) — uporablja ga /api/pot/places.
 */

import fs from 'node:fs';
import path from 'node:path';
import { MUSEUMS } from '@/lib/museums';
import type { PlaceCategoryId, PlaceResult } from '@/lib/place-categories';

interface RegisterEntry {
  id: string;
  name: string;
  address: string;
  registeredAt: string;
  lat: number;
  lng: number;
}

interface RegisterFile {
  museums: RegisterEntry[];
}

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-ZČŠŽ0-9]+/g, ' ')
    .trim();
}

/** Preberi register s diska (manjka/pokvarjen → null). */
function loadRegister(): RegisterFile | null {
  try {
    const file = path.join(process.cwd(), 'public', 'data', 'museums-register.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as RegisterFile;
    if (!Array.isArray(raw.museums) || raw.museums.length === 0) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Uradni register + kurirani opisi, združeno in brez podvojitev. */
export function buildSloveniaMuseums(): PlaceResult[] {
  const register = loadRegister();
  if (!register) {
    // Rezerva: samo kurirani katalog (brez uradnega statusa).
    return MUSEUMS.map((m) => ({
      id: `muzej-${m.id}`,
      name: m.name,
      category: 'muzeji' as PlaceCategoryId,
      lat: m.lat,
      lng: m.lng,
      curated: true,
      note: m.desc,
      city: m.city,
    }));
  }

  const out: PlaceResult[] = [];
  const usedCurated = new Set<string>();
  for (const entry of register.museums) {
    const normReg = normalizeName(entry.name);
    const match = MUSEUMS.find((m) => {
      const normCur = normalizeName(m.name);
      return normReg.includes(normCur) || normCur.includes(normReg);
    });
    if (match) usedCurated.add(match.id);
    out.push({
      id: entry.id,
      name: entry.name,
      category: 'muzeji',
      lat: entry.lat,
      lng: entry.lng,
      curated: true,
      note: match?.desc,
      city: match?.city,
      address: entry.address,
      source: 'remk',
      website: match?.website,
    });
  }
  // Kurirani muzeji, ki jih register (po imenu) ni pokril — dodaj na konec.
  for (const m of MUSEUMS) {
    if (usedCurated.has(m.id)) continue;
    out.push({
      id: `muzej-${m.id}`,
      name: m.name,
      category: 'muzeji',
      lat: m.lat,
      lng: m.lng,
      curated: true,
      note: m.desc,
      city: m.city,
      source: 'izbor',
    });
  }
  return out;
}
