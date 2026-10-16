import dns from "node:dns";
import net from "node:net";
import { NextResponse } from "next/server";

import { rateLimited, tooManyRequests } from "@/lib/rate-limit";
import { decodePolyline6 } from "@/lib/road-routing-server";

/**
 * /api/plan/directions — SAMO POST: strežniški proxy na javni Valhalla
 * primerek FOSSGIS (valhalla1.openstreetmap.de, costing auto; #35 faza 2
 * PoC 2.65.0 — prej OSRM demo; self-host = VALHALLA_BASE_URL override)
 * za VOZLJIVO POT na zemljevidu načrta (izdaja 2.30.0, POLIR3 skupina A).
 *
 * Zakaj strežniški proxy (kanon vremenskega proxyja /api/weather):
 *  - Valhalla kliče STREŽNIK, ne brskalnik → v CSP NI novih zunanjih domen;
 *  - predpomnilnik + omejitev ščitita javni primerek (vljudnost do
 *    prostega vira FOSSGIS).
 *
 * ISKRENOST (fail-closed PO DNEVIH): polna črta na zemljevidu nastane
 * IZKLJUČNO iz dejanske Valhalla geometry (dekodiran shape). Katerikoli
 * padec posameznega dneva (timeout, status ≠ 0, InvalidValue, HTTP 5xx,
 * slaba oblika odgovora) pomeni za TISTI dan status "straight" — ostali
 * dnevi so neodvisni, poti nikoli ne izmišljamo. Odjemalec tedaj iskreno
 * izriše črtkano premočrtno črto.
 *
 * Vir podatkov: Valhalla (OpenStreetMap) — geometrije cest so iz projekta
 * OpenStreetMap (licenca ODbL); atribucija stoji v opombi pod zemljevidom.
 *
 *  - VHOD: { days: [[lon, lat], …][] } — koordinate SO izključno iz registra
 *    destinacij (odjemalec pošilja koordinate markerjev), zato so veljavne;
 *    vseeno validiramo (fail-closed 400): tabela, ≤ 8 dni, vsak dan 2–12
 *    točk, števila, znotraj bbox-a registra (lon 13.0–20.0, lat 41.0–47.2 —
 *    SI·HR·ME·AL). Pošiljanje poljubnih uporabniških koordinat NE BI smelo
 *    biti mogoče; validacija je varovalka (usmerjevalnik sicer tiho pripenja
 *    na najbližjo cesto — glej raziskavo 2026-10-12-polir3.md, preizkus #3).
 *  - IZHOD 200: { source: "Valhalla (OpenStreetMap)", days: [{ day, status:
 *    "route", geometry: [[lat, lon], …], distanceM, durationS } | { day,
 *    status: "straight" }] } — `day` je INDEKS DNEVA V ZAHTEVI; geometry je
 *    [lat, lon] (Leaflet; Valhalla polyline6 dekodiran v [lat, lng] — vrstni
 *    red ŽE ustreza, leg-shape-i se staknejo brez podvojenih mejnih točk).
 *    POLIR5 A (2.32.0): distanceM (celo število metrov) in durationS (celo
 *    število sekund) sta IZMERJENI vrednosti iz ISTEGA odgovora — zdaj
 *    trip.summary.length (km, units=kilometers → ×1000) in trip.summary.time
 *    (s). Odgovor je ADITIVEN: stari odjemalci, ki berejo samo geometry, se
 *    ne prelomijo. Slaba/manjkajoča/negativna/nekončna vrednost pomeni
 *    fail-closed "straight" ZA TISTI DAN (enak kanon kot slaba geometry —
 *    nikoli ne izmišljujemo števil, ki jih Valhalla ni izmeril).
 *  - Predpomnilnik: pomnilniška Map, ključ "driving:" + koordinate zaokrožene
 *    na 4 decimalke (determinizem: isti vhod → isti ključ), TTL 24 h, največ
 *    500 vnosov (izmet najstarejšega). Vnos nosi VSE TROJE (geometry,
 *    distanceM, durationS) pod istim ključem. NEUSPELI dnevi se NE
 *    predpomnijo (prehodna napaka ne zastrupi 24 ur).
 *  - Omejitev: 60 zahtev/min na odjemalca (XFF, skupni kanon rate-limit).
 *  - 0 skrivnosti, 0 persistenc (nič ne shranjujemo); 0 AI.
 */

