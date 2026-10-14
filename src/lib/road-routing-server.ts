/**
 * ROAD-ROUTING-SERVER — strežniški Valhalla odjemalec (#35 faza 2 PoC,
 * 2.65.0; prej OSRM demo — R11). Iskrenostni kanon se OHRANI v celoti:
 * pomnilniški cache 24 h / 600, circuit breaker 4 → 10 min,
 * NaN/negativna varovalka, RoutingMethod valhalla|heuristic|mixed.
 *
 * VIR (iskrenostni kanon, nikoli prelomljiv):
 *  - privzeti vir je JAVNI Valhalla primerek FOSSGIS
 *    (valhalla1.openstreetmap.de — BJS za lahkotno uporabo; OpenStreetMap
 *    podatki, ODbL; MIT motor) — trajna rešitev faze 2 je self-host:
 *    nastavi VALHALLA_BASE_URL in koda ostane ISTA (kanon dokumenta #35:
 *    „zamenjava BASE URL + formata odgovora je dovolj");
 *  - source "valhalla" sme nositi SAMO uspešno razčlenjen odgovor Valhalla
 *    /route (trip.status = 0, legs[0].summary z veljavno dolžino/časom,
 *    dekodirana geometrija shape);
 *  - vsaka napaka (omrežje, timeout, HTTP napaka, NaN/negativne vrednosti,
 *    prazne poti, pokvarjen shape) vodi v HEVRISTIČNO OCENO (haversine ×
 *    1,3 pri ~55 km/h) z oznako source "heuristic" — hevristika NIKOLI ni
 *    označena kot valhalla;
 *  - geometrija hevristike = premica med točkama (2 točki) — v UI je
 *    razkrita kot črtkana črta z oznako "ocena".
 *
 * Odločitve (dokumentirane):
 *  - v pomnilniški cache se shranjujejo SAMO uspešni Valhalla odseki — ko
 *    strežnik okreva, takoj strežemo realne poti (zastarela hevristika bi
 *    bila neiskrena do vira);
 *  - geometrija z več kot 400 točkami se enakomerno redči (vsaka N-ta
 *    točka + zadnja) — ISTA realna pot, le zmanjšana ločljivost, ne izmislek;
 *  - Valhalla se kliče prek node:https z family:4 (KANON IZVIRNIKA —
 *    prenos iz OSRM: globalni fetch Node v peskovniku poizkusi IPv6 in NE
 *    pade nazaj na IPv4; pošten identifikacijski UA ostaja etiquette);
 *  - zahteva = GET ?json={"locations":[…],"costing":"auto",
 *    "shape_format":"polyline6","units":"kilometers"} — units je OBVEZEN
 *    (privzeta enota summary.length je MILJA); polyline6 = 1e6 natančnost,
 *    dekodirano v [lat, lng] (Valhalla vrstni red, brez preobra).
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
  source: "valhalla" | "heuristic";
  geometry: [number, number][];
}

// ── Konstante ──────────────────────────────────────────────────────────

/** Javni Valhalla primerek FOSSGIS (BJS) — privzeti vir do self-host. */
export const VALHALLA_PUBLIC_BASE_URL = "https://valhalla1.openstreetmap.de";

/**
 * Override za self-host (faza 2, trajna rešitev): nastavi VALHALLA_BASE_URL
 * na svoj primerek — koda ostane ISTA (kanon dokumenta #35). Sprejmemo samo
 * http(s) — drugače mirno pademo na javni primerek (vzorec PHOTON_BASE_URL).
 */
function resolveRoutingBaseUrl(): string {
  const raw = process.env.VALHALLA_BASE_URL?.trim() ?? "";
  if (raw.length > 0 && /^https?:\/\//.test(raw)) return raw;
  return VALHALLA_PUBLIC_BASE_URL;
}

export const VALHALLA_BASE_URL = resolveRoutingBaseUrl();
export const VALHALLA_TIMEOUT_MS = 8_000;
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

// ── Valhalla request/response (čisto) ──────────────────────────────────

/**
 * Zgradi Valhalla /route URL za en odsek (from → to).
 * units=kilometers je OBVEZEN (privzeta enota summary.length je milja);
 * shape_format=polyline6 (1e6 natančnost); costing=auto (vozni profil).
 */
export function buildValhallaUrl(
  base: string,
  from: LatLng,
  to: LatLng
): string {
  const json = JSON.stringify({
    locations: [
      { lat: from.lat, lon: from.lng },
      { lat: to.lat, lon: to.lng },
    ],
    costing: "auto",
    shape_format: "polyline6",
    units: "kilometers",
  });
  return `${base}/route?json=${encodeURIComponent(json)}`;
}

/**
 * Dekodira Encoded Polyline (Valhalla shape, natančnost 1e6) v pari
 * [lat, lng] (Valhalla vrstni red — brez preobra, za razliko od OSRM
 * geojson [lng, lat]). Referenca: Mapbox/valhalla specifikacija
 * (variable-length int + zigzag). Slaba oblika → null (iskrenostni kanon:
 * ne ugibamo geometrije).
 */
export function decodePolyline6(shape: string): [number, number][] | null {
  if (typeof shape !== "string" || shape.length === 0) return null;
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const n = shape.length;

  const readChunk = (): number | null => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (index >= n) return null; // prekinjen zapis
      const code = shape.charCodeAt(index++);
      // Valhalla polyline je ASCII (base64-ish); odmik od 63.
      b = code - 63;
      if (b < 0) return null;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result;
  };

  while (index < n) {
    const dLat = readChunk();
    const dLng = readChunk();
    if (dLat === null || dLng === null) return null;
    lat += dLat & 1 ? ~(dLat >> 1) : dLat >> 1;
    lng += dLng & 1 ? ~(dLng >> 1) : dLng >> 1;
    const latDeg = lat / 1e6;
    const lngDeg = lng / 1e6;
    if (
      !Number.isFinite(latDeg) ||
      !Number.isFinite(lngDeg) ||
      latDeg < -90 ||
      latDeg > 90 ||
      lngDeg < -180 ||
      lngDeg > 180
    ) {
      return null;
    }
    out.push([latDeg, lngDeg]);
  }
  return out.length >= 2 ? out : null;
}

