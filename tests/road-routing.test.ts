/**
 * ROAD-ROUTING — OSRM odjemalec (src/lib/road-routing-server.ts) BREZ
 * pravega omrežja: vbrizgljan fetch/ura/timeout (kanon testne hiše).
 *
 * Iskrenostne invariante: hevristika (haversine ×1,3 @ ~55 km/h) je VEDNO
 * označena source "heuristic" (nikoli "osrm"); NaN/negativne vrednosti in
 * prazne poti so neuspeh; circuit breaker 4 zaporedne napake → odprt 10 min;
 * cache 24 h / 600 (LRU); geometrija se redči na ~400 točk (ista pot).
 */

import { describe, expect, test } from "bun:test";

import {
  BREAKER_OPEN_MS,
  BREAKER_THRESHOLD,
  buildCacheKey,
  CACHE_CAP,
  CACHE_TTL_MS,
  CircuitBreaker,
  formatCoordKey,
  GEOMETRY_CAP,
  heuristicLeg,
  haversineKmLocal,
  OSRM_TIMEOUT_MS,
  parseOsrmResponse,
  RoadRouter,
  roundTo1,
  sampleGeometry,
} from "../src/lib/road-routing-server";

const LJ = { lat: 46.0569, lng: 14.5058 };
const BLED = { lat: 46.3683, lng: 14.0944 };

/** Veljaven OSRM odgovor (route/v1/driving …?overview=full&geometries=geojson). */
function osrmPayload(
  distanceM: number,
  durationS: number,
  coordinates: [number, number][]
) {
  return {
    code: "Ok",
    routes: [
      { distance: distanceM, duration: durationS, geometry: { coordinates } },
    ],
  };
}

/** Uspešen primer: Ljubljana → Bled, ~76,9 km / ~91 min, 3 točke [lng,lat]. */
const VALID_OSRM = osrmPayload(76900, 5460, [
  [14.5058, 46.0569],
  [14.4, 46.2],
  [14.0944, 46.3683],
]);

/** Fake fetch: vrne podani JSON (200) in šteje klice. */
function jsonFetch(payload: unknown, ok = true) {
  let calls = 0;
  const impl = (async () => {
    calls += 1;
    return new Response(JSON.stringify(payload), {
      status: ok ? 200 : 500,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { impl, calls: () => calls };
}

/** Fake fetch: vedno meče (omrežje padlo). */
function failingFetch() {
  let calls = 0;
  const impl = (async () => {
    calls += 1;
    throw new Error("network down");
  }) as typeof fetch;
  return { impl, calls: () => calls };
}

/** Fake fetch: obljubi, a se nikoli ne razreši — zavrne šele ob preklicu. */
function hangingFetch() {
  let calls = 0;
  const impl = ((_url: unknown, init?: RequestInit) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new Error("AbortError"))
      );
    });
  }) as unknown as typeof fetch;
  return { impl, calls: () => calls };
}

describe("road-routing: haversine in hevristika", () => {
  test("haversine Ljubljana→Bled ≈ 40–50 km, simetrično, 0 za isto točko", () => {
    const d = haversineKmLocal(LJ, BLED);
    expect(d).toBeGreaterThan(40);
    expect(d).toBeLessThan(50);
    expect(haversineKmLocal(BLED, LJ)).toBeCloseTo(d, 8);
    expect(haversineKmLocal(LJ, LJ)).toBe(0);
  });

  test("hevristika: source heuristic, km = round1(hav×1,3), min = round(km×60/55), premica 2 točki", () => {
    const leg = heuristicLeg(LJ, BLED);
    expect(leg.source).toBe("heuristic");
    expect(leg.km).toBe(roundTo1(haversineKmLocal(LJ, BLED) * 1.3));
    expect(leg.km).toBeGreaterThan(50); // ~60 km cestne ocene
    expect(leg.min).toBe(Math.round((leg.km * 60) / 55));
    expect(leg.geometry).toEqual([
      [LJ.lat, LJ.lng],
      [BLED.lat, BLED.lng],
    ]);
  });
});

