/**
 * GEOCODING TESTI — Photon odjemalec (src/lib/geocoding-server.ts) BREZ
 * pravega omrežja: vbrizgljan fetch/ura/timeout (kanon testne hiše, vzorec
 * road-routing.test.ts) + strukturini zaklepi API rute /api/geocode.
 *
 * Iskrenostne invariante: source "photon" NOSI SAMO razčlenjen GeoJSON
 * odgovor; vsaka nepravilnost → source "none" + prazen seznam (NIKOLI
 * izmišljeni rezultati); circuit breaker 4 zaporedne napake → odprt
 * 10 min; cache 24 h / 600 (LRU, samo uspešni odgovori — tudi prazni []).
 */

import { describe, expect, test } from "bun:test";

import {
  buildCacheKey,
  buildPhotonUrl,
  Geocoder,
  GEO_BREAKER_OPEN_MS,
  GEO_BREAKER_THRESHOLD,
  GEO_CACHE_CAP,
  GEO_CACHE_TTL_MS,
  GEO_DEFAULT_LIMIT,
  GEO_MAX_LIMIT,
  normalizeQuery,
  parsePhotonResponse,
  PHOTON_LANG,
  PHOTON_PUBLIC_BASE_URL,
  type FetchLike,
} from "../src/lib/geocoding-server";

/** Veljaven Photon odgovor (GeoJSON FeatureCollection, [lng,lat]). */
function photonPayload(
  features: Array<{
    name?: string;
    countrycode?: string;
    city?: string;
    state?: string;
    county?: string;
    country?: string;
    lng: number;
    lat: number;
  }>
) {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      properties: {
        ...(f.name !== undefined ? { name: f.name } : {}),
        ...(f.countrycode !== undefined ? { countrycode: f.countrycode } : {}),
        ...(f.city !== undefined ? { city: f.city } : {}),
        ...(f.state !== undefined ? { state: f.state } : {}),
        ...(f.county !== undefined ? { county: f.county } : {}),
        ...(f.country !== undefined ? { country: f.country } : {}),
        osm_id: 1,
        osm_type: "N",
        osm_key: "historic",
        osm_value: "castle",
      },
      geometry: { type: "Point", coordinates: [f.lng, f.lat] },
    })),
  };
}

const LJ_GRAD = photonPayload([
  {
    name: "Ljubljanski grad",
    countrycode: "si",
    city: "Ljubljana",
    state: "Osrednjeslovenska",
    country: "Slovenija",
    lng: 14.5085383,
    lat: 46.0487819,
  },
]);

/** Fake fetch: vrne podani JSON (200) in šteje klice. */
function jsonFetch(payload: unknown, ok = true, status = ok ? 200 : 500) {
  let calls = 0;
  const impl = Object.assign(
    async () => {
      calls += 1;
      return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    },
    { calls: () => calls }
  );
  return impl as FetchLike & { calls: () => number };
}

/** Fake fetch, ki vedno meče (omrežna napaka). */
function throwingFetch() {
  let calls = 0;
  const impl = Object.assign(
    async () => {
      calls += 1;
      throw new Error("boom");
    },
    { calls: () => calls }
  );
  return impl as FetchLike & { calls: () => number };
}

// ── Čiste pomožne funkcije ──────────────────────────────────────────────

