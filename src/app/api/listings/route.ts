import { NextResponse } from "next/server";

import { LOKALI, type Lokal } from "@/lib/lokali-data";

export const dynamic = "force-dynamic";

/**
 * /api/listings — rekonstrukcija produkcjskega vira (oblika {listings, total}).
 * Podatkovna množica: src/lib/lokali-data.ts (uredniška kuracija — glej
 * LOKALI_HONESTY_NOTE; koordinat in kontaktov ni, zato jih odgovor ne izmišljuje).
 *
 * Filtri (vsi neobvezni, med seboj kombinirljivi):
 *   ?category=restaurant — kanonska kategorija (7 tipov)
 *   ?region=gorenjska     — kanonski ID regije (slovenia-data)
 *   ?q=franko             — iskanje po imenu/kraju/opisu (case-insensitive)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.trim();
  const region = searchParams.get("region")?.trim();
  const q = searchParams.get("q")?.trim().toLowerCase();

  let result: Lokal[] = LOKALI;

  if (category) {
    result = result.filter((x) => x.category === category);
  }
  if (region) {
    result = result.filter((x) => x.region === region);
  }
  if (q) {
    result = result.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.town.toLowerCase().includes(q) ||
        x.description.sl.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    listings: result,
    total: result.length,
  });
}
