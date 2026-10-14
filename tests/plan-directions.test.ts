import { afterEach, describe, expect, test } from "bun:test";

import * as routeModule from "@/app/api/plan/directions/route";
import { POST } from "@/app/api/plan/directions/route";

/**
 * PLAN-DIRECTIONS (POLIR3 A, 2.30.0; POLIR5 A, 2.32.0; #35 faza 2, 2.65.0)
 * — enotski preizkusi strežniškega proxyja /api/plan/directions Z MAKETO
 * globalnega fetch (0 omrežja: noben preizkus ne gre na internet; vir je
 * zdaj JAVNI VALHALLA primerek FOSSGIS — prej OSRM demo; fixture-ji so
 * native trip odgovori te oblike: trip.status 0, legs[…].summary
 * {length km, time s}, legs[…].shape = Encoded Polyline 1e6).
 *
 * Kanoni (vzorec start-anywhere + go-offline maketa fetch):
 *  - validacija fail-closed 400 (dnevi/točke/števila/bbox registra);
 *  - geometrija = dekodirani leg-shape-i [lat, lon], staknjeni brez
 *    podvojenih mejnih točk (Leaflet vrstni red ŽE ustreza);
 *  - predpomnilnik po zaokroženih koordinatah (2. klic NE kliče fetch);
 *  - fail-closed PO DNEVIH (padec enega dneva ne podre ostalih);
 *  - TimeoutError → iskren status "straight";
 *  - oblika odgovora { source, days } + omejitev 60/min po odjemalcu;
 *  - POLIR5 A: IZMERJENI distanceM/durationS iz ISTEGA trip.summary —
 *    aditivni poli, veljavno le kot celo število ≥ 0; negativna/nekončna/
 *    manjkajoča vrednost → fail-closed "straight" ZA TISTI dan (in dan se
 *    NE predpomni); predpomnilnik hrani VSE TROJE (geometry, distanceM,
 *    durationS) pod istim ključem.
 *
 * 0 AI, 0 omrežja, determinizem (vsak preizkus ima svoj XFF in svoje
 * koordinate dneva, da predpomnilnik med preizkusi ne pušča sledi).
 */

const ROUTE_SRC = "src/app/api/plan/directions/route.ts";

// ── maketa fetch (0 omrežja — vzorec tests/go-offline.test.ts) ────────────

const realFetch = globalThis.fetch;

/** Vsi klici makete (URL + init) — štejejo se za preizkus predpomnilnika. */
let fetchCalls: { url: string; init?: RequestInit }[] = [];

afterEach(() => {
  globalThis.fetch = realFetch;
  fetchCalls = [];
});

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ── Encoded Polyline 1e6 kodirnik (testni dvojček decodePolyline6) ────────

function zigzag(n: number): number {
  return n < 0 ? -n * 2 - 1 : n * 2;
}

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

/**
 * Valhalla odgovor ob uspehu (native trip). POLIR5 A: privzeti length/time
 * sta ŽIVI ujeti vrednosti (preizkus B: Bled→Vintgar→Bohinj = 21,551 km /
 * 2173 s) — proxy zdaj iz ISTEGA trip.summary bere ves trojček.
 * `legs` > 1 razdeli shape na več nog (Valhalla za več lokacij vrača nogo
 * na lokacijo; nogi si delita mejno točko — proxy jo stakne brez dvojnikov).
 */
function valhallaOk(
  coordsLonLat: [number, number][],
  lengthKm: number = 21.551,
  timeS: number = 2_173,
  legs: number = 1
): unknown {
  const pts = coordsLonLat.map(
    ([lon, lat]) => [lat, lon] as [number, number]
  );
  const shapes: string[] = [];
  if (legs === 1) {
    shapes.push(encodePolyline6(pts));
  } else {
    const cut = Math.round(pts.length / legs);
    for (let i = 0; i < legs; i++) {
      const start = Math.max(0, i * cut - (i > 0 ? 1 : 0));
      const end = i === legs - 1 ? pts.length : (i + 1) * cut;
      shapes.push(encodePolyline6(pts.slice(start, end)));
    }
  }
  return {
    trip: {
      status: 0,
      status_message: "Found route between points",
      units: "kilometers",
      legs: shapes.map((shape) => ({
        summary: { length: lengthKm / legs, time: timeS / legs },
        shape,
      })),
      summary: { length: lengthKm, time: timeS },
    },
  };
}

