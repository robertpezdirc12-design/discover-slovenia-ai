/**
 * USKLAJEVANJE PRENOČIŠČ Z BAZO — servisna plast (Prisma + uradni viri).
 *
 * GLAVNI VIR — AJPES, Poslovni register Slovenije (uradni, CC BY 4.0):
 *   vsi registrirani sobodajalci (~3.400) z uradnimi naslovi; naslovi se
 *   geokodirajo prek Nominatim (≤ 1 zahteva/s, predpomnilnik v bazi),
 *   zato celoten potek traja tudi do eno uro. Poteka V OZADJU — napredek
 *   poroča `getSyncProgress()`, odjemalcu pa POST vrne takoj.
 *
 * REZERVA — OpenStreetMap (Overpass → Nominatim mreža), če AJPES ni
 *   dosegljiv. Podatki so vedno iskreno označeni z virom v UI.
 *
 * Zaklep: sočasni klici sync-ja delijo isti promise (brez podvojenih vnosov).
 */

import { db } from '@/lib/db';
import {
  PRS_CSV_URL,
  geocodeCacheKey,
  parsePrsCsvStream,
  streetLine,
  type AjpesProvider,
} from '@/lib/ajpes-source';
import { geocodeStructuredAddress, RateLimitError } from '@/lib/ajpes-geocode';
import {
  fetchNominatimApartments,
  fetchOverpassApartments,
  mergeApartmentRecords,
  type ApartmentRecord,
  type FetchLike,
  type SyncOutcome,
} from '@/lib/apartments-source';

export interface ApartmentsPayload {
  apartments: ApartmentRecord & { obcina?: string | null; legalForm?: string | null; maticna?: string | null }[];
  updatedAt: string | null;
  source: string | null;
}

const SYNC_ID = 'apartments-sync';
const NOMINATIM_MAX_DURATION_MS = 12 * 60 * 1000; // varnostna omejitev OSM mrežnega iskanja
const CSV_CACHE_PATH = '/tmp/opsiprs_cache.csv';
const CSV_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const PROGRESS_LOG_EVERY = 50;

// ─── Branje iz baze ──────────────────────────────────────────────────────────

/** Prebere vse prenočišča iz baze (+ metapodatke usklajevanja). */
export async function getApartmentsFromDb(): Promise<{
  apartments: Array<{
    id: string; name: string; lat: number; lng: number;
    city: string | null; street: string | null; postcode: string | null;
    obcina: string | null; legalForm: string | null; maticna: string | null;
    website: string | null; phone: string | null; stars: number | null;
    source: string;
  }>;
  updatedAt: string | null;
  source: string | null;
}> {
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
      obcina: r.obcina,
      legalForm: r.legalForm,
      maticna: r.maticna,
      website: r.website,
      phone: r.phone,
      stars: r.stars,
      source: r.source,
    })),
    updatedAt: state ? state.updatedAt.toISOString() : null,
    source: state?.source ?? null,
  };
}

/** Ali je baza prazna (sproži samodejno usklajevanje). */
export async function isApartmentsDbEmpty(): Promise<boolean> {
  return (await db.apartment.count()) === 0;
}

// ─── AJPES: potek v ozadju + napredek ────────────────────────────────────────

export type SyncPhase = 'idle' | 'download' | 'geocode' | 'persist' | 'done' | 'error';

