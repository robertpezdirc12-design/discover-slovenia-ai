/**
 * ROAD-ROUTING-SERVER — strežniški OSRM odjemalec (rekonstrukcija
 * izvornega src/lib/road-routing-server.ts; glej avditski zapis
 * §"OSRM/route": pomnilniški cache 24 h / 600, circuit breaker 4 → 10 min,
 * NaN/negativna varovalka, RoutingMethod osrm|heuristic|mixed).
 *
 * ISKRENOSTNI KANON (nikoli prelomljiv):
 *  - source "osrm" sme nositi SAMO uspešno razčlenjen odgovor javnega
 *    strežnika OSRM (router.project-osrm.org, profil driving) z veljavno
 *    geometrijo;
 *  - vsaka napaka (omrežje, timeout, HTTP napaka, NaN/negativne vrednosti,
 *    prazne poti) vodi v HEVRISTIČNO OCENO (haversine × 1,3 pri ~55 km/h)
 *    z oznako source "heuristic" — hevristika NIKOLI ni označena kot osrm;
 *  - geometrija hevristike = premica med točkama (2 točki) — v UI je
 *    razkrita kot črtkana črta z oznako "ocena".
 *
 * Odločitve (dokumentirane):
 *  - v pomnilniški cache se shranjujejo SAMO uspešni OSRM odseki — ko
 *    OSRM okreva, takoj strežemo realne poti (zastarela hevristika bi
 *    bila neiskrena do vira);
 *  - geometrija z več kot 400 točkami se enakomerno redči (vsaka N-ta
 *    točka + zadnja) — ISTA realna pot, le zmanjšana ločljivost, ne izmislek;
 *  - OSRM se kliče prek node:https z family:4 (KANON IZVIRNIKA —
 *    „router.project-osrm.org prek node:https family:4"): globalni fetch
 *    Node v peskovniku poizkusi IPv6 (2a02:418:… je TU NEDELJIV — ETIMEDOUT)
 *    in NE pade nazaj na IPv4; prav tako strežnik zavrne zahtevek brez
 *    User-Agent (403) — zato pošiljamo pošten identifikacijski UA.
 *
 * Testabilnost: RoadRouter/CircuitBreaker sprejemata injiciran fetch/uro/
 * timeout — testi NE segajo na pravo omrežje. Modul je namenjen izključno
 * strežniški uporabi (route handlerji); ni "use client" vmesnika.
 */

import https from "node:https";

// ── Tipi ───────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

/** En odsek poti (rezultat routeLeg). Geometrija = pari [lat, lng]. */
export interface LegRoute {
  km: number;
  min: number;
  source: "osrm" | "heuristic";
  geometry: [number, number][];
}

// ── Konstante ──────────────────────────────────────────────────────────

export const OSRM_BASE_URL = "https://router.project-osrm.org";
export const OSRM_TIMEOUT_MS = 8_000;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h (kanon izvirnika)
export const CACHE_CAP = 600; // največ 600 vnosov (kanon izvirnika)
export const BREAKER_THRESHOLD = 4; // 4 zaporedne napake → odprt
export const BREAKER_OPEN_MS = 10 * 60 * 1000; // odprt 10 min
export const ROAD_FACTOR = 1.3; /* cestni faktor nad premico */
export const HEURISTIC_SPEED_KMH = 55; /* ~55 km/h */
export const GEOMETRY_CAP = 400; /* največ ~400 točk geometrije */

// ── Čiste pomožne funkcije ─────────────────────────────────────────────

