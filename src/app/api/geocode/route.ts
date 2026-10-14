import { NextResponse } from "next/server";
import { z } from "zod";

import { rateLimited, tooManyRequests } from "@/lib/rate-limit";
import { searchPlaces } from "@/lib/geocoding-server";

export const dynamic = "force-dynamic";

/**
 * /api/geocode — javno krajevno iskanje (geokodiranje; #35 faza 3, 2.64.0).
 *
 * Kanoni:
 *  · STREŽNIŠKI klic na Photon (javni BJS primerek do self-host) —
 *    odjemalec NIKOLI ne kliče Photon direktno (CSP nespremenjen:
 *    connect-src ostaja 'self' + tiles.openfreemap.org);
 *  · iskrenostni kanon: source "photon" SAMO za razčlenjen odgovor;
 *    napaka → source "none" + prazen seznam (HTTP 200 — odjemalec
 *    graciozno pade na ročni vnos, ki ostaja VEDNO mogoč);
 *  · rate limit 30/min (fair-use do javnega Photon + cache/breaker v
 *    geocoding-server.ts — vzorec R8: cache + rate limit);
 *  · podrobnost napake baza/omrežje NE gre k odjemalcu (P0 AUDIT L1).
 *
 * GET ?q=bled&lat=46.36&lng=14.09&limit=5 →
 *   { ok: true, source: "photon", hits: [{ label, name, city, region,
 *      country, countryCode, lat, lng, source }] }
 */

const QuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export async function GET(request: Request) {
  if (rateLimited(request, 30)) {
    return tooManyRequests();
  }

  const url = new URL(request.url);
  const raw = {
    q: url.searchParams.get("q") ?? "",
    lat: url.searchParams.get("lat") ?? undefined,
    lng: url.searchParams.get("lng") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };

  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Poizvedba: q (2–80 znakov); opcijsko lat, lng, limit (1–10).",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const { q, lat, lng, limit } = parsed.data;
  const result = await searchPlaces(q, { lat, lng, limit });

  return NextResponse.json(
    { ok: true, source: result.source, hits: result.hits },
    { status: 200 }
  );
}
