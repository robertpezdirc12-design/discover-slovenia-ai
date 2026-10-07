import { NextResponse } from "next/server";

import { routeLeg } from "@/lib/road-routing-server";
import { DESTINATIONS, type Destination } from "@/lib/slovenia-data";

export const dynamic = "force-dynamic";

/**
 * /api/journey/route — POST { slugs: string[] }
 *
 * Realne vozne poti med destinacijami iz kanonskega nabora (38) prek
 * javnega OSRM strežnika (router.project-osrm.org), z iskreno hevristično
 * zasilno potjo, kadar OSRM odpove (source "heuristic" — nikoli prikrito
 * kot "osrm"; glej src/lib/road-routing-server.ts).
 *
 * Kanon izvirnika: OSRM se kliče SAMO med koordinatami destinacij nabora
 * (ne poljubnih postankov), odseki se računajo SEKVENČNO (javni strežnik
 * ne sme biti preplavljen) in RoutingMethod je osrm | heuristic | mixed.
 *
 * Validacija: slugs = 2–12 veljavnih slug-ov brez dvojnikov (400 s
 * slovenskim sporočilom). Rate limit 30 zahtevkov/min (in-memory, 429).
 */

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

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

  // ── Validacija telesa { slugs: string[] } ───────────────────────
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
            "Vse destinacije morajo biti iz kanonskega nabora 38 destinacij.",
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