/**
 * Razčleni Valhalla /route odgovor (native trip oblika).
 * Vrne LegRoute ali null ob KATERIKOLI nepravilnosti (trip.status ≠ 0,
 * prazne poti, manjkajoča/neveljavna summary, pokvarjen shape).
 *  - leg.summary.length = km (units=kilometers);
 *  - leg.summary.time = sekunde;
 *  - leg.shape = encoded polyline6 → dekodirano v [lat, lng].
 */
export function parseValhallaResponse(json: unknown): LegRoute | null {
  if (json === null || typeof json !== "object") return null;
  const root = json as { trip?: unknown };
  if (typeof root.trip !== "object" || root.trip === null) return null;
  const trip = root.trip as {
    status?: unknown;
    legs?: unknown;
    summary?: unknown;
  };
  if (trip.status !== 0) return null; // 0 = "Found route between points"
  if (!Array.isArray(trip.legs) || trip.legs.length < 1) return null;

  const leg = trip.legs[0] as {
    summary?: unknown;
    shape?: unknown;
  };
  const summary = leg?.summary;
  if (typeof summary !== "object" || summary === null) return null;
  const { length, time } = summary as { length?: unknown; time?: unknown };
  if (typeof length !== "number" || typeof time !== "number") return null;
  if (!Number.isFinite(length) || !Number.isFinite(time)) return null;
  if (length < 0 || time < 0) return null; // NaN/negativna varovalka

  const km = roundTo1(length);
  const min = Math.round(time / 60);
  if (!Number.isFinite(km) || !Number.isFinite(min) || km < 0 || min < 0) {
    return null;
  }

  if (typeof leg.shape !== "string" || leg.shape.length === 0) return null;
  const geometry = decodePolyline6(leg.shape);
  if (!geometry) return null; // pokvarjen/prekratek shape → ne ugibamo

  return { km, min, source: "valhalla", geometry: sampleGeometry(geometry) };
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

// ── Valhalla fetch (privzeta implementacija — node:https family:4) ────

/** Pošten identifikacijski UA (OpenStreetMap etiquette — kanon izvirnika). */
const VALHALLA_USER_AGENT =
  "DiscoverSlovenia-AI/2.65.1 (routing; sledi OpenStreetMap etiquette)";

/**
 * Privzeti Valhalla fetch prek node:https z VSILJENIM IPv4 (family:4) —
 * kanon iz OSRM dobe. Telo se v celoti prebere v Response (timeout 8 s
 * pokriva celotno izmenjavo). Podpira preklic prek init.signal
 * (AbortController).
 */
export function valhallaFetch(
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
        family: 4, // IPv6 naslovi so v peskovniku nedelujni (ETIMEDOUT)
        headers: {
          "User-Agent": VALHALLA_USER_AGENT,
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
      req.destroy(new Error("Valhalla request aborted (timeout)"));
    });
    req.end();
  });
}

// ── RoadRouter ─────────────────────────────────────────────────────────

/** Fetchu-podobna funkcija — namerno ozko tipizirana (za vbrizg v testih). */
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface RouterDeps {
  fetchImpl?: FetchLike;
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
 * Valhalla usmerjevalnik z LRU pomnilniškim cachejem (TTL 24 h, cap 600),
 * circuit breakerjem in hevrističnim zasilnim načinom.
 * Odvisnosti (fetch/ura/timeout) so vbrizgljive — za teste brez omrežja.
 */
export class RoadRouter {
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly cacheCap: number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly breaker: CircuitBreaker;

  constructor(deps: RouterDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? valhallaFetch;
    this.now = deps.now ?? (() => Date.now());
    this.timeoutMs = deps.timeoutMs ?? VALHALLA_TIMEOUT_MS;
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
      leg = await this.fetchValhalla(from, to);
      if (leg) {
        this.breaker.recordSuccess();
      } else {
        this.breaker.recordFailure();
      }
    }
    if (!leg) {
      // Vezje odprto ALI Valhalla napaka → iskrena hevristika (nikoli "valhalla").
      leg = heuristicLeg(from, to);
    }

    if (leg.source === "valhalla") {
      // V cache SAMO realne poti — ko Valhalla okreva, strežemo realno.
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

  private async fetchValhalla(
    from: LatLng,
    to: LatLng
  ): Promise<LegRoute | null> {
    const url = buildValhallaUrl(VALHALLA_BASE_URL, from, to);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal });
      if (!res.ok) return null;
      const json: unknown = await res.json();
      return parseValhallaResponse(json);
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
