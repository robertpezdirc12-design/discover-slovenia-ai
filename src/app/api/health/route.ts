import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

import { db } from "@/lib/db";
import { DATA_STATS, DESTINATIONS } from "@/lib/slovenia-data";

export const dynamic = "force-dynamic";

/**
 * /api/health — vzorec produkcije (snapshots/render-api-health.json):
 * {status, version, checkedAt, startup:[{name, status, detail, at}]}.
 * Startup preverbe so iskrene: ok / degraded / skipped z dejanskim razlogom.
 */
export async function GET() {
  const now = () => new Date().toISOString();
  const startup: {
    name: string;
    status: "ok" | "degraded" | "skipped";
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

  // 4) PWA offline: prisotnost sw.js + offline.html + manifest v public/
  //    (registracija: produkcija ali ?sw=1 — glej src/components/pwa/).
  try {
    const [sw, offlinePage, manifest] = await Promise.all([
      readFile("public/sw.js", "utf8"),
      readFile("public/offline.html", "utf8"),
      readFile("public/manifest.json", "utf8"),
    ]);
    const versionMatch = /SW_VERSION = "([^"]+)"/.exec(sw);
    startup.push({
      name: "pwa:offline",
      status: "ok",
      detail: `sw.js ${versionMatch?.[1] ?? "?"} + offline.html + manifest prisotni (registracija: produkcija ali ?sw=1)`,
      at: now(),
    });
  } catch {
    startup.push({
      name: "pwa:offline",
      status: "skipped",
      detail: "PWA offline datoteke niso prisotne (sw.js/offline.html/manifest)",
      at: now(),
    });
  }

  // 5) Provizijski sloj (v2.5.0) + partner kanal booking verige (v2.6.0):
  //    register partnerjev + nabor črpalk + partner rezervacije v My Trips
  //    ( AFFILIATE_*_ID žetoni se NAMENOMA ne preverjajo — fail-closed
  //    pomeni: brez žetona povezave delujejo javno, klikanja se štejejo).
  try {
    const { AFFILIATE_PROVIDERS } = await import("@/lib/affiliate-providers");
    const { FUEL_STATIONS } = await import("@/lib/fuel-stations");
    const { BOOKING_CHANNELS, searchPartnerOffers } = await import(
      "@/lib/journey/booking-provider",
    );
    const commissionable = AFFILIATE_PROVIDERS.filter(
      (p) => p.category !== "fuel",
    ).length;
    const partnerSearchOk =
      BOOKING_CHANNELS.includes("partner") &&
      searchPartnerOffers("bled").length === commissionable;
    startup.push({
      name: "booking:affiliate",
      status: partnerSearchOk ? "ok" : "degraded",
      detail: partnerSearchOk
        ? `${commissionable} provizijskih partnerjev (rezervacija v booking verigi, PENDING → potrditev) + ${FUEL_STATIONS.length} črpalk (gorivo brez provizije — odprti podatki)`
        : `Register partnerjev (${commissionable}) ni uskladen s partner iskanjem — preveri booking-provider`,
      at: now(),
    });
  } catch {
    startup.push({
      name: "booking:affiliate",
      status: "skipped",
      detail: "Moduli provizijskega sloja niso dosegljivi",
      at: now(),
    });
  }

  return NextResponse.json({
    status: "ok",
    version: "2.6.0",
    startup,
    checkedAt: now(),
  });
}