describe("road-routing: ključ cache", () => {
  test("zaokrožitev na 4 decimalke → enak ključ; -0,0000 normalizirano", () => {
    expect(formatCoordKey(-0.00001)).toBe("0.0000");
    expect(formatCoordKey(46.123456)).toBe("46.1235");
    const a = buildCacheKey(
      { lat: 46.123456, lng: 14.100001 },
      { lat: 46.2, lng: 14.3 }
    );
    const b = buildCacheKey(
      { lat: 46.123499, lng: 14.100004 },
      { lat: 46.2, lng: 14.3 }
    );
    expect(a).toBe(b);
  });

  test("smer ima pomen (from→to ≠ to→from)", () => {
    expect(buildCacheKey(LJ, BLED)).not.toBe(buildCacheKey(BLED, LJ));
  });
});

describe("road-routing: parseOsrmResponse", () => {
  test("uspeh: km/min zaokroženi, [lng,lat] → [lat,lng]", () => {
    const leg = parseOsrmResponse(VALID_OSRM);
    expect(leg).not.toBeNull();
    expect(leg?.source).toBe("osrm");
    expect(leg?.km).toBe(76.9); // 76.900 m → 76,9 km
    expect(leg?.min).toBe(91); // 5.460 s → 91 min
    expect(leg?.geometry).toEqual([
      [46.0569, 14.5058],
      [46.2, 14.4],
      [46.3683, 14.0944],
    ]);
  });

  test("redčenje geometrije > 400 točk (ista pot, manjša ločljivost)", () => {
    const coords: [number, number][] = Array.from({ length: 1000 }, (_, i) => [
      i / 1000, // lng 0 … 0,999
      45, // lat
    ]);
    const leg = parseOsrmResponse(osrmPayload(50000, 3600, coords));
    expect(leg).not.toBeNull();
    expect(leg?.geometry.length).toBeLessThanOrEqual(GEOMETRY_CAP + 1);
    expect(leg?.geometry.length).toBeGreaterThanOrEqual(300); // resnično redčeno
    expect(leg?.geometry[0]).toEqual([45, 0]); // prva točka ohranjena
    expect(leg?.geometry[leg!.geometry.length - 1]).toEqual([45, 0.999]); // zadnja
    // Neposredno: cap spo tudi pri 401 točkah
    const many: [number, number][] = Array.from({ length: 401 }, (_, i) => [
      i,
      46,
    ]);
    expect(sampleGeometry(many, 400).length).toBeLessThanOrEqual(
      GEOMETRY_CAP + 1
    );
  });

  test("NaN/negativna varovalka: distance NaN, duration negativna → null", () => {
    expect(
      parseOsrmResponse(osrmPayload(Number.NaN, 600, [[14, 46], [14.1, 46.1]]))
    ).toBeNull();
    expect(
      parseOsrmResponse(osrmPayload(-5, 600, [[14, 46], [14.1, 46.1]]))
    ).toBeNull();
    expect(
      parseOsrmResponse(osrmPayload(1000, Number.NaN, [[14, 46], [14.1, 46.1]]))
    ).toBeNull();
    expect(
      parseOsrmResponse(osrmPayload(1000, -60, [[14, 46], [14.1, 46.1]]))
    ).toBeNull();
  });

  test("prazne poti / napačna koda / pokvarjena geometrija → null", () => {
    expect(parseOsrmResponse({ code: "Ok", routes: [] })).toBeNull();
    expect(parseOsrmResponse({ code: "NoRoute", routes: [{}] })).toBeNull();
    expect(parseOsrmResponse(osrmPayload(1000, 60, [[14, 46]]))).toBeNull(); // 1 točka
    expect(parseOsrmResponse(osrmPayload(1000, 60, []))).toBeNull();
    expect(
      parseOsrmResponse(
        osrmPayload(1000, 60, [
          ["a", "b"],
          [1, 2],
        ] as unknown as [number, number][])
      )
    ).toBeNull(); // ne-številke
    expect(
      parseOsrmResponse({
        code: "Ok",
        routes: [{ distance: 1000, duration: 60 }], // geometrija manjka
      })
    ).toBeNull();
    expect(parseOsrmResponse(null)).toBeNull();
    expect(parseOsrmResponse("not-an-object")).toBeNull();
  });
});

