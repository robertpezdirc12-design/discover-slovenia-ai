/**
 * ROAD-ROUTING — Valhalla odjemalec (src/lib/road-routing-server.ts, #35
 * faza 2 PoC 2.65.0) BREZ pravega omrežja: vbrizgljan fetch/ura/timeout
 * (kanon testne hiše).
 *
 * Iskrenostne invariante: hevristika (haversine ×1,3 @ ~55 km/h) je VEDNO
 * označena source "heuristic" (nikoli "valhalla"); NaN/negativne vrednosti
 * in prazne/pokvarjene poti so neuspeh; circuit breaker 4 zaporedne napake
 * → odprt 10 min; cache 24 h / 600 (LRU); geometrija se redči na ~400
 * točk (ista pot).
 */

import { describe, expect, test } from "bun:test";

import {
  BREAKER_OPEN_MS,
  BREAKER_THRESHOLD,
  buildCacheKey,
  buildValhallaUrl,
  CACHE_CAP,
  CACHE_TTL_MS,
  CircuitBreaker,
  decodePolyline6,
  formatCoordKey,
  GEOMETRY_CAP,
  heuristicLeg,
  haversineKmLocal,
  VALHALLA_BASE_URL,
  VALHALLA_PUBLIC_BASE_URL,
  VALHALLA_TIMEOUT_MS,
  parseValhallaResponse,
  RoadRouter,
  roundTo1,
  sampleGeometry,
  type FetchLike,
} from "../src/lib/road-routing-server";

const LJ = { lat: 46.0569, lng: 14.5058 };
const BLED = { lat: 46.3683, lng: 14.0944 };

// ── polyline6 kodirnik (testni dvojček decodePolyline6) ────────────────

function zigzag(n: number): number {
  return n < 0 ? -n * 2 - 1 : n * 2;
}

/** Kodira [lat, lng] pare v Encoded Polyline (natančnost 1e6). */
function encodePolyline6(coords: [number, number][]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = "";
  const chunk = (v: number): void => {
    let x = zigzag(v);
    while (x >= 0x20) {
      out += String.fromCharCode((0x20 | (x & 0x1f)) + 63);
      x >>= 5;
    }
    out += String.fromCharCode(x + 63);
  };
  for (const [lat, lng] of coords) {
    const la = Math.round(lat * 1e6);
    const lo = Math.round(lng * 1e6);
    chunk(la - lastLat);
    chunk(lo - lastLng);
    lastLat = la;
    lastLng = lo;
  }
  return out;
}

/** Veljaven Valhalla odgovor (native trip, 1 noga = 2 lokaciji). */
function valhallaPayload(
  lengthKm: number,
  timeS: number,
  coords: [number, number][]
) {
  return {
    trip: {
      status: 0,
      status_message: "Found route between points",
      units: "kilometers",
      legs: [
        { summary: { length: lengthKm, time: timeS }, shape: encodePolyline6(coords) },
      ],
      summary: { length: lengthKm, time: timeS },
    },
  };
}

/** Uspešen primer: Ljubljana → Bled, ~76,9 km / ~91 min, 3 točke [lat,lng]. */
const VALID_VALHALLA = valhallaPayload(76.9, 5460, [
  [46.0569, 14.5058],
  [46.2, 14.4],
  [46.3683, 14.0944],
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
  }) as FetchLike;
  return { impl, calls: () => calls };
}

/** Fake fetch: vedno meče (omrežje padlo). */
function failingFetch() {
  let calls = 0;
  const impl = (async () => {
    calls += 1;
    throw new Error("network down");
  }) as FetchLike;
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
  }) as unknown as FetchLike;
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

describe("road-routing: Valhalla URL in polyline6", () => {
  test("buildValhallaUrl: base + /route?json= z locations [lat,lon], costing auto, polyline6, kilometers", () => {
    const url = buildValhallaUrl("https://x.example", LJ, BLED);
    expect(url.startsWith("https://x.example/route?json=")).toBe(true);
    const json = JSON.parse(
      decodeURIComponent(url.split("json=")[1] as string)
    ) as {
      locations: { lat: number; lon: number }[];
      costing: string;
      shape_format: string;
      units: string;
    };
    expect(json.locations).toEqual([
      { lat: LJ.lat, lon: LJ.lng },
      { lat: BLED.lat, lon: BLED.lng },
    ]);
    expect(json.costing).toBe("auto");
    expect(json.shape_format).toBe("polyline6");
    expect(json.units).toBe("kilometers"); // privzeta enota je MILJA — obvezno
  });

  test("decodePolyline6: kodiranje ↔ dekodiranje je identiteta (lat, lng vrstni red)", () => {
    const pts: [number, number][] = [
      [46.0569, 14.5058],
      [46.2, 14.4],
      [46.3683, 14.0944],
      [45.5, -13.25], // negativna delta (zigzag)
    ];
    expect(decodePolyline6(encodePolyline6(pts))).toEqual(pts);
  });

  test("decodePolyline6: prazen/prekratez/pokvarjen zapis → null (ne ugibamo)", () => {
    expect(decodePolyline6("")).toBeNull();
    expect(decodePolyline6("??")).toBeNull(); // koda pod 63
    expect(
      decodePolyline6("_p~iF") // 1 točka, prekinjeno
    ).toBeNull();
    // Prekinjen zapis (nepopoln par) → null
    expect(decodePolyline6("c{a")).toBeNull();
  });

  test("privzeti BASE je javni FOSSGIS primerek (BJS); override gre prek env", () => {
    expect(VALHALLA_PUBLIC_BASE_URL).toBe(
      "https://valhalla1.openstreetmap.de"
    );
    // Brez env spremenljivke se razreši na javni primerek.
    expect(VALHALLA_BASE_URL).toBe(VALHALLA_PUBLIC_BASE_URL);
  });
});

