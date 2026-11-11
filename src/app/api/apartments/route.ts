import { NextResponse } from 'next/server';
import { regionForCityWithCoords } from '@/lib/si-regions';
import {
  getApartmentsFromDb,
  getSyncProgress,
  isApartmentsDbEmpty,
  startAjpesSyncInBackground,
} from '@/lib/apartments-sync';
import { loadApartmentsSnapshot, type SnapshotRecord } from '@/lib/apartments-snapshot';

/**
 * API: uradna prenočišča v Sloveniji (vir: AJPES Poslovni register RS).
 *
 * GET /api/apartments
 *   → 200 { ok:true, count, updatedAt, source, apartments:[…] }
 *
 * Vrste dobesednih virov (po vrstnem redu poskusa):
 *   1. SQLite baza — lokalni strežnik (polni potek: prenos PRS + geokodiranje).
 *   2. Vgrajen snapshot `data/ajpes-apartments.json` — serverless (Vercel),
 *      kjer baze ni in dolgotrajnega usklajevanja ni mogoče zagnati.
 *
 * Če je baza LOKALNO prazna, se V OZADJU sproži usklajevanje z uradnim virom
 * (lahko traja do eno uro), odgovor pa takoj vrne prazno stanje s `syncing:true`.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export interface ApartmentApiItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  region: string;
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

export interface ApartmentsApiResponse {
  ok: boolean;
  count?: number;
  updatedAt?: string | null;
  source?: string | null;
  syncing?: boolean;
  snapshot?: boolean;
  syncProgress?: ReturnType<typeof getSyncProgress>;
  apartments?: ApartmentApiItem[];
  error?: string;
}

/** Zapis v API obliki (vključno z izračunom regije). */
function toApiItem(a: SnapshotRecord): ApartmentApiItem {
  return {
    id: a.id,
    name: a.name,
    lat: a.lat,
    lng: a.lng,
    city: a.city,
    region: regionForCityWithCoords(a.city, a.lat, a.lng),
    street: a.street,
    postcode: a.postcode,
    obcina: a.obcina,
    legalForm: a.legalForm,
    maticna: a.maticna,
    website: a.website,
    phone: a.phone,
    stars: a.stars,
    source: a.source,
  };
}

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET() {
  // ── 1) SQLite baza (lokalni strežnik) ──────────────────────────────────────
  try {
    if (!(await isApartmentsDbEmpty())) {
      const { apartments, updatedAt, source } = await getApartmentsFromDb();
      return NextResponse.json(
        { ok: true, count: apartments.length, updatedAt, source, apartments: apartments.map(toApiItem) },
        NO_STORE,
      );
    }

    if (!process.env.VERCEL) {
      // Baza prazna: uradni AJPES potek v ozadju, odgovor takoj.
      const progress = getSyncProgress();
      if (!progress.running) {
        const started = startAjpesSyncInBackground();
        return NextResponse.json(
          { ok: true, count: 0, updatedAt: null, source: null, syncing: true, syncProgress: started, apartments: [] },
          NO_STORE,
        );
      }
      return NextResponse.json(
        { ok: true, count: 0, updatedAt: null, source: null, syncing: true, syncProgress: progress, apartments: [] },
        NO_STORE,
      );
    }
    // Na Vercelu prazna baza → pade naprej na snapshot (sync tam ni izvedljiv).
  } catch (error) {
    // Baza/DATABASE_URL nedosegljiva (npr. serverless brez SQLite) → snapshot.
    console.error('GET /api/apartments: baza nedosegljiva, prehajam na vgrajen snapshot:', error);
  }

  // ── 2) Vgrajen uradni snapshot (AJPES, CC BY 4.0) ──────────────────────────
  try {
    const snapshot = await loadApartmentsSnapshot();
    if (snapshot && snapshot.apartments.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          count: snapshot.apartments.length,
          updatedAt: snapshot.updatedAt,
          source: snapshot.source,
          snapshot: true,
          apartments: snapshot.apartments.map(toApiItem),
        },
        NO_STORE,
      );
    }
  } catch (error) {
    console.error('GET /api/apartments: snapshot ni dosegljiv:', error);
  }

  return NextResponse.json(
    { ok: false, error: 'Podatkov o prenočiščih trenutno ni mogoče prikazati.' },
    { status: 500 },
  );
}
