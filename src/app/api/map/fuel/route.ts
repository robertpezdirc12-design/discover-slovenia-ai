import { NextResponse } from "next/server";

import {
  FUEL_PRECISION,
  FUEL_SOURCE,
  FUEL_STATIONS,
  filterFuelByBbox,
  fuelStationDTO,
  parseFuelBbox,
} from "@/lib/fuel-stations";

export const dynamic = "force-dynamic";

/**
 * /api/map/fuel — bencinske črpalke v pogledu zemljevida.
 *
 *   GET ?bbox=south,west,north,east
 *
 * Čista logika v src/lib/fuel-stations.ts; ta handler samo parsira,
 * validira (400 s slovenskimi sporočili) in sestavi odgovor.
 *
 * POZOR (E2E odkritje 2026-10-08): uporabljamo parseFuelBbox (BREZ
 * omejitve razpona), ne parseBbox iz map-pins (10°/15° omejitev za FSQ
 * pri zoom ≥ 15) — plast črpalk je namenjena pogledu CELE DRŽAVE.
 *
 * Iskrenost: source označuje kurirane odprte podatke (OSM/ODbL),
 * precision "approximate" (priključki/občine — nikoli „exact"), brez
 * odpiralnih časov in cen (uravnavane, se spreminjajo dnevno).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const bbox = parseFuelBbox(searchParams.get("bbox"));
  if (!bbox.ok) {
    return NextResponse.json({ error: bbox.error }, { status: 400 });
  }

  const stations = filterFuelByBbox(bbox.value);
  return NextResponse.json({
    stations: stations.map(fuelStationDTO),
    total: FUEL_STATIONS.length,
    returned: stations.length,
    precision: FUEL_PRECISION,
    source: FUEL_SOURCE,
  });
}
