/**
 * Vgrajen SNAPSHOT uradnega registra prenočišč (AJPES, Poslovni register
 * Slovenije — CC BY 4.0).
 *
 * `data/ajpes-apartments.json` nastane z `bun run data:export` in vsebuje
 * trenutno vsebino lokalne baze. Uporablja ga /api/apartments kot rezervo
 * na strežniških platformah brez SQLite (npr. Vercel serverless), kjer
 * Prisma ni dosegljiva in dolgotrajnega usklajevanja (prenos 126 MB CSV +
 * geokodiranje ~1 h) ni mogoče zagnati.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Vrstica snapshot-a — enaka obliki kot vrstica tabele Apartment. */
export interface SnapshotRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  street: string | null;
  postcode: string | null;
  obcina: string | null;
  legalForm: string | null;
  maticna: string | null;
  website: string | null;
  phone: string | null;
  stars: number | null;
  source: string;
}

export interface ApartmentsSnapshot {
  updatedAt: string | null;
  source: string | null;
  apartments: SnapshotRecord[];
}

const SNAPSHOT_PATH = join(process.cwd(), 'data', 'ajpes-apartments.json');

let cached: ApartmentsSnapshot | null = null;

/**
 * Prebere vgrajen snapshot (z predpomnilnikom na instanco).
 * Vrne null, če datoteka ni dosegljiva ali je oblika neveljavna.
 */
export async function loadApartmentsSnapshot(): Promise<ApartmentsSnapshot | null> {
  if (cached) return cached;
  try {
    const raw = await readFile(SNAPSHOT_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ApartmentsSnapshot;
    if (!parsed || !Array.isArray(parsed.apartments)) return null;
    cached = parsed;
    return cached;
  } catch {
    return null;
  }
}
