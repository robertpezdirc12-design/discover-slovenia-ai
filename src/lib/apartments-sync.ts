/**
 * USKLAJEVANJE APARTMAJEV Z BAZO — servisna plast (Prisma + spletni viri).
 *
 * Potek: Overpass (bogatejši vir) → če ni dosegljiv, Nominatim po mreži
 * celic (≤ 1 zahteva/s, traja nekaj minut). Zapisi se v transakciji
 * prepišejo v SQLite (tabela `Apartment`), tako da je odziv API-ja
 * takojšen tudi, ko je omrežje počasno/vpisano. Vir v UI je vedno
 * iskreno označen (overpass / nominatim + čas usklajevanja).
 *
 * Zaklep: sočasni klici sync-ja delijo isti promise (brez podvojenih vnosov).
 */

import { db } from '@/lib/db';
import {
  fetchNominatimApartments,
  fetchOverpassApartments,
  mergeApartmentRecords,
  type ApartmentRecord,
  type FetchLike,
  type SyncOutcome,
} from '@/lib/apartments-source';

export interface ApartmentsPayload {
  apartments: ApartmentRecord[];
  updatedAt: string | null;
  source: string | null;
}

const OVERPASS_TIMEOUT_MS = 12_000;
const SYNC_ID = 'apartments-sync';
const NOMINATIM_MAX_DURATION_MS = 12 * 60 * 1000; // varnostna omejitev mrežnega iskanja

let syncInFlight: Promise<SyncOutcome & { persisted: number }> | null = null;

/** Prebere vse apartmaje iz baze (+ metapodatke usklajevanja). */
export async function getApartmentsFromDb(): Promise<ApartmentsPayload> {
  const [rows, state] = await Promise.all([
    db.apartment.findMany({ orderBy: [{ city: 'asc' }, { name: 'asc' }] }),
    db.syncState.findUnique({ where: { id: SYNC_ID } }),
  ]);
  return {
    apartments: rows.map((r) => ({
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      city: r.city,
      street: r.street,
      postcode: r.postcode,
      website: r.website,
      phone: r.phone,
      stars: r.stars,
      source: r.source === 'overpass' ? 'overpass' : 'nominatim',
    })),
    updatedAt: state ? state.updatedAt.toISOString() : null,
    source: state?.source ?? null,
  };
}

/** Ali je baza prazna (sproži samodejno usklajevanje). */
export async function isApartmentsDbEmpty(): Promise<boolean> {
  return (await db.apartment.count()) === 0;
}

/**
 * Uskladi apartmaje s spleta in jih preprišče v bazo.
 * Sočasni klici delijo isti promise; rezultat vsebuje izvor + številke.
 */
export async function syncApartments(
  doFetch: FetchLike = fetch,
): Promise<SyncOutcome & { persisted: number }> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const startedAt = Date.now();

    // 1) Overpass (bogatejši vir: website/phone/stars) — če je dosegljiv
    const overpass = await fetchOverpassApartments(doFetch, OVERPASS_TIMEOUT_MS);

    let records: ApartmentRecord[];
    let source: SyncOutcome['source'];
    let failedRequests = 0;
    let totalRequests = 1;

    if (overpass && overpass.length > 0) {
      records = overpass;
      source = 'overpass';
    } else {
      // 2) Nominatim po mreži celic (rezerva, ≤ 1 zahteva/s → nekaj minut)
      const timeoutSignal = AbortSignal.timeout(NOMINATIM_MAX_DURATION_MS);
      const guardedFetch: FetchLike = (url, init) =>
        doFetch(url, { signal: init?.signal ?? timeoutSignal });
      const nominatim = await fetchNominatimApartments(guardedFetch);
      records = nominatim.records;
      source = 'nominatim';
      failedRequests = nominatim.failures;
      totalRequests = nominatim.requests;
    }

    const merged = mergeApartmentRecords(records);
    const outcome: SyncOutcome = {
      records: merged,
      source,
      failedRequests,
      totalRequests,
      durationMs: Date.now() - startedAt,
    };

    // 3) Prepis v bazo (transakcija: delete-all + insert-all → brez dvojnikov)
    await db.$transaction([
      db.apartment.deleteMany(),
      db.apartment.createMany({
        data: merged.map((r) => ({
          id: r.id,
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          city: r.city,
          street: r.street,
          postcode: r.postcode,
          website: r.website,
          phone: r.phone,
          stars: r.stars,
          source: r.source,
        })),
      }),
      db.syncState.upsert({
        where: { id: SYNC_ID },
        update: { updatedAt: new Date(), source, count: merged.length },
        create: { id: SYNC_ID, updatedAt: new Date(), source, count: merged.length },
      }),
    ]);

    return { ...outcome, persisted: merged.length };
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}
