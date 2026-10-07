import { NextRequest, NextResponse } from "next/server";

import {
  OSM_ATTRIBUTION,
  queryViewportPois,
} from "@/lib/supply/providers/osm/overpass";

export const dynamic = "force-dynamic";

/**
 * /api/pois?bbox=south,west,north,east — živi OSM POI sloj po viewportu
 * (P0-C, Overpass). Namerno omejitve (max površina, rate limit, timeout)
 * ščitijo javni vir; napaka je ISKRENA (status error + razlog + atribucija
 * ODbL) — nikoli izmišljeni POI, nikoli tiho prazna plast.
 */
export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("bbox") ?? "").trim();
  if (raw.length === 0) {
    return NextResponse.json(
      { error: "manjka bbox=south,west,north,east", attribution: OSM_ATTRIBUTION },
      { status: 400 },
    );
  }
  const parts = raw.split(",").map((v) => Number.parseFloat(v));
  if (parts.length !== 4 || parts.some((v) => Number.isNaN(v))) {
    return NextResponse.json(
      {
        error: "bbox potrebuje 4 številke: south,west,north,east",
        attribution: OSM_ATTRIBUTION,
      },
      { status: 400 },
    );
  }

  const result = await queryViewportPois(parts);

  if (result.status === "ok") {
    return NextResponse.json({
      status: "ok",
      total: result.pois.length,
      pois: result.pois,
      attribution: result.attribution,
      endpoint: result.endpoint,
    });
  }

  // Iskrena napaka: vrsta kode glede na razlog (viewport = uporabniška
  // napaka; rate limit = 429; omrežje/zrcala = 502 zunanji vir).
  const bboxReasons = [
    "viewport prevelik",
    "south mora biti",
    "west mora biti",
    "koordinate izven",
    "bbox potrebuje",
  ];
  const isUserError = bboxReasons.some((r) => result.reason.includes(r));
  const isRate = result.reason.startsWith("prehitro");
  return NextResponse.json(
    {
      status: "error",
      error: result.reason,
      attribution: result.attribution,
    },
    { status: isUserError ? 400 : isRate ? 429 : 502 },
  );
}
