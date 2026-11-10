/**
 * JAVNI PREVOZ (OJPP / brezavta.si) — čista podatkovna plast.
 *
 * Podatki: Brezavta.si backend (api.beta.brezavta.si, OpenTripPlanner),
 * skupnostni projekt OJPP — združuje vozne rede slovenskih prevoznikov
 * (LPP, Arriva, Marprom, SŽ …) v odprte standarde. Vir je živo preverjen
 * brez ključa; dostop gre prek našega strežniškega posrednika
 * (/api/pot/transit), da ni CORS omejitev in da kličemo le od zunaj.
 *
 * Ta datoteka je ČISTA: tipi, varstvo vnosa, oblikovanje povzetkov.
 */

export type TransitMode = 'BUS' | 'TRAIN' | 'BUS,TRAIN';

export interface TransitPoint {
  lat: number;
  lng: number;
  name: string;
  type: string;
  gtfsId?: string | null;
  departureTime?: number;
  arrivalTime?: number;
}

export interface TransitLeg {
  mode: string; // WALK | BUS | TRAIN | ...
  distanceM: number;
  startTime: number;
  endTime: number;
  fromPoint: TransitPoint;
  toPoint: TransitPoint;
  /** Polygonline: [[lon,lat], …] ali null. */
  geometry: readonly (readonly [number, number])[] | null;
}

export interface TransitPlan {
  startTime: number;
  endTime: number;
  legs: readonly TransitLeg[];
}

export interface TransitResult {
  plans: readonly TransitPlan[];
  nextPage?: string | null;
  previousPage?: string | null;
}

/** Vir (atribucija v UI). */
export const TRANSIT_ATTRIBUTION = 'Javni prevoz: OJPP / brezavta.si (skupnostni podatki)';

/** Privzeta točka odhoda — Ljubljana (center). */
export const TRANSIT_DEFAULT_ORIGIN = { name: 'Ljubljana', lat: 46.0569, lng: 14.5058 } as const;

/** Največje število legov/načrtov, ki jih sprejmemo (varstvo pred zlorabo). */
const MAX_PLANS = 10;
const MAX_LEGS = 30;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parsePoint(raw: unknown): TransitPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const lat = o.lat;
  const lon = o.lon;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    lat,
    lng: lon,
    name: typeof o.name === 'string' ? o.name : '',
    type: typeof o.type === 'string' ? o.type : '',
    gtfsId: typeof o.gtfs_id === 'string' ? o.gtfs_id : null,
    departureTime: isFiniteNumber(o.departure_time) ? o.departure_time : undefined,
    arrivalTime: isFiniteNumber(o.arrival_time) ? o.arrival_time : undefined,
  };
}

function parseLeg(raw: unknown): TransitLeg | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const from = parsePoint(o.from_point);
  const to = parsePoint(o.to_point);
  if (!from || !to) return null;
  const geometryRaw = o.geometry;
  let geometry: TransitLeg['geometry'] = null;
  if (
    geometryRaw &&
    typeof geometryRaw === 'object' &&
    (geometryRaw as Record<string, unknown>).type === 'LineString'
  ) {
    const coords = (geometryRaw as Record<string, unknown>).coordinates;
    if (Array.isArray(coords)) {
      geometry = coords
        .filter((c): c is [number, number] => Array.isArray(c) && c.length >= 2 && c.every((n) => isFiniteNumber(n)))
        .slice(0, 2000);
    }
  }
  return {
    mode: typeof o.mode === 'string' ? o.mode : 'WALK',
    distanceM: isFiniteNumber(o.distance) ? o.distance : 0,
    startTime: isFiniteNumber(o.start_time) ? o.start_time : 0,
    endTime: isFiniteNumber(o.end_time) ? o.end_time : 0,
    fromPoint: from,
    toPoint: to,
    geometry,
  };
}