export const dynamic = "force-dynamic";

// ZDRAVJE OMREŽJA (empirično ugotovljeno v živi verifikaciji POLIR3 A):
// javni usmerjevalniki imajo lahko A in AAAA zapise. V okoljih z nedelujočim
// IPv6 privzeta resolucija (IPv6 pred IPv4 + happy-eyeballs 250 ms) obesi
// fetch na nedosegljivem IPv6 naslovu — Node/undici občasno javi ETIMEDOUT
// že po ~250 ms (že znana dirka happy-eyeballs), kar bi pomenilo NAKLJUČNO
// črtkane črte, čeprav je strežnik zdrav. Nadomestek: prednost IPv4 pri
// resoluciji (enakovredno NODE_OPTIONS=--dns-result-order=ipv4first) in
// IZKLOP happy-eyeballs (ravno privzeto v Node 22) — 12/12 uspešnih
// preizkusov proti živemu OSRM (preneseno na Valhalla — isti kanon). Obe
// nastavitvi sta procesno-globalni, idempotentni in varni: naslovi BREZ A
// zapisa se povežejo po IPv6 (vrstni red samo UREJA zapise, ne izključuje jih).
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

/**
 * Javni Valhalla primerek FOSSGIS (BJS) — privzeti vir do self-host
 * (faza 2, #35): nastavi VALHALLA_BASE_URL in koda ostane ISTA
 * (isti override kot road-routing-server.ts). Sprejmemo samo http(s).
 */
function resolveDirectionsBaseUrl(): string {
  const raw = process.env.VALHALLA_BASE_URL?.trim() ?? "";
  if (raw.length > 0 && /^https?:\/\//.test(raw)) return raw;
  return "https://valhalla1.openstreetmap.de";
}

const VALHALLA_ROUTE_URL = `${resolveDirectionsBaseUrl()}/route`;
const ROUTING_USER_AGENT =
  "DiscoverSlovenia-AI/2.67.1 (routing; sledi OpenStreetMap etiquette)";
const UPSTREAM_TIMEOUT_MS = 8_000;

const RATE_LIMIT = 60;

const CACHE_TTL_MS = 24 * 60 * 60_000; // 24 h
const CACHE_CAP = 500;

const MAX_DAYS = 8;
const MIN_POINTS = 2;
const MAX_POINTS = 12;

/** Bbox registra destinacij (SI·HR·ME·AL — glej slovenia-data.ts). */
const LON_MIN = 13.0;
const LON_MAX = 20.0;
const LAT_MIN = 41.0;
const LAT_MAX = 47.2;

/** Točka dneva v zahtvi: [lon, lat] (vrstni red OSRM). */
type ReqPoint = [number, number];

/**
 * Rezultat enega dneva: vozljiva pot z IZMERJENO razdaljo/časom ali iskrena
 * premočrtna povezava. distanceM/durationS (POLIR5 A, 2.32.0) sta iz
 * OSRM routes[0].distance/duration — nikoli izpeljana iz geometry (dolžina
 * geometrije ≠ cestna razdalja) in nikoli iz hevristike.
 */
type DayResult =
  | {
      day: number;
      status: "route";
      geometry: [number, number][];
      /** IZMERJENA cestna razdalja dneva (celo število metrov). */
      distanceM: number;
      /** IZMERJEN čas vožnje dneva (celo število sekund). */
      durationS: number;
    }
  | { day: number; status: "straight" };

/** Uspešno razrešen dan: celoten trojček iz enega OSRM odgovora. */
interface DayRoute {
  geometry: [number, number][];
  distanceM: number;
  durationS: number;
}

/**
 * Pomnilniški predpomnilnik uspešnih dni (0 persistenc): ključ →
 * { potek, geometry, distanceM, durationS } (geometry je ŽE v vrstnem redu
 * [lat, lon]; trojček pripada istemu odgovoru, zato ostane skupaj).
 */
const cache = new Map<
  string,
  { expiresAt: number; geometry: [number, number][]; distanceM: number; durationS: number }
>();

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Validacija telesa (fail-closed 400): days tabela, ≤ 8 dni, vsak dan 2–12
 * točk [lon, lat] s končnima številoma znotraj bbox-a registra.
 */
function parseDays(body: unknown): ReqPoint[][] | null {
  if (typeof body !== "object" || body === null) return null;
  const days = (body as { days?: unknown }).days;
  if (!Array.isArray(days) || days.length > MAX_DAYS) return null;
  const out: ReqPoint[][] = [];
  for (const day of days) {
    if (!Array.isArray(day) || day.length < MIN_POINTS || day.length > MAX_POINTS) {
      return null;
    }
    const points: ReqPoint[] = [];
    for (const p of day) {
      if (!Array.isArray(p) || p.length !== 2) return null;
      const [lon, lat] = p;
      if (!isFiniteNumber(lon) || !isFiniteNumber(lat)) return null;
      if (lon < LON_MIN || lon > LON_MAX || lat < LAT_MIN || lat > LAT_MAX) {
        return null;
      }
      points.push([lon, lat]);
    }
    out.push(points);
  }
  return out;
}

/** Ključ predpomnilnika: "driving:" + koordinate zaokrožene na 4 decimalke. */
function cacheKey(points: ReqPoint[]): string {
  return (
    "driving:" +
    points
      .map(([lon, lat]) => `${lon.toFixed(4)},${lat.toFixed(4)}`)
      .join(";")
  );
}

function cacheGet(key: string, now: number): DayRoute | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    cache.delete(key); // potekel → počistimo in gre naprej na gorovje
    return null;
  }
  return {
    geometry: hit.geometry,
    distanceM: hit.distanceM,
    durationS: hit.durationS,
  };
}

