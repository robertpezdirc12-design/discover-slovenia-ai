import { NextRequest, NextResponse } from "next/server";

import { runStoIngest } from "@/lib/supply/providers/sto/ingest";
import { STO_ATTRIBUTION } from "@/lib/supply/providers/sto/llms-source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/cron/sto-reingest — tedenska osvežitev STO vsebine (torek 7:30 UTC,
 * vercel.json). Bearer CRON_SECRET je OBVEZEN (brez njega 401 — fail-closed,
 * kanon izvirnika); idempotenten (ponovni klic prepiše z istim virom).
 *
 * GET + POST sta podprta (Vercel cron pošlje GET z glavo Authorization).
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim().length === 0) {
    return NextResponse.json(
      { error: "CRON_SECRET ni nastavljen — cron je zaprt (fail-closed)" },
      { status: 401 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "neveljaven žeton" }, { status: 401 });
  }

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