describe("road-routing: parseValhallaResponse", () => {
  test("uspeh: km/min zaokroženi, shape dekodiran v [lat,lng]", () => {
    const leg = parseValhallaResponse(VALID_VALHALLA);
    expect(leg).not.toBeNull();
    expect(leg?.source).toBe("valhalla");
    expect(leg?.km).toBe(76.9); // summary.length 76,9 km
    expect(leg?.min).toBe(91); // 5.460 s → 91 min
    expect(leg?.geometry).toEqual([
      [46.0569, 14.5058],
      [46.2, 14.4],
      [46.3683, 14.0944],
    ]);
  });

  test("redčenje geometrije > 400 točk (ista pot, manjša ločljivost)", () => {
    const coords: [number, number][] = Array.from({ length: 1000 }, (_, i) => [
      45, // lat
      i / 1000, // lng 0 … 0,999
    ]);
    const leg = parseValhallaResponse(valhallaPayload(50, 3600, coords));
    expect(leg).not.toBeNull();
    expect(leg?.geometry.length).toBeLessThanOrEqual(GEOMETRY_CAP + 1);
    expect(leg?.geometry.length).toBeGreaterThanOrEqual(300); // resnično redčeno
    expect(leg?.geometry[0]).toEqual([45, 0]); // prva točka ohranjena
    expect(leg?.geometry[leg!.geometry.length - 1]).toEqual([45, 0.999]); // zadnja
    // Neposredno: cap spo tudi pri 401 točkah
    const many: [number, number][] = Array.from({ length: 401 }, (_, i) => [
      46,
      i,
    ]);
    expect(sampleGeometry(many, 400).length).toBeLessThanOrEqual(
      GEOMETRY_CAP + 1
    );
  });

  test("NaN/negativna varovalka: length NaN, time negativna → null", () => {
    const c: [number, number][] = [
      [46, 14],
      [46.1, 14.1],
    ];
    expect(
      parseValhallaResponse(valhallaPayload(Number.NaN, 600, c))
    ).toBeNull();
    expect(parseValhallaResponse(valhallaPayload(-5, 600, c))).toBeNull();
    expect(
      parseValhallaResponse(valhallaPayload(10, Number.NaN, c))
    ).toBeNull();
    expect(parseValhallaResponse(valhallaPayload(10, -60, c))).toBeNull();
  });

  test("slab status / prazne noge / pokvarjen shape → null", () => {
    const c: [number, number][] = [
      [46, 14],
      [46.1, 14.1],
    ];
    expect(
      parseValhallaResponse({ trip: { status: 1, legs: [{}] } })
    ).toBeNull(); // status ≠ 0 (NoRoute)
    expect(parseValhallaResponse({ trip: { status: 0, legs: [] } })).toBeNull();
    expect(
      parseValhallaResponse({
        trip: { status: 0, legs: [{ summary: { length: 1, time: 60 } }] },
      })
    ).toBeNull(); // shape manjka
    expect(
      parseValhallaResponse(
        valhallaPayload(10, 60, [] as [number, number][])
      )
    ).toBeNull(); // prazen shape
    expect(parseValhallaResponse(null)).toBeNull();
    expect(parseValhallaResponse("not-an-object")).toBeNull();
    expect(parseValhallaResponse({ nope: true })).toBeNull();
  });
});

describe("road-routing: circuit breaker (vbrizgljiva ura)", () => {
  test("kanon izvirnika: prag 4, odprt 10 min, cache 24 h / 600, timeout 8 s", () => {
    expect(BREAKER_THRESHOLD).toBe(4);
    expect(BREAKER_OPEN_MS).toBe(10 * 60 * 1000);
    expect(CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(CACHE_CAP).toBe(600);
    expect(VALHALLA_TIMEOUT_MS).toBe(8000);
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
  test("uspešen Valhalla klic; ponovni klic istih koordinat streže iz cacheja (fetch 1×)", async () => {
    const f = jsonFetch(VALID_VALHALLA);
    const router = new RoadRouter({ fetchImpl: f.impl });
    const first = await router.routeLeg(LJ, BLED);
    expect(first.source).toBe("valhalla");
    expect(first.km).toBe(76.9);
    expect(first.min).toBe(91);
    const second = await router.routeLeg(LJ, BLED);
    expect(second).toEqual(first);
    expect(f.calls()).toBe(1); // drugi klic NI šel na omrežje
    expect(router.cacheSize()).toBe(1);
  });

  test("cache poteče po 24 h (TTL) → ponoven klic na Valhalla", async () => {
    let t = 0;
    const f = jsonFetch(VALID_VALHALLA);
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
    const f = jsonFetch(VALID_VALHALLA);
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
      return new Response(JSON.stringify(VALID_VALHALLA), {
        headers: { "content-type": "application/json" },
      });
    }) as FetchLike;
    const router = new RoadRouter({ fetchImpl: impl });

    for (let i = 0; i < 3; i++) await router.routeLeg(LJ, BLED);
    expect(router.breakerOpen()).toBe(false); // 3 < 4

    fail = false;
    const ok = await router.routeLeg(LJ, BLED);
    expect(ok.source).toBe("valhalla"); // ponastavitev števca

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

  test("hevristika se ne cacha in NIKOLI ni označena kot valhalla", async () => {
    const f = failingFetch();
    const router = new RoadRouter({ fetchImpl: f.impl });
    const a = await router.routeLeg(LJ, BLED);
    const b = await router.routeLeg(LJ, BLED); // pod pragom → spet poskusi Valhalla
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