function cacheSet(key: string, route: DayRoute, now: number): void {
  cache.delete(key); // osveži mesto v vrstnem redu vmapiravanja
  cache.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    geometry: route.geometry,
    distanceM: route.distanceM,
    durationS: route.durationS,
  });
  while (cache.size > CACHE_CAP) {
    const oldest = cache.keys().next().value; // Map ohranja vrstni red vnosa
    if (oldest === undefined) break;
    cache.delete(oldest); // izmet najstarejšega vnosa
  }
}

/**
 * Preveri obliko Valhalla odgovora (native trip): geometry iz dekodiranih
 * leg-shape-ov (staknjene brez podvojenih mejnih točk, [lat, lon] — Leaflet
 * vrstni red ŽE ustreza), iz ISTEGA trip.summary pa prebere IZMERJENO
 * length (km) in time (s). Slaba oblika / manjkajoča / negativna /
 * nekončna vrednost katerekoli od treh → null (fail-closed po dnevih —
 * en dan, ena odločitev: dan z izmerjeno geometrijo a slabo razdaljo NI
 * izmerjen dan).
 */
function parseDayRoute(data: unknown, expectedLegs: number): DayRoute | null {
  if (typeof data !== "object" || data === null) return null;
  const trip = (data as { trip?: unknown }).trip;
  if (typeof trip !== "object" || trip === null) return null;
  const t = trip as {
    status?: unknown;
    legs?: unknown;
    summary?: unknown;
  };
  if (t.status !== 0) return null; // 0 = "Found route between points"
  if (!Array.isArray(t.legs) || t.legs.length !== expectedLegs) return null;

  // IZMERJENI vrednosti iz ISTEGA odgovora (POLIR5 A): končni, nenegativni.
  // trip.summary.length je km (units=kilometers) in time je v sekundah.
  // Math.round je deterministična varovalka za decimalne vnose (nikoli
  // ne izmišljujemo vrednosti, ki je Valhalla ni poslal).
  const summary = t.summary;
  if (typeof summary !== "object" || summary === null) return null;
  const { length, time } = summary as { length?: unknown; time?: unknown };
  if (!isFiniteNumber(length) || length < 0) return null;
  if (!isFiniteNumber(time) || time < 0) return null;

  // Geometry: stakni dekodirane shape-e vseh nog (brez podvojenih mejnih
  // točk). Pokvarjen/prekratek shape → null (ne ugibamo).
  const out: [number, number][] = [];
  for (let i = 0; i < t.legs.length; i++) {
    const leg = t.legs[i] as { shape?: unknown } | null;
    if (leg === null || typeof leg !== "object") return null;
    if (typeof leg.shape !== "string" || leg.shape.length === 0) return null;
    const decoded = decodePolyline6(leg.shape);
    if (!decoded) return null;
    for (const [lat, lng] of decoded) {
      if (i > 0 && out.length > 0) {
        const prev = out[out.length - 1] as [number, number];
        if (prev[0] === lat && prev[1] === lng) continue; // mejna točka
      }
      out.push([lat, lng]);
    }
  }
  if (out.length < 2) return null;
  return {
    geometry: out,
    distanceM: Math.round(length * 1000),
    durationS: Math.round(time),
  };
}

