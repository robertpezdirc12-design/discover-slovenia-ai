/**
 * GO-GPS — ČISTE izračunske funkcije žive GPS navigacije za Go Mode
 * „Na poti“ (issue #1 področje 1; kanon izvirnika v1.190.0: geo-distance,
 * travel-state, DistanceChip / ETA hint — premočrtna razdalja ×1,3 pri
 * ~55 km/h, vse ocene pošteno razkrite).
 *
 * 0 DOM, 0 omrežje, 0 persistenc — modul je CLIENT-SAFE in testabilen
 * (enak vzorec kot weather.ts / map-pins.ts). Uporabljajo ga Go Mode UI
 * IN strežniška pot /api/journey/route (validacija + prisilna zaokrožitev).
 *
 * ISKRENOSTNI KANON:
 *  - razdalje iz premočne črte so razkrite („v zraku“, „~“);
 *  - ETA je ocena (cestni faktor 1,3 pri ~55 km/h — prometnih podatkov NI,
 *    zato ure prihoda ne podajamo natančneje);
 *  - brez geometrije poti odklona NE izmišljamo (offRouteCheck iskreno
 *    poroča bazo "straight" in odklon 0 — klicatelj naj za pravo meritev
 *    poda [prejšnji, naslednji] ali OSRM geometrijo);
 *  - ZASEBNOST: na strežnik gre izključno roundedPrivacy() pozicija
 *    (4 decimale ≈ 11 m) — in samo ob eksplicitnem preračunu poti.
 */

// ── Tipi ────────────────────────────────────────────────────────────────

/** Ena točka na zemljevidu (lat/lng v desetiških stopinjah). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

import type { PickLocale } from "./i18n-pick";

/** Jezik oznak (6 jezikov od 2.21.0/4-c; identičen PickLocale). */
export type GpsLang = PickLocale;

// ── Razdalje (kanon geo-distance izvirnika: R = 6371) ───────────────────

export const EARTH_RADIUS_KM = 6371;

/** Haversine razdalja v km (premočrtna razdalja — „v zraku“). */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

// ── Smer: azimuth + kardinalne oznake (8 sektorjev) ─────────────────────

/**
 * Azimuth od → to v stopinjah [0, 360): 0° = sever, 90° = vzhod (smer ure).
 * Kanon kompasov; klicatelj prikaže rotirano puščico po tej vrednosti.
 */
