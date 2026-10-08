import { NextRequest, NextResponse } from "next/server";

import { loadKiwitaxiRoutes } from "@/lib/supply/providers/kiwitaxi/routes";
import { KIWITAXI_ATTRIBUTION } from "@/lib/supply/providers/kiwitaxi/routes";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * /api/cron/kiwitaxi-reingest — tedenska osvežitev KT feeda (sreda 7:30 UTC,
 * vercel.json). Bearer CRON_SECRET je OBVEZEN (requireCronSecret —
 * fail-closed).
 *
 * ISKRENOST: partner CSV feed še ni nameščen (P0-C čaka vir — feed je ostal
 * na mrtvem GitHub računu). Dokler vir ne obstaja, je odgovor namernen
 * no-op s statusom 204: cron je zdrav, plast čaka podatke — nikoli ne
 * pobarvamo praznine kot uspeh, nikoli ne pišemo prazne množice.
 */
async function handle(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const loaded = await loadKiwitaxiRoutes();
  if (loaded.status === "ok") {
    return NextResponse.json({
      status: "ok",
      note: "feed je lokalna množica — osvežitev teče z `bun run kiwitaxi:ingest --csv <feed>` (runbook DATA-PROVENANCE.md)",
      routes: loaded.dataset.routes.length,
      ingestedAt: loaded.dataset.ingestedAt,
      attribution: KIWITAXI_ATTRIBUTION,
    });
  }

  // Feed (še) ni nameščen: iskren no-op — cron deluje, plast čaka vir.
  return new NextResponse(null, {
    status: 204,
    headers: {
      "x-dsa-status": "feed-not-installed",
      "x-dsa-reason": "partner CSV čaka vir (P0-C gate data)",
    },
  });
}

export const GET = handle;
export const POST = handle;
