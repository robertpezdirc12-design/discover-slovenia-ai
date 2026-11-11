/**
 * IZVOZ uradnega registra prenočišč (AJPES) v vgrajen snapshot.
 *
 * Zaženi: bun run data:export
 *
 * Ustvari data/ajpes-apartments.json — trenutno vsebino tabele Apartment
 * (+ metapodatke usklajevanja). Snapshot gre v repozitorij in se uporablja
 * na strežniških platformah brez SQLite (Vercel), kjer lokalne baze ni in
 * dolgotrajnega usklajevanja ni mogoče zagnati.
 *
 * Po vsaki lokalni sinhronizaciji (scripts/sync-ajpes.ts) ponovi izvoz,
 * da snapshot ostane svež.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db';

const SYNC_ID = 'apartments-sync';
const OUT_DIR = join(process.cwd(), 'data');
const OUT_FILE = join(OUT_DIR, 'ajpes-apartments.json');

async function main(): Promise<void> {
  const [rows, state] = await Promise.all([
    db.apartment.findMany({ orderBy: [{ city: 'asc' }, { name: 'asc' }] }),
    db.syncState.findUnique({ where: { id: SYNC_ID } }),
  ]);

  const payload = {
    updatedAt: state ? state.updatedAt.toISOString() : null,
    source: state?.source ?? null,
    count: rows.length,
    apartments: rows.map((r) => ({
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      city: r.city,
      street: r.street,
      postcode: r.postcode,
      obcina: r.obcina,
      legalForm: r.legalForm,
      maticna: r.maticna,
      website: r.website,
      phone: r.phone,
      stars: r.stars,
      source: r.source,
    })),
  };

  const json = JSON.stringify(payload);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, json, 'utf8');

  console.log(
    `[data:export] ${rows.length} ponudnikov (vir: ${payload.source ?? '—'}, posodobljeno: ${payload.updatedAt ?? '—'}) → ${OUT_FILE} (${(json.length / 1024).toFixed(0)} KB)`,
  );
  await db.$disconnect();
}

main().catch((err) => {
  console.error('[data:export] NAPAKA:', err);
  process.exit(1);
});
