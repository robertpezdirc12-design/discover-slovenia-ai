import dns from "node:dns";
import net from "node:net";
import { NextResponse } from "next/server";

import { rateLimited, tooManyRequests } from "@/lib/rate-limit";

/**
 * /api/plan/directions — SAMO POST: strežniški proxy na javni OSRM demo
 * strežnik (router.project-osrm.org, profil driving) za VOZLJIVO POT na
 * zemljevidu načrta (izdaja 2.30.0, POLIR3 skupina A).
 *
 * Zakaj strežniški proxy (kanon vremenskega proxyja /api/weather):
 *  - OSRM kliče STREŽNIK, ne brskalnik → v CSP NI novih zunanjih domen;
 *  - predpomnilnik + omejitev ščitita javni demo strežnik (vljudnost do
 *    prostega vira, ki ga uradna dokumentacija OSRM sama navaja kot primer).
 *
 * ISKRENOST (fail-closed PO DNEVIH): polna črta na zemljevidu nastane
 * IZKLJUČNO iz dejanske OSRM geometry. Katerikoli padec posameznega dneva
 * (timeout, NoRoute, InvalidValue, HTTP 5xx, slaba oblika odgovora) pomeni
 * za TISTI dan status "straight" — ostali dnevi so neodvisni, poti nikoli
 * ne izmišljamo. Odjemalec tedaj iskreno izriše črtkano premočrtno črto.
 *
 * Vir podatkov: OSRM (OpenStreetMap) — geometrije cest so iz projekta
 * OpenStreetMap (licenca ODbL); atribucija stoji v opombi pod zemljevidom.
 *
 *  - VHOD: { days: [[lon, lat], …][] } — koordinate SO izključno iz registra
 *    destinacij (odjemalec pošilja koordinate markerjev), zato so veljavne;
 *    vseeno validiramo (fail-closed 400): tabela, ≤ 8 dni, vsak dan 2–12
 *    točk, števila, znotraj bbox-a registra (lon 13.0–20.0, lat 41.0–47.2 —
 *    SI·HR·ME·AL). Pošiljanje poljubnih uporabniških koordinat NE BI smelo
 *    biti mogoče; validacija je varovalka (OSRM sicer tiho pripenja na
 *    najbližjo cesto — glej raziskavo 2026-10-12-polir3.md, preizkus #3).
 *  - IZHOD 200: { source: "OSRM (OpenStreetMap)", days: [{ day, status:
 *    "route", geometry: [[lat, lon], …] } | { day, status: "straight" }] }
 *    — `day` je INDEKS DNEVA V ZAHTEVI; geometry je PREOBRNJENA v vrstni
 *    red [lat, lon] (Leaflet).
 *  - Predpomnilnik: pomnilniška Map, ključ "driving:" + koordinate zaokrožene
 *    na 4 decimalke (determinizem: isti vhod → isti ključ), TTL 24 h, največ
 *    500 vnosov (izmet najstarejšega). NEUSPELI dnevi se NE predpomnijo
 *    (prehodna napaka ne zastrupi 24 ur).
 *  - Omejitev: 60 zahtev/min na odjemalca (XFF, skupni kanon rate-limit).
 *  - 0 skrivnosti, 0 persistenc (nič ne shranjujemo); 0 AI.
 */

export const dynamic = "force-dynamic";

// ZDRAVJE OMREŽJA (empirično ugotovljeno v živi verifikaciji POLIR3 A):
// router.project-osrm.org ima A in AAAA zapise. V okoljih z nedelujočim
// IPv6 privzeta resolucija (IPv6 pred IPv4 + happy-eyeballs 250 ms) obesi
// fetch na nedosegljivem IPv6 naslovu — Node/undici občasno javi ETIMEDOUT
// že po ~250 ms (že znana dirka happy-eyeballs), kar bi pomenilo NAKLJUČNO
// črtkane črte, čeprav je strežnik zdrav. Nadomestek: prednost IPv4 pri
// resoluciji (enakovredno NODE_OPTIONS=--dns-result-order=ipv4first) in
// IZKLOP happy-eyeballs (ravno privzeto v Node 22) — 12/12 uspešnih
// preizkusov proti živemu OSRM. Obe nastavitvi sta procesno-globalni,
// idempotentni in varni: naslovi BREZ A zapisa se povežejo po IPv6
// (vrstni red samo UREJA zapise, ne izključuje jih).
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving/";
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

