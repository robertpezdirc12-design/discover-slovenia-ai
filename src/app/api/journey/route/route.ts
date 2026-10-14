import { NextResponse } from "next/server";

import {
  parseRerouteBody,
  roundedPrivacy,
} from "@/lib/go-gps";
import { routeLeg } from "@/lib/road-routing-server";
import { DESTINATIONS, type Destination } from "@/lib/slovenia-data";

export const dynamic = "force-dynamic";

/**
 * /api/journey/route — DVE obliki telesa POST:
 *
 * 1. { slugs: string[] } (faza 3, NESPREMENJENA oblika) — realne vozne
 *    poti med destinacijami iz kanonskega nabora (38) prek javnega OSRM
 *    strežnika (router.project-osrm.org), z iskreno hevristično zasilno
 *    potjo, kadar OSRM odpove (source "heuristic" — nikoli prikrito
 *    kot "osrm"; glej src/lib/road-routing-server.ts).
 *
 * 2. { from: {lat, lng}, to: "<slug>" } (issue #1 — PRERAČUN z živega
 *    GPS ob odklonu od poti): from je ZAOKROŽENA trenutna pozicija
 *    uporabnika (ZASEBNOSTNI KANON: klient pošlje 4 decimale ~11 m,
 *    strežnik zaokrožitev ŠE PRISILNO izvede — defense-in-depth;
 *    validacija lat ±90 / lng ±180), to mora biti slug iz nabora 74.
 *    Odziv ima ISTO obliko { legs, totalKm, totalMin, method } (ena
 *    noga, from "gps") + dodatno polje reroute { from, to }.
 *
 * Kanon izvirnika: OSRM se kliče SAMO z usmerjanjem odsek-po-odsek
 * (javni strežnik ne sme biti preplavljen) in RoutingMethod je
 * osrm | heuristic | mixed.
 *
 * Validacija: slugs = 2–12 veljavnih slug-ov brez dvojnikov; from/to
 * in slugs ne smejo biti kombinirani (400 s slovenskim sporočilom).
 * Rate limit 30 zahtevkov/min (in-memory, 429). 0 persistenc.
 */

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

/** Nabor 38 kanonskih slug-ov (validacija + razreševanje preračuna). */
const DEST_BY_SLUG = new Map(DESTINATIONS.map((d) => [d.slug, d] as const));
const DEST_SLUG_SET = new Set(DEST_BY_SLUG.keys());

/** Okno na IP (fiksno okno; peskovniški gateway nastavi x-forwarded-for). */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function allowRequest(key: string, now: number): boolean {
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (rateBuckets.size > 5_000) {
      // Varnostna mreža proti nenehavemu pomnilniku: počisti potekla okna.
      for (const [k, v] of rateBuckets) {
        if (now >= v.resetAt) rateBuckets.delete(k);
      }
    }
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT;
}

interface JourneyLeg {
  from: string;
  to: string;
  km: number;
  min: number;
  source: "osrm" | "heuristic";
  geometry: [number, number][];
}

