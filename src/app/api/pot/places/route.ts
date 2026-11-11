import { NextResponse } from 'next/server';
import {
  BALKAN_BBOX,
  buildFallbackPlaces,
  COUNTRY_BBOX,
  overpassPlacesQuery,
  parseOverpassPlaces,
  placeCategoryById,
  type PlaceCategoryId,
  type PlaceResult,
} from '@/lib/place-categories';
import { MUSEUMS } from '@/lib/museums';
import { buildSloveniaMuseums } from '@/lib/museums-register';
import { balkanMuseumsForCountry } from '@/lib/museums-balkan';

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
  // omejeno iskanje okoli točke, z `scope=country&country=<id>` pa poženemo
  // iskanje znotraj izbrane države (uporabno za vmesnik »država → kaj iščem«).
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
  } else if (scope === 'country') {
    const country = (url.searchParams.get('country') ?? '').trim();
    const cb = COUNTRY_BBOX[country];
    if (!cb) {
      return NextResponse.json({ ok: false, error: 'Neznana država.' }, { status: 400 });
    }
    // KURIRANI KATALOG + URADNI REGISTER (muzeji):
    // Slovenija → REMK razvid (uradni vir, z naslovi) + kurirani opisi.
    // Ostale balkanske države → kurirani katalog pravih muzejev.
    if (catId === 'muzeji') {
      if (country === 'slovenija') {
        const places = buildSloveniaMuseums();
        return NextResponse.json({ ok: true, category: catId, radius, curated: true, places });
      }
      const balkan = balkanMuseumsForCountry(country);
      if (balkan.length > 0) {
        const places: PlaceResult[] = balkan.map((m) => ({
          id: m.id,
          name: m.name,
          category: 'muzeji' as PlaceCategoryId,
          lat: m.lat,
          lng: m.lng,
          curated: true,
          note: m.desc,
          city: m.city,
          source: 'katalog',
        }));
        return NextResponse.json({ ok: true, category: catId, radius, curated: true, places });
      }
    }
    bbox = cb;
  }
  const query = overpassPlacesQuery(category, bbox, scope === 'local' ? 30 : 60);

  // Vzporedni poskusi zrcal; zmaga prvi uspešen odziv.
  const attempts = OVERPASS_ENDPOINTS.map((endpoint) => {
    const init: RequestInit = {
      method: 'POST',
      headers: { 'user-agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(10000),
    };
    return fetch(endpoint, init).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as unknown;
    });
  });
  let raw: unknown = null;
  try {
    raw = await Promise.any(attempts);
  } catch {
    raw = null;
  }

  if (raw !== null) {
    const places = parseOverpassPlaces(raw, catId as PlaceCategoryId);
    if (places.length > 0) {
      return NextResponse.json({ ok: true, category: catId, radius, places });
    }
  }

  // REZERVA: kurirani predlogi območij — pini so vedno vidni, vir je
  // izrecno označen (curated: true). Omejimo jih na izbrano državo, da se
  // ne prikažejo »povsod« po Balkanu.
  const fbCountry = scope === 'country' ? (url.searchParams.get('country') ?? '').trim() : '';
  return NextResponse.json({
    ok: true,
    category: catId,
    radius,
    curated: true,
    places: buildFallbackPlaces(category, catId as PlaceCategoryId, fbCountry || undefined),
  });
}