describe("geocoding: čiste pomožne funkcije", () => {
  test("normalizeQuery: trim, stisni presledke, lowercase", () => {
    expect(normalizeQuery("  Ljubljanski   GRAD ")).toBe("ljubljanski grad");
    expect(normalizeQuery("\tBled\t")).toBe("bled");
    expect(normalizeQuery("")).toBe("");
  });

  test("buildCacheKey: vprašanje + težišče (2 dec.) + limit", () => {
    expect(buildCacheKey("Bled", { limit: 5 })).toBe("bled#5");
    expect(buildCacheKey("  BLED ", { lat: 46.3683333, lng: 14.0944444, limit: 3 })).toBe(
      "bled@46.37,14.09#3"
    );
    // brez limit → privzeti
    expect(buildCacheKey("bled")).toBe(`bled#${GEO_DEFAULT_LIMIT}`);
  });

  test("buildPhotonUrl: q encode, lang=en (sl NI podprt — verifikacija 14.10.), bias", () => {
    const url = buildPhotonUrl(PHOTON_PUBLIC_BASE_URL, "Ljubljanski grad", 5, 46.05, 14.5);
    expect(url.startsWith(`${PHOTON_PUBLIC_BASE_URL}/api/?`)).toBe(true);
    expect(url).toContain(`lang=${PHOTON_LANG}`);
    expect(url).toContain("q=Ljubljanski+grad");
    expect(url).toContain("limit=5");
    expect(url).toContain("lat=46.05000");
    expect(url).toContain("lon=14.50000");
    // brez biasa: brez lat/lon
    const plain = buildPhotonUrl(PHOTON_PUBLIC_BASE_URL, "bled", 3);
    expect(plain).not.toContain("lat=");
    expect(plain).not.toContain("lon=");
  });

  test("konstante kanona (24 h / 600, 4 → 10 min, limit)", () => {
    expect(GEO_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(GEO_CACHE_CAP).toBe(600);
    expect(GEO_BREAKER_THRESHOLD).toBe(4);
    expect(GEO_BREAKER_OPEN_MS).toBe(10 * 60 * 1000);
    expect(GEO_DEFAULT_LIMIT).toBe(5);
    expect(GEO_MAX_LIMIT).toBe(10);
  });
});

// ── Photon parse (čist) ─────────────────────────────────────────────────

describe("geocoding: parsePhotonResponse", () => {
  test("veljaven odgovor → normalizirani zadetki (lng,lat → lat,lng; cc uppercase)", () => {
    const hits = parsePhotonResponse(LJ_GRAD);
    expect(hits).not.toBeNull();
    expect(hits?.length).toBe(1);
    const h = hits?.[0];
    expect(h?.name).toBe("Ljubljanski grad");
    expect(h?.countryCode).toBe("SI");
    expect(h?.lat).toBeCloseTo(46.0487819, 7);
    expect(h?.lng).toBeCloseTo(14.5085383, 7);
    expect(h?.city).toBe("Ljubljana");
    expect(h?.region).toBe("Osrednjeslovenska");
    expect(h?.country).toBe("Slovenija");
    expect(h?.label).toBe("Ljubljanski grad, Ljubljana, Slovenija");
    expect(h?.source).toBe("photon");
  });

  test("oznaka brez podvojenih delov (name == city)", () => {
    const hits = parsePhotonResponse(
      photonPayload([
        { name: "Bled", countrycode: "SI", city: "Bled", country: "Slovenija", lng: 14.11, lat: 46.36 },
      ])
    );
    expect(hits?.[0]?.label).toBe("Bled, Slovenija");
  });

  test("prazen FeatureCollection → [] (uspeh brez zadetkov, ne null)", () => {
    expect(parsePhotonResponse({ type: "FeatureCollection", features: [] })).toEqual([]);
  });

  test("nepravilnosti → null (nikoli ugibanj)", () => {
    expect(parsePhotonResponse(null)).toBeNull();
    expect(parsePhotonResponse("x")).toBeNull();
    expect(parsePhotonResponse({ type: "Nope" })).toBeNull();
    expect(parsePhotonResponse({ type: "FeatureCollection" })).toBeNull();
    expect(parsePhotonResponse({ type: "FeatureCollection", features: "x" })).toBeNull();
    // brez imena
    expect(
      parsePhotonResponse(photonPayload([{ countrycode: "SI", lng: 14, lat: 46 }]))
    ).toBeNull();
    // brez countrycode
    expect(parsePhotonResponse(photonPayload([{ name: "x", lng: 14, lat: 46 }]))).toBeNull();
    // napačen countrycode
    expect(
      parsePhotonResponse(photonPayload([{ name: "x", countrycode: "SLO", lng: 14, lat: 46 }]))
    ).toBeNull();
    // neveljavni koordinati
    expect(
      parsePhotonResponse(photonPayload([{ name: "x", countrycode: "SI", lng: 999, lat: 46 }]))
    ).toBeNull();
    expect(
      parsePhotonResponse(
        photonPayload([{ name: "x", countrycode: "SI", lng: Number.NaN, lat: 46 }])
      )
    ).toBeNull();
    // feature brez lastnosti
    expect(
      parsePhotonResponse({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { coordinates: [14, 46] } }],
      })
    ).toBeNull();
  });
});

// ── Geocoder: cache + breaker + iskrenost (vbrizgan fetch) ─────────────

