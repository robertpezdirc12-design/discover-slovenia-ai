import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { DATA_STATS, DESTINATIONS } from "@/lib/slovenia-data";

export const dynamic = "force-dynamic";

/**
 * /api/health — vzorec produkcije (snapshots/render-api-health.json):
 * {status, version, checkedAt, startup:[{name, status, detail, at}]}.
 * Startup preverbe so iskrene: ok / skipped z dejanskim razlogom.
 */
export async function GET() {
  const now = () => new Date().toISOString();
  const startup: {
    name: string;
    status: "ok" | "skipped";
    detail: string;
    at: string;
  }[] = [];

  // 1) Skrivnosti: sandbox rekonstrukcije ne uporablja avtentikacijskih
  //    skrivnosti (NextAuth priključek pride kasneje) — iskreno zabeležimo.
  startup.push({
    name: "config:secrets",
    status: "ok",
    detail:
      "sandbox rekonstrukcija brez skrivnosti v kodi (avtentikacija še ni priključena — pričakovano)",
    at: now(),
  });

  // 2) Žig sheme: dejanska preverba dostopnosti baze (SQLite + Prisma).
  let dbCount: number | null = null;
  try {
    dbCount = await db.destination.count();
    startup.push({
      name: "schema:stamp",
      status: "ok",
      detail: `baza dosegljiva — ${dbCount} semenskih destinacij v tabeli Destination`,
      at: now(),
    });
  } catch (err) {
    startup.push({
      name: "schema:stamp",
      status: "skipped",
      detail: `baza ni dosegljiva (${
        err instanceof Error ? err.message.split("\n")[0] : "neznana napaka"
      }) — API deluje iz kanonskega dataseta`,
      at: now(),
    });
  }

  // 3) Kanonski nabor podatkov (izvorna resnica aplikacije).
  startup.push({
    name: "data:destinations",
    status: "ok",
    detail: `${DATA_STATS.destinations} destinacij · ${DATA_STATS.regions} regij · ${DATA_STATS.types} tipov · ${DATA_STATS.countries} države (seed usklajen: ${
      dbCount === DESTINATIONS.length ? "DA" : dbCount === null ? "NEZNANO" : `NE (${dbCount})`
    })`,
    at: now(),
  });

  return NextResponse.json({
    status: "ok",
    version: "2.3.1",
    startup,
    checkedAt: now(),
  });
}