/** Stanje usklajevanja — odjemalec ga poizveduje (GET /api/apartments/sync). */
export interface SyncProgress {
  running: boolean;
  phase: SyncPhase;
  done: number;
  total: number;
  matched: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

const IDLE_PROGRESS: SyncProgress = {
  running: false,
  phase: 'idle',
  done: 0,
  total: 0,
  matched: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
};

let progress: SyncProgress = { ...IDLE_PROGRESS };
let syncInFlight: Promise<SyncProgress> | null = null;

/** Trenutno stanje usklajevanja (za API + UI). */
export function getSyncProgress(): SyncProgress {
  return { ...progress };
}

function setProgress(patch: Partial<SyncProgress>): void {
  progress = { ...progress, ...patch };
}

/** Pridobi pretok PRS CSV (predpomnilnik na disku; prenos → tee v predpomnilnik). */
async function prsCsvStream(doFetch: FetchLike): Promise<ReadableStream<Uint8Array>> {
  const fs = await import('node:fs/promises');
  const fsSync = await import('node:fs');
  const { Readable } = await import('node:stream');

  try {
    const st = await fs.stat(CSV_CACHE_PATH);
    if (st.size > 1_000_000 && Date.now() - st.mtimeMs < CSV_CACHE_MAX_AGE_MS) {
      return Readable.toWeb(fsSync.createReadStream(CSV_CACHE_PATH)) as unknown as ReadableStream<Uint8Array>;
    }
  } catch {
    // ni predpomnilnika → prenos
  }

  const res = await doFetch(PRS_CSV_URL, {
    signal: AbortSignal.timeout(300_000),
    headers: { 'User-Agent': 'discover-slovenia-ai/1.0 (uradni odprti podatki; CC BY 4.0)' },
  });
  if (!res.ok || !res.body) throw new Error(`Prenos PRS ni uspel: HTTP ${res.status}`);

  const [forCache, forParse] = res.body.tee();
  // Predpomnilnik pišemo vzporedno (ne blokira razčlenjevanja)
  void (async () => {
    try {
      const out = fsSync.createWriteStream(CSV_CACHE_PATH);
      const nodeReadable = Readable.fromWeb(forCache as never);
      await new Promise<void>((resolve) => {
        nodeReadable.pipe(out);
        out.on('finish', () => resolve());
        out.on('error', () => resolve());
      });
    } catch {
      // predpomnilnik ni ključen
    }
  })();
  return forParse;
}

/** Geokodiraj ponudnika z bazo kot predpomnilnikom. */
async function geocodeWithCache(
  p: AjpesProvider,
  stats: { exact: number; street: number; settlement: number; miss: number; cached: number; error: number },
): Promise<{ lat: number; lng: number; obcina: string | null } | null> {
  const key = geocodeCacheKey(p);

  const cached = await db.geocodeCache.findUnique({ where: { key } });
  if (cached) {
    stats.cached += 1;
    if (cached.match !== 'miss' && cached.lat !== null && cached.lng !== null) {
      if (cached.match === 'exact') stats.exact += 1;
      else if (cached.match === 'street') stats.street += 1;
      else stats.settlement += 1;
      return { lat: cached.lat, lng: cached.lng, obcina: cached.obcina };
    }
    stats.miss += 1;
    return null;
  }

  const outcome = await geocodeStructuredAddress(fetch, {
    ulica: p.ulica,
    hs: p.hs,
    hsDodatek: p.hsDodatek,
    naselje: p.naselje,
  });

  // Začasna napaka (npr. 429): NE gre v negativni predpomnilnik.
  if (outcome.transient) {
    stats.error += 1;
    return null;
  }

  await db.geocodeCache.upsert({
    where: { key },
    update: {
      lat: outcome.lat,
      lng: outcome.lng,
      obcina: outcome.obcina,
      match: outcome.match,
      checkedAt: new Date(),
    },
    create: {
      key,
      lat: outcome.lat,
      lng: outcome.lng,
      obcina: outcome.obcina,
      match: outcome.match,
      checkedAt: new Date(),
    },
  });

  if (outcome.match === 'miss') stats.miss += 1;
  else if (outcome.match === 'exact') stats.exact += 1;
  else if (outcome.match === 'street') stats.street += 1;
  else stats.settlement += 1;

  if (outcome.match === 'miss' || outcome.lat === null || outcome.lng === null) return null;
  return { lat: outcome.lat, lng: outcome.lng, obcina: outcome.obcina };
}

/**
 * Celoten AJPES potek (prenos → izvleček → geokodiranje → zapis).
 * Dolgotrajen (geokodiranje ≤ 1 zahteva/s) — kliči v ozadju.
 */
async function runAjpesSync(): Promise<SyncProgress> {
  const startedAt = new Date();
  setProgress({ running: true, phase: 'download', startedAt: startedAt.toISOString(), finishedAt: null, error: null, done: 0, total: 0, matched: 0 });

  try {
    const stream = await prsCsvStream(fetch);
    const parsed = await parsePrsCsvStream(stream);
    if (parsed.providers.length === 0) throw new Error('PRS: ni ponudnikov — preveri format CSV-ja.');
    setProgress({ phase: 'geocode', total: parsed.providers.length });

    const stats = { exact: 0, street: 0, settlement: 0, miss: 0, cached: 0, error: 0 };
    const located: Array<{
      id: string; name: string; lat: number; lng: number; city: string | null;
      street: string; postcode: string | null; obcina: string | null;
      legalForm: string; maticna: string;
    }> = [];

    for (let i = 0; i < parsed.providers.length; i += 1) {
      const p = parsed.providers[i];
      try {
        const geo = await geocodeWithCache(p, stats);
        if (geo) {
          located.push({
            id: `ajpes-${p.maticna}`,
            name: p.name,
            lat: geo.lat,
            lng: geo.lng,
            city: p.naselje || null,
            street: streetLine(p),
            postcode: p.postnaSt ? `${p.postnaSt} ${p.posta}`.trim() : null,
            obcina: geo.obcina,
            legalForm: p.legalForm,
            maticna: p.maticna,
          });
        }
      } catch (err) {
        // Omejevanje Nominatim → ustavi potek (stanje 'error', napredek ostane)
        if (err instanceof RateLimitError) throw err;
        // Posamezen zapis ne sme ustaviti celotnega usklajevanja
        console.log(`[ajpes-sync] opomba: zapis ${p.maticna} preskočen: ${err instanceof Error ? err.message : 'napaka'}`);
      }
      setProgress({ done: i + 1, matched: located.length });

      if ((i + 1) % PROGRESS_LOG_EVERY === 0) {
        console.log(
          `[ajpes-sync] ${i + 1}/${parsed.providers.length} · exact:${stats.exact} street:${stats.street} ` +
            `naselje:${stats.settlement} brez:${stats.miss}`,
        );
      }
    }

    setProgress({ phase: 'persist' });
    await db.$transaction([
      db.apartment.deleteMany(),
      db.apartment.createMany({
        data: located.map((r) => ({
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
          website: null,
          phone: null,
          stars: null,
          source: 'ajpes',
        })),
      }),
      db.syncState.upsert({
        where: { id: SYNC_ID },
        update: { updatedAt: new Date(), source: 'ajpes-prs', count: located.length },
        create: { id: SYNC_ID, updatedAt: new Date(), source: 'ajpes-prs', count: located.length },
      }),
    ]);

    setProgress({ running: false, phase: 'done', finishedAt: new Date().toISOString() });
    console.log(`[ajpes-sync] KONEC: ${located.length} uradnih ponudnikov v bazi.`);
    return getSyncProgress();
  } catch (err) {
    console.error('[ajpes-sync] NAPAKA:', err);
    setProgress({
      running: false,
      phase: 'error',
      error: err instanceof Error ? err.message : 'Usklajevanje ni uspelo.',
      finishedAt: new Date().toISOString(),
    });
    return getSyncProgress();
  } finally {
    syncInFlight = null;
  }
}

/** Zaženi AJPES usklajevanje v ozadju (idempotentno — če že teče, vrni stanje). */
export function startAjpesSyncInBackground(): SyncProgress {
  if (syncInFlight) return getSyncProgress();
  syncInFlight = runAjpesSync();
  return getSyncProgress();
}

// ─── Rezerva: OSM (Overpass → Nominatim) ─────────────────────────────────────

const OVERPASS_TIMEOUT_MS = 12_000;

/** OSM potek (rezerva, če AJPES ni dosegljiv). Syncrhon-await do konca. */
export async function syncApartmentsOsm(
  doFetch: FetchLike = fetch,
): Promise<SyncOutcome & { persisted: number }> {
  const startedAt = Date.now();

  const overpass = await fetchOverpassApartments(doFetch, OVERPASS_TIMEOUT_MS);

  let records: ApartmentRecord[];
  let source: SyncOutcome['source'];
  let failedRequests = 0;
  let totalRequests = 1;

  if (overpass && overpass.length > 0) {
    records = overpass;
    source = 'overpass';
  } else {
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
        obcina: null,
        legalForm: null,
        maticna: null,
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
}