/** Namesti maketo fetch (celotna zamenjava — noben klic ne gre v omrežje). */
function mockFetch(
  handler: (url: string) => Response | Promise<Response>
): void {
  globalThis.fetch = ((
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    fetchCalls.push({ url, init });
    return Promise.resolve(handler(url));
  }) as typeof fetch;
}

/** Maketa, ki za VSE klice vrže (timeout / brez povezave). */
function mockFetchThrow(): void {
  globalThis.fetch = ((): Promise<Response> => {
    throw new Error(
      "TimeoutError: The operation was aborted due to timeout"
    );
  }) as unknown as typeof fetch;
}

// ── pomoči zahtev (XFF edinstven po preizkusu — izolacija omejitve) ───────

function drPost(body: unknown, xff: string): Promise<Response> {
  return POST(
    new Request("http://x/api/plan/directions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": xff,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

// ── koordinate registra (slovenia-data.ts) — [lon, lat] (vhodni vrstni red) ─

const BLED: [number, number] = [14.0944, 46.3683];
const VINTGAR: [number, number] = [14.1167, 46.4];
const BOHINJ: [number, number] = [13.8833, 46.2833];
const LJ: [number, number] = [14.5058, 46.0569];
const MARIBOR: [number, number] = [15.6466, 46.5565];
const CELJE: [number, number] = [15.2674, 46.2309];
const PTUJ: [number, number] = [15.8772, 46.4198];
const PIRAN: [number, number] = [13.5729, 45.5296];
const KOPER: [number, number] = [13.7294, 45.5467];

/** Pričakovan URL Valhalla (isti graditelj kot resolveDay). */
const VALHALLA_URL = (points: [number, number][]): string =>
  "https://valhalla1.openstreetmap.de/route?json=" +
  encodeURIComponent(
    JSON.stringify({
      locations: points.map(([lon, lat]) => ({ lat, lon, type: "break" })),
      costing: "auto",
      shape_format: "polyline6",
      units: "kilometers",
    })
  );

// ── FIXTURE: odgovori v native Valhalla obliki (koordinate registra)

/** Bled→Ljubljana: 20 točk [lon, lat] (1 noga, 56,6 km). */
const FIXTURE_BLED_LJ: [number, number][] = [
  [14.095853, 46.370582], [14.107016, 46.376902], [14.122074, 46.366684],
  [14.134056, 46.368126], [14.149838, 46.36351], [14.16068, 46.367562],
  [14.203798, 46.331163], [14.251804, 46.315017], [14.277685, 46.310616],
  [14.292518, 46.281542], [14.379998, 46.256143], [14.405352, 46.236175],
  [14.462416, 46.203376], [14.481323, 46.186588], [14.486178, 46.17374],
  [14.475956, 46.145454], [14.481764, 46.124656], [14.463521, 46.097707],
  [14.496434, 46.061203], [14.5058, 46.056898],
];

/**
 * Več-točkovni dan Bled;Vintgar;Bohinj: 66 točk [lon, lat] (37,6 km) —
 * EN zahtevek pokrije celoten dan (raziskava POLIR3: „legs: 2" — fixture
 * ima 2 nogi z deljeno mejno točko, proxy jih stakne nazaj v 66).
 */
const FIXTURE_BVG_BOHINJ: [number, number][] = [
  [14.095853, 46.370582], [14.100674, 46.37247], [14.098192, 46.373192],
  [14.097481, 46.374496], [14.104039, 46.37669], [14.108273, 46.380778],
  [14.10786, 46.38823], [14.110883, 46.3886], [14.11487, 46.391802],
  [14.113921, 46.394411], [14.117096, 46.396793], [14.117878, 46.398837],
  [14.116697, 46.399824], [14.111539, 46.400218], [14.116648, 46.399831],
  [14.117947, 46.398427], [14.113921, 46.394411], [14.11487, 46.391802],
  [14.110883, 46.3886], [14.10786, 46.38823], [14.108367, 46.38098],
  [14.104039, 46.37669], [14.110774, 46.375837], [14.116508, 46.36867],
  [14.108566, 46.366758], [14.106759, 46.364799], [14.09932, 46.362303],
  [14.099205, 46.359823], [14.072986, 46.34986], [14.070207, 46.346793],
  [14.066957, 46.345327], [14.058737, 46.323], [14.063141, 46.315063],
  [14.063431, 46.310638], [14.061538, 46.305684], [14.057661, 46.303958],
  [14.048067, 46.303251], [14.038926, 46.299051], [14.036389, 46.29715],
  [14.03371, 46.29154], [14.029028, 46.2883], [14.02032, 46.284897],
  [14.014019, 46.288092], [14.007371, 46.289281], [13.981787, 46.288004],
  [13.976677, 46.286703], [13.969633, 46.281848], [13.962137, 46.283305],
  [13.953986, 46.281779], [13.9528, 46.278501], [13.950321, 46.27702],
  [13.952542, 46.272635], [13.95021, 46.273522], [13.940939, 46.272767],
  [13.937889, 46.273711], [13.930799, 46.271616], [13.924895, 46.27355],
  [13.917008, 46.272037], [13.913156, 46.270281], [13.912501, 46.268553],
  [13.905394, 46.267514], [13.898003, 46.268846], [13.895081, 46.272851],
  [13.886396, 46.277817], [13.886216, 46.281653], [13.88333, 46.282459],
];

/** Pričakovana geometrija fixture v vrstnem redu [lat, lon] (Leaflet). */
const toLatLng = (pts: [number, number][]): [number, number][] =>
  pts.map(([lon, lat]) => [lat, lon]);

// ── VALIDACIJA (fail-closed 400) ──────────────────────────────────────────

describe("PLAN-DIRECTIONS — validacija telesa (fail-closed 400)", () => {
  test("① neveljavna telesa → 400 (različne oblike; 0 klicev fetch)", async () => {
    mockFetch(() => jsonRes(200, valhallaOk(FIXTURE_BLED_LJ)));
    const invalid: unknown[] = [
      "neveljaven json {{{", // JSON sintaksa
      null, // brez objekta
      {}, // manjka days
      { days: "ne-tabela" },
      { days: {} },
      { days: [BLED] }, // dan ni tabela točk
      { days: [[BLED]] }, // dan z 1 točko
      { days: [[BLED, LJ, BOHINJ, BLED, LJ, BOHINJ, BLED, LJ, BOHINJ, BLED, LJ, BOHINJ, BLED]] }, // 13 točk
      { days: Array.from({ length: 9 }, () => [BLED, LJ]) }, // 9 dni
      { days: [[["14.09", "46.36"], LJ]] }, // niz namesto števila
      { days: [[[Number.NaN, 46.36], LJ]] }, // NaN
      { days: [[[Infinity, 46.36], LJ]] }, // neskončno
      { days: [[[BLED[0], BLED[1], 14.2], LJ]] }, // točka s 3 elementi
      { days: [[BLED, LJ], "ne-tabela" ] }, // drugi dan ni tabela
    ];
    for (const body of invalid) {
      const res = await drPost(body, "dr-val-1");
      expect(res.status).toBe(400);
    }
    expect(fetchCalls.length).toBe(0); // neveljaven vhod NE gre v omrežje
  });

  test("② bbox registra LOČENO: lon/lat izven (13.0–20.0 / 41.0–47.2) → 400", async () => {
    mockFetch(() => jsonRes(200, valhallaOk(FIXTURE_BLED_LJ)));
    const out: unknown[] = [
      { days: [[[12.99, 46.36], LJ]] }, // lon pod
      { days: [[[20.01, 46.36], LJ]] }, // lon nad
      { days: [[[14.09, 40.99], LJ]] }, // lat pod
      { days: [[[14.09, 47.21], LJ]] }, // lat nad
    ];
    for (const body of out) {
      const res = await drPost(body, "dr-val-2");
      expect(res.status).toBe(400);
    }
    // ROBNI vrednosti bbox-a so VELJAVNE (meje vključene)
    const okEdge = await drPost(
      { days: [[[13.0, 41.0], [20.0, 47.2]]] },
      "dr-val-2b"
    );
    expect(okEdge.status).toBe(200);
    expect(fetchCalls.length).toBe(1); // samo robna veljavna zahteva
  });

  test("③ neveljavne zahteve NE porabijo kvote (validacija pred omejitvijo)", async () => {
    mockFetch(() => jsonRes(200, valhallaOk(FIXTURE_BLED_LJ)));
    // 20 neveljavnih s STEVILIM XFF …
    for (let i = 0; i < 20; i++) {
      const res = await drPost({ days: [[BLED]] }, "dr-val-3");
      expect(res.status).toBe(400);
    }
    // … nato veljavna zahteva z istim XFF → 200 (meja ni izčrpana)
    const ok = await drPost({ days: [[BOHINJ, VINTGAR]] }, "dr-val-3");
    expect(ok.status).toBe(200);
  });
});

// ── USPEH VALHALLA (maketa) ───────────────────────────────────────────────

describe("PLAN-DIRECTIONS — uspeh: dekodiran shape v [lat, lon] + oblika", () => {
  test("④ Bled→Ljubljana: 200, source, geometry iz shape (20 točk [lat, lon])", async () => {
    mockFetch((url) => {
      expect(url).toBe(VALHALLA_URL([BLED, LJ])); // točen URL Valhalla
      return jsonRes(200, valhallaOk(FIXTURE_BLED_LJ));
    });
    const res = await drPost({ days: [[BLED, LJ]] }, "dr-ok-4");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      source: string;
      days: {
        day: number;
        status: string;
        geometry: [number, number][];
        distanceM: number;
        durationS: number;
      }[];
    };
    // oblika odgovora: source + days (kanon specifikacije)
    expect(body.source).toBe("Valhalla (OpenStreetMap)");
    expect(body.days.length).toBe(1);
    expect(body.days[0].day).toBe(0);
    expect(body.days[0].status).toBe("route");
    // dekodiran shape je ŽE v [lat, lon] (Leaflet vrstni red)
    expect(body.days[0].geometry).toEqual(toLatLng(FIXTURE_BLED_LJ));
    expect(body.days[0].geometry.length).toBe(20);
    expect(body.days[0].geometry[0]).toEqual([46.370582, 14.095853]);
    expect(body.days[0].geometry[19]).toEqual([46.056898, 14.5058]);
    // POLIR5 A: ADITIVNI poli — IZMERJENI distanceM/durationS iz ISTEGA
    // trip.summary (cela števila, metri/sekunde); geometry ostaja
    // nespremenjena (stari odjemalci, ki berejo samo geometry, ne prelomijo).
    expect(body.days[0].distanceM).toBe(21_551);
    expect(body.days[0].durationS).toBe(2_173);
    expect(Number.isInteger(body.days[0].distanceM)).toBe(true);
    expect(Number.isInteger(body.days[0].durationS)).toBe(true);
    // zahtevek proti Valhalla: GET (brez metode), JSON sprejem, pošten UA,
    // signal prekinitve
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].init?.method).toBeUndefined();
    expect(
      (fetchCalls[0].init?.headers as Record<string, string>)?.accept
    ).toBe("application/json");
    expect(
      (fetchCalls[0].init?.headers as Record<string, string>)?.[
        "user-agent"
      ]
    ).toContain("DiscoverSlovenia-AI/");
    expect(fetchCalls[0].init?.signal).toBeDefined();
  });

  test("⑤ več-točkovni dan Bled;Vintgar;Bohinj: EN fetch za CEL dan (2 nogi → 66 točk brez dvojnikov)", async () => {
    mockFetch((url) => {
      expect(url).toBe(VALHALLA_URL([BLED, VINTGAR, BOHINJ]));
      return jsonRes(200, valhallaOk(FIXTURE_BVG_BOHINJ, 21.551, 2_173, 2));
    });
    const res = await drPost(
      { days: [[BLED, VINTGAR, BOHINJ]] },
      "dr-ok-5"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      days: {
        status: string;
        geometry: [number, number][];
        distanceM: number;
        durationS: number;
      }[];
    };
    expect(body.days[0].status).toBe("route");
    // nogi sta staknjeni BREZ podvojene mejne točke → natanko 66 točk
    expect(body.days[0].geometry).toEqual(toLatLng(FIXTURE_BVG_BOHINJ));
    expect(body.days[0].geometry.length).toBe(66);
    // POLIR5 A: ŽIVI ujet vzorec iz raziskave 2026-10-11-polir5.md (preizkus
    // B): isti dan Bled→Vintgar→Bohinj = 21551 m / 2173 s — proxy ves trojček
    // pošilja naprej BREZ dodatnih poizvedb (en fetch za cel dan zgoraj).
    expect(body.days[0].distanceM).toBe(21_551);
    expect(body.days[0].durationS).toBe(2_173);
    expect(fetchCalls.length).toBe(1); // en dan = en zahtevek (tudi pri 3 točkah)
  });

  test("⑥ dva dneva v eni zahtevi: dva fetcha, `day` = indeks v ZAHTEVI", async () => {
    mockFetch((url) => {
      if (url === VALHALLA_URL([LJ, MARIBOR])) {
        return jsonRes(200, valhallaOk(FIXTURE_BLED_LJ));
      }
      return jsonRes(200, valhallaOk(FIXTURE_BVG_BOHINJ)); // CELJE→PTUJ
    });
    const res = await drPost(
      { days: [[LJ, MARIBOR], [CELJE, PTUJ]] },
      "dr-ok-6"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      days: { day: number; status: string }[];
    };
    expect(body.days.map((d) => d.day)).toEqual([0, 1]);
    expect(body.days.every((d) => d.status === "route")).toBe(true);
    expect(fetchCalls.length).toBe(2);
  });

  test("⑦ prazna tabela dni: 200 s praznim days (0 klicev fetch)", async () => {
    mockFetch(() => jsonRes(200, valhallaOk(FIXTURE_BLED_LJ)));
    const res = await drPost({ days: [] }, "dr-ok-7");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { source: string; days: unknown[] };
    expect(body.source).toBe("Valhalla (OpenStreetMap)");
    expect(body.days).toEqual([]);
    expect(fetchCalls.length).toBe(0);
  });
});

