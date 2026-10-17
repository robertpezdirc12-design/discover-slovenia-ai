/**
 * FSQ DATASET — Foursquare Open Places (P0-C, issue §4/§6).
 *
 * RECOVER: naslednik src/lib/supply/providers/fsq/dataset.ts izvirnika
 * (izgubljen ob varnostnem incidentu 2026-10-06). Izvirnikova množica
 * (125.446 POI: SI 18.010 · HR 88.331 · ME 10.285 · AL 8.820, snapshot
 * 2025-02-06, vir fused.io/source.coop) je ostala na mrtvem GitHub
 * računu — ta modul obnavlja LOADER in kanonično verigo validacije;
 * samo množica čaka vir (matrika: gate „data").
 *
 * LICENCA (docs/DATA-PROVENANCE.md): Foursquare Open Places so odprti
 * podatki pod Apache-2.0 Z obvezno atribucijo („© Foursquare Open
 * Places — foursquare.com"). To so ODPRTI PODATKI, ne affiliate —
 * plast cen je NOT_SUPPORTED (nikoli ne postane provizijska).
 *
 * RUNBOOK (osvežitev — vir posodobljen 17.10.2026, glej
 * docs/research/fsq-os-places-vir.md):
 *  1. Lastniški korak: brezplačen HuggingFace račun → dataset
 *     foursquare/fsq-os-places → soglasje (gated „auto") → fine-grained
 *     read žeton. Vir je uraden in AKTUALEN (mesečne izdaje; baseline
 *     snapshot 2025-02-06 = izdaja dt=2025-02-06, torej 1:1 reproducibilen;
 *     sveža izdaja = zadnji dt). IZVIKNI viri so mrtvi: javni S3 žeg
 *     (NoSuchBucket) in source.coop/fused.io (razdeljuje samo Overture).
 *  2. duckdb (httpfs/hf://, žeton) pushdown bbox SI·HR·ME·AL → surovi
 *     .jsonl (fsq_id/name/lat/lng/country/categories).
 *  3. `bun run fsq:ingest --raw-dir <dir>` — določen, validiran pretvorba
 *     v canonical .jsonl + manifest.json (provenance + števci).
 *  4. Loader samodejno pobere data/fsq-places/*.jsonl (brez omrežja).
 *
 * KANON ISKRENOSTI:
 *  · množica manjka / je prazna → status „missing"/„empty" z dejanskimi
 *    števci — NIKOLI izmišljeni POI, nikoli tiho prazna plast;
 *  · vsaka vrstica .jsonl gre skozi strogo validacijo (shema + geo
 *    okvir države + znane kategorije); neveljavne se izpustijo in
 *    PREŠTEJEJO (fail-closed);
 *  · pričakovana sestava (baseline izvirnika) je v FSQ_EXPECTED_COUNTS —
 *    odmik se izpiše, ne pa prikrije.
 */

import { sanitizeUntrustedText } from "@/lib/system-data-guard";

// ── Baseline izvirnika (pričakovana sestava — za iskrene odmike) ───────────

export const FSQ_SNAPSHOT_DATE_BASELINE = "2025-02-06";

export const FSQ_EXPECTED_COUNTS: Readonly<Record<string, number>> =
  Object.freeze({ SI: 18010, HR: 88331, ME: 10285, AL: 8820 });

/** Skupna pričakovana množina (125.446 — trditev izvirnikovega README). */
export const FSQ_EXPECTED_TOTAL = Object.values(FSQ_EXPECTED_COUNTS).reduce(
  (a, b) => a + b,
  0
);

/** Atribucija — izpisuje se ob vsaki uporabi množice. */
export const FSQ_ATTRIBUTION =
  "© Foursquare Open Places (Apache-2.0, z atribucijo) — foursquare.com";

// ── Canonical oblika vnosa ─────────────────────────────────────────────────

/** Geo okvirji držav (bbox: [south, west, north, east]) — validacija
 *  koordinat proti prijavljeni državi (čezmejne laži se zavrnejo). */
export const FSQ_COUNTRY_BBOXES: Readonly<
  Record<string, readonly [number, number, number, number]>
> = Object.freeze({
  SI: [45.4, 13.3, 46.9, 16.6],
  HR: [42.3, 13.4, 46.6, 19.5],
  ME: [41.8, 18.3, 43.6, 20.4],
  AL: [39.6, 19.2, 42.7, 21.1],
});

/** Potovalno-relevantne kategorije (kanon izvirnikovega README):
 *  nastanitve, restavracije, atrakcije, plaže, bencinske črpalke. */
export const FSQ_TRAVEL_CATEGORIES: readonly string[] = Object.freeze([
  "hotel",
  "accommodation",
  "restaurant",
  "cafe",
  "bar",
  "attraction",
  "museum",
  "sight",
  "beach",
  "fuel",
  "park",
  "nature",
]);

/** Canonical vnos (2.x oblika — izvirnikova natančna preslikava je
 *  izgubljena; ta shema je dokumentirana v docs/DATA-PROVENANCE.md). */
