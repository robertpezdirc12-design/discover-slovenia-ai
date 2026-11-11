/**
 * STANDALONE USKLAJEVANJE: uradni ponudniki prenočitve (AJPES PRS).
 *
 * Zaženi: bun run scripts/sync-ajpes.ts   (v ozadju — traja ~1 h)
 *
 * Potek:
 *  1) Prenos uradnega PRS CSV (podatki.gov.si, CC BY 4.0) — predpomnjen
 *     v /tmp/opsiprs_cache.csv (12 h); razčlenjevanje poteka PRETOKOM
 *     (celoten 126 MB CSV nikoli ni v pomnilniku).
 *  2) Izvleček vseh registriranih sobodajalcev (~3.400 uradnih ponudnikov).
 *  3) Geokodiranje uradnih naslovov (Nominatim, ≤ 1 zahteva/s) s predpomnilnikom
 *     v bazi (GeocodeCache) — prekinjen zagon se nemoteno nadaljuje.
 *  4) Ob koncu: prepis v tabelo Apartment (id = "ajpes-<maticna>") + SyncState.
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

const CSV_CACHE_PATH = '/tmp/opsiprs_cache.csv';
const CSV_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const LOG_EVERY = 100;

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/** Pridobi pretok PRS CSV (predpomnilnik na disku; prenos → tee v predpomnilnik). */
async function prsCsvStream(): Promise<ReadableStream<Uint8Array>> {
  try {
    const file = Bun.file(CSV_CACHE_PATH);
    if (await file.exists()) {
      const age = Date.now() - file.lastModified;
      if (age < CSV_CACHE_MAX_AGE_MS) {
        log(`CSV iz predpomnilnika (${CSV_CACHE_PATH}, starost ${Math.round(age / 60000)} min)`);
        return file.stream();
      }
    }
  } catch {
    // brez predpomnilnika → prenos
  }

  log(`Prenos PRS CSV: ${PRS_CSV_URL}`);
  const res = await fetch(PRS_CSV_URL, {
    headers: { 'User-Agent': 'discover-slovenia-ai/1.0 (uradni odprti podatki; CC BY 4.0)' },
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok || !res.body) throw new Error(`Prenos PRS ni uspel: HTTP ${res.status}`);

  const [forCache, forParse] = res.body.tee();
  // Predpomnilnik pišemo vzporedno (ne blokira razčlenjevanja)
  void Bun.write(CSV_CACHE_PATH, forCache)
    .then(() => log(`CSV shranjen v predpomnilnik: ${CSV_CACHE_PATH}`))
    .catch(() => log('Opomba: predpomnilnika ni bilo mogoče shraniti (nepomembno).'));
  return forParse;
}

interface GeoStats {
  exact: number;
  street: number;
  settlement: number;
  miss: number;
  cached: number;
  error: number;
}

/** Geokodiraj enega ponudnika (z bazo kot predpomnilnikom). */
async function geocodeWithCache(p: AjpesProvider, stats: GeoStats): Promise<{
  lat: number; lng: number; obcina: string | null;
} | null> {
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

  // Začasna napaka (npr. 429): NE gre v negativni predpomnilnik —
  // naslov se poskusi znova ob naslednjem zagonu.
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

async function main(): Promise<void> {
  const startedAt = Date.now();
  log('=== USKLAJEVANJE AJPES PRS (uradni ponudniki prenočitev) ===');

  const stream = await prsCsvStream();
  const parsed = await parsePrsCsvStream(stream);
  log(
    `PRS razčlenjen: ${parsed.totalRows} vrstic ponudnikov, unikatnih: ${parsed.providers.length}` +
      (parsed.skippedForeign ? `, tujih preskočenih: ${parsed.skippedForeign}` : ''),
  );
  if (parsed.providers.length === 0) throw new Error('PRS: ni ponudnikov — preveri format CSV-ja.');

  const stats: GeoStats = { exact: 0, street: 0, settlement: 0, miss: 0, cached: 0, error: 0 };
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
      // Omejevanje Nominatim → urejen izhod (predpomnilnik ohranja napredek)
      if (err instanceof RateLimitError) throw err;
      // Posamezen zapis ne sme ustaviti celotnega usklajevanja
      log(`opomba: zapis ${p.maticna} (${p.name}) preskočen: ${err instanceof Error ? err.message : 'napaka'}`);
    }

    if ((i + 1) % LOG_EVERY === 0 || i + 1 === parsed.providers.length) {
      const done = i + 1;
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = done / Math.max(elapsed, 1);
      const remaining = Math.round((parsed.providers.length - done) / Math.max(rate, 0.01) / 60);
      log(
        `napredek: ${done}/${parsed.providers.length} · exact:${stats.exact} street:${stats.street} ` +
          `naselje:${stats.settlement} brez:${stats.miss} začasno-napake:${stats.error} · preostanek ~${remaining} min`,
      );
    }
  }

  log(`Geokodiranje končano: ${located.length} ponudnikov s koordinatami (od ${parsed.providers.length}).`);

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
      where: { id: 'apartments-sync' },
      update: { updatedAt: new Date(), source: 'ajpes-prs', count: located.length },
      create: { id: 'apartments-sync', updatedAt: new Date(), source: 'ajpes-prs', count: located.length },
    }),
  ]);

  log(
    `Baza posodobljena: ${located.length} uradnih ponudnikov (vir: ajpes-prs). ` +
      `Trajanje: ${Math.round((Date.now() - startedAt) / 60000)} min. KONEC.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`[${new Date().toISOString()}] NAPAKA:`, err);
    process.exit(1);
  });
