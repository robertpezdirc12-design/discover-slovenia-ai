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

  // 6) Supply plast (P0-B, v2.7.0): register zmožnosti + matrika življenjskega
  //    cikla + mehanska izpeljeka stanj — usklajenost med tremi registri
  //    (supply ← /go hub ← affiliate). Env se NE preverja po vrednostih
  //    (Boolean-only kanon; izpis samo števci stanj).
  try {
    const { SUPPLY_REGISTRY } = await import("@/lib/supply/registry");
    const { PRODUCTION_MATRIX } = await import("@/lib/supply/production-matrix");
    const { checkAllProviders } = await import("@/lib/supply/activation-check");
    const registryIds = new Set(SUPPLY_REGISTRY.map((p) => p.id));
    const matrixIds = new Set(PRODUCTION_MATRIX.map((e) => e.id));
    const usklajeno =
      registryIds.size === matrixIds.size &&
      [...registryIds].every((id) => matrixIds.has(id));
    const poročilo = checkAllProviders({});
    startup.push({
      name: "supply:matrix",
      status: usklajeno ? "ok" : "degraded",
      detail: usklajeno
        ? `${SUPPLY_REGISTRY.length} ponudnikov (register ≡ matrika) — 🟢 ${poročilo.counts.ACTIVE} živih · 🔵 ${poročilo.counts.CONFIGURED} konfiguriranih · ⚪ ${poročilo.counts.NOT_CONFIGURED} nekonfiguriranih · 🔴 ${poročilo.counts.BLOCKED} zunanjih ovir (iskrena matrika; /api/health ne izpisuje env vrednosti)`
        : `Register (${registryIds.size}) in matrika (${matrixIds.size}) nista usklajena — preveri src/lib/supply/`,
      at: now(),
    });
  } catch {
    startup.push({
      name: "supply:matrix",
      status: "skipped",
      detail: "Moduli supply plasti niso dosegljivi",
      at: now(),
    });
  }

  // 7) Podatkovni viri (P0-C, v2.9.0): STO uradna vsebina (ŽIV vir),
  //    FSQ lokalna množica, KiwiTaxi feed — iskrena stanja vsakega.
  try {
    const { loadStoContent } = await import(
      "@/lib/supply/providers/sto/content"
    );
    const { loadFsqDataset } = await import(
      "@/lib/supply/providers/fsq/loader"
    );
    const { loadKiwitaxiRoutes } = await import(
      "@/lib/supply/providers/kiwitaxi/routes"
    );

    const parts: string[] = [];
    let degraded = false;

    const sto = await loadStoContent();
    if (sto.status === "ok") {
      const days = Math.floor(
        (Date.now() - Date.parse(sto.dataset.fetchedAt)) / 86_400_000
      );
      parts.push(
        `STO ${sto.dataset.entries.length} vnosov / ${sto.dataset.languages.length} jezikov (ingest ${days === 0 ? "danes" : `pred ${days} d`})`,
      );
    } else {
      degraded = true;
      parts.push(`STO: ${sto.status === "missing" ? "ni ingesciran" : `neveljaven (${sto.reason})`}`);
    }

    const fsq = await loadFsqDataset();
    if (fsq.status === "ok") {
      parts.push(
        `FSQ ${fsq.stats.total} POI (snapshot ${fsq.manifest?.snapshotDate ?? "?"})`,
      );
    } else {
      parts.push("FSQ: množica čaka vir (dump na mrtvem GitHubu — gate data)");
    }

    const kt = await loadKiwitaxiRoutes();
    if (kt.status === "ok") {
      parts.push(`KiwiTaxi ${kt.dataset.routes.length} rut`);
    } else {
      parts.push("KiwiTaxi: feed čaka vir (partner CSV — gate data)");
    }

    startup.push({
      name: "data:feeds",
      status: degraded ? "degraded" : "ok",
      detail: `${parts.join(" · ")} — FSQ/KT čakanje vira je iskreno stanje (matrika), ne napaka`,
      at: now(),
    });
  } catch (err) {
    startup.push({
      name: "data:feeds",
      status: "skipped",
      detail: `Moduli podatkovnih virov niso dosegljivi (${
        err instanceof Error ? err.message.split("\n")[0] : "neznana napaka"
      })`,
      at: now(),
    });
  }

  return NextResponse.json({
    status: "ok",
    version: "2.9.0",
    startup,
    checkedAt: now(),
  });
}
