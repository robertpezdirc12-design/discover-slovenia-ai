import { NextRequest, NextResponse } from "next/server";

import { requireCronSecret } from "@/lib/cron-auth";
import { runWatchCheck } from "@/lib/watch-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/cron/watch-check — P1-C (issue #3 §4): prehod vrednotenja VSEH
 * aktivnih spremljanj (urnik: vsaki 2 uri v vercel.json).
 *
 * Kanoni (enako kot P0-I draft-reminders):
 *  - CRON_SECRET: Bearer žeton OBVEZEN (requireCronSecret — fail-closed 401);
 *  - IDEMPOTENCA: obvestila nosijo dedupeKey unique na (userId, dedupeKey)
 *    → vzporedni/ponovljeni zagon NE podvoji zapisov;
 *  - BOUNDED: največ WATCH_WEATHER_MAX_COORDS vremenskih klicev na zagon
 *    (determinističen vrstni red lokacij); ostale → iskreno unavailable;
 *  - ISKRENOST: vir nedosegljiv → unavailable (brez izmišljenih podatkov);
 *    nič za opozorilo je legitimno stanje, ne napaka;
 *  - AUDITABILITY: vsak zagon → AuditLog „watch.check_run" (števci v meta).
 */

async function handle(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  try {
    const report = await runWatchCheck();
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    console.error("[api/cron/watch-check] napaka:", err);
    return NextResponse.json(
      { status: "error", job: "watch-check", error: "Preverjanje ni uspelo (glej dnevnik)." },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