/** Haversine razdalja v km (R = 6371 km — kanon geo-distance izvirnika). */
export function haversineKmLocal(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Zaokroži na 1 decimalo. */
export function roundTo1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Hevristični odsek: haversine × 1,3 cestni faktor pri ~55 km/h.
 * km = round1(hav × 1,3); min = round(km × 60 / 55); geometrija = premica
 * (2 točki). Vedno source "heuristic" — poštena oznaka.
 */
export function heuristicLeg(from: LatLng, to: LatLng): LegRoute {
  const km = roundTo1(haversineKmLocal(from, to) * ROAD_FACTOR);
  const min = Math.round((km * 60) / HEURISTIC_SPEED_KMH);
  return {
    km,
    min,
    source: "heuristic",
    geometry: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
  };
}

/** Ena koordinata kljuca: zaokroženo na 4 decimalke (-0,0000 → 0,0000). */
export function formatCoordKey(v: number): string {
  const s = v.toFixed(4);
  return s === "-0.0000" ? "0.0000" : s;
}

/** Ključ cache: "lat,lng;lat,lng" obeh točk (zaokroženo na 4 dec.). */
export function buildCacheKey(from: LatLng, to: LatLng): string {
  return `${formatCoordKey(from.lat)},${formatCoordKey(from.lng)};${formatCoordKey(to.lat)},${formatCoordKey(to.lng)}`;
}

/**
 * Enakomerno redčenje geometrije na ~cap točk (vsaka N-ta + zadnja točka).
 * Ista realna pot, zmanjšana ločljivost — NI izmišljene geometrije.
 */
export function sampleGeometry(
  coords: [number, number][],
  cap: number = GEOMETRY_CAP
): [number, number][] {
  if (coords.length <= cap) return coords;
  const step = Math.ceil(coords.length / cap);
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) {
    out.push(coords[i]);
  }
  const last = coords[coords.length - 1] as [number, number];
  if (out[out.length - 1] !== last) {
    out.push(last);
  }
  return out;
}

// ── OSRM parse (čist) ──────────────────────────────────────────────────

/**
 * Razčleni OSRM odgovor (route/v1/driving …?overview=full&geometries=geojson).
 * Vrne LegRoute ali null ob KATERIKOLI nepravilnosti (NaN/negativna
 * varovalka, prazne poti, manjkajoča geometrija, koda ≠ "Ok").
 * GeoJSON koordinate so [lng, lat] → pretvorba v [lat, lng].
 */
export function parseOsrmResponse(json: unknown): LegRoute | null {
  if (json === null || typeof json !== "object") return null;
  const root = json as { code?: unknown; routes?: unknown };
  if (root.code !== "Ok") return null;
  if (!Array.isArray(root.routes) || root.routes.length === 0) return null;

  const route = root.routes[0] as {
    distance?: unknown;
    duration?: unknown;
    geometry?: { coordinates?: unknown };
  };
  const { distance, duration } = route;
  if (typeof distance !== "number" || typeof duration !== "number") return null;
  if (!Number.isFinite(distance) || !Number.isFinite(duration)) return null;
  if (distance < 0 || duration < 0) return null; // NaN/negativna varovalka

  const km = roundTo1(distance / 1000);
  const min = Math.round(duration / 60);
  if (!Number.isFinite(km) || !Number.isFinite(min) || km < 0 || min < 0) {
    return null;
  }

  const rawCoords = route.geometry?.coordinates;
  if (!Array.isArray(rawCoords) || rawCoords.length < 2) return null;
  const geometry: [number, number][] = [];
  for (const c of rawCoords) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const lng = c[0];
    const lat = c[1];
    if (
      typeof lng !== "number" ||
      typeof lat !== "number" ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat)
    ) {
      return null;
    }
    geometry.push([lat, lng]); // geojson [lng,lat] → [lat,lng]
  }

  return { km, min, source: "osrm", geometry: sampleGeometry(geometry) };
}

// ── Circuit breaker (vbrizgljiva ura za testi) ────────────────────────

/**
 * Circuit breaker: 4 ZAPOREDNE napake odprejo vezje za 10 min (med tem
 * OSRM preskočimo → takoj hevristika). Uspeh števec ponastavi. Po 10 min
 * naslednji klic znova poskusi OSRM (half-open); neuspeh znova odpre.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly threshold: number = BREAKER_THRESHOLD,
    private readonly openMs: number = BREAKER_OPEN_MS
  ) {}

  isOpen(): boolean {
    if (this.failures < this.threshold) return false;
    return this.now() - this.openedAt < this.openMs;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openedAt = this.now(); // (ponovno) odpri od zdaj
    }
  }

  get failureCount(): number {
    return this.failures;
  }
}

// ── OSRM fetch (privzeta implementacija — node:https family:4) ─────────

/** Pošten identifikacijski UA (OSRM strežnik odgovori 403 brez njega). */
const OSRM_USER_AGENT =
  "DiscoverSlovenia-AI/2.2.0 (rekonstrukcija; sledi OpenStreetMap etiquette)";