// ── PREDPOMNILNIK (determinizem po zaokroženih koordinatah) ───────────────

describe("PLAN-DIRECTIONS — predpomnilnik (ključ po zaokroženih koordinatah)", () => {
  test("⑧ isti dan 2× → fetch SAMO enkrat; odgovora sta enaka (deep equal)", async () => {
    mockFetch(() => jsonRes(200, valhallaOk(FIXTURE_BLED_LJ)));
    const body = { days: [[VINTGAR, BOHINJ]] };
    const a = await drPost(body, "dr-cache-8");
    const b = await drPost(body, "dr-cache-8");
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(fetchCalls.length).toBe(1); // 2. klic je iz predpomnilnika
    expect(await b.json()).toEqual(await a.json());
  });

  test("⑨ koordinate, ki se zaokrožijo na isto vrednost → PREDPOMNILNIK (isti ključ)", async () => {
    mockFetch(() => jsonRes(200, valhallaOk(FIXTURE_BLED_LJ)));
    // 1. klic: točni koordinati (Bled→Vintgar — par, ki ga nihče prej ni uporabil)
    const a = await drPost(
      { days: [[[14.0944, 46.3683], [14.1167, 46.4]]] },
      "dr-cache-9"
    );
    expect(a.status).toBe(200);
    expect(fetchCalls.length).toBe(1);
    // 2. klic: 5. decimala (zaokroži se na isto 4-mestno vrednost) → zadetek
    const b = await drPost(
      { days: [[[14.09440001, 46.36830002], [14.1167, 46.4]]] },
      "dr-cache-9"
    );
    expect(b.status).toBe(200);
    expect(fetchCalls.length).toBe(1); // NI novega klica — isti ključ
    expect(await b.json()).toEqual(await a.json());
  });

  test("⑩ NEUSPEŠEN dan se NE predpomni (prehodna napaka ne zastrupi 24 ur)", async () => {
    // 1. klic: Valhalla odgovori 500 → dan iskreno "straight"
    mockFetch(() => jsonRes(500, { error_code: 102, error: "Internal error" }));
    const a = await drPost({ days: [[PIRAN, KOPER]] }, "dr-cache-10");
    expect(a.status).toBe(200);
    const bodyA = (await a.json()) as { days: { status: string }[] };
    expect(bodyA.days[0].status).toBe("straight");
    expect(fetchCalls.length).toBe(1);
    // 2. klic: Valhalla ozdravi → dan dobi pot (neuspeh NI bil predpomnjen)
    mockFetch(() => jsonRes(200, valhallaOk(FIXTURE_BLED_LJ)));
    const b = await drPost({ days: [[PIRAN, KOPER]] }, "dr-cache-10");
    expect(fetchCalls.length).toBe(2); // ponovni poskus je RES šel v omrežje
    const bodyB = (await b.json()) as { days: { status: string }[] };
    expect(bodyB.days[0].status).toBe("route");
  });
});

