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
import { buildWikidataMuseums } from '@/lib/museums-wikidata';

/**
 * GET /api/pot/places?cat={kategorija}&lat=&lng=&radius=
 *
 * Išče kraje izbrane kategorije (muzeji, restavracije, hoteli …) okoli
 * točke prek Overpassa (globalna zrcala, časovni proračun). Brez ključev.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function parseCoord(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Lokalna imena držav v OSM (Photon properties.country) → naš country id. */
const OSM_COUNTRY_NAMES: Record<string, readonly string[]> = {
  slovenija: ['Slovenija', 'Slovenia'],
  hrvaska: ['Hrvatska', 'Croatia'],
  'bosna-hercegovina': ['Bosna i Hercegovina', 'Bosnia and Herzegovina'],
  srbija: ['Srbija', 'Serbia', 'Србија'],
  kosovo: ['Kosovo'],
  'crna-gora': ['Crna Gora', 'Montenegro'],
  albanija: ['Shqipëria', 'Albania'],
  'severna-makedonija': ['Северна Македонија', 'North Macedonia', 'Makedonija'],
};

/** Ali Photon-ime države ustreza naši izbrani državi (dualni zapisi v OSM). */
function countryMatches(photonCountry: string, countryId: string): boolean {
  const variants = OSM_COUNTRY_NAMES[countryId];
  if (!variants) return true; // neznana država → ne filtriraj
  return variants.some((v) => photonCountry.startsWith(v));
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
  const fbCountryName = (url.searchParams.get('country') ?? '').trim();
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
    // MUZEJI — po državah:
    // Slovenija → REMK uradni register + kurirani opisi.
    // Ostale balkanske države → Wikidata (CC0) + kurirani opisi,
    // rezerva pa kurirani katalog pravih muzejev.
    if (catId === 'muzeji') {
      if (country === 'slovenija') {
        const places = buildSloveniaMuseums();
        return NextResponse.json({ ok: true, category: catId, radius, curated: true, places });
      }
      const wikidata = buildWikidataMuseums(
        country,
        balkanMuseumsForCountry(country).map((m) => ({
          name: m.name,
          desc: m.desc,
          city: m.city,
          website: m.website,
        })),
      );
      if (wikidata) {
        return NextResponse.json({ ok: true, category: catId, radius, curated: true, places: wikidata });
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
  const query = overpassPlacesQuery(category, bbox, scope === 'local' ? 30 : 80);

  // PRIMARNI VIR — Photon (Komoot, ~0,5 s, dosegljiv povsod): osm_tag po
  // kategoriji znotraj bboxa; rezultati so striktno filtrirani na bbox in
  // državo (Photon bbox je le bias, ne stroga mejа).
  const parts = bbox.split(',').map(Number);
  const bboxNum =
    parts.length === 4 && parts.every((n) => Number.isFinite(n))
      ? { south: parts[0], west: parts[1], north: parts[2], east: parts[3] }
      : null;
  if (bboxNum) {
    try {
      // Photon zahteva neprazen q; »a« se ujema s skoraj vsemi imeni →
      // dejanski filter sta osm_tag + bbox (izenačeno spodaj).
      // bbox vrstni red: COUNTRY_BBOX = south,west,north,east →
      // Photon = minLon,minLat,maxLon,maxLat (zamenjana okljiča).
      const [bbSouth, bbWest, bbNorth, bbEast] = bbox.split(',');
      const photonUrl =
        `https://photon.komoot.io/api/?q=a` +
        `&bbox=${encodeURIComponent(`${bbWest},${bbSouth},${bbEast},${bbNorth}`)}` +
        `&osm_tag=${encodeURIComponent(category.photonTag)}` +
        `&limit=60`;
      const res = await fetch(photonUrl, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const j = (await res.json()) as {
          features?: { geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }[];
        };
        const seen = new Set<string>();
        const places: PlaceResult[] = [];
        for (const f of j.features ?? []) {
          const coords = f.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) continue;
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          // Strogi bbox filter (Photon včasih vrne tudi zadetke ob robu).
          if (lat < bboxNum.south || lat > bboxNum.north) continue;
          if (lng < bboxNum.west || lng > bboxNum.east) continue;
          // Filtriraj po imenu države (Photon vrača lokalno ime iz OSM).
          const country = typeof f.properties?.country === 'string' ? f.properties.country : '';
          if (scope === 'country' && !countryMatches(country, fbCountryName)) continue;
          const props = f.properties ?? {};
          const name = typeof props.name === 'string' ? props.name.trim() : '';
          if (!name) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          places.push({
            id: `osm-${typeof props.osm_type === 'string' ? props.osm_type : 'n'}-${typeof props.osm_id === 'number' || typeof props.osm_id === 'string' ? props.osm_id : seen.size}`,
            name: name.slice(0, 120),
            category: catId as PlaceCategoryId,
            lat,
            lng,
            city: typeof props.city === 'string' ? props.city : undefined,
            source: 'osm',
          });
          if (places.length >= 60) break;
        }
        if (places.length > 0) {
          return NextResponse.json({ ok: true, category: catId, radius, places });
        }
      }
    } catch {
      /* Photon ni dosegljiv → Overpass → rezerva */
    }
  }

  // DOSEGLJIVI viri (izmerjeno v POLIRAJ-9/29): overpass-api.de deluje iz
  // Vercela (dokazano s prenočišči); osm.ch je SAMO švicarski izvleček
  // (za Balkan vrne 0 → zanka nadaljuje). GET-first (POST zrcala 500-irajo).
  const liveEndpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
  ];
  let raw: unknown = null;
  for (const endpoint of liveEndpoints) {
    try {
      const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(scope === 'local' ? 10000 : 25000),
      });
      if (!res.ok) continue;
      const parsed = await res.json();
      // Nadaljuj na naslednji vir, če je odziv prazen (osm.ch za Balkan).
      if (parseOverpassPlaces(parsed, catId as PlaceCategoryId).length === 0) continue;
      raw = parsed;
      break;
    } catch {
      continue; // naslednji endpoint
    }
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
