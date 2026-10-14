/**
 * GEOCODING-SERVER — strežniški Photon odjemalec (geokodiranje/krajevno
 * iskanje; #35 faza 3, v2.64.0). Zgrajen po ISTEM kanonu kot
 * road-routing-server.ts (OSRM): pomnilniški cache 24 h / 600 (LRU),
 * circuit breaker 4 → 10 min, vbrizgljiv fetch/ura/timeout, iskrenostni
 * kanon z izrecno oznako vira.
 *
 * VIR (iskrenostni kanon, nikoli prelomljiv):
 *  - privzeti vir je JAVNI Photon primerek (photon.komoot.io — BJS,
 *    fair-use; OpenStreetMap podatki, ODbL) — vmesna rešitev enaka kot
 *    OSRM demo pri fazi 2 (kanon dokumenta #35 §9: BJS do self-host);
 *  - self-host je Pripravljen brez spremembe kode: nastavi PHOTON_BASE_URL
 *    (dokument #35 §9 faza 3: „Photon self-host … trivialen self-host");
 *  - source "photon" sme nositi SAMO razčlenjen odgovor Photon API-ja
 *    (GeoJSON FeatureCollection z veljavnimi lastnostmi); vsaka napaka
 *    (omrežje, timeout, HTTP napaka, pokvarjen JSON) vrne source "none"
 *    — rezultat NIKOLI ni izmišljen;
 *  - prazni zadetki (veljavna odgovor brez featureov) so USPEH — brez
 *    breakerja (Photon je odgovoril), v cache se shrani [] (query zares
 *    nima zadetkov; ščiti tudi fair-use kvoto).
 *
 * OMEJITVE javnega primerka (verificirano curl 14. 10. 2026):
 *  - `lang` podpira SAMO default/de/en/fr — `lang=sl` vrne HTTP 400!
 *    Zato pošiljamo lang=en (pravilna imena so vseeno lokalizirana:
 *    „Ljubljanski grad, Ljubljana, Slovenija"); UI prikazuje etiketo
 *    vira, ne prevodov odgovora.
 *  - fair-use: pošten identifikacijski UA + cache + breaker + rate limit
 *    na /api/geocode (30/min) — enak mitigation vzorec kot R8.
 *
 * ODMERITEV: koordinata = geometry.coordinates [lng, lat] (GeoJSON) →
 * pretvorba v {lat, lng} (ISTO varovalko kot OSRM parse).
 *
 * Testabilnost: Geocoder sprejema injiciran fetch/uro/timeout — testi NE
 * segajo na pravo omrežje. Modul je namenjen izključno strežniški
 * uporabi (route handlerji); ni "use client" vmesnika.
 */

import https from "node:https";

// ── Tipi ───────────────────────────────────────────────────────────────

/** En zadetek geokodiranja (normaliziran iz Photon GeoJSON). */
export interface GeocodeHit {
  /** Celotna oznaka za prikaz: „Ljubljanski grad, Ljubljana, Slovenija". */
  label: string;
  /** Primarno ime (Photon properties.name). */
  name: string;
  city: string | null;
  /** Regija (state ?? county) — za izpolnitev polja „regija". */
  region: string | null;
  country: string | null;
  /** 2-črkovni ISO (uppercase) — Photon properties.countrycode. */
  countryCode: string;
  lat: number;
  lng: number;
  source: "photon";
}

export interface GeocodeResult {
  hits: GeocodeHit[];
  /** "photon" = razčlenjen odgovor; "none" = napaka/odprto vezje/prazno vprašanje. */
  source: "photon" | "none";
}

export interface SearchOpts {
  /** Opcijska težiščna točka (Photon lat/lon bias). */
  lat?: number;
  lng?: number;
  /** 1–10 (privzeto 5). */
  limit?: number;
}

// ── Konstante ──────────────────────────────────────────────────────────

/** Javni Photon primerek (BJS) — privzeti vir do self-host. */
export const PHOTON_PUBLIC_BASE_URL = "https://photon.komoot.io";

/**
 * Override za self-host (faza 3): nastavi PHOTON_BASE_URL na svoj primerek —
 * koda ostane ISTA (kanon dokumenta #35: „zamenjava BASE URL je dovolj").
 * Sprejmemo samo http(s) — drugače mirno pademo na javni primerek.
 */
