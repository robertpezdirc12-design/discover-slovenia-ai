import { NextResponse } from 'next/server';
import {
  BALKAN_BBOX,
  buildFallbackPlaces,
  COUNTRY_BBOX,
  FALLBACK_HUBS,
  overpassPlacesQuery,
  parseOverpassPlaces,
  placeCategoryById,
  type PlaceCategoryId,
  type PlaceResult,
} from '@/lib/place-categories';
import { buildSloveniaMuseums } from '@/lib/museums-register';
import { balkanMuseumsForCountry } from '@/lib/museums-balkan';
import { buildWikidataMuseums } from '@/lib/museums-wikidata';

const BALKAN_COUNTRIES = [
  'hrvaska',
  'bosna-hercegovina',
  'srbija',
  'kosovo',
  'crna-gora',
  'albanija',
  'severna-makedonija',
] as const;

/**
 * GET /api/pot/places?cat={kategorija}&scope={balkan|country|local}
 *
 * Živi OSM kraji po kategoriji (restavracije, lekarne, hoteli …):
 *  1. Overpass MREŽA — bbox se razdeli na ~1° celice, vzporedne poizvedbe
 *     (vsaka hitra, skupaj pokrijejo celo državo — tudi celotno obalo),
 *  2. Photon multi-city (rezerva, ~1 s),
 *  3. kurirani predlogi območij (vedno nekaj pini).
 * Muzeji imajo svoj potek (uradni registri/katalogi) in se ne dotikajo
 * živega iskanja.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Velikost mrežne celice v stopinjah (≈ 100 km). */
const CELL_DEG = 1.0;
/** Največje število vzporednih celic (varovalka za scope=balkan). */
const MAX_CELLS = 40;
/** Cap skupnega števila živih pinov. */
const MAX_PLACES = 400;

function parseCoord(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Razčleni 'south,west,north,east' ali vrni null. */
function parseBBox(raw: string): BBox | null {
  const p = raw.split(',').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  return { south: p[0], west: p[1], north: p[2], east: p[3] };
}

/** Mreža celic čez bbox (zadnja celica se prilagodi, da pokrije rob). */
function gridCells(box: BBox): BBox[] {
  const cells: BBox[] = [];
  const latSteps = Math.min(MAX_CELLS / 2, Math.ceil((box.north - box.south) / CELL_DEG));
  const lngSteps = Math.min(MAX_CELLS / 2, Math.ceil((box.east - box.west) / CELL_DEG));
  const latStep = (box.north - box.south) / latSteps;
  const lngStep = (box.east - box.west) / lngSteps;
  for (let i = 0; i < latSteps; i++) {
    for (let j = 0; j < lngSteps; j++) {
      cells.push({
        south: box.south + i * latStep,
        west: box.west + j * lngStep,
        north: box.south + (i + 1) * latStep,
        east: box.west + (j + 1) * lngStep,
      });
    }
  }
  return cells;
}

/** Prenesi eno Overpass celico (out center 60, hitra mala poizvedba). */
async function fetchCell(
  category: { tag: string },
  cell: BBox,
  categoryId: PlaceCategoryId,
  timeoutMs: number,
): Promise<PlaceResult[]> {
  const q =
    `[out:json][timeout:8];` +
    `(node${category.tag}(${cell.south},${cell.west},${cell.north},${cell.east});` +
    `way${category.tag}(${cell.south},${cell.west},${cell.north},${cell.east});` +
    `relation${category.tag}(${cell.south},${cell.west},${cell.north},${cell.east});)` +
    `out center 60;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${endpoint}?data=${encodeURIComponent(q)}`, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      return parseOverpassPlaces(await res.json(), categoryId);
    } catch {
      continue; // naslednje zrcalo
    }
  }
  return [];
}

/** Overpass mreža čez bbox — vzporedne celice, združene in brez podvojitev. */
async function overpassGrid(
  category: { tag: string },
  box: BBox,
  categoryId: PlaceCategoryId,
): Promise<PlaceResult[]> {
  const cells = gridCells(box);
  const results = await Promise.allSettled(
    cells.map((cell) => fetchCell(category, cell, categoryId, 9000)),
  );
  const seen = new Set<string>();
  const out: PlaceResult[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const p of r.value) {
      const key = `${p.name.toLowerCase()}@${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
      if (out.length >= MAX_PLACES) return out;
    }
  }
  return out;
}

/** Photon multi-city — hitra rezerva (~1 s), ko Overpass ni dosegljiv. */
async function photonMultiCity(
  category: { photonQ: string; photonTag: string },
  box: BBox,
  hubs: readonly { name: string; lat: number; lng: number }[],
  categoryId: PlaceCategoryId,
  countryId: string,
): Promise<PlaceResult[]> {
  const span = 0.35;
  const queries = hubs.slice(0, 10).map((hub) =>
    fetch(
      `https://photon.komoot.io/api/?q=a&bbox=${encodeURIComponent(
        `${(hub.lng - span).toFixed(3)},${(hub.lat - span).toFixed(3)},${(hub.lng + span).toFixed(3)},${(hub.lat + span).toFixed(3)}`,
      )}&osm_tag=${encodeURIComponent(category.photonTag)}&limit=40`,
      { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
    )
      .then((r) => (r.ok ? (r.json() as Promise<PhotonResponse>) : { features: [] }))
      .catch(() => ({ features: [] })),
  );
  const responses = await Promise.all(queries);
  const seen = new Set<string>();
  const out: PlaceResult[] = [];
  for (const resp of responses) {
    for (const f of resp.features ?? []) {
      const coords = f.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < box.south || lat > box.north || lng < box.west || lng > box.east) continue;
      const props = f.properties ?? {};
      const name = typeof props.name === 'string' ? props.name.trim() : '';
      if (!name) continue;
      const key = `${name.toLowerCase()}@${lat.toFixed(3)},${lng.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `osm-${typeof props.osm_type === 'string' ? props.osm_type : 'n'}-${typeof props.osm_id === 'number' || typeof props.osm_id === 'string' ? props.osm_id : seen.size}`,
        name: name.slice(0, 120),
        category: categoryId,
        lat,
        lng,
        city: typeof props.city === 'string' ? props.city : undefined,
        source: 'osm',
      });
      if (out.length >= 200) return out;
    }
  }
  void countryId;
  return out;
}

