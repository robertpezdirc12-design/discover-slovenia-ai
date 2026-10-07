/**
 * KIWITAXI RUTE — transfer feed z objavljenimi cenami (P0-C, issue §7).
 *
 * RECOVER: naslednik data/kiwitaxi-routes.json plasti izvirnika
 * (Task 43 — prvi realni partnerjev feed). Izvirnikova datoteka z realnimi
 * objavljenimi cenami je ostala na mrtvem GitHub računu — ta modul
 * obnavlja SHEMO, VALIDACIJO relacij in iskanje; feed čaka vir
 * (matrika: gate „data" — partner CSV iz affiliate programa).
 *
 * KANON (izvirnikov README):
 *  · rute, ki se DOTIKAJO Slovenije (iz SI / v SI) + regionalne, kjer
 *    feed dejansko vsebuje podatke;
 *  · kjer feed nima podatkov → iskreno „ni transfernih rut" (NAPAKA
 *    ni — praznina je odgovor);
 *  · cena je OBJAVLJENA „od"-cena vira (FROM_PRICE) — NI živ citat;
 *    rezervacija je ZUNANJA (affiliate povezava).
 */

import { readFile } from "node:fs/promises";

// ── Vrste ──────────────────────────────────────────────────────────────────

/** Canonical transfer ruta (2.x oblika — dokumentirana v DATA-PROVENANCE). */
export interface KiwitaxiRoute {
  /** Determinističen id: `${from}-${to}` (normalizirano, ASCII). */
  id: string;
  fromName: string;
  fromCountry: string; // ISO-2 (SI, HR, ME, AL, AT, IT …)
  toName: string;
  toCountry: string;
  /** Objavljena „od"-cena v EUR (vir — NI živ citat). */
  priceFromEur: number;
  /** Razred vozila (npr. Economy / Comfort / Minivan) — neobvezno. */
  vehicleClass?: string;
  /** Uradna povezava na rezervacijo pri partnerju — neobvezna. */
  url?: string;
}

/** data/kiwitaxi-routes.json (zapisal `bun run kiwitaxi:ingest`). */
export interface KiwitaxiDataset {
  source: string;
  license: string;
  ingestedAt: string;
  routes: KiwitaxiRoute[];
}

/** Atribucija — objavljene cene so partnerjeve. */
export const KIWITAXI_ATTRIBUTION =
  "Transferji in cene: KiwiTaxi (objavljeni partner feed) — rezervacija pri partnerju";

export const KIWITAXI_FEED_SOURCE =
  "KiwiTaxi partner feed (kiwitaxi.com — affiliate program)";

// ── Validacija (čista, fail-closed) ────────────────────────────────────────

export type RouteValidation =
  | { ok: true; route: KiwitaxiRoute }
  | { ok: false; reason: string };

/** Normaliziraj ime kraja v ASCII id (deterministično). */
function slugifyName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ISO2 = /^[A-Z]{2}$/;

/** Zavrni ruto, ki ne ustreza shemi (državi ISO-2, cena > 0, imeni). */
export function validateKiwitaxiRoute(raw: unknown): RouteValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "ruta ni objekt" };
  }
  const d = raw as Record<string, unknown>;
  if (typeof d.fromName !== "string" || d.fromName.trim().length === 0) {
    return { ok: false, reason: "manjka fromName" };
  }
  if (typeof d.toName !== "string" || d.toName.trim().length === 0) {
    return { ok: false, reason: "manjka toName" };
  }
  if (typeof d.fromCountry !== "string" || !ISO2.test(d.fromCountry)) {
    return { ok: false, reason: `fromCountry ni ISO-2: ${String(d.fromCountry)}` };
  }
  if (typeof d.toCountry !== "string" || !ISO2.test(d.toCountry)) {
    return { ok: false, reason: `toCountry ni ISO-2: ${String(d.toCountry)}` };
  }
  const price = d.priceFromEur;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return { ok: false, reason: `cena ni pozitivna: ${String(price)}` };
  }
  const fromName = d.fromName.trim();
  const toName = d.toName.trim();
  return {
    ok: true,
    route: {
      id: `${slugifyName(fromName)}-${slugifyName(toName)}`,
      fromName,
      fromCountry: d.fromCountry,
      toName,
      toCountry: d.toCountry,
      priceFromEur: Math.round(price * 100) / 100,
      ...(typeof d.vehicleClass === "string" && d.vehicleClass.trim()
        ? { vehicleClass: d.vehicleClass.trim() }
        : {}),
      ...(typeof d.url === "string" && /^https:\/\//.test(d.url)
        ? { url: d.url }
        : {}),
    },
  };
}