/**
 * En dan: predpomnilnik → (zgrešil) Valhalla. Katerikoli padec → null
 * (iskrena črtkana povezava; ostali dnevi neodvisni — fail-closed po dnevih).
 */
async function resolveDay(
  points: ReqPoint[],
  now: number
): Promise<DayRoute | null> {
  const key = cacheKey(points);
  const cached = cacheGet(key, now);
  if (cached) return cached;

  // Valhalla zahteva [lat, lon] v locations (za razliko od OSRM [lon, lat]).
  const json = JSON.stringify({
    locations: points.map(([lon, lat]) => ({ lat, lon, type: "break" })),
    costing: "auto",
    shape_format: "polyline6",
    units: "kilometers",
  });
  const url = `${VALHALLA_ROUTE_URL}?json=${encodeURIComponent(json)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        "user-agent": ROUTING_USER_AGENT,
      },
    });
    if (!res.ok) return null; // 4xx/5xx → straight
    const body: unknown = await res.json();
    const route = parseDayRoute(body, points.length - 1);
    if (!route) return null; // slaba oblika (tudi length/time) → straight
    cacheSet(key, route, now); // predpomnimo SAMO uspeh (ves trojček)
    return route;
  } catch {
    // timeout / omrežna napaka / slaba oblika JSON → straight (fail-closed)
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Neveljaven JSON v telesu zahteve." },
      { status: 400 }
    );
  }

  const days = parseDays(body);
  if (!days) {
    return NextResponse.json(
      {
        error:
          "Neveljavno telo: pričakovana { days: [[lon, lat], …][] } z največ 8 dnevi, 2–12 točkami na dan in koordinatami znotraj registra (lon 13.0–20.0, lat 41.0–47.2).",
      },
      { status: 400 }
    );
  }

  // Omejitev 60/min na odjemalca (skupni kanon src/lib/rate-limit.ts).
  if (rateLimited(request, RATE_LIMIT)) {
    return tooManyRequests();
  }

  // Dnevi POSEBEJ (padec enega dneva ne podre ostalih) in VZPOREDNO
  // (vsak s svojo prekinitvijo; Promise ohranja vrstni red zahteve,
  // zato je `day` = indeks v vhodni tabeli dni — resolveDay nikoli ne vrže).
  const now = Date.now();
  const results: DayResult[] = await Promise.all(
    days.map(async (points, i): Promise<DayResult> => {
      const route = await resolveDay(points, now);
      return route
        ? {
            day: i,
            status: "route",
            geometry: route.geometry,
            distanceM: route.distanceM,
            durationS: route.durationS,
          }
        : { day: i, status: "straight" };
    })
  );

  return NextResponse.json({
    source: "Valhalla (OpenStreetMap)",
    days: results,
  });
}
