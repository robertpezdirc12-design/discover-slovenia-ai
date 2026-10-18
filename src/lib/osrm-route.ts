/**
 * OSRM cestna pot med postanki "Moje poti" (javni demo strežnik).
 *
 * Uporaba: navigacija po poti prikaže PRAVO cestno linijo med postanki
 * (ne premočrtne) + razdaljo/čas do naslednje postanke.
 *
 * Pravična uporaba: javni demo strežnik (router.project-osrm.org, politika
 * ≤ 1 zahteva/s) → kličemo IZKLJUČNO prek strežniškega posrednika
 * (/api/osrm/route) s predpomnilnikom; brskalnik ne kliče direktno.
 *
 * Čisto in testabilno: gradnja URL + razčlenjevanje odgovora brez `fetch`.
 */

export const OSRM_BASE = 'https://router.project-osrm.org';

export interface OsrmWaypoint {
  lat: number;
  lng: number;
}

export interface OsrmLegInfo {
  /** Razdalja nožice v km (1 decimalni mesti). */
  distanceKm: number;
  /** Trajanje nožice v celih minutah (zaokroženo). */
  durationMin: number;
}

export interface OsrmRouteResult {
  /** Celotna geometrija poti kot [lat, lng] para (za Leaflet polyline). */
  coords: [number, number][];
  /** Nožice med zaporednimi postanki (n−1 vnosov). */
  legs: OsrmLegInfo[];
  /** Skupna razdalja v km (1 decimalni mesti). */
  totalKm: number;
}

/** URL zahteve — koordinate OSRM vrstnega reda: lng,lat;lng,lat (DOKLJENO: x=lng). */
export function osrmRouteUrl(waypoints: readonly OsrmWaypoint[]): string {
  const line = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
  return `${OSRM_BASE}/route/v1/driving/${line}?overview=full&geometries=geojson`;
}

/** Zaokroži na 1 decimalko (stabilno za NaN → 0 prek Number.isFinite). */
function km(meters: number): number {
  if (!Number.isFinite(meters) || meters < 0) return 0;
  return Math.round((meters / 1000) * 10) / 10;
}

function minutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.round(seconds / 60);
}

/**
 * Razčlenjevanje OSRM odgovora (route/v1, geometries=geojson).
 * Vrne null ob vsakem odmiku od pričakovanja (fail-clean) — nikoli ne meče.
 */
export function parseOsrmRoute(raw: unknown): OsrmRouteResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as {
    code?: unknown;
    routes?: unknown;
  };
  if (r.code !== 'Ok' || !Array.isArray(r.routes) || r.routes.length === 0) return null;
  const route = r.routes[0] as {
    distance?: unknown;
    duration?: unknown;
    geometry?: unknown;
    legs?: unknown;
  };
  const geometry = route.geometry as { coordinates?: unknown } | undefined;
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const coords: [number, number][] = [];
  for (const c of coordinates) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const lng = c[0];
    const lat = c[1];
    if (
      typeof lng !== 'number' || !Number.isFinite(lng) ||
      typeof lat !== 'number' || !Number.isFinite(lat)
    ) {
      return null;
    }
    coords.push([lat, lng]);
  }

  if (!Array.isArray(route.legs)) return null;
  const legs: OsrmLegInfo[] = [];
  for (const leg of route.legs) {
    const l = leg as { distance?: unknown; duration?: unknown };
    if (typeof l.distance !== 'number' || typeof l.duration !== 'number') return null;
    legs.push({ distanceKm: km(l.distance), durationMin: minutes(l.duration) });
  }
  if (legs.length === 0) return null;

  const totalKm = km(typeof route.distance === 'number' ? route.distance : 0);
  return { coords, legs, totalKm };
}
