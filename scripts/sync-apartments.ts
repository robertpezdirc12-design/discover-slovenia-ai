/**
 * SEED: prenos realnih apartmajev v Sloveniji z odprtih spletnih virov
 * (Overpass → Nominatim rezerva) v lokalno SQLite bazo.
 *
 * Zagon: bun scripts/sync-apartments.ts
 * (isto logiko uporablja POST /api/apartments/sync)
 */

import { syncApartments, getApartmentsFromDb } from '../src/lib/apartments-sync';

async function main() {
  console.log('→ Usklajevanje apartmajev s spleta (Overpass → Photon) …');
  const outcome = await syncApartments(fetch);
  console.log(
    `✓ Vir: ${outcome.source} · zapisov: ${outcome.persisted} · neuspelih zahtevkov: ${outcome.failedRequests}/${outcome.totalRequests} · trajanje: ${(outcome.durationMs / 1000).toFixed(1)} s`,
  );

  const { apartments, updatedAt, source } = await getApartmentsFromDb();
  const withCity = apartments.filter((a) => a.city).length;
  console.log(`✓ Baza: ${apartments.length} apartmajev (s krajem: ${withCity}) · posodobljeno: ${updatedAt} · vir: ${source}`);

  // Kratek vzorec za hitro preverbo
  const sample = apartments.slice(0, 8);
  for (const a of sample) {
    console.log(`   • ${a.name} — ${a.city ?? '—'} [${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}] (${a.source})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ Usklajevanje ni uspelo:', err);
    process.exit(1);
  });