function resolveBaseUrl(): string {
  const raw = process.env.PHOTON_BASE_URL?.trim() ?? "";
  if (raw.length > 0 && /^https?:\/\//.test(raw)) return raw;
  return PHOTON_PUBLIC_BASE_URL;
}

export const PHOTON_BASE_URL = resolveBaseUrl();
export const PHOTON_TIMEOUT_MS = 6_000;
export const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h (kanon routing)
export const GEO_CACHE_CAP = 600; // največ 600 vnosov (kanon routing)
export const GEO_BREAKER_THRESHOLD = 4; // 4 zaporedne napake → odprt
export const GEO_BREAKER_OPEN_MS = 10 * 60 * 1000; // odprt 10 min
export const GEO_DEFAULT_LIMIT = 5;
export const GEO_MAX_LIMIT = 10;
/** Photon: `lang` podpira samo default/de/en/fr (verificirano 14. 10.). */
export const PHOTON_LANG = "en";

// ── Čiste pomožne funkcije ─────────────────────────────────────────────

/** Normalizacija vprašanja za cache ključ: trim, stisni presledke, lowercase. */
export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Ključ cache: vprašanje + težišče (2 dec.) + limit. */
export function buildCacheKey(
  q: string,
  opts: SearchOpts = {}
): string {
  const bias =
    typeof opts.lat === "number" && typeof opts.lng === "number"
      ? `@${opts.lat.toFixed(2)},${opts.lng.toFixed(2)}`
      : "";
  return `${normalizeQuery(q)}${bias}#${opts.limit ?? GEO_DEFAULT_LIMIT}`;
}

/** Zgradi Photon URL (vprašanje je URL-encodeano; lang=en — sl NI podprt). */
export function buildPhotonUrl(
  base: string,
  q: string,
  limit: number,
  lat?: number,
  lng?: number
): string {
  const params = new URLSearchParams({
    q,
    limit: String(limit),
    lang: PHOTON_LANG,
  });
  if (typeof lat === "number" && typeof lng === "number") {
    params.set("lat", lat.toFixed(5));
    params.set("lon", lng.toFixed(5));
  }
  return `${base}/api/?${params.toString()}`;
}

/** Oznaka iz lastnosti: [name, city, country] — brez praznih, unikatno. */
function buildLabel(p: {
  name: string;
  city: string | null;
  country: string | null;
}): string {
  const parts = [p.name, p.city, p.country].filter(
    (x): x is string => typeof x === "string" && x.length > 0
  );
  return [...new Set(parts)].join(", ");
}

/**
 * Razčleni Photon odgovor (GeoJSON FeatureCollection).
 * Vrne GeocodeHit[] (lahko []) ali null ob KATERIKOLI nepravilnosti
 * (ni FeatureCollection, features ni polje, posamezen feature brez
 * imena/državne kode/veljavnih koordinat).
 */
export function parsePhotonResponse(
  json: unknown,
  cap: number = GEO_MAX_LIMIT
): GeocodeHit[] | null {
  if (json === null || typeof json !== "object") return null;
  const root = json as { type?: unknown; features?: unknown };
  if (root.type !== "FeatureCollection") return null;
  if (!Array.isArray(root.features)) return null;
  if (root.features.length > cap * 3) return null; // zlorabna varovalka

  const hits: GeocodeHit[] = [];
  for (const f of root.features) {
    if (f === null || typeof f !== "object") return null;
    const feature = f as {
      properties?: unknown;
      geometry?: { coordinates?: unknown };
    };
    if (feature.properties === null || typeof feature.properties !== "object") {
      return null;
    }
    const p = feature.properties as Record<string, unknown>;

    // Ime: Photon vedno vrne properties.name; brez njega je odgovor
    // neuporaben (ne ugibamo iz city — iskrenostni kanon).
    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (name.length < 1) return null;

    const countryCode =
      typeof p.countrycode === "string" ? p.countrycode.trim().toUpperCase() : "";
    if (!/^[A-Z]{2}$/.test(countryCode)) return null;

    // Koordinati: GeoJSON [lng, lat] → {lat, lng}; finite varovalka.
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lng = coords[0];
    const lat = coords[1];
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    const str = (v: unknown): string | null => {
      const s = typeof v === "string" ? v.trim() : "";
      return s.length > 0 ? s : null;
    };
    const city = str(p.city);
    const county = str(p.county);
    const state = str(p.state);
    const country = str(p.country);

    hits.push({
      label: buildLabel({ name, city, country }),
      name,
      city,
      region: state ?? county,
      country,
      countryCode,
      lat,
      lng,
      source: "photon",
    });
  }
  return hits;
}

// ── Circuit breaker (enak vzorec kot road-routing-server) ─────────────

/**
 * Circuit breaker: 4 ZAPOREDNE napake odprejo vezje za 10 min (med tem
 * Photon preskočimo → takoj source "none"). Uspeh števec ponastavi.
 * Po 10 min naslednji klic znova poskusi (half-open); neuspeh znova odpre.
 */
export class GeocodeCircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly threshold: number = GEO_BREAKER_THRESHOLD,
    private readonly openMs: number = GEO_BREAKER_OPEN_MS
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

// ── Photon fetch (privzeta implementacija — node:https family:4) ──────

/** Pošten identifikacijski UA (OpenStreetMap etiquette; vzorec OSRM). */
const PHOTON_USER_AGENT =
  "DiscoverSlovenia-AI/2.65.2 (geokodiranje; sledi OpenStreetMap etiquette)";

/**
 * Privzeti Photon fetch prek node:https z Vsiljenim IPv4 (family:4) —
 * kanon iz road-routing-server: globalni fetch Node v peskovniku poizkusi
 * IPv6 in NE pade nazaj na IPv4 (ETIMEDOUT). Podpira preklic prek signal.
 */
export function photonFetch(
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
        family: 4, // IPv6 naslovi so v peskovniku nedelujni (kanon OSRM)
        headers: {
          "User-Agent": PHOTON_USER_AGENT,
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
          resolve(new Response(Buffer.concat(chunks), { status, headers }));
        });
      }
    );
    req.on("error", reject);
    init?.signal?.addEventListener("abort", () => {
      req.destroy(new Error("Photon request aborted (timeout)"));
    });
    req.end();
  });
}

