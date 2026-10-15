/**
 * pg-live-verify.ts — POSTGRESQL LIVE VRATA (issue #2 §2/§3; 2.66.0).
 *
 * Motivacija (lekcija 9, uporabljena tudi na podatkovno plast): `db:pg:deploy`
 * (prisma migrate deploy 0_init) je bil do 2.65.3 TEORETIČEN — CI je dokazoval
 * suho (baseline ≡ from-empty dif), nikoli pa, da se migracija DEJANSKO aplicira
 * na živ PostgreSQL. Prvi resnični cutover ni smel biti prvi zagon.
 *
 * Ta skripta na VSAKEM pushu (obe CI platformi, pariteta) postavi ZIV PostgreSQL
 * 17 v uporabniškem prostoru (npm binarke @embedded-postgres/linux-x64 — brez
 * sistemskih odvisnosti, brez root-a, brez Docker services) in izvede točno
 * runbook sekvenco (docs/PRODUCTION-CUTOVER.md §2 + §3):
 *
 *   1. suha vrata:            db:pg:check (+ db:pg:validate)
 *   2. SHADOW REPLAY (§2):    migrate diff --from-migrations → pričakovano
 *                             "-- This is an empty migration." (migracije ≡ shema)
 *   3. DEPLOY (§3):           db:pg:deploy → 0_init apliciran
 *   4. IDEMPOTENCA:           drugi deploy → "No pending migrations to apply"
 *   5. MIGRATE STATUS:        "Database schema is up to date"
 *   6. INTEGRITY (§3 vrata):  db:integrity → prismaMigrations 1, št. tabel ≡
 *                             št. modelov v shemi (samokalibracijsko — NI
 *                             trdo-kodirano, zraste s shemo)
 *   7. DATA PLANE:            db:pg:generate (PG klient) → seed → števec
 *                             "skupaj ≡ pričakovano" → integrity ponovno
 *                             (Destination ≡ seed števec)
 *   8. ČISTILO:               db:generate (SQLite klient nazaj — nadaljnji
 *                             CI koraki ostanejo na razvojnem providerju)
 *
 * ISKRENOSTNI KANON: vsak korak je fail-closed (izhod 1 ob prvem rdečem),
 * pričakovanja so ASERTIRANA (ne zgolj izhodne kode), URL-ji se nikoli ne
 * izpisujejo (samo protokol), PG se ustaví tudi ob napaki (finally).
 *
 * OPOMBE O OKOLJU (izmerjeno 15. 10. 2026, glej docs/evidence/pg-live-verify/):
 *  - npm paket nosi libicu*.so.60.2, binarke pa iščejo .so.60 — hidracija
 *    symlinkov (pg-symlinks.json) je ZAKLENJENA za bun postinstall; skripta
 *    hidriranje sama, s KOPIJAMI (deluje tudi tam, kjer so symlinki
 *    prepovedani — npr. peskovnica; linker ne vidi razlike).
 *  - Bun v nekaterih okoljih ne zna vezati na "localhost" (AggregateError);
 *    vsa naša povezava zato eksplicitno uporablja 127.0.0.1 + timeout.
 *  - Bun 1.3.x + import embedded-postgres IGNORIRA process.exitCode (izhod 0
 *    tudi ob napaki — izmerjeno 15. 10.); zato glavna skripta zaključi z
 *    eksplicitnim process.exit(koda).
 *
 * Zagon: bun scripts/pg-live-verify.ts
 * Env:   PG_LIVE_PORT (privzeto 55433) · PG_LIVE_REPORT (JSON poročilo, CI)
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";

// ── Konstante ────────────────────────────────────────────────────────────────

const PG_VERSION_PREFIX = "17"; // produkcija = PostgreSQL 17 (runbook kanon)
const PORT = Number(process.env.PG_LIVE_PORT ?? 55433);
const HOST = "127.0.0.1"; // NIKOLI "localhost" (Bun AggregateError quirk)
const CONNECT_TIMEOUT_MS = 5_000;
const PLATFORM_PKG = "node_modules/@embedded-postgres/linux-x64";

// ── Pripomočki ───────────────────────────────────────────────────────────────

type Step = { name: string; ms: number; ok: boolean; note?: string };
const steps: Step[] = [];

function step<T>(name: string, fn: () => T): T {
  const t0 = Date.now();
  try {
    const out = fn();
    steps.push({ name, ms: Date.now() - t0, ok: true });
    console.log(`✓ ${name} (${Date.now() - t0} ms)`);
    return out;
  } catch (e) {
    steps.push({
      name,
      ms: Date.now() - t0,
      ok: false,
      note: String(e).slice(0, 300),
    });
    console.error(`✗ ${name} (${Date.now() - t0} ms): ${String(e)}`);
    throw e;
  }
}

/** Zaženi ukaz z env; izhod pade, če exit ≠ 0; stdout/stderr se vrne in izpiše. */
function run(cmd: string[], env: Record<string, string>): string {
  const proc = Bun.spawnSync(cmd, {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = proc.stdout.toString();
  const err = proc.stderr.toString();
  if (out.trim()) console.log(out.trimEnd());
  if (err.trim()) console.error(err.trimEnd());
  if (proc.exitCode !== 0) {
    throw new Error(`ukaz padel (exit ${proc.exitCode}): ${cmd.join(" ")}`);
  }
  return out;
}

/** Zaženi ukaz in ASERTIRAJ vsebino izhoda (fail-closed, ne zgolj exit koda). */
function runAssert(
  cmd: string[],
  env: Record<string, string>,
  mustContain: string,
  label: string,
): string {
  const out = run(cmd, env);
  if (!out.includes(mustContain)) {
    throw new Error(
      `${label}: izhod NE vsebuje pričakovanega niza ("${mustContain}")`,
    );
  }
  return out;
}

/** Število modelov v glavni shemi — samokalibracija namesto trdo-kodiranih števil. */
function countModels(): number {
  const text = readFileSync("prisma/schema.prisma", "utf8");
  return (text.match(/^model\s+/gm) ?? []).length;
}

/** Hidracija knjižnic: kopije namesto symlinki (glej glavo). Idempotentno. */
function hydratePlatformLibs(): number {
  const manifestPath = `${PLATFORM_PKG}/native/pg-symlinks.json`;
  if (!existsSync(manifestPath)) {
    throw new Error(`${manifestPath} ne obstaja — platforma podprta samo linux-x64`);
  }
  const entries = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as { source: string; target: string }[];
  let created = 0;
  for (const e of entries) {
    const src = `${PLATFORM_PKG}/${e.source}`;
    const dst = `${PLATFORM_PKG}/${e.target}`;
    if (!existsSync(dst)) {
      cpSync(src, dst); // KOPIJA (symlinki niso vedno dovoljeni; linker ne vidi razlike)
      created++;
    }
  }
  for (const bin of ["initdb", "pg_ctl", "postgres"]) {
    if (!existsSync(`${PLATFORM_PKG}/native/bin/${bin}`)) {
      throw new Error(`manjka binarka native/bin/${bin}`);
    }
  }
  return created;
}

// ── Glavna sekvenca ──────────────────────────────────────────────────────────

async function main(): Promise<number> {
  if (process.platform !== "linux" || process.arch !== "x64") {
    console.error(
      `pg-live-verify: podprta samo linux-x64 (trenutno ${process.platform}-${process.arch}) — binarke @embedded-postgres so linux-x64.`,
    );
    return 2;
  }

  const t0 = Date.now();
  const dataDir = `/tmp/pg-live-verify-${process.pid}-${Date.now()}`;
  const pgUrl = `postgresql://postgres:ci@${HOST}:${PORT}/dsa`;
  const shadowUrl = `postgresql://postgres:ci@${HOST}:${PORT}/dsa_shadow`;
  const urlProtocol = "postgresql://"; // v log gre SAMO protokol, nikoli URL

  let pgClientGenerated = false;
  // Ref-objekt namesto spremenljivke: TS closure-narrowing sicer označi
  // dodelitev znotraj step() closure-a kot "nikoli" (tsc TS2339 v finally).
  const pgRef: { current: InstanceType<typeof EmbeddedPostgres> | null } = {
    current: null,
  };

  try {
    // 0. Okolje + hidracija binarnih knjižnic.
    step("okolje: linux-x64 + hidracija knjižnic (kopije)", () => {
      const n = hydratePlatformLibs();
      if (n > 0) console.log(`  (hidriranih knjižnic: ${n})`);
    });

    // 1. Ziv PostgreSQL 17 v uporabniškem prostoru.
    step(`PG 17 zagon (port ${PORT}, data ${dataDir})`, () => {
      pgRef.current = new EmbeddedPostgres({
        databaseDir: dataDir,
        user: "postgres",
        password: "ci",
        port: PORT,
        persistent: false,
      });
    });
    await step("PG initialise + start", async () => {
      await pgRef.current!.initialise();
      await pgRef.current!.start();
    });

    const ensureDb = async (name: string) => {
      const c = new Client({
        host: HOST,
        port: PORT,
        user: "postgres",
        password: "ci",
        database: "postgres",
        connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      });
      try {
        await c.connect();
        await c.query(`CREATE DATABASE ${name}`);
      } finally {
        await c.end().catch(() => {});
      }
    };
    await step("bazi dsa + dsa_shadow (127.0.0.1, timeout 5 s)", async () => {
      await ensureDb("dsa");
      await ensureDb("dsa_shadow");
    });

    // 2. Suha vrata.
    step("db:pg:check (shema ≡ glavna, baseline ≡ from-empty)", () => {
      run(["bun", "run", "db:pg:check"], {});
    });
    step("db:pg:validate (provider postgresql)", () => {
      run(["bun", "run", "db:pg:validate"], { DATABASE_URL: pgUrl });
    });

    // 3. SHADOW REPLAY (§2 opcijsko → obvezna CI vrata): migracije ≡ shema.
    step("shadow replay: migrate diff → prazna difa", () => {
      const out = run(
        [
          "bunx",
          "prisma",
          "migrate",
          "diff",
          "--from-migrations",
          "prisma/postgres/migrations",
          "--to-schema-datamodel",
          "prisma/postgres/schema.prisma",
          "--shadow-database-url",
          shadowUrl,
          "--script",
        ],
        { DATABASE_URL: pgUrl },
      );
      if (!out.includes("-- This is an empty migration.")) {
        throw new Error(
          "migracije NISO identične shemi (dif ni prazen) — poženi db:pg:baseline",
        );
      }
    });

    // 4. DEPLOY + IDEMPOTENCA + STATUS (§3).
    step("db:pg:deploy → 0_init apliciran", () => {
      runAssert(
        ["bun", "run", "db:pg:deploy"],
        { DATABASE_URL: pgUrl },
        "All migrations have been successfully applied",
        "deploy",
      );
    });
    step("idempotenca: 2. deploy → no pending", () => {
      runAssert(
        ["bun", "run", "db:pg:deploy"],
        { DATABASE_URL: pgUrl },
        "No pending migrations to apply",
        "idempotenca",
      );
    });
    step("migrate status → up to date", () => {
      runAssert(
        [
          "bunx",
          "prisma",
          "migrate",
          "status",
          "--schema",
          "prisma/postgres/schema.prisma",
        ],
        { DATABASE_URL: pgUrl },
        "Database schema is up to date",
        "status",
      );
    });

    // 5. INTEGRITY (§3 vrata) — samokalibracija proti številu modelov.
    const modelCount = step("preberi št. modelov iz sheme (kalibracija)", () =>
      countModels(),
    );
    const parseIntegrity = (label: string) =>
      step(label, () => {
        const out = run(["bun", "run", "db:integrity"], { DATABASE_URL: pgUrl });
        // stdout je čist JSON (log gre na stderr) — vzemi zadnji JSON objekt:
        const start = out.indexOf("{");
        if (start === -1) throw new Error("db:integrity ni vrnil JSON izhoda");
        const report = JSON.parse(out.slice(start)) as {
          provider: string;
          urlProtocol: string;
          tables: Record<string, number>;
          prismaMigrations: number | null;
        };
        if (report.provider !== "postgresql") {
          throw new Error(`provider = ${report.provider}, pričakovan postgresql`);
        }
        if (report.urlProtocol !== urlProtocol) {
          throw new Error(`protokol = ${report.urlProtocol} (pričakovan ${urlProtocol})`);
        }
        return report;
      });

    const rep1 = parseIntegrity("integrity po deployu (migracije + tabele)");
    step("asertacija: 1 migracija, tabele ≡ modeli", () => {
      if (rep1.prismaMigrations !== 1) {
        throw new Error(
          `prismaMigrations = ${rep1.prismaMigrations}, pričakovano 1 (natanko 0_init)`,
        );
      }
      const tableCount = Object.keys(rep1.tables).length;
      if (tableCount !== modelCount) {
        throw new Error(
          `št. tabel (${tableCount}) ≠ št. modelov (${modelCount}) — migracija ni pokrila cele sheme`,
        );
      }
    });

    // 6. DATA PLANE: PG klient + seed + števec + integrity ponovno.
    step("db:pg:generate (produkcijski PG klient)", () => {
      run(["bun", "run", "db:pg:generate"], {});
      pgClientGenerated = true;
    });
    const seedDest = step("seed nad živim PG (skupaj ≡ pričakovano)", () => {
      const out = run(["bun", "prisma/seed.ts"], { DATABASE_URL: pgUrl });
      const m = out.match(/Seed DESTINATIONS:.*skupaj (\d+) \(pričakovano (\d+)\)/);
      if (!m) throw new Error("seed izhod brez pričakovanega števca DESTINATIONS");
      if (m[1] !== m[2] || m[1] === "0") {
        throw new Error(`seed DESTINATIONS: skupaj=${m[1]}, pričakovano=${m[2]}`);
      }
      const l = out.match(/Seed LISTINGS:.*skupaj (\d+) \(pričakovano (\d+)\)/);
      if (l && (l[1] !== l[2] || l[1] === "0")) {
        throw new Error(`seed LISTINGS: skupaj=${l[1]}, pričakovano=${l[2]}`);
      }
      return Number(m[1]);
    });
    const rep2 = parseIntegrity("integrity po seedu");
    step("asertacija: Destination ≡ seed števec", () => {
      if (rep2.tables.Destination !== seedDest) {
        throw new Error(
          `Destination = ${rep2.tables.Destination}, seed = ${seedDest}`,
        );
      }
    });

    console.log("");
    console.log(
      `REZULTAT: ZELENO — PostgreSQL ${PG_VERSION_PREFIX} živa sekvence OK (${steps.length} korakov, ${Date.now() - t0} ms); ${urlProtocol}… port ${PORT}.`,
    );
    return 0;
  } catch (e) {
    console.error("");
    console.error(
      `REZULTAT: RDEČO — pg-live-verify je padel (${String(e).slice(0, 300)})`,
    );
    return 1;
  } finally {
    // ČISTILO (tudi ob napaki): SQLite klient nazaj + PG dol + data dir čiščenje.
    if (pgClientGenerated) {
      try {
        Bun.spawnSync(["bun", "run", "db:generate"], {
          stdout: "ignore",
          stderr: "ignore",
        });
        console.log("✓ čiščilo: SQLite klient obnovljen (db:generate)");
      } catch {
        console.error("✗ čiščilo: db:generate ni uspel — poženi ročno!");
      }
    }
    if (pgRef.current) {
      try {
        await pgRef.current.stop();
        console.log("✓ čiščilo: PG ustavljen");
      } catch {
        console.error("✗ čiščilo: pg.stop() ni uspel (osirel postmaster na portu " + PORT + "?)");
      }
    }
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    // CI poročilo (kot smoke: padec je dokaz, ne smeti).
    const reportPath = process.env.PG_LIVE_REPORT;
    if (reportPath) {
      try {
        mkdirSync("reports", { recursive: true });
        await Bun.write(
          reportPath,
          JSON.stringify(
            {
              generatedAt: new Date().toISOString(),
              pgVersion: PG_VERSION_PREFIX,
              steps,
              ok: steps.every((s) => s.ok),
            },
            null,
            2,
          ),
        );
      } catch {
        /* poročilo ne sme spremeniti izida */
      }
    }
  }
}

process.exit(await main()); // NE process.exitCode: import embedded-postgres drži handle in bun 1.3.x izgubi exitCode (izmerjeno 15.10. — glej evidence)