interface PhotonResponse {
  features?: {
    geometry?: { coordinates?: number[] };
    properties?: Record<string, unknown>;
  }[];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const catId = (url.searchParams.get('cat') ?? '').trim();
  const category = placeCategoryById(catId);
  if (!category) {
    return NextResponse.json({ ok: false, error: 'Neznana kategorija.' }, { status: 400 });
  }

  const scope = url.searchParams.get('scope') ?? 'balkan';
  const fbCountryName = (url.searchParams.get('country') ?? '').trim();
  const radius = Math.min(50, Math.max(3, Number(url.searchParams.get('radius') ?? 20)));

  let boxRaw = BALKAN_BBOX;
  if (scope === 'country') {
    const cb = COUNTRY_BBOX[fbCountryName];
    if (!cb) {
      return NextResponse.json({ ok: false, error: 'Neznana država.' }, { status: 400 });
    }
    boxRaw = cb;
  } else if (scope === 'local') {
    const lat = parseCoord(url.searchParams.get('lat'));
    const lng = parseCoord(url.searchParams.get('lng'));
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ ok: false, error: 'Manjka veljavno središče (lat/lng).' }, { status: 400 });
    }
    const d = (radius / 100) * 0.02;
    boxRaw = `${lat - d},${lng - d},${lat + d},${lng + d}`;
  }
  const box = parseBBox(boxRaw);
  if (!box) {
    return NextResponse.json({ ok: false, error: 'Neveljaven bbox.' }, { status: 400 });
  }

  // MUZEJI — poseben potek: uradni registri / kurirani katalogi
  // (REMK za Slovenijo, Wikidata za Balkan, kurirana rezerva).
  if (catId === 'muzeji') {
    if (scope === 'country' && fbCountryName === 'slovenija') {
      return NextResponse.json({
        ok: true,
        category: catId,
        radius,
        curated: true,
        places: buildSloveniaMuseums(),
      });
    }
    if (scope === 'country') {
      const wikidata = buildWikidataMuseums(
        fbCountryName,
        balkanMuseumsForCountry(fbCountryName).map((m) => ({
          name: m.name,
          desc: m.desc,
          city: m.city,
          website: m.website,
        })),
      );
      if (wikidata) {
        return NextResponse.json({ ok: true, category: catId, radius, curated: true, places: wikidata });
      }
      const balkan = balkanMuseumsForCountry(fbCountryName);
      if (balkan.length > 0) {
        return NextResponse.json({
          ok: true,
          category: catId,
          radius,
          curated: true,
          places: balkan.map((m) => ({
            id: m.id,
            name: m.name,
            category: 'muzeji' as PlaceCategoryId,
            lat: m.lat,
            lng: m.lng,
            curated: true,
            note: m.desc,
            city: m.city,
            source: 'katalog',
          })),
        });
      }
    }
    // balkan scope: kurirani muzeji vseh balkanskih držav
    const all = BALKAN_COUNTRIES.flatMap((c) =>
      balkanMuseumsForCountry(c).map((m) => ({
        id: m.id,
        name: m.name,
        category: 'muzeji' as PlaceCategoryId,
        lat: m.lat,
        lng: m.lng,
        curated: true,
        note: m.desc,
        city: m.city,
        source: 'katalog',
      })),
    );
    if (all.length > 0) {
      return NextResponse.json({ ok: true, category: catId, radius, curated: true, places: all });
    }
  }

  // ŽIVI OSM — mreža celic (primarno) → Photon multi-city (rezerva) → kurirano.
  const hubs =
    scope === 'country'
      ? FALLBACK_HUBS.filter((h) => h.country === fbCountryName)
      : FALLBACK_HUBS.filter(
          (h) => h.lat >= box.south && h.lat <= box.north && h.lng >= box.west && h.lng <= box.east,
        );

  // OBA VIRA SKUPAJ: Photon (hitre top ujemanje po mestih) + Overpass MREŽA
  // (izčrpna pokritost — tudi obala med večjimi mesti). Združimo brez
  // podvojitev, cap 400; če Overpass odpove, ostane Photon.
  const photon = await photonMultiCity(
    category,
    box,
    hubs.length > 0 ? hubs : FALLBACK_HUBS,
    catId as PlaceCategoryId,
    fbCountryName,
  );

  const grid = await overpassGrid(category, box, catId as PlaceCategoryId);

  const merged: PlaceResult[] = [];
  const seenMerged = new Set<string>();
  for (const p of [...photon, ...grid]) {
    const key = `${p.name.toLowerCase()}@${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    if (seenMerged.has(key)) continue;
    seenMerged.add(key);
    merged.push(p);
    if (merged.length >= MAX_PLACES) break;
  }

  if (merged.length > 0) {
    return NextResponse.json({ ok: true, category: catId, radius, places: merged });
  }

  // REZERVA: kurirani predlogi območij — pini so vedno vidni, vir izrecno označen.
  return NextResponse.json({
    ok: true,
    category: catId,
    radius,
    curated: true,
    places: buildFallbackPlaces(category, catId as PlaceCategoryId, scope === 'country' ? fbCountryName : undefined),
  });
}

