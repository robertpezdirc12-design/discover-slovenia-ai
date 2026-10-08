import { NextRequest, NextResponse } from "next/server";

import { runStoIngest } from "@/lib/supply/providers/sto/ingest";
import { STO_ATTRIBUTION } from "@/lib/supply/providers/sto/llms-source";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/cron/sto-reingest — tedenska osvežitev STO vsebine (torek 7:30 UTC,
 * vercel.json). Bearer CRON_SECRET je OBVEZEN (requireCronSecret —
 * fail-closed); idempotenten (ponovni klic prepiše z istim virom).
 *
 * GET + POST sta podprta (Vercel cron pošlje GET z glavo Authorization).
 */
async function handle(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const report = await runStoIngest();
  // Poročilo je varno za dnevnik: 0 skrivnosti (javen vir, samo števci).
  return NextResponse.json(
    {
      ...report,
      attribution: STO_ATTRIBUTION,
    },
    { status: report.status === "error" ? 502 : report.wroteFile ? 200 : 207 },
  );
}

export const GET = handle;
export const POST = handle;