/** Kanon izvirnika: ruta se dotika Slovenije (iz SI ali v SI). */
export function routeTouchesSlovenia(route: KiwitaxiRoute): boolean {
  return route.fromCountry === "SI" || route.toCountry === "SI";
}

// ── Iskanje po relacijah (čisto) ──────────────────────────────────────────

export interface RouteMatch {
  route: KiwitaxiRoute;
  /** 2 = obe končni točki zadeta · 1 = ena. */
  matchedStops: number;
}

/** Poišči rute med kraji (neobčutljivo na velikost/diakritiko/ločila). */
export function findRoutes(
  from: string,
  to: string,
  routes: readonly KiwitaxiRoute[]
): RouteMatch[] {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const nf = norm(from);
  const nt = norm(to);
  if (!nf && !nt) return [];

  const out: RouteMatch[] = [];
  for (const route of routes) {
    const rf = norm(route.fromName);
    const rt = norm(route.toName);
    let matched = 0;
    const fromHit = nf.length > 0 && (rf === nf || rf.includes(nf) || nf.includes(rf));
    const toHit = nt.length > 0 && (rt === nt || rt.includes(nt) || nt.includes(rt));
    if (fromHit) matched += 1;
    if (toHit) matched += 1;
    if (matched > 0) out.push({ route, matchedStops: matched });
  }
  // Dvojne zadetke prve, potem cenejše — deterministično.
  out.sort(
    (a, b) =>
      b.matchedStops - a.matchedStops ||
      a.route.priceFromEur - b.route.priceFromEur ||
      (a.route.id < b.route.id ? -1 : a.route.id > b.route.id ? 1 : 0)
  );
  return out;
}

// ── Nalagalnik (strežniški, iskren) ────────────────────────────────────────

export type KiwitaxiLoadResult =
  | { status: "ok"; dataset: KiwitaxiDataset }
  | { status: "missing" }
  | { status: "invalid"; reason: string };

export async function loadKiwitaxiRoutes(
  dataDir: string = "data"
): Promise<KiwitaxiLoadResult> {
  let raw: string;
  try {
    raw = await readFile(`${dataDir}/kiwitaxi-routes.json`, "utf8");
  } catch {
    return { status: "missing" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: "invalid",
      reason: `JSON napaka: ${err instanceof Error ? err.message : "neznana"}`,
    };
  }
  const d = parsed as Record<string, unknown>;
  if (!Array.isArray(d.routes)) {
    return { status: "invalid", reason: "routes ni polje" };
  }
  const routes: KiwitaxiRoute[] = [];
  let invalid = 0;
  for (const r of d.routes) {
    const v = validateKiwitaxiRoute(r);
    if (v.ok) routes.push(v.route);
    else invalid += 1;
  }
  if (routes.length === 0) {
    return { status: "invalid", reason: "0 veljavnih rut (vse zavrnjene)" };
  }
  return {
    status: "ok",
    dataset: {
      source: typeof d.source === "string" ? d.source : KIWITAXI_FEED_SOURCE,
      license:
        typeof d.license === "string"
          ? d.license
          : "Objavljene cene partnerja (FROM_PRICE — ni živ citat)",
      ingestedAt:
        typeof d.ingestedAt === "string" && !Number.isNaN(Date.parse(d.ingestedAt))
          ? d.ingestedAt
          : "",
      routes,
    },
  };
  // invalid števec se zavedeno zavrže — nalagalnik poroča samo veljavne;
  // ingest skripta je tista, ki zavrne celoto ob sumljivem viru (fail-closed).
}