export interface FsqPlace {
  /** Foursquare ID (primarni ključ množice). */
  fsq_id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** ISO koda države (SI/HR/ME/AL). */
  country: string;
  /** Potovalno-relevantna kategorija (kanonični nabor). */
  category: string;
  /** Naslov (neobvezno — vir ga ima pogosto). */
  address?: string;
  /** Kraj/občina (neobvezno). */
  locality?: string;
}

// ── Validacija (čista, fail-closed) ────────────────────────────────────────

export type FsqValidation =
  | { ok: true; place: FsqPlace }
  | { ok: false; reason: string };

/** Zavrni vrstico, ki ne ustreza shemi / geu / kategorijam. */
export function validateFsqLine(raw: unknown): FsqValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "vrstica ni objekt" };
  }
  const d = raw as Record<string, unknown>;

  if (typeof d.fsq_id !== "string" || d.fsq_id.trim().length === 0) {
    return { ok: false, reason: "manjka fsq_id" };
  }
  // SYSTEM_DATA_GUARD (P0-I §23): ime je ZUNANJI podatek (FSQ dump) —
  // sanitizirano ob vstopu; prazno po čiščenju = neveljavna vrstica.
  const name = sanitizeUntrustedText(d.name, { maxLen: 160, fallback: "" });
  if (name.length === 0) {
    return { ok: false, reason: "manjka ime" };
  }
  const lat = d.latitude;
  const lng = d.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { ok: false, reason: "koordinati niso števili" };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: "koordinati niso končni" };
  }
  if (typeof d.country !== "string" || !(d.country in FSQ_COUNTRY_BBOXES)) {
    return { ok: false, reason: `neznan country: ${String(d.country)}` };
  }
  if (
    typeof d.category !== "string" ||
    !(FSQ_TRAVEL_CATEGORIES as readonly string[]).includes(d.category)
  ) {
    return { ok: false, reason: `nezna kategorija: ${String(d.category)}` };
  }

  // Geo validacija: koordinata MORA pasti v bbox prijavljene države.
  const [s, w, n, e] = FSQ_COUNTRY_BBOXES[d.country as string];
  if (lat < s || lat > n || lng < w || lng > e) {
    return {
      ok: false,
      reason: `koordinata (${lat.toFixed(3)}, ${lng.toFixed(3)}) izven bbox ${d.country}`,
    };
  }

  return {
    ok: true,
    place: {
      fsq_id: d.fsq_id.trim(),
      name,
      latitude: lat,
      longitude: lng,
      country: d.country,
      category: d.category,
      // Naslov/kraj sta prav tako zunanja niza — sanitizirana (SYSTEM_DATA_GUARD).
      ...(typeof d.address === "string" && d.address.trim()
        ? { address: sanitizeUntrustedText(d.address, { maxLen: 200, fallback: "" }) || undefined }
        : {}),
      ...(typeof d.locality === "string" && d.locality.trim()
        ? { locality: sanitizeUntrustedText(d.locality, { maxLen: 120, fallback: "" }) || undefined }
        : {}),
    },
  };
}

// ── Statistika množice (iskrena) ──────────────────────────────────────────

export interface FsqDatasetStats {
  total: number;
  byCountry: Record<string, number>;
  byCategory: Record<string, number>;
  invalidLines: number;
  duplicateIds: number;
  /** Odmik od baseline izvirnika (samo za izpis — ne blokira). */
  vsBaseline: Record<string, number>;
}

export function emptyFsqStats(): FsqDatasetStats {
  return {
    total: 0,
    byCountry: {},
    byCategory: {},
    invalidLines: 0,
    duplicateIds: 0,
    vsBaseline: {},
  };
}

/** Zbiraj statistiko iz veljavnih vnosov (+ odmik od baseline). */
export function summarizeFsqPlaces(
  places: readonly FsqPlace[],
  invalidLines = 0,
  duplicateIds = 0
): FsqDatasetStats {
  const stats = emptyFsqStats();
  stats.total = places.length;
  stats.invalidLines = invalidLines;
  stats.duplicateIds = duplicateIds;
  for (const p of places) {
    stats.byCountry[p.country] = (stats.byCountry[p.country] ?? 0) + 1;
    stats.byCategory[p.category] = (stats.byCategory[p.category] ?? 0) + 1;
  }
  for (const [country, expected] of Object.entries(FSQ_EXPECTED_COUNTS)) {
    const actual = stats.byCountry[country] ?? 0;
    stats.vsBaseline[country] = actual - expected;
  }
  return stats;
}

// ── Manifest (provenance zapis ingesta) ───────────────────────────────────

/** data/fsq-places/manifest.json — provenance množice (licenca + vir). */
export interface FsqManifest {
  snapshotDate: string;
  source: string;
  license: string;
  attribution: string;
  ingestedAt: string;
  counts: Record<string, number>;
  total: number;
}