// ── Geocoder ───────────────────────────────────────────────────────────

/** Fetchu-podobna funkcija — namerno ozko tipizirana (za vbrizg v testih). */
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface GeocoderDeps {
  fetchImpl?: FetchLike;
  now?: () => number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheCap?: number;
}

interface CacheEntry {
  value: GeocodeHit[];
  at: number;
}

/**
 * Photon geokodirnik z LRU pomnilniškim cachejem (TTL 24 h, cap 600),
 * circuit breakerjem in iskrenim zasilnim načinom (source "none").
 * Odvisnosti (fetch/ura/timeout) so vbrizgljive — za teste brez omrežja.
 */
export class Geocoder {
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly cacheCap: number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly breaker: GeocodeCircuitBreaker;

  constructor(deps: GeocoderDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? photonFetch;
    this.now = deps.now ?? (() => Date.now());
    this.timeoutMs = deps.timeoutMs ?? PHOTON_TIMEOUT_MS;
    this.cacheTtlMs = deps.cacheTtlMs ?? GEO_CACHE_TTL_MS;
    this.cacheCap = deps.cacheCap ?? GEO_CACHE_CAP;
    this.breaker = new GeocodeCircuitBreaker(this.now);
  }

  /** Išče kraje. Nikoli ne meče — ob napaki { hits: [], source: "none" }. */
  async search(q: string, opts: SearchOpts = {}): Promise<GeocodeResult> {
    const trimmed = q.trim();
    // Prekrajšo vprašanje NE pošilja na omrežje (fair-use kanon R8).
    if (trimmed.length < 2) return { hits: [], source: "none" };

    const limit = clampLimit(opts.limit);
    const key = buildCacheKey(trimmed, { ...opts, limit });
    const cached = this.readCache(key);
    if (cached) return { hits: cached, source: "photon" };

    if (this.breaker.isOpen()) {
      return { hits: [], source: "none" };
    }

    const hits = await this.fetchPhoton(trimmed, limit, opts);
    if (hits === null) {
      this.breaker.recordFailure();
      return { hits: [], source: "none" };
    }

    this.breaker.recordSuccess();
    // V cache gre SAMO uspešna razčlenjena odgovora (tudi prazna []) —
    // ko Photon okreva, strežemo realne zadetke (kanon routing).
    this.writeCache(key, hits);
    return { hits, source: "photon" };
  }

  private readCache(key: string): GeocodeHit[] | null {
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

  private writeCache(key: string, value: GeocodeHit[]): void {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, { value, at: this.now() });
    while (this.cache.size > this.cacheCap) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
  }

  private async fetchPhoton(
    q: string,
    limit: number,
    opts: SearchOpts
  ): Promise<GeocodeHit[] | null> {
    const url = buildPhotonUrl(PHOTON_BASE_URL, q, limit, opts.lat, opts.lng);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal });
      if (!res.ok) return null;
      const json: unknown = await res.json();
      return parsePhotonResponse(json, limit);
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

/** Omeji limit na [1, GEO_MAX_LIMIT]. */
function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return GEO_DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), GEO_MAX_LIMIT);
}

/** Singleton, ki ga uporabljajo route handlerji (deljena cache/breaker). */
export const geocoder = new Geocoder();

/** Priročen odkrit izvoz singletona (vzorec routeLeg). */
export async function searchPlaces(
  q: string,
  opts: SearchOpts = {}
): Promise<GeocodeResult> {
  return geocoder.search(q, opts);
}