export function bearingDeg(from: GeoPoint, to: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Oznake 8 sektorjev po house vzorcu L = { sl, en }. */
export const CARDINALS: Record<GpsLang, readonly string[]> = {
  sl: ["S", "SV", "V", "JV", "J", "JZ", "Z", "SZ"],
  en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  it: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  de: ["N", "NO", "O", "SO", "S", "SW", "W", "NW"],
  fr: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  es: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
};

/** Polna imena smeri (za sr-only/a11y opis puščice). */
export const CARDINAL_NAMES: Record<GpsLang, readonly string[]> = {
    sl: ["sever", "severovzhod", "vzhod", "jugovzhod", "jug", "jugozahod", "zahod", "severozahod"],
    en: ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"],
    it: ["nord", "nord-est", "est", "sud-est", "sud", "sud-ovest", "ovest", "nord-ovest"],
    de: ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"],
    fr: ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"],
    es: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
  };

/**
 * Indeks sektorja (0–7) za azimut v stopinjah. Sektorji so središčeni na
 * 0°/45°/90°/… (±22,5°): [337,5°–22,5°) = sever, [22,5°–67,5°) = SV …
 */
export function cardinalIndex(deg: number): number {
  const norm = ((deg % 360) + 360) % 360;
  return Math.floor(((norm + 22.5) % 360) / 45) % 8;
}

/** Kratka kardinalna oznaka (S/SV/V/JV/J/JZ/Z/SZ · N/NE/E/SE/S/SW/W/NW). */
export function cardinalLabel(deg: number, lang: GpsLang): string {
  return CARDINALS[lang][cardinalIndex(deg)] ?? CARDINALS.sl[0]!;
}

/** Polno ime smeri (sever/severovzhod/… · north/northeast/…). */
export function cardinalName(deg: number, lang: GpsLang): string {
  return CARDINAL_NAMES[lang][cardinalIndex(deg)] ?? CARDINAL_NAMES.sl[0]!;
}

// ── ETA (kanon izvirnika geo-distance: ×1,3 pri ~55 km/h) ───────────────

/** Cestni faktor nad premočno razdaljo (pošteno razkrit z „~“). */
export const ETA_ROAD_FACTOR = 1.3;
/** Povprečna hitrost hevristične ocene vožnje. */
export const ETA_SPEED_KMH = 55;

/**
 * Ocena minute vožnje iz PREMOČNE razdalje: km × 1,3 (cestni faktor) pri
 * ~55 km/h. Neveljaven/negativen vhod → 0 (nikoli izmišljenega časa).
 */
export function etaMinutes(straightKm: number): number {
  if (!Number.isFinite(straightKm) || straightKm <= 0) return 0;
  return Math.round(((straightKm * ETA_ROAD_FACTOR) / ETA_SPEED_KMH) * 60);
}

// ── Geometrija: projekcija točka → odsek (ravninska aproksimacija) ──────

/** Kilometrov na stopinjo latituda (povprečje Zemlje). */
const KM_PER_DEG_LAT = 110.574;
/** Kilometrov na stopinjo longituda ob ekvatorju. */
const KM_PER_DEG_LNG_EQ = 111.32;

/**
 * Projekcija točke na odsek [a, b]: parameter t ∈ [0, 1] (0 = a, 1 = b) +
 * pravokotna nogavica (foot). Ravninska (equirektangular) aproksimacija
 * okoli točke a — za odseke ≤ ~200 km na širinah Slovenije natančna
 * prek 99,9 % (dokumentirana aproksimacija, ne izmislek).
 */
function projectOnSegment(
  user: GeoPoint,
  a: GeoPoint,
  b: GeoPoint
): { t: number; foot: GeoPoint } {
  const kx = KM_PER_DEG_LNG_EQ * Math.cos((a.lat * Math.PI) / 180);
  const ux = (user.lng - a.lng) * kx;
  const uy = (user.lat - a.lat) * KM_PER_DEG_LAT;
  const dx = (b.lng - a.lng) * kx;
  const dy = (b.lat - a.lat) * KM_PER_DEG_LAT;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return { t: 1, foot: a }; // degeneriran odsek (a ≈ b)
  const raw = (ux * dx + uy * dy) / len2;
  const t = Math.min(1, Math.max(0, raw));
  return {
    t,
    foot: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) },
  };
}

/**
 * Pravokotna razdalja (km) od točke do odseka [a, b] — haversine do
 * pravokotne nogavice (point-to-segment).
 */
export function pointToSegmentKm(user: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const { foot } = projectOnSegment(user, a, b);
  return haversineKm(user, foot);
}

// ── Napredek po poti med postankoma ─────────────────────────────────────

/**
 * Napredek (%) opravljene poti med prejšnjim in naslednjim postankom:
 * projekcija uporabnika na odsek [prevStop, nextStop] → t × 100,
 * zaokroženo in CLAMPED na 0–100 (za ciljem 100, pred startom 0).
 * Degeneriran odsek (enaki točki) → 100 (cilj je že tu).
 */
export function progressAlongRoute(
  user: GeoPoint,
  prevStop: GeoPoint,
  nextStop: GeoPoint
): number {
  const { t } = projectOnSegment(user, prevStop, nextStop);
  return Math.round(t * 100);
}

// ── Odklon od načrtovane poti ───────────────────────────────────────────

/** Prag odklona (km) za opozorilo „Odklon od načrtovane poti“. */
export const OFF_ROUTE_KM = 3;

export interface OffRouteCheck {
  offRoute: boolean;
  /** Izmerjen odklon v km (razkrit v UI). */
  deviationKm: number;
  /**
   * Iskrena baza merjenja:
   *  - "route"   → proti podani poliliniji (OSRM geometrija ali premica
   *                [prejšnji, naslednji], ki jo poda klicatelj);
   *  - "straight" → brez routeCoords poznamo SAMO premico do cilja —
   *                odklon ni merljiv, pošteno poročamo 0 (razkrito).
   */
  basis: "route" | "straight";
}

/**
 * Odklon uporabnika od načrtovane poti do naslednjega postanka.
 *
 * Z routeCoords (≥ 2 točki): najmanjša pravokotna razdalja do kateregakoli
 * odseka polilinije (point-to-segment) — > 3 km → offRoute = true.
 *
 * BREZ routeCoords (iskrenostni kanon): edina referenca je premica do
 * cilja same — uporabnik je na nji vedno (odklon trivialno 0), zato
 * odklona NE izmišljamo: offRoute = false, deviationKm = 0, baza
 * "straight" je RAZKRITA. Klicatelj naj za pravo meritev poda geometrijo
 * OSRM ali približek [prejšnji postanek, naslednji postanek].
 */
