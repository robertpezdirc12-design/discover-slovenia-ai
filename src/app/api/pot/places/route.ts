import { NextResponse } from 'next/server';
import {
  BALKAN_BBOX,
  overpassPlacesQuery,
  parseOverpassPlaces,
  placeCategoryById,
  type PlaceCategoryId,
} from '@/lib/place-categories';

/**
 * GET /api/pot/places?cat={kategorija}&lat=&lng=&radius=
 *
 * Išče kraje izbrane kategorije (muzeji, restavracije, hoteli …) okoli
 * točke prek Overpassa (globalna zrcala, časovni proračun). Brez ključev.
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const TIMEOUT_MS = 12000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function parseCoord(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const catId = (url.searchParams.get('cat') ?? '').trim();
  const category = placeCategoryById(catId);
  if (!category) {
    return NextResponse.json({ ok: false, error: 'Neznana kategorija.' }, { status: 400 });
  }
  // Privzeto iščemo PO VSEM BALKANU; z `scope=local&lat&lng` je mogoče
  // omejeno iskanje okoli točke (uporabno za prihodnje razširitve).
  const scope = url.searchParams.get('scope') ?? 'balkan';
  let bbox = BALKAN_BBOX;
  let radius = 20;
  if (scope === 'local') {
    const lat = parseCoord(url.searchParams.get('lat'));
    const lng = parseCoord(url.searchParams.get('lng'));
    radius = Math.min(50, Math.max(3, Number(url.searchParams.get('radius') ?? 15)));
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ ok: false, error: 'Manjka veljavno središče (lat/lng).' }, { status: 400 });
    }
    const d = (radius / 100) * 0.02;
    bbox = `${lat - d},${lng - d},${lat + d},${lng + d}`;
  }
  const query = overpassPlacesQuery(category, bbox, scope === 'local' ? 30 : 60);

  let lastError = '';
  for (const endpoint of OVERPASS_ENDPOINTS) {
    // Poskusi najprej GET (overpass-api.de sprejme le GET), nato POST.
    for (const method of ['GET', 'POST'] as const) {
      try {
        const init: RequestInit = {
          method,
          headers: { 'user-agent': UA },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        };
        const res =
          method === 'GET'
            ? await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, init)
            : await fetch(endpoint, {
                ...init,
                headers: { ...(init.headers as Record<string, string>), 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(query)}`,
              });
        if (!res.ok) {
          lastError = `HTTP ${res.status}`;
          continue;
        }
        const raw: unknown = await res.json();
        const places = parseOverpassPlaces(raw, catId as PlaceCategoryId);
        return NextResponse.json({ ok: true, category: catId, radius, places });
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'mrežna napaka';
      }
    }
  }
  return NextResponse.json(
    { ok: false, error: 'Vir OpenStreetMap ni dosegljiv (' + lastError + ').' },
    { status: 502 },
  );
}
