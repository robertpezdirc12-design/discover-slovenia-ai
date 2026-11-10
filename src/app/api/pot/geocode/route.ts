import { NextResponse } from 'next/server';
import { parsePlaceLines, isInBalkanBbox, type GeocodedPlace } from '@/lib/import-places';

/**
 * POST /api/pot/geocode — geokodiranje seznama krajev (Photon/Komoot).
 *
 * Telo: { places: string[] } (ali { input: string } za surov vnos).
 * Odziv: { ok, results: GeocodedPlace[] } — po en rezultat na vnos.
 * Skriptni »Start Anywhere«: brez AI modela, brez ključev.
 */

const PHOTON = 'https://photon.komoot.io/api/';
const TIMEOUT_MS = 12000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; country?: string; city?: string };
}

function parsePhotonFeature(raw: unknown): { name: string; lat: number; lng: number; country?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as PhotonFeature;
  const coords = f.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = f.properties?.name?.trim() ?? '';
  if (!name) return null;
  return { name, lat, lng, country: f.properties?.country };
}

async function geocodeOne(q: string): Promise<GeocodedPlace> {
  try {
    // Photon podpira le default/de/en/fr jezike — language izpustimo.
    const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { q, ok: false, name: '', lat: 0, lng: 0 };
    const body: unknown = await res.json();
    const features = (body as { features?: unknown[] })?.features;
    const feature = Array.isArray(features) && features[0] ? parsePhotonFeature(features[0]) : null;
    if (!feature) return { q, ok: false, name: '', lat: 0, lng: 0 };
    return {
      q,
      ok: true,
      name: feature.name,
      lat: feature.lat,
      lng: feature.lng,
      country: feature.country,
      outsideBalkan: !isInBalkanBbox(feature.lat, feature.lng),
    };
  } catch {
    return { q, ok: false, name: '', lat: 0, lng: 0 };
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Neveljavna zahteva — pričakovan JSON.' }, { status: 400 });
  }
  const raw = body as Record<string, unknown> | null;
  const places = Array.isArray(raw?.places)
    ? parsePlaceLines((raw.places as unknown[]).map((p) => (typeof p === 'string' ? p : '')).join('\n'))
    : typeof raw?.input === 'string'
      ? parsePlaceLines(raw.input)
      : [];
  if (places.length === 0) {
    return NextResponse.json({ ok: false, error: 'Ni krajev za geokodiranje.' }, { status: 400 });
  }
  const results = await Promise.all(places.map(geocodeOne));
  const found = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, results, found, total: results.length });
}