// ── FAIL-CLOSED PO DNEVIH ─────────────────────────────────────────────────

describe("PLAN-DIRECTIONS — fail-closed PO DNEVIH (padec ne podre ostalih)", () => {
  test("⑪ en dan HTTP 500, drugi uspeh → straight + route (neodvisno)", async () => {
    mockFetch((url) => {
      if (url === VALHALLA_URL([MARIBOR, PTUJ])) {
        return jsonRes(500, { error_code: 102, error: "Internal error" }); // prvi dan pade
      }
      return jsonRes(200, valhallaOk(FIXTURE_BLED_LJ)); // drugi dan uspe
    });
    const res = await drPost(
      { days: [[MARIBOR, PTUJ], [CELJE, LJ]] },
      "dr-fc-11"
    );
    expect(res.status).toBe(200); // zahtevek KOT CELOTA uspe (200)
    const body = (await res.json()) as {
      days: { day: number; status: string; geometry?: unknown }[];
    };
    expect(body.days[0]).toEqual({ day: 0, status: "straight" });
    expect(body.days[1].status).toBe("route");
    expect(body.days[1].geometry).toEqual(toLatLng(FIXTURE_BLED_LJ));
  });

  test("⑫ brez poti (HTTP 400) + trip brez shape + trip status ≠ 0 → vsi iskreno straight", async () => {
    mockFetch((url) => {
      if (url === VALHALLA_URL([PTUJ, MARIBOR])) {
        // Valhalla: brez poti → HTTP 400 (error_code 171)
        return jsonRes(400, {
          error_code: 171,
          error: "No path could be found for input",
        });
      }
      if (url === VALHALLA_URL([LJ, CELJE])) {
        // status 0, a legs[0] BREZ shape (slaba oblika) → fail-closed
        return jsonRes(200, {
          trip: { status: 0, legs: [{ summary: { length: 1, time: 60 } }] },
        });
      }
      // trip status ≠ 0 (npr. 1 — brez poti) s praznimi nogami
      return jsonRes(200, {
        trip: { status: 1, status_message: "No path", legs: [] },
      });
    });
    const res = await drPost(
      { days: [[PTUJ, MARIBOR], [LJ, CELJE], [KOPER, PIRAN]] },
      "dr-fc-12"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { days: { status: string }[] };
    expect(body.days.map((d) => d.status)).toEqual([
      "straight",
      "straight",
      "straight",
    ]);
    expect(fetchCalls.length).toBe(3);
    // druga enaka zahteva: NEUSPEŠNI dnevi se ne predpomnijo → 3 novi klici
    const again = await drPost(
      { days: [[PTUJ, MARIBOR], [LJ, CELJE], [KOPER, PIRAN]] },
      "dr-fc-12"
    );
    expect(again.status).toBe(200);
    expect(fetchCalls.length).toBe(6);
  });

  test("⑬ TimeoutError (prekinitev po 8 s) → iskren status straight", async () => {
    mockFetchThrow(); // fetch vrže (AbortSignal.timeout → TimeoutError)
    const res = await drPost({ days: [[BOHINJ, LJ]] }, "dr-fc-13");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { days: { status: string }[] };
    expect(body.days[0].status).toBe("straight");
    expect(fetchCalls.length).toBe(0); // maketa šteje samo uspešne klice
  });
});

// ── IZMERE: distanceM/durationS (POLIR5 A, 2.32.0) ─────────────────────

describe("PLAN-DIRECTIONS — izmere: validacija distanceM/durationS (fail-closed po dnevih)", () => {
  test("⑯ negativna length → iskren straight ZA TISTI dan (ne za vse; ni predpomnilnika)", async () => {
    mockFetch((url) => {
      if (url === VALHALLA_URL([BLED, CELJE])) {
        return jsonRes(200, valhallaOk(FIXTURE_BLED_LJ, -1, 2_173)); // negativna razdalja
      }
      return jsonRes(200, valhallaOk(FIXTURE_BVG_BOHINJ)); // zdrav dan
    });
    const res = await drPost(
      { days: [[BLED, CELJE], [LJ, PTUJ]] },
      "dr-m-16"
    );
    expect(res.status).toBe(200); // zahteva KOT CELOTA uspe
    const body = (await res.json()) as {
      days: { day: number; status: string; distanceM?: unknown }[];
    };
    // padli dan: SAMO { day, status } — brez geometry, distanceM, durationS
    expect(body.days[0]).toEqual({ day: 0, status: "straight" });
    // zdrav dan je NEODVISEN (fail-closed po dnevih) z izmerjenim trojčkom
    expect(body.days[1].status).toBe("route");
    expect(body.days[1].distanceM).toBe(21_551);
    expect(fetchCalls.length).toBe(2);
    // NEUSPEŠEN dan se NE predpomni: ponovna zahteva gre SPET v omrežje
    const again = await drPost({ days: [[BLED, CELJE]] }, "dr-m-16");
    expect(fetchCalls.length).toBe(3);
    const body2 = (await again.json()) as { days: { status: string }[] };
    expect(body2.days[0].status).toBe("straight");
  });

  test("⑰ nekončna time (1e999 v JSON) → iskren straight", async () => {
    // JSON.stringify(Infinity) vrne null, zato mora biti telo SESTAVLJENO
    // dobesedno — JSON.parse("1e999") da Number.POSITIVE_INFINITY.
    const shape = encodePolyline6(toLatLng(FIXTURE_BLED_LJ));
    const raw =
      '{"trip":{"status":0,"legs":[{"summary":{"length":21.551,"time":1e999},' +
      `"shape":"${shape}"}],` +
      '"summary":{"length":21.551,"time":1e999}}}';
    mockFetch(
      () =>
        new Response(raw, {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    const res = await drPost({ days: [[KOPER, MARIBOR]] }, "dr-m-17");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { days: { status: string }[] };
    expect(body.days[0].status).toBe("straight"); // nekončno trajanje NI izmerjena vrednost
    expect(fetchCalls.length).toBe(1);
  });

  test("⑱ manjkajoča polja (trip.summary brez length/time) → straight", async () => {
    mockFetch((url) => {
      if (url === VALHALLA_URL([PTUJ, CELJE])) {
        // POVSEM slaba oblika: shape je, trip.summary MANJKA (proxy zahteva
        // ves trojček — ne izmišljujemo vrednosti, ki jih Valhalla ni poslal)
        return jsonRes(200, {
          trip: {
            status: 0,
            legs: [{ shape: encodePolyline6(toLatLng(FIXTURE_BLED_LJ)) }],
          },
        });
      }
      // length je, time MANJKA → dan ni izmerjen
      return jsonRes(200, {
        trip: {
          status: 0,
          legs: [
            {
              summary: { length: 21.551, time: 2_173 },
              shape: encodePolyline6(toLatLng(FIXTURE_BVG_BOHINJ)),
            },
          ],
          summary: { length: 21.551 }, // time manjka
        },
      });
    });
    const res = await drPost(
      { days: [[PTUJ, CELJE], [PIRAN, LJ]] },
      "dr-m-18"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { days: { status: string }[] };
    expect(body.days.map((d) => d.status)).toEqual(["straight", "straight"]);
    // oba padla dneva se NE predpomnita → ponovna zahteva znova v omrežje
    const again = await drPost(
      { days: [[PTUJ, CELJE], [PIRAN, LJ]] },
      "dr-m-18"
    );
    expect(fetchCalls.length).toBe(4);
    expect(again.status).toBe(200);
  });

  test("⑲ velik odgovor (dan 12 točk, shape 89 točk) z vsemi tremi → predpomnjeno VSE TROJE (2. klic brez fetch)", async () => {
    // 12-točkovni dan = zgornja meja validacije; 89 točk shape = obseg
    // živega vzorca iz raziskave POLIR5 (preizkus B). Koordinate registra.
    const DAY_12: [number, number][] = [
      [14.0944, 46.3683], [14.1167, 46.4], [13.8833, 46.2833],
      [13.7332, 46.3447], [13.8462, 46.3794], [13.5864, 46.2453],
      [14.5058, 46.0569], [14.2045, 45.7845], [15.2675, 46.2389],
      [15.6459, 46.5547], [15.867, 46.4197], [15.0864, 46.5131],
    ];
    const BIG_89: [number, number][] = Array.from(
      { length: 89 },
      (_, i) => [14.0944 + i * 0.0045, 46.3683 - i * 0.0035] // deterministično
    );
    mockFetch((url) => {
      expect(url).toBe(VALHALLA_URL(DAY_12));
      // 12 točk = 11 nog (Valhalla vrača nogo na lokacijo)
      return jsonRes(200, valhallaOk(BIG_89, 21.551, 2_173, DAY_12.length - 1));
    });
    const req = { days: [DAY_12] };
    const a = await drPost(req, "dr-m-19");
    expect(a.status).toBe(200);
    const bodyA = (await a.json()) as {
      days: {
        status: string;
        geometry: [number, number][];
        distanceM: number;
        durationS: number;
      }[];
    };
    expect(bodyA.days[0].status).toBe("route");
    expect(bodyA.days[0].geometry.length).toBe(89);
    expect(bodyA.days[0].distanceM).toBe(21_551);
    expect(bodyA.days[0].durationS).toBe(2_173);
    // 2. klic: predpomnilnik pod ISTIM ključem vrne VSE TROJE brez fetch-a
    const b = await drPost(req, "dr-m-19");
    expect(b.status).toBe(200);
    expect(fetchCalls.length).toBe(1); // NI novega klica
    const bodyB = (await b.json()) as typeof bodyA;
    expect(bodyB).toEqual(bodyA); // ves trojček identičen (deep equal)
  });
});

// ── OMEJITEV 60/MIN + POGODBA MODULA ──────────────────────────────────────

describe("PLAN-DIRECTIONS — omejitev 60/min po odjemalcu (XFF)", () => {
  test("⑭ 60 zahtev z istim XFF → 200; 61. → 429; drug odjemalec ne trpi", async () => {
    mockFetch(() => jsonRes(200, valhallaOk(FIXTURE_BLED_LJ)));
    const body = { days: [[MARIBOR, CELJE]] };
    let ok = 0;
    let limited = 0;
    for (let i = 0; i < 61; i++) {
      const res = await drPost(body, "dr-rl-14");
      if (res.status === 200) ok += 1;
      else if (res.status === 429) limited += 1;
      else throw new Error(`nepričakovan status ${res.status}`);
    }
    expect(ok).toBe(60);
    expect(limited).toBe(1);
    // predpomnilnik: vseh 60 uspešnih je porabilo SAMO en klic fetch
    expect(fetchCalls.length).toBe(1);
    // DRUG odjemalec (lasten XFF) ni bil prizadet
    const other = await drPost(body, "dr-rl-14-other");
    expect(other.status).toBe(200);
    expect(fetchCalls.length).toBe(1); // še vedno predpomnilnik
  });
});

describe("PLAN-DIRECTIONS — pogodba modula (SAMO POST, kanoni proxyja)", () => {
  test("⑮ izvožen SAMO POST (noben GET); izvorna koda drži kanone proxyja", async () => {
    expect(typeof routeModule.POST).toBe("function");
    expect(
      typeof (routeModule as unknown as Record<string, unknown>).GET
    ).toBe("undefined");
    const src = await Bun.file(ROUTE_SRC).text();
    // #35 faza 2 (2.65.0): vir je javni Valhalla primerek FOSSGIS z
    // override-om VALHALLA_BASE_URL (self-host = isti kanon kot faza 3).
    expect(src).toContain("valhalla1.openstreetmap.de");
    expect(src).toContain("/route");
    expect(src).toContain("VALHALLA_BASE_URL");
    expect(src).toContain('"polyline6"');
    expect(src).toContain('"kilometers"'); // privzeta enota je MILJA — obvezno
    expect(src).toContain("AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)"); // 8 s
    expect(src).toContain("8_000"); // prekinitev 8 s
    expect(src).toContain("24 * 60 * 60_000"); // TTL predpomnilnika 24 h
    expect(src).toContain("500"); // največ 500 vnosov
    expect(src).toContain("rateLimited"); // skupni kanon omejitve
    // POLIR5 A: izmere iz ISTEGA odgovora (trip.summary.length/time) —
    // nikoli izpeljane iz geometry in nikoli iz hevristike.
    expect(src).toContain("distanceM");
    expect(src).toContain("durationS");
    // 0 AI / 0 naključja v strežniški logiki
    expect(src).not.toContain("Math.random");
    expect(src).not.toContain("Date.now() + Math");
  });
});
