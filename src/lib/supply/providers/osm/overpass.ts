/**
 * OSM OVERPASS — živi POI sloj po viewportu (P0-C, issue §6).
 *
 * RECOVER: naslednik Overpass adapterja izvirnika (izgubljen ob
 * varnostnem incidentu 2026-10-06). Poizvedbe po viewportu zemljevida
 * (bbox) proti javnemu Overpass API-ju (3 zrcala).
 *
 * LICENCA: OpenStreetMap © avtorji, ODbL 1.1 — obvezna atribucija
 * (OSM_ATTRIBUTION se vrača v Vsakem odzivu, tudi napakah).
 *
 * KANON ISKRENOSTI:
 *  · NAMERNO omejitve: max površina bbox (preprečuje zlorabo javnega
 *    vira), min interval med poizvedbami (rate limit), timeout;
 *  · napaka omrežja/strežnika → status „error" z razlogom — NIKOLI
 *    izmišljeni POI, nikoli tiho prazen sloj (izvirnikov vzorec:
 *    „Lokalni vir nedosegljiv" iskrena degradacija);
 *  · injectable fetch + ura (testi brez omrežja — FetchLike vzorec
 *    road-routing-serverja).
 */

// ── Konstante vira ─────────────────────────────────────────────────────────

/** Javna zrcala Overpass API (po vrsti = primarno najprej). */
export const OVERPASS_ENDPOINTS: readonly string[] = Object.freeze([
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]);

/** Obvezna atribucija ODbL. */
export const OSM_ATTRIBUTION =
  "Podatki © OpenStreetMap avtorji, ODbL 1.1 (openstreetmap.org/copyright)";

/** Max površina viewporta v stopinjah² (zaščita javnega vira). */
export const OVERPASS_MAX_BBOX_AREA = 0.25;

/** Min interval med poizvedbami (ms) — namerni rate limit. */
export const OVERPASS_MIN_INTERVAL_MS = 5_000;

/** Timeout poizvedbe (ms). */
export const OVERPASS_TIMEOUT_MS = 15_000;

/** Max število POI na poizvedbo. */
export const OVERPASS_MAX_RESULTS = 200;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

// ── Bbox (viewport zemljevida) ─────────────────────────────────────────────

/** [south, west, north, east] — isti vrstni red kot Leaflet fitBounds. */
export type Bbox = readonly [number, number, number, number];

export type BboxValidation =
  | { ok: true; bbox: Bbox }
  | { ok: false; reason: string };

/** Validiraj bbox: smiselne koordinate + omejitev površine. */
export function validateBbox(raw: readonly number[]): BboxValidation {
  if (raw.length !== 4 || raw.some((v) => !Number.isFinite(v))) {
    return { ok: false, reason: "bbox potrebuje 4 končne številke (s,w,n,e)" };
  }
  const [s, w, n, e] = raw;
  if (s >= n) return { ok: false, reason: "south mora biti < north" };
  if (w >= e) return { ok: false, reason: "west mora biti < east" };
  if (s < -90 || n > 90 || w < -180 || e > 180) {
    return { ok: false, reason: "koordinate izven zemljepisnih okvirov" };
  }
  const area = (n - s) * (e - w);
  if (area > OVERPASS_MAX_BBOX_AREA) {
    return {
      ok: false,
      reason: `viewport prevelik (${area.toFixed(2)}°² > ${OVERPASS_MAX_BBOX_AREA}°²) — približajte zemljevid`,
    };
  }
  return { ok: true, bbox: [s, w, n, e] };
}

// ── Overpass QL (potovalno-relevantni POI) ─────────────────────────────────

/** Oznake, ki jih sloj pobira (kanon: turizem + hrana + narava + gorivo). */
export const OVERPASS_POI_FILTERS: readonly string[] = Object.freeze([
  "tourism",
  "amenity=restaurant",
  "amenity=cafe",
  "amenity=bar",
  "amenity=fast_food",
  "historic",
  "leisure=park",
  "natural=beach",
  "amenity=fuel",
]);

/** Zgradi Overpass QL poizvedbo za bbox (deterministično). */
export function buildOverpassQuery(bbox: Bbox): string {
  const [s, w, n, e] = bbox.map((v) => v.toFixed(5));
  const selectors = OVERPASS_POI_FILTERS.map((f) => `nwr[${f}]`).join(";");
  return `[out:json][timeout:14];(${selectors};)(${s},${w},${n},${e});out center ${OVERPASS_MAX_RESULTS};`;
}

// ── Rezultat ───────────────────────────────────────────────────────────────

