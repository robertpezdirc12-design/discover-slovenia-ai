import { NextResponse } from "next/server";

import {
  DESTINATIONS,
  type Destination,
} from "@/lib/slovenia-data";

export const dynamic = "force-dynamic";

/**
 * /api/destinations — 1:1 oblika produkcije: {destinations, total}.
 * Filtri (vsi neobvezni, med seboj kombinirljivi):
 *   ?region=gorenjska   — kanonski ID regije
 *   ?type=city          — kanonski ID tipa (9 tipov)
 *   ?q=bled             — iskanje po imenu/tagline/opisu (case-insensitive)
 * Brez filtrov vrne vseh 38 zapisov v kanonski vrstni redu.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region")?.trim();
  const type = searchParams.get("type")?.trim();
  const q = searchParams.get("q")?.trim().toLowerCase();

  let result: Destination[] = DESTINATIONS;

  if (region) {
    result = result.filter((d) => d.region === region);
  }
  if (type) {
    result = result.filter((d) => d.type === type);
  }
  if (q) {
    result = result.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.tagline.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    destinations: result,
    total: result.length,
  });
}
