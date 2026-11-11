import { NextResponse } from 'next/server';
import { indicativeApartmentPrice } from '@/lib/apartments-source';
import { regionForCityWithCoords } from '@/lib/si-regions';
import {
  getApartmentsFromDb,
  isApartmentsDbEmpty,
  syncApartments,
} from '@/lib/apartments-sync';

/**
 * API: apartmaji v Sloveniji.
 *
 * GET /api/apartments
 *   → 200 { ok:true, count, updatedAt, source, apartments:[…] }
 *     (podatki iz baze — zadnji uspešen prenos s spleta)
 *     Če je baza prazna, se samodejno sproži usklajevanje (prvi zagon).
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
  website: string | null;
  phone: string | null;
  stars: number | null;
  priceFrom: number;
  source: string;
}

export async function GET() {
  try {
    if (await isApartmentsDbEmpty()) {
      // Prvi zagon: samodejno usklajevanje (Overpass → Nominatim rezerva).
      await syncApartments(fetch);
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
      website: a.website,
      phone: a.phone,
      stars: a.stars,
      priceFrom: indicativeApartmentPrice(a.stars),
      source: a.source,
    }));

    return NextResponse.json(
      { ok: true, count: items.length, updatedAt, source, apartments: items },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('GET /api/apartments napaka:', error);
    return NextResponse.json(
      { ok: false, error: 'Podatkov o apartmajih trenutno ni mogoče prikazati.' },
      { status: 500 },
    );
  }
}