/** Canonical POI (iz elementov Overpass, fail-closed preslikava). */
export interface OsmPoi {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Vrsta (prvi ujemajoč filter, npr. „tourism" ali „amenity=cafe"). */
  kind: string;
  /** Pridružene oznake (samo potovalno-relevantne — izpis omejen). */
  tags: Record<string, string>;
}

export type OverpassResult =
  | {
      status: "ok";
      pois: OsmPoi[];
      attribution: string;
      endpoint: string;
    }
  | {
      status: "error";
      reason: string;
      attribution: string;
    };

// ── Rate limit (module-level, injectable ura za teste) ────────────────────

export type ClockLike = () => number;

let lastQueryAt = 0;

/** Notranje za teste: ponastavi stanje rate limiterja. */
export function __resetOverpassRateLimit(): void {
  lastQueryAt = 0;
}

// ── Preslikava elementov (čista) ──────────────────────────────────────────

/** Preslikaj element Overpass v canonical POI (ime je obvezno). */
export function mapOverpassElement(el: unknown): OsmPoi | null {
  if (typeof el !== "object" || el === null) return null;
  const d = el as {
    type?: string;
    id?: number;
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
    tags?: Record<string, string>;
  };
  const lat = typeof d.lat === "number" ? d.lat : d.center?.lat;
  const lon = typeof d.lon === "number" ? d.lon : d.center?.lon;
  const tags = d.tags ?? {};
  const name = tags["name"];
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    typeof name !== "string" ||
    name.trim().length === 0
  ) {
    // POI brez imena/koordinat ni uporaben za sloj — iskreno izpust.
    return null;
  }
  const kind =
    OVERPASS_POI_FILTERS.find((f) => {
      const [key, val] = f.split("=");
      return val === undefined ? key in tags : tags[key] === val;
    }) ?? "other";
  // Omejen izpis oznak (samo potovalno-relevantne — brez zasebnosti
  // nepotrebnih polj, brez contact:* itd.).
  const relevantTags: Record<string, string> = {};
  for (const key of [
    "tourism",
    "amenity",
    "historic",
    "leisure",
    "natural",
    "cuisine",
    "opening_hours",
    "website",
  ]) {
    if (tags[key]) relevantTags[key] = tags[key];
  }
  return {
    id: `${d.type ?? "n"}-${d.id ?? "?"}`,
    name: name.trim(),
    latitude: lat,
    longitude: lon,
    kind,
    tags: relevantTags,
  };
}

// ── Poizvedba (fail-closed, rate-limited, 3 zrcala) ────────────────────────

/**
 * Poišči POI po viewportu. Vrne iskren rezultat — tudi napaka nosi
 * atribucijo (sloj je ODbL ne glede na uspeh).
 */
export async function queryViewportPois(
  rawBbox: readonly number[],
  opts: {
    fetchLike?: FetchLike;
    clock?: ClockLike;
    /** Testna bypass rate limita (samo za teste). */
    ignoreRateLimit?: boolean;
  } = {}
): Promise<OverpassResult> {
  const v = validateBbox(rawBbox);
  if (!v.ok) {
    return { status: "error", reason: v.reason, attribution: OSM_ATTRIBUTION };
  }

  const clock = opts.clock ?? (() => Date.now());
  if (!opts.ignoreRateLimit) {
    const now = clock();
    const since = now - lastQueryAt;
    if (since >= 0 && since < OVERPASS_MIN_INTERVAL_MS) {
      return {
        status: "error",
        reason: `prehitro — javni vir potrebuje vsaj ${OVERPASS_MIN_INTERVAL_MS} ms med poizvedbami (${since} ms)`,
        attribution: OSM_ATTRIBUTION,
      };
    }
    lastQueryAt = clock();
  }

  const fetchLike = opts.fetchLike ?? ((url, init) => fetch(url, init));
  const query = buildOverpassQuery(v.bbox);
  const errors: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetchLike(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": "discover-slovenia-ai/2.x (osm-poi-layer)",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        errors.push(`${new URL(endpoint).hostname}: HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements?: unknown[] };
      const elements = Array.isArray(json.elements) ? json.elements : [];
      const pois = elements
        .map(mapOverpassElement)
        .filter((p): p is OsmPoi => p !== null);
      return {
        status: "ok",
        pois,
        attribution: OSM_ATTRIBUTION,
        endpoint: new URL(endpoint).hostname,
      };
    } catch (err) {
      const reason =
        err instanceof Error
          ? err.name === "AbortError"
            ? "timeout"
            : err.message
          : "neznana napaka";
      errors.push(`${new URL(endpoint).hostname}: ${reason}`);
      continue;
    }
  }

  return {
    status: "error",
    reason: `Overpass nedosegljiv na vseh zrcalih — ${errors.join(" · ")}`,
    attribution: OSM_ATTRIBUTION,
  };
}
