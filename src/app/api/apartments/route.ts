import { NextResponse } from 'next/server';
import { regionForCityWithCoords } from '@/lib/si-regions';
import {
  getApartmentsFromDb,
  getSyncProgress,
  isApartmentsDbEmpty,
  startAjpesSyncInBackground,
} from '@/lib/apartments-sync';

/**
 * API: uradna prenočišča v Sloveniji (vir: AJPES Poslovni register RS).
 *
 * GET /api/apartments
 *   → 200 { ok:true, count, updatedAt, source, syncing?, apartments:[…] }
 *     Če je baza prazna, se V OZADJU sproži usklajevanje z uradnim virom
 *     (prenos PRS + geokodiranje naslovov — lahko traja do eno uro),
 *     odgovor pa takoj vrne prazno stanje z `syncing:true`.
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
  syncProgress?: ReturnType<typeof getSyncProgress>;
  apartments?: ApartmentApiItem[];
  error?: string;
}

export async function GET() {
  try {
    if (await isApartmentsDbEmpty()) {
      const progress = getSyncProgress();
      if (!progress.running) {
        // Prvi zagon: uradni AJPES potek v ozadju, odgovor takoj.
        const started = startAjpesSyncInBackground();
        return NextResponse.json(
          {
            ok: true,
            count: 0,
            updatedAt: null,
            source: null,
            syncing: true,
            syncProgress: started,
            apartments: [],
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json(
        { ok: true, count: 0, updatedAt: null, source: null, syncing: true, syncProgress: progress, apartments: [] },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { apartments, updatedAt, source } = await getApartmentsFromDb();

    const items: ApartmentApiItem[] = apartments.map((a) => ({
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
    }));

    return NextResponse.json(
      { ok: true, count: items.length, updatedAt, source, apartments: items },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('GET /api/apartments napaka:', error);
    return NextResponse.json(
      { ok: false, error: 'Podatkov o prenočiščih trenutno ni mogoče prikazati.' },
      { status: 500 },
    );
  }
}
