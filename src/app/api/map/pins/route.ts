import { NextResponse } from "next/server";

import { buildPinsPayload, parseBbox, parseZoom } from "@/lib/map-pins";

export const dynamic = "force-dynamic";

/**
 * /api/map/pins — GET ?bbox=south,west,north,east&zoom=N
 *
 * Rekonstrukcija produkcijskega pins API-ja (oblika 1:1, preverjeno živo
 * na i-feel-slovenia.vercel.app 2026-10-07). Produkcija streže FSQ Open
 * Places (125.445 krajev) — te množice v peskovniku ni, zato ta route
 * pošteno streže LASTNE kanonske podatke (38 destinacij + 26 lokalov s
 * povezavo na destinacijo; koordinate lokalov so izpeljane iz središča
 * destinacije in tako označene — precision "destination_center").
 *
 * Logika je ČISTA v src/lib/map-pins.ts (testabilna brez strežnika);
 * ta handler samo parsira, validira (400 s slovenskimi sporočili) in
 * sestavi odgovor.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const bbox = parseBbox(searchParams.get("bbox"));
  if (!bbox.ok) {
    return NextResponse.json({ error: bbox.error }, { status: 400 });
  }

  const zoom = parseZoom(searchParams.get("zoom"));
  if (!zoom.ok) {
    return NextResponse.json({ error: zoom.error }, { status: 400 });
  }

  return NextResponse.json(buildPinsPayload(bbox.value, zoom.value));
}
