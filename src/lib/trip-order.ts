/**
 * VRSTNI RED POSTANKOV — čista podatkovna plast (»povleci in spusti«).
 *
 * Zakaj ločeno od komponente: @dnd-kit poda samo IMENI (id) aktivne in
 * ciljne postanke; vse odločitve (premakni, uveljavi shranjen red, preveri
 * ali je red sploh spremenjen, počisti tuj vnos iz localStorage ali deljene
 * povezave) so tukaj — deterministične in pokrite s testi.
 *
 * Brez Reacta, brez `window`, brez Leafleta, brez @dnd-kit. Komponenta
 * samo posreduje imena in shrani rezultat prek adapterja.
 */

/** En ključ za vse regije — red je shranjen po regiji (regije imajo različne postanke). */
export const TRIP_ORDER_KEY = 'dsa.trip.order.v1';
/** Lokalni dogodek: useSyncExternalStore se z njim znova prebere po zapisu. */
export const TRIP_ORDER_EVENT = 'dsa:trip-order';

/** Največje število imen v redu (varstvo pred pokvarjenim/zlonamernim vnosom). */
export const MAX_TRIP_ORDER_NAMES = 32;
const MAX_NAME_LENGTH = 80;
const MAX_REGION_LENGTH = 40;

export interface NamedStop {
  name: string;
}

export interface TripOrderMap {
  [region: string]: readonly string[];
}

/**
 * Premakne postanek z `from` na `to` (indeksa sta 0-based, cilj je KONČNA
 * pozicija). Neveljavni indeksi ali `from === to` vrnejo ISTO referenco —
 * komponenta zato ne zapisuje odvečnih sprememb v localStorage.
 */
export function moveStop<T>(stops: readonly T[], from: number, to: number): readonly T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return stops;
  if (from < 0 || to < 0 || from >= stops.length || to >= stops.length) return stops;
  if (from === to) return stops;
  const next = stops.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Različica za @dnd-kit: `active.id` in `over.id` sta imeni destinacij. */
export function moveStopByName<T extends NamedStop>(
  stops: readonly T[],
  activeName: string,
  overName: string,
): readonly T[] {
  const from = stops.findIndex((s) => s.name === activeName);
  const to = stops.findIndex((s) => s.name === overName);
  if (from < 0 || to < 0) return stops;
  return moveStop(stops, from, to);
}

/** Hitri premik za eno mesto (gumb gor/dol) — isti čisti premik kot pri vlečenju. */
export function nudgeStop<T>(stops: readonly T[], index: number, delta: -1 | 1): readonly T[] {
  return moveStop(stops, index, index + delta);
}

/**
 * Uveljavi shranjen vrstni red NAD privzetim planom regije:
 *  • znana imena gredo v navedenem vrstnem redu,
 *  • podvojeni in neznani vnosi se prezrejo,
 *  • NOVE postanke (sprememba TRIP_PLAN) se vedno dodajo na konec — nikoli
 *    ne izginejo in nikoli ne podrejo uporabnikovega reda.
 */
export function applyStopOrder<T extends NamedStop>(
  stops: readonly T[],
  order: readonly string[] | null,
): readonly T[] {
  if (!order || order.length === 0) return stops;
  const byName = new Map<string, T>();
  for (const stop of stops) byName.set(stop.name, stop);
  const used = new Set<string>();
  const ordered: T[] = [];
  for (const name of order) {
    const stop = byName.get(name);
    if (stop && !used.has(name)) {
      ordered.push(stop);
      used.add(name);
    }
  }
  for (const stop of stops) {
    if (!used.has(stop.name)) ordered.push(stop);
  }
  return ordered;
}

/** Ali shranjeni red dejansko spreminja privzeti (za gumb »Ponastavi«)? */
export function differsFromOrder<T extends NamedStop>(
  stops: readonly T[],
  order: readonly string[] | null,
): boolean {
  if (!order || order.length === 0) return false;
  const applied = applyStopOrder(stops, order);
  return applied.some((stop, i) => stop.name !== stops[i]?.name);
}

/** Varno prečisti seznam imen iz localStorage ali deljene povezave (tuj vnos). */
export function sanitizeOrderNames(raw: unknown): readonly string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const name = item.trim().slice(0, MAX_NAME_LENGTH);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= MAX_TRIP_ORDER_NAMES) break;
  }
  return names.length > 0 ? names : null;
}

/** Razčleni celoten zapis — pokvarjen JSON ali napačna oblika → prazna mapa. */
export function parseTripOrderMap(raw: string | null): TripOrderMap {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: TripOrderMap = {};
    for (const [region, names] of Object.entries(value as Record<string, unknown>)) {
      if (!region || region.length > MAX_REGION_LENGTH) continue;
      const clean = sanitizeOrderNames(names);
      if (clean) out[region] = clean;
    }
    return out;
  } catch {
    return {}; // okvarjen zapis ne sme nikoli porušiti zemljevida
  }
}

/** Shranjeni red ene regije (null = privzeti vrstni red). */
export function regionStopOrder(raw: string | null, region: string): readonly string[] | null {
  if (!region) return null;
  return parseTripOrderMap(raw)[region] ?? null;
}

/** Seriliziraj mapo (stabilen vrstni red ključev → stabilen localStorage zapis). */
export function serializeTripOrderMap(map: TripOrderMap): string {
  const out: Record<string, readonly string[]> = {};
  for (const region of Object.keys(map).sort()) out[region] = map[region];
  return JSON.stringify(out);
}

/**
 * Izračuna NOV zapis za localStorage. `null` pomeni »odstrani ključ« —
 * uporabljeno, ko uporabnik ponastavi zadnji prilagojeni red (ne puščamo
 * praznega zapisa, ki bi le še kazal, da je red spremenjen).
 */
export function withRegionStopOrder(
  raw: string | null,
  region: string,
  order: readonly string[] | null,
): string | null {
  if (!region) return raw;
  const clean = sanitizeOrderNames(order);
  const map = { ...parseTripOrderMap(raw) };
  if (clean) map[region] = clean;
  else delete map[region];
  const keys = Object.keys(map);
  return keys.length > 0 ? serializeTripOrderMap(map) : null;
}

/** Stabilen ključ poti: regija + dejanski vrstni red (OSRM/POI se morata preračunati). */
export function stopRouteKey(region: string | null, stops: readonly NamedStop[]): string | null {
  if (!region) return null;
  return `${region}:${stops.map((s) => s.name).join('>')}`;
}