function parsePlan(raw: unknown): TransitPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const start = o.start_time;
  const end = o.end_time;
  if (!isFiniteNumber(start) || !isFiniteNumber(end)) return null;
  const legsRaw = o.legs;
  if (!Array.isArray(legsRaw)) return null;
  const legs: TransitLeg[] = [];
  for (const legRaw of legsRaw.slice(0, MAX_LEGS)) {
    const leg = parseLeg(legRaw);
    if (leg) legs.push(leg);
  }
  if (legs.length === 0) return null;
  return { startTime: start, endTime: end, legs };
}

/** Varna razčlenitev odziva API-ja (tuj/poškodovan vnos → null). */
export function parseTransitResponse(raw: unknown): TransitResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const plansRaw = o.plans;
  if (!Array.isArray(plansRaw)) return null;
  const plans: TransitPlan[] = [];
  for (const p of plansRaw.slice(0, MAX_PLANS)) {
    const plan = parsePlan(p);
    if (plan) plans.push(plan);
  }
  if (plans.length === 0) return null;
  return {
    plans,
    nextPage: typeof o.next_page === 'string' ? o.next_page : null,
    previousPage: typeof o.previous_page === 'string' ? o.previous_page : null,
  };
}

/** URL do načrtovanja (brez časov — strežnik vzame naslednje odhode). */
export function buildTransitUrl(
  base: string,
  mode: TransitMode,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  const fromLonLat = `${from.lng.toFixed(6)},${from.lat.toFixed(6)}`;
  const toLonLat = `${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
  return `${base}/plan/${mode}/${fromLonLat}/${toLonLat}`;
}

/** Slovenska oznaka prevoznega načina (BUS → »Bus«). */
export function transitModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    WALK: 'Pohod',
    BUS: 'Bus',
    TRAIN: 'Vlak',
    TRAM: 'Tramvaj',
  };
  return labels[mode] ?? mode;
}

/** »Pohod 0,9 km« / »Bus 24 min« za posamezen leg. */
export function transitLegSummary(leg: TransitLeg): string {
  const label = transitModeLabel(leg.mode);
  const durationMin = Math.max(1, Math.round((leg.endTime - leg.startTime) / 60000));
  if (leg.mode === 'WALK' && leg.distanceM > 0) {
    const km = leg.distanceM / 1000;
    const kmText = km < 10 ? km.toFixed(1).replace('.', ',') : String(Math.round(km));
    return `${label} ${kmText} km`;
  }
  return `${label} ${durationMin} min`;
}

/** Slikovna oznaka (za UI): prevozni način → emoji. */
export function transitModeEmoji(mode: string): string {
  if (mode === 'WALK') return '🚶';
  if (mode === 'TRAIN') return '🚆';
  if (mode === 'TRAM') return '🚊';
  return '🚌';
}

/** Oblikovanje ure (sl-SI). */
export function formatTransitTime(ts: number): string {
  if (!Number.isFinite(ts)) return '';
  return new Intl.DateTimeFormat('sl-SI', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

/** Skupno trajanje načrta (v minutah). */
export function transitPlanDurationMin(plan: TransitPlan): number {
  return Math.max(1, Math.round((plan.endTime - plan.startTime) / 60000));
}

/**
 * Povzetek načrta: »od 07:15 · 1 h 24 min · Bus · Ljubljana → Bled«.
 */
export function transitPlanSummary(plan: TransitPlan): string {
  const duration = transitPlanDurationMin(plan);
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const durationText = hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
  const modes = Array.from(new Set(plan.legs.map((l) => l.mode).filter((m) => m !== 'WALK')));
  const modeText = modes.length > 0 ? modes.map(transitModeLabel).join(', ') : 'Pohod';
  const fromName = plan.legs[0]?.fromPoint.name;
  const toName = plan.legs[plan.legs.length - 1]?.toPoint.name;
  const route = fromName && toName && fromName !== toName ? `${fromName} → ${toName}` : '';
  return `od ${formatTransitTime(plan.startTime)} · ${durationText} · ${modeText}${route ? ` · ${route}` : ''}`;
}