/** Rezultat enega dneva: vozljiva pot ali iskrena premočrtna povezava. */
type DayResult =
  | { day: number; status: "route"; geometry: [number, number][] }
  | { day: number; status: "straight" };

/**
 * Pomnilniški predpomnilnik uspešnih geometrij (0 persistenc): ključ →
 * { potek, geometry } (geometry je ŽE v vrstnem redu [lat, lon]).
 */
const cache = new Map<
  string,
  { expiresAt: number; geometry: [number, number][] }
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

function cacheGet(key: string, now: number): [number, number][] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    cache.delete(key); // potekel → počistimo in gre naprej na gorovje
    return null;
  }
  return hit.geometry;
}

function cacheSet(key: string, geometry: [number, number][], now: number): void {
  cache.delete(key); // osveži mesto v vrstnem redu vmapiravanja
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, geometry });
  while (cache.size > CACHE_CAP) {
    const oldest = cache.keys().next().value; // Map ohranja vrstni red vnosa
    if (oldest === undefined) break;
    cache.delete(oldest); // izmet najstarejšega vnosa
  }
}

/**
 * Preveri obliko OSRM odgovora in geometry preobrne v vrstni red
 * [lat, lon] (Leaflet). Slaba oblika → null (fail-closed po dnevih).
 */
function parseGeometry(data: unknown): [number, number][] | null {
  if (typeof data !== "object" || data === null) return null;
  const routes = (data as { routes?: unknown }).routes;
  if (!Array.isArray(routes) || routes.length === 0) return null;
  const geometry = (routes[0] as { geometry?: unknown }).geometry;
  if (typeof geometry !== "object" || geometry === null) return null;
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const out: [number, number][] = [];
  for (const c of coordinates) {
    if (!Array.isArray(c) || c.length !== 2) return null;
    const [lon, lat] = c;
    if (!isFiniteNumber(lon) || !isFiniteNumber(lat)) return null;
    out.push([lat, lon]); // PREOBRAT: OSRM [lon, lat] → Leaflet [lat, lon]
  }
  return out;
}

/**
 * En dan: predpomnilnik → (zgrešil) OSRM. Katerikoli padec → geometry null
 * (iskrena črtkana povezava; ostali dnevi neodvisni — fail-closed po dnevih).
 */
async function resolveDay(
  points: ReqPoint[],
  now: number
): Promise<[number, number][] | null> {
  const key = cacheKey(points);
  const cached = cacheGet(key, now);
  if (cached) return cached;

  const url =
    OSRM_BASE +
    points.map(([lon, lat]) => `${lon},${lat}`).join(";") +
    "?overview=simplified&geometries=geojson";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null; // 4xx/5xx → straight
    const json: unknown = await res.json();
    if (
      typeof json !== "object" ||
      json === null ||
      (json as { code?: unknown }).code !== "Ok"
    ) {
      return null; // NoRoute / InvalidValue / … → straight
    }
    const geometry = parseGeometry(json);
    if (!geometry) return null; // slaba oblika → straight
    cacheSet(key, geometry, now); // predpomnimo SAMO uspeh
    return geometry;
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
      const geometry = await resolveDay(points, now);
      return geometry
        ? { day: i, status: "route", geometry }
        : { day: i, status: "straight" };
    })
  );

  return NextResponse.json({
    source: "OSRM (OpenStreetMap)",
    days: results,
  });
}