describe("road-routing: circuit breaker (vbrizgljiva ura)", () => {
  test("kanon izvirnika: prag 4, odprt 10 min, cache 24 h / 600, timeout 8 s", () => {
    expect(BREAKER_THRESHOLD).toBe(4);
    expect(BREAKER_OPEN_MS).toBe(10 * 60 * 1000);
    expect(CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(CACHE_CAP).toBe(600);
    expect(OSRM_TIMEOUT_MS).toBe(8000);
  });

  test("4 zaporedne napake odprejo vezje za 10 min", () => {
    let t = 0;
    const br = new CircuitBreaker(() => t);
    br.recordFailure();
    br.recordFailure();
    br.recordFailure();
    expect(br.isOpen()).toBe(false); // 3 < 4
    br.recordFailure(); // 4. → odpri ob t=0
    expect(br.isOpen()).toBe(true);
    t = 9 * 60 * 1000;
    expect(br.isOpen()).toBe(true); // še odprto
    t = 10 * 60 * 1000;
    expect(br.isOpen()).toBe(false); // poteklo → half-open
  });

  test("neuspeh v half-open znova odpre; uspeh ponastavi števec", () => {
    let t = 0;
    const br = new CircuitBreaker(() => t);
    for (let i = 0; i < 4; i++) br.recordFailure();
    expect(br.isOpen()).toBe(true);
    t = 10 * 60 * 1000; // half-open
    br.recordFailure(); // ponovni poskus je padel → znova odpri od zdaj
    expect(br.isOpen()).toBe(true);
    expect(br.failureCount).toBe(5);
    t = 15 * 60 * 1000; // 5 min od ponovnega odprtja
    expect(br.isOpen()).toBe(true);
    t = 20 * 60 * 1000; // poteklo
    br.recordSuccess();
    expect(br.isOpen()).toBe(false);
    expect(br.failureCount).toBe(0);
  });
});

describe("road-routing: RoadRouter (vbrizgljan fetch — brez omrežja)", () => {
  test("uspešen OSRM klic; ponovni klic istih koordinat streže iz cacheja (fetch 1×)", async () => {
    const f = jsonFetch(VALID_OSRM);
    const router = new RoadRouter({ fetchImpl: f.impl });
    const first = await router.routeLeg(LJ, BLED);
    expect(first.source).toBe("osrm");
    expect(first.km).toBe(76.9);
    expect(first.min).toBe(91);
    const second = await router.routeLeg(LJ, BLED);
    expect(second).toEqual(first);
    expect(f.calls()).toBe(1); // drugi klic NI šel na omrežje
    expect(router.cacheSize()).toBe(1);
  });

  test("cache poteče po 24 h (TTL) → ponoven klic na OSRM", async () => {
    let t = 0;
    const f = jsonFetch(VALID_OSRM);
    const router = new RoadRouter({ fetchImpl: f.impl, now: () => t });
    await router.routeLeg(LJ, BLED);
    t = 23 * 60 * 60 * 1000; // 23 h — še veljavno
    await router.routeLeg(LJ, BLED);
    expect(f.calls()).toBe(1);
    t = 25 * 60 * 60 * 1000; // 25 h — poteklo
    await router.routeLeg(LJ, BLED);
    expect(f.calls()).toBe(2);
  });

  test("LRU izpodrivanje: cap 3 → najstarejši vnos izpadel in se ponovno pridobi", async () => {
    const f = jsonFetch(VALID_OSRM);
    const router = new RoadRouter({ fetchImpl: f.impl, cacheCap: 3 });
    const pairs = [
      [{ lat: 40, lng: 14 }, { lat: 40.1, lng: 14.1 }],
      [{ lat: 41, lng: 15 }, { lat: 41.1, lng: 15.1 }],
      [{ lat: 42, lng: 16 }, { lat: 42.1, lng: 16.1 }],
      [{ lat: 43, lng: 17 }, { lat: 43.1, lng: 17.1 }],
    ] as const;
    for (const [a, b] of pairs) {
      await router.routeLeg(a, b);
    }
    expect(f.calls()).toBe(4);
    expect(router.cacheSize()).toBe(3); // prvi vnos izpadel
    await router.routeLeg(pairs[0][0], pairs[0][1]); // cache miss → fetch
    expect(f.calls()).toBe(5);
  });

  test("4 neuspehi odprejo vezje → 5. klic BREZ omrežja → hevristika", async () => {
    const f = failingFetch();
    const router = new RoadRouter({ fetchImpl: f.impl });
    for (let i = 0; i < 4; i++) {
      const leg = await router.routeLeg(LJ, BLED);
      expect(leg.source).toBe("heuristic"); // odkrita zasilna ocena
      expect(leg.km).toBe(roundTo1(haversineKmLocal(LJ, BLED) * 1.3));
    }
    expect(f.calls()).toBe(4);
    expect(router.breakerOpen()).toBe(true);
    const fifth = await router.routeLeg(LJ, BLED);
    expect(f.calls()).toBe(4); // vezje odprto → NO ČE omrežja
    expect(fifth.source).toBe("heuristic");
    expect(router.cacheSize()).toBe(0); // hevristika se ne cacha
  });

  test("uspeh ponastavi vezje (3 napake → uspeh → 3 napake: nikoli odprto)", async () => {
    let fail = true;
    let calls = 0;
    const impl = (async () => {
      calls += 1;
      if (fail) throw new Error("down");
      return new Response(JSON.stringify(VALID_OSRM), {
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const router = new RoadRouter({ fetchImpl: impl });

    for (let i = 0; i < 3; i++) await router.routeLeg(LJ, BLED);
    expect(router.breakerOpen()).toBe(false); // 3 < 4

    fail = false;
    const ok = await router.routeLeg(LJ, BLED);
    expect(ok.source).toBe("osrm"); // ponastavitev števca

    fail = true;
    // RAZLIČNE točke (uspešni odsek je v cacheju → ne bi šel na omrežje)
    for (let i = 0; i < 3; i++) {
      const leg = await router.routeLeg(
        { lat: 45 + i, lng: 13 },
        { lat: 45.1 + i, lng: 13.1 }
      );
      expect(leg.source).toBe("heuristic");
    }
    expect(router.breakerOpen()).toBe(false); // števec teče znova od 0
    expect(calls).toBe(7); // vezje NI blokiralo nobenega klica
  });

  test("hevristika se ne cacha in NIKOLI ni označena kot osrm", async () => {
    const f = failingFetch();
    const router = new RoadRouter({ fetchImpl: f.impl });
    const a = await router.routeLeg(LJ, BLED);
    const b = await router.routeLeg(LJ, BLED); // pod pragom → spet poskusi OSRM
    expect(f.calls()).toBe(2); // ni cacheja za hevristiko
    expect(a.source).toBe("heuristic");
    expect(b.source).toBe("heuristic");
    expect(router.cacheSize()).toBe(0);
  });

  test("timeout (vbrizgljiv) prekine obesi se klic → hevristika", async () => {
    const f = hangingFetch();
    const router = new RoadRouter({ fetchImpl: f.impl, timeoutMs: 20 });
    const leg = await router.routeLeg(LJ, BLED);
    expect(f.calls()).toBe(1);
    expect(leg.source).toBe("heuristic");
    expect(leg.geometry).toEqual([
      [LJ.lat, LJ.lng],
      [BLED.lat, BLED.lng],
    ]);
  });
});