export function offRouteCheck(
  user: GeoPoint,
  nextStop: GeoPoint,
  routeCoords?: readonly GeoPoint[]
): OffRouteCheck {
  if (routeCoords && routeCoords.length >= 2) {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i + 1 < routeCoords.length; i++) {
      const a = routeCoords[i]!;
      const b = routeCoords[i + 1]!;
      min = Math.min(min, pointToSegmentKm(user, a, b));
    }
    return {
      offRoute: min > OFF_ROUTE_KM,
      deviationKm: Math.round(min * 100) / 100,
      basis: "route",
    };
  }
  return { offRoute: false, deviationKm: 0, basis: "straight" };
}

// ── Zasebnost: zaokrožena pozicija za strežniški preračun ───────────────

/** Zaokroži na 4 decimale in normalizira −0 (stabilen, determinističen zapis). */
function round4(v: number): number {
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * ZASEBNOSTNI KOMPROMIS (dokumentiran): za strežniški preračun poti
 * pošljemo položaj zaokrožen na 4 decimalne mesta (~11 m mreža) —
 * dovolj natančno za OSRM vozno pot, hkrati iz strežniških dnevnikov
 * ni mogoče rekonstruirati točne lege. GPS sicer živi SAMO v klientu;
 * ta točka je edini izhod položaja iz brskalnika (ob eksplicitnem
 * preračunu, ki ga sproži uporabnik).
 */
export function roundedPrivacy(coords: GeoPoint): GeoPoint {
  return { lat: round4(coords.lat), lng: round4(coords.lng) };
}

// ── Prihod (geofence okoli trenutnega postanka) ─────────────────────────

/**
 * Radijus prihoda (km): 250 m okoli cilja postanka (P0-G, issue §16
 * „arrival state“). Namerno velikodušen — GPS točke so v mestu lahko
 * slabo vidljive; prihod je NAMIG, ne dokaz (iskreno razkrito v UI).
 */
export const ARRIVAL_RADIUS_KM = 0.25;

export interface ArrivalCheck {
  /** Ali je uporabnik znotraj radijusa prihoda trenutnega postanka. */
  arrived: boolean;
  /** Izmerjena premočrtna razdalja do cilja v km (zaokrožena na 3 m). */
  distanceKm: number;
}

/**
 * Preveri prihod uporabnika na ciljni postanek (geofence ~250 m).
 * Čista funkcija nad haversine — 0 DOM, 0 omrežja; UI pokaže stanje
 * „PRISPEL“ z razkritim radijusom in poudari gumb „Opravljeno“.
 */
export function arrivalCheck(user: GeoPoint, target: GeoPoint): ArrivalCheck {
  const distanceKm = Math.round(haversineKm(user, target) * 1000) / 1000;
  return { arrived: distanceKm <= ARRIVAL_RADIUS_KM, distanceKm };
}

// ── Zunanji handoff: OSM directions z izhodiščem ────────────────────────

/**
 * OSM directions URL z izhodiščem (živi GPS) — zunanji handoff kanon
 * (uporabnik IZRECNO klikne „Navigiraj“; enako kot vsak navigacijski
 * gumb pošlje njegovo pozicijo zunanji storitvi, ki jo je izbral).
 */
export function osmDirectionsUrlWithOrigin(from: GeoPoint, to: GeoPoint): string {
  return `https://www.openstreetmap.org/directions?from=${from.lat}%2C${from.lng}&to=${to.lat}%2C${to.lng}`;
}

// ── Zunanji handoff: geo: URI za mobilni sistemski izbirnik ─────────────

/**
 * geo: URI cilja (P0-G, issue §16 „mobile geo URI + system chooser“) —
 * na mobilni napravi odpre SISTEMSKI izbirnik zemljevidov (Google Maps,
 * Waze, Apple Maps, Organic Maps …); na namizju OSM povezava ostane
 * glavna. 6 decimalk ≈ 0,1 m — enkratno izročilo točke ob kliku.
 * Normalizacija −0 (zaokrožena zahodna/južna vrednost ne pusti
 * „geo:-0.000000, …“).
 */
export function geoUri(target: GeoPoint): string {
  const fixed = (v: number): string => {
    const s = v.toFixed(6);
    return s === "-0.000000" ? "0.000000" : s;
  };
  return `geo:${fixed(target.lat)},${fixed(target.lng)}`;
}

// ── Validacija nove oblike /api/journey/route: { from, to } ─────────────

export interface RerouteBody {
  from: GeoPoint;
  to: string;
}

/**
 * Čista validacija telesa preračuna { from: {lat, lng}, to: "<slug>" }:
 *  - from.lat ∈ [-90, 90], from.lng ∈ [-180, 180] (končni števili);
 *  - to: neprazen niz IZ dovoljenega nabora slug-ov (strežnik poda
 *    kanonskih 74 destinacij; testi svoje majhne nabore).
 * Vrne null ob katerikoli nepravilnosti — strežnik odgovori 400
 * (izločeno v čisto funkcijo, da je testabilna brez strežnika).
 */
export function parseRerouteBody(
  body: unknown,
  allowedSlugs: ReadonlySet<string> | readonly string[]
): RerouteBody | null {
  if (typeof body !== "object" || body === null) return null;
  const o = body as Record<string, unknown>;
  const from = o.from;
  if (typeof from !== "object" || from === null) return null;
  const f = from as Record<string, unknown>;
  if (typeof f.lat !== "number" || typeof f.lng !== "number") return null;
  if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) return null;
  if (f.lat < -90 || f.lat > 90) return null;
  if (f.lng < -180 || f.lng > 180) return null;
  if (typeof o.to !== "string" || o.to.trim() === "") return null;
  const allowed =
    allowedSlugs instanceof Set ? allowedSlugs : new Set(allowedSlugs);
  if (!allowed.has(o.to)) return null;
  return { from: { lat: f.lat, lng: f.lng }, to: o.to };
}

