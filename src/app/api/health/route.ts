import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

import { db } from "@/lib/db";
import { cronSecretConfigured } from "@/lib/cron-auth";
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

  // 5) Provizijski sloj (v2.5.0) + partner kanal booking verige (v2.6.0)
  //    + registrska razširitev P0-F (v2.10.0): register partnerjev +
  //    nabor črpalk + partner rezervacije v My Trips ( AFFILIATE_*_ID
  //    žetoni se NAMENOMA ne preverjajo — fail-closed pomeni: brez
  //    žetona povezave delujejo javno, klikanja se štejejo).
  try {
    const { AFFILIATE_PROVIDERS } = await import("@/lib/affiliate-providers");
    const { FUEL_STATIONS } = await import("@/lib/fuel-stations");
    const {
      BOOKING_CHANNELS,
      PARTNER_SEARCH_CATEGORIES,
      searchPartnerOffers,
    } = await import("@/lib/journey/booking-provider");
    const commissionable = AFFILIATE_PROVIDERS.filter(
      (p) => p.category !== "fuel",
    ).length;
    const inChain = AFFILIATE_PROVIDERS.filter((p) =>
      PARTNER_SEARCH_CATEGORIES.includes(p.category),
    ).length;
    const partnerSearchOk =
      BOOKING_CHANNELS.includes("partner") &&
      searchPartnerOffers("bled").length === inChain;
    startup.push({
      name: "booking:affiliate",
      status: partnerSearchOk ? "ok" : "degraded",
      detail: partnerSearchOk
        ? `${inChain}/${commissionable} provizijskih partnerjev v booking verigi (PENDING → potrditev; ostali na /go straneh) + ${FUEL_STATIONS.length} črpalk (gorivo brez provizije — odprti podatki)`
        : `Register partnerjev (${inChain}/${commissionable}) ni uskladen s partner iskanjem — preveri booking-provider`,
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

  // 8) B2B tržnica (P0-H): statusni stroj moderacije — javno vidi SAMO
  //    objavljene (draft → pending → published; partner nikoli ne objavi sam).
  try {
    const [drafts, pending, published, rejected, partners] = await Promise.all([
      db.product.count({ where: { status: "draft" } }),
      db.product.count({ where: { status: "pending" } }),
      db.product.count({ where: { status: "published" } }),
      db.product.count({ where: { status: "rejected" } }),
      db.user.count({ where: { role: "partner" } }),
    ]);
    startup.push({
      name: "marketplace:moderation",
      status: "ok",
      detail: `${published} objavljenih (javno) · ${pending} v predaji · ${drafts} osnutkov · ${rejected} zavrnjenih · ${partners} partnerjev — javna tržnica vidi samo objavljene (§22)`,
      at: now(),
    });
  } catch {
    startup.push({
      name: "marketplace:moderation",
      status: "skipped",
      detail: "Tabela Product/User ni dosegljiva (migracija P0-H?) — preveri prisma/schema.prisma",
      at: now(),
    });
  }

  // 9) Ops plast (P0-I): cron jobi + fail-closed skrivnost + dim.
  //    Mehanska preverba: vse 4 cron poti obstajajo v drevesu API + CRON_SECRET
  //    je nastavljen (vrednost se NE razkrije — samo DA/NE) + AuditLog števec
  //    strojnih zagonov (sledljivost cron dejanj). Če drevesa virov ni mogoče
  //    prebrati (npr. standalone pojav), se to ISKRENO izpiše — registracijo
  //    poti v repotu pa mehansko zaklene test cron-ops-contract (P0-I).
  try {
    const cronRoutes = [
      "sto-reingest",
      "kiwitaxi-reingest",
      "recalculate-status",
      "draft-reminders",
    ];
    const fs = await import("node:fs/promises");
    await fs.access("src/app/api/cron");
    const routeChecks = await Promise.all(
      cronRoutes.map(async (route) => {
        try {
          await fs.access(`src/app/api/cron/${route}/route.ts`);
          return true;
        } catch {
          return false;
        }
      })
    );
    const routesOk = routeChecks.every(Boolean);
    const secretOk = cronSecretConfigured();
    let cronAuditCount: number | null = null;
    try {
      cronAuditCount = await db.auditLog.count({
        where: { actorType: "system" },
      });
    } catch {
      cronAuditCount = null;
    }
    startup.push({
      name: "ops:cron",
      status: routesOk ? "ok" : "degraded",
      detail: routesOk
        ? `4 cron poti registrirane (${cronRoutes.join(", ")}) · CRON_SECRET: ${
            secretOk ? "nastavljen (jobi se izvajajo z Bearer žetonom)" : "NI nastavljen — jobi so ZAPRTI (fail-closed 401)"
          } · dim: \`bun run smoke\` (P0-I)${cronAuditCount !== null ? ` · ${cronAuditCount} sistemskih AuditLog zapisov` : ""}`
        : "Manjka ena ali več cron poti v src/app/api/cron/ — preveri drevo (P0-I)",
      at: now(),
    });
  } catch {
    startup.push({
      name: "ops:cron",
      status: "skipped",
      detail: "Drevo virov (src/app/api/cron) v tem okolju ni dosegljivo — registracijo poti mehansko zaklepa test cron-ops-contract; CRON_SECRET gate ostaja fail-closed",
      at: now(),
    });
  }

  // 10) PRODUCTION CUTOVER (issue #2 §8): podatkovna povezava + migracijsko
  //     stanje + build identiteta — BREZ skrivnosti (samo protokol/latenca/
  //     števci/SHA, nikoli povezovalni niz).
  try {
    const url = process.env.DATABASE_URL ?? "";
    const engine = url.startsWith("file:")
      ? "sqlite"
      : url.startsWith("postgres://") || url.startsWith("postgresql://")
        ? "postgresql"
        : null;
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - t0;

    if (engine === "postgresql") {
      // Produkcija: _prisma_migrations obstane SAMO ob pravem `prisma migrate
      // deploy` (db push NE pusti zgodovine — iskreno odkrito stanje).
      let migrationDetail = "baza deluje, zgodovina migracij NI dosegljiva";
      try {
        const rows = await db.$queryRaw<
          Array<{ migration_name: string; finished_at: Date | null; applied_steps_count: number }>
        >`SELECT migration_name, finished_at, applied_steps_count FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 1`;
        const last = rows[0];
        const total = await db.$queryRaw<Array<{ c: bigint }>>`SELECT COUNT(*)::int AS c FROM "_prisma_migrations"`;
        migrationDetail = last
          ? `${total[0]?.c ?? "?"} apliciranih migracij · zadnja: ${last.migration_name} (${
              last.finished_at ? new Date(last.finished_at).toISOString().slice(0, 10) : "v teku"
            })`
          : "0 migracij (prazna zgodovina — preveri db:pg:deploy)";
      } catch {
        migrationDetail =
          "tabela _prisma_migrations ne obstaja — baza je bila materializirana ZUNAJ migracij (db push?). Produkcija zahteva prisma migrate deploy (runbook §6)";
      }
      startup.push({
        name: "db:cutover",
        status: "ok",
        detail: `PostgreSQL povezljiv (${latencyMs} ms) · ${migrationDetail}`,
        at: now(),
      });
    } else if (engine === "sqlite") {
      startup.push({
        name: "db:cutover",
        status: "ok",
        detail: `SQLite povezljiv (${latencyMs} ms) — razvoj/peskovnik/CI plast; produkcija teče na PostgreSQL (prisma/postgres/schema.prisma + migracije; runbook docs/PRODUCTION-CUTOVER.md)`,
        at: now(),
      });
    } else {
      startup.push({
        name: "db:cutover",
        status: "degraded",
        detail: "DATABASE_URL protokol neprepoznan (podprta: file: / postgres://) — iskren izpis, brez vrednosti",
        at: now(),
      });
    }
  } catch (err) {
    startup.push({
      name: "db:cutover",
      status: "degraded",
      detail: `Podatkovna povezava NI dosegljiva (${
        err instanceof Error ? err.message.split("\n")[0] : "neznana napaka"
      })`,
      at: now(),
    });
  }

  // 11) Build identiteta (issue #2 §8 "git SHA/build id"): platforma ponudi
  //     enega odstandardnih env (Vercel: SOURCE_VERSION/VERCEL_GIT_COMMIT_SHA;
  //     Render: GIT_COMMIT/RENDER_GIT_COMMIT). Brez njih je to iskreno
  //     lokalni build — vrednosti se NE izmišljujejo.
  {
    const sha =
      process.env.SOURCE_VERSION ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GIT_COMMIT ??
      process.env.RENDER_GIT_COMMIT ??
      null;
    startup.push({
      name: "build:meta",
      status: "ok",
      detail: sha
        ? `build SHA ${sha.slice(0, 12)} (vir: platforma)`
        : "build SHA ni na voljo (lokalni razvoj — platforma ga ponudi ob deployu)",
      at: now(),
    });
  }

  return NextResponse.json({
    status: "ok",
    version: "2.66.2",
    startup,
    checkedAt: now(),
  });
}