export async function POST(request: Request) {
  // ── Rate limit (30/min na odjemalca) ─────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(ip, Date.now())) {
    return NextResponse.json(
      { error: "Preveč zahtevkov — poskusite znova čez minuto." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // ── Validacija telesa ───────────────────────────────────────
  // Dve dovoljeni obliki: { slugs: [2..12] } (faza 3) ALI
  // { from: {lat,lng}, to: "<slug>" } (issue #1 preračun z živega GPS).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Neveljavno telo zahteve — pričakovan JSON." },
      { status: 400 }
    );
  }

  const slugs = (body as { slugs?: unknown } | null)?.slugs;
  const hasRerouteShape =
    (body as { from?: unknown } | null)?.from !== undefined ||
    (body as { to?: unknown } | null)?.to !== undefined;

  // ── NOVA oblika: { from, to } — preračun z žive GPS ──────────
  if (slugs === undefined) {
    // Čista validacija (izvoz v go-gps.ts — testabilna brez strežnika):
    // lat ±90 / lng ±180, končni števili, to iz nabora 74.
    const reroute = parseRerouteBody(body, DEST_SLUG_SET);
    if (!reroute) {
      return NextResponse.json(
        {
          error:
            'Neveljaven preračun: pričakovana oblika { from: { lat, lng }, to: "<slug>" } z lat ±90 / lng ±180 in slug-om iz nabora 74 destinacij.',
        },
        { status: 400 }
      );
    }
    const dest = DEST_BY_SLUG.get(reroute.to) as Destination;

    // ZASEBNOST (defense-in-depth): strežnik izvede zaokrožitev na 4
    // decimale (~11 m) SAM — tudi če bi klient poslal natančnejšo točko.
    const from = roundedPrivacy(reroute.from);

    const leg = await routeLeg(from, dest.coords);
    return NextResponse.json({
      legs: [
        {
          from: "gps",
          to: dest.slug,
          km: leg.km,
          min: leg.min,
          source: leg.source,
          geometry: leg.geometry,
        },
      ],
      totalKm: Math.round(leg.km * 10) / 10,
      totalMin: Math.round(leg.min),
      method: leg.source,
      reroute: { from, to: dest.slug },
    });
  }

  // ── OBSTOJEČA oblika: { slugs: [2..12] } — 100 % nespremenjena ──
  if (hasRerouteShape) {
    return NextResponse.json(
      {
        error:
          "Telo ne sme združevati slugs in from/to — uporabi eno od oblik.",
      },
      { status: 400 }
    );
  }
  if (!Array.isArray(slugs) || slugs.length < 2 || slugs.length > 12) {
    return NextResponse.json(
      { error: "slugs mora biti seznam 2–12 destinacij." },
      { status: 400 }
    );
  }
  if (slugs.some((s) => typeof s !== "string")) {
    return NextResponse.json(
      { error: "Vsi elementi slugs morajo biti nizi (slug-i destinacij)." },
      { status: 400 }
    );
  }
  if (new Set(slugs).size !== slugs.length) {
    return NextResponse.json(
      { error: "slugs ne sme vsebovati dvojnikov." },
      { status: 400 }
    );
  }

  const bySlug = new Map(DESTINATIONS.map((d) => [d.slug, d]));
  const resolved: Destination[] = [];
  for (const slug of slugs) {
    const d = bySlug.get(slug);
    if (!d) {
      return NextResponse.json(
        {
          error:
            "Vse destinacije morajo biti iz kanonskega nabora 74 destinacij.",
        },
        { status: 400 }
      );
    }
    resolved.push(d);
  }

  // ── Odseki: SEKVENČNO (concurrency guard za javni OSRM) ────────
  const legs: JourneyLeg[] = [];
  for (let i = 0; i + 1 < resolved.length; i++) {
    const from = resolved[i] as Destination;
    const to = resolved[i + 1] as Destination;
    const leg = await routeLeg(from.coords, to.coords);
    legs.push({
      from: from.slug,
      to: to.slug,
      km: leg.km,
      min: leg.min,
      source: leg.source,
      geometry: leg.geometry,
    });
  }

  // ── Povzetek + RoutingMethod (kanon izvirnika) ──────────────────
  const totalKm =
    Math.round(legs.reduce((sum, l) => sum + l.km, 0) * 10) / 10;
  const totalMin = Math.round(legs.reduce((sum, l) => sum + l.min, 0));
  const allOsrn = legs.every((l) => l.source === "osrm");
  const allHeuristic = legs.every((l) => l.source === "heuristic");
  const method: "osrm" | "heuristic" | "mixed" = allOsrn
    ? "osrm"
    : allHeuristic
      ? "heuristic"
      : "mixed";

  return NextResponse.json({ legs, totalKm, totalMin, method });
}