/**
 * Privzeti OSRM fetch prek node:https z DVSILJENIM IPv4 (family:4) — kanon
 * izvirnika. Telo se v celoti prebere v Response (timeout 8 s pokriva
 * celotno izmenjavo). Podpira preklic prek init.signal (AbortController).
 */
export function osrmFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const req = https.request(
      url,
      {
        family: 4, // IPv6 naslovi OSRM so v peskovniku nedelujni (ETIMEDOUT)
        headers: {
          "User-Agent": OSRM_USER_AGENT,
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("error", reject);
        res.on("end", () => {
          const status = res.statusCode ?? 502;
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            headers[k] = Array.isArray(v) ? v.join(", ") : (v ?? "");
          }
          resolve(
            new Response(Buffer.concat(chunks), { status, headers })
          );
        });
      }
    );
    req.on("error", reject);
    init?.signal?.addEventListener("abort", () => {
      req.destroy(new Error("OSRM request aborted (timeout)"));
    });
    req.end();
  });
}

// ── RoadRouter ─────────────────────────────────────────────────────────

export interface RouterDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheCap?: number;
}

interface CacheEntry {
  value: LegRoute;
  at: number;
}

/**
 * OSRM usmerjevalnik z LRU pomnilniškim cachejem (TTL 24 h, cap 600),
 * circuit breakerjem in hevrističnim zasilnim načinom.
 * Odvisnosti (fetch/ura/timeout) so vbrizgljive — za teste brez omrežja.
 */
export class RoadRouter {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly cacheCap: number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly breaker: CircuitBreaker;

  constructor(deps: RouterDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? osrmFetch;
    this.now = deps.now ?? (() => Date.now());
    this.timeoutMs = deps.timeoutMs ?? OSRM_TIMEOUT_MS;
    this.cacheTtlMs = deps.cacheTtlMs ?? CACHE_TTL_MS;
    this.cacheCap = deps.cacheCap ?? CACHE_CAP;
    this.breaker = new CircuitBreaker(this.now);
  }

  /** Usmeri en odsek (from → to). Nikoli ne meče — ob napaki hevristika. */
  async routeLeg(from: LatLng, to: LatLng): Promise<LegRoute> {
    const key = buildCacheKey(from, to);
    const cached = this.readCache(key);
    if (cached) return cached;

    let leg: LegRoute | null = null;
    if (!this.breaker.isOpen()) {
      leg = await this.fetchOsrm(from, to);
      if (leg) {
        this.breaker.recordSuccess();
      } else {
        this.breaker.recordFailure();
      }
    }
    if (!leg) {
      // Vezje odprto ALI OSRM napaka → iskrena hevristika (nikoli "osrm").
      leg = heuristicLeg(from, to);
    }

    if (leg.source === "osrm") {
      // V cache SAMO realne poti — ko OSRM okreva, strežemo realno.
      this.writeCache(key, leg);
    }
    return leg;
  }

  private readCache(key: string): LegRoute | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (this.now() - hit.at >= this.cacheTtlMs) {
      this.cache.delete(key); // potekel vnos
      return null;
    }
    // LRU: osveži položaj (Map ohranja vrstni red vstavljanja).
    this.cache.delete(key);
    this.cache.set(key, hit);
    return hit.value;
  }

  private writeCache(key: string, value: LegRoute): void {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, { value, at: this.now() });
    while (this.cache.size > this.cacheCap) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
  }

  private async fetchOsrm(from: LatLng, to: LatLng): Promise<LegRoute | null> {
    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal });
      if (!res.ok) return null;
      const json: unknown = await res.json();
      return parseOsrmResponse(json);
    } catch {
      return null; // omrežje/timeout/pokvarjen JSON → varovalka (ne meči)
    } finally {
      clearTimeout(timer);
    }
  }

  /** Introspekcija za teste (stanja ne spreminja). */
  cacheSize(): number {
    return this.cache.size;
  }

  breakerFailures(): number {
    return this.breaker.failureCount;
  }

  breakerOpen(): boolean {
    return this.breaker.isOpen();
  }
}

/** Singleton, ki ga uporabljajo route handlerji (deljena cache/breaker). */
export const roadRouter = new RoadRouter();

/** Priročen odkrit izvoz singletona (kanon izvirnika: routeLeg(from, to)). */
export async function routeLeg(from: LatLng, to: LatLng): Promise<LegRoute> {
  return roadRouter.routeLeg(from, to);
}