// ── Tipovska straža odgovora /api/journey/route (klient ne zaupa žici) ──

/** En odsek poti v odgovoru (oblika faze 3, nespremenjena). */
export interface RouteLegInfo {
  from: string;
  to: string;
  km: number;
  min: number;
  source: "osrm" | "heuristic";
  geometry: [number, number][];
}

/** Odgovor /api/journey/route (slugs oblika + reroute dodatek). */
export interface JourneyRouteResponse {
  legs: RouteLegInfo[];
  totalKm: number;
  totalMin: number;
  method: "osrm" | "heuristic" | "mixed";
  /** Samo pri preračunu z žive GPS: odsevana zaokrožena from + ciljni slug. */
  reroute?: { from: GeoPoint; to: string };
}

/**
 * Straža odgovora poti: legs (vsaj 1) s preverjenimi km/min/source/
 * geometrijo [lat, lng], končna totalKm/totalMin, method iz nabora.
 * Klient NE zaupa slepo žici — vsak neveljaven odgovor → null → UI
 * pokaže iskreno napako (nikoli izmišljenih podatkov).
 */
export function isJourneyRouteResponse(v: unknown): v is JourneyRouteResponse {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.legs) || o.legs.length === 0) return false;
  for (const leg of o.legs) {
    if (typeof leg !== "object" || leg === null) return false;
    const lg = leg as Record<string, unknown>;
    if (typeof lg.from !== "string" || typeof lg.to !== "string") return false;
    if (
      typeof lg.km !== "number" ||
      !Number.isFinite(lg.km) ||
      lg.km < 0
    ) {
      return false;
    }
    if (
      typeof lg.min !== "number" ||
      !Number.isFinite(lg.min) ||
      lg.min < 0
    ) {
      return false;
    }
    if (lg.source !== "osrm" && lg.source !== "heuristic") return false;
    if (!Array.isArray(lg.geometry) || lg.geometry.length < 2) return false;
    for (const p of lg.geometry) {
      if (
        !Array.isArray(p) ||
        p.length < 2 ||
        typeof p[0] !== "number" ||
        !Number.isFinite(p[0]) ||
        typeof p[1] !== "number" ||
        !Number.isFinite(p[1])
      ) {
        return false;
      }
    }
  }
  if (typeof o.totalKm !== "number" || !Number.isFinite(o.totalKm)) return false;
  if (typeof o.totalMin !== "number" || !Number.isFinite(o.totalMin)) {
    return false;
  }
  return o.method === "osrm" || o.method === "heuristic" || o.method === "mixed";
}