describe("geocoding: Geocoder (cache/breaker/iskrenost)", () => {
  test("uspešen odgovor → source 'photon', cache zadetek (2. klic brez omrežja)", async () => {
    const f = jsonFetch(LJ_GRAD);
    const g = new Geocoder({ fetchImpl: f });
    const r1 = await g.search("ljubljanski grad");
    expect(r1.source).toBe("photon");
    expect(r1.hits.length).toBe(1);
    expect(f.calls()).toBe(1);
    const r2 = await g.search("ljubljanski grad");
    expect(r2.source).toBe("photon");
    expect(f.calls()).toBe(1); // iz cache
    expect(g.cacheSize()).toBe(1);
  });

  test("prazni zadetki so USPEH (brez breakerja) in se cacheirajo", async () => {
    const f = jsonFetch({ type: "FeatureCollection", features: [] });
    const g = new Geocoder({ fetchImpl: f });
    const r = await g.search("zzzqqqxxx");
    expect(r.source).toBe("photon");
    expect(r.hits).toEqual([]);
    expect(g.breakerFailures()).toBe(0);
    expect(g.cacheSize()).toBe(1);
  });

  test("HTTP napaka → source 'none', breaker šteje; 4 napake → odprt", async () => {
    const f = jsonFetch({}, false);
    const g = new Geocoder({ fetchImpl: f });
    for (let i = 0; i < GEO_BREAKER_THRESHOLD; i++) {
      const r = await g.search("bled");
      expect(r.source).toBe("none");
      expect(r.hits).toEqual([]);
    }
    expect(g.breakerOpen()).toBe(true);
    const callsAtOpen = f.calls();
    const r = await g.search("bled");
    expect(r.source).toBe("none");
    expect(f.calls()).toBe(callsAtOpen); // odprto vezje → brez omrežja
  });

  test("uspeh ponastavi breaker števec", async () => {
    let ok = false;
    let calls = 0;
    const f = (async () => {
      calls += 1;
      if (!ok) throw new Error("down");
      return new Response(JSON.stringify(LJ_GRAD), { status: 200 });
    }) as FetchLike;
    const g = new Geocoder({ fetchImpl: f });
    await g.search("bled");
    await g.search("bled");
    await g.search("bled");
    expect(g.breakerFailures()).toBe(3);
    ok = true;
    const r = await g.search("bled");
    expect(r.source).toBe("photon");
    expect(g.breakerFailures()).toBe(0);
    expect(g.breakerOpen()).toBe(false);
  });

  test("breaker se po 10 min half-open znova poskusi (vbrizgana ura)", async () => {
    let t = 1_000_000;
    const f = throwingFetch();
    const g = new Geocoder({ fetchImpl: f, now: () => t });
    for (let i = 0; i < GEO_BREAKER_THRESHOLD; i++) await g.search("bled");
    expect(g.breakerOpen()).toBe(true);
    t += GEO_BREAKER_OPEN_MS - 1;
    await g.search("bled"); // še vedno odprto
    const callsBefore = f.calls();
    t += 1; // natanko 10 min
    await g.search("bled"); // half-open: poskusi (neuspeh → znova odprto)
    expect(f.calls()).toBeGreaterThan(callsBefore);
    expect(g.breakerOpen()).toBe(true);
  });

  test("TTL: potekel cache vnos se znova pridobi (vbrizgana ura)", async () => {
    let t = 1_000_000;
    const f = jsonFetch(LJ_GRAD);
    const g = new Geocoder({ fetchImpl: f, now: () => t });
    await g.search("bled");
    expect(f.calls()).toBe(1);
    t += GEO_CACHE_TTL_MS - 1;
    await g.search("bled");
    expect(f.calls()).toBe(1); // še svež
    t += 1;
    await g.search("bled");
    expect(f.calls()).toBe(2); // potekel
  });

  test("LRU cap: najstarejši vnos pade ven", async () => {
    const f = jsonFetch(LJ_GRAD);
    const g = new Geocoder({ fetchImpl: f, cacheCap: 2 });
    await g.search("aa");
    await g.search("bb");
    await g.search("cc"); // "aa" pade ven
    expect(g.cacheSize()).toBe(2);
    await g.search("aa");
    expect(f.calls()).toBe(4); // "aa" je moral znova na omrežje
  });

  test("prekrajšo vprašanje NE gre na omrežje (fair-use kanon)", async () => {
    const f = jsonFetch(LJ_GRAD);
    const g = new Geocoder({ fetchImpl: f });
    const r = await g.search("b");
    expect(r.source).toBe("none");
    expect(f.calls()).toBe(0);
  });

  test("različna vprašanja → različni cache vnosi; limit vpliva na ključ", async () => {
    const f = jsonFetch(LJ_GRAD);
    const g = new Geocoder({ fetchImpl: f });
    await g.search("bled", { limit: 5 });
    await g.search("bled", { limit: 5 });
    expect(f.calls()).toBe(1);
    await g.search("bled", { limit: 3 });
    expect(f.calls()).toBe(2);
    await g.search("bled", { lat: 46.36, lng: 14.09, limit: 5 });
    expect(f.calls()).toBe(3);
  });
});

// ── Struktura API rute /api/geocode (SOURCE-CONTRACT kanon hiše) ──────

describe("geocoding: struktura /api/geocode rute", () => {
  test("ruta je GET-only, force-dynamic, brez CSP novih hostov (strežniški klic)", async () => {
    const src = await Bun.file("src/app/api/geocode/route.ts").text();
    expect(src).toContain("export const dynamic = \"force-dynamic\"");
    expect(src).toContain("export async function GET");
    expect(src).not.toContain("export async function POST");
    expect(src).toContain("rateLimited(request, 30)");
    expect(src).toContain("searchPlaces");
  });
});
