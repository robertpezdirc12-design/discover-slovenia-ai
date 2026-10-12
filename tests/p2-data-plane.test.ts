/**
 * P2-DATA-PLANE CONTRACT (issue #2) — Postgres produkcjska plast + migracije
 * + integrity vrata + legacy prenos + health razširitev.
 *
 * SOURCE-CONTRACT (vzorec p1a/p1c): zaklene STRUKTURO izvorne kode in
 * generiranih artefaktov. Če kdo izbriše postgres shemo, baseline migracijo,
 * CI vrata, integrity/migracijske skripte, bcrypt podporo ali health
 * preverbi, mreža pade.
 */

import { describe, expect, test } from "bun:test";
import { transformToPostgres } from "../scripts/pg-schema-sync";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("P2 §1 — postgres shema (izpeljana, en vir resnice)", () => {
  test("transformToPostgres: provider edina sprememba + glava z izvorom", async () => {
    const sqlite = await src("prisma/schema.prisma");
    const pg = transformToPostgres(sqlite);
    expect(pg).toContain('provider = "postgresql"');
    expect(pg).not.toContain('provider = "sqlite"');
    // Modeli ostanejo IDENTIČNI (primerjava od generator dalje):
    const strip = (s: string, provider: string) =>
      s.slice(s.indexOf("generator client {")).replace(`provider = "${provider}"`, "provider = X");
    expect(strip(pg, "postgresql")).toBe(strip(sqlite, "sqlite"));
  });

  test("transformToPostgres: FAIL-CLOSED na @db. nativne tipe", () => {
    expect(() => transformToPostgres('model A { id String @id @db.VarChar(10) }')).toThrow(/@db\./);
  });

  test("transformToPostgres: FAIL-CLOSED na previewFeatures", () => {
    expect(() => transformToPostgres('generator client {\n  provider = "prisma-client-js"\n  previewFeatures = ["x"]\n}')).toThrow(/previewFeatures/);
  });

  test("prisma/postgres/schema.prisma obstoja, je postgresql in usklajena z glavno", async () => {
    const pg = await src("prisma/postgres/schema.prisma");
    expect(pg).toContain('provider = "postgresql"');
    const sqlite = await src("prisma/schema.prisma");
    expect(pg).toBe(transformToPostgres(sqlite)); // točno to, kar bi generiral sync
  });

  test("baseline 0_init: 27 tabel + migration_lock postgresql", async () => {
    const baseline = await src("prisma/postgres/migrations/0_init/migration.sql");
    const tables = (baseline.match(/CREATE TABLE/g) ?? []).length;
    const sqlite = await src("prisma/schema.prisma");
    const models = (sqlite.match(/^model /gm) ?? []).length;
    expect(tables).toBe(models); // ena tabela na model — nikolidrift
    const lock = await src("prisma/postgres/migrations/migration_lock.toml");
    expect(lock).toContain('provider = "postgresql"');
  });
});

describe("P2 §1 — CI vrata (GitLab + GitHub)", () => {
  test("GitLab prisma-stopnja vsebuje postgres preverbe", async () => {
    const ci = await src(".gitlab-ci.yml");
    expect(ci).toContain("db:pg:check");
    expect(ci).toContain("db:pg:validate");
  });
  test("GitHub workflow vsebuje iste preverbe (zrcalna CI)", async () => {
    const ci = await src(".github/workflows/ci.yml");
    expect(ci).toContain("db:pg:check");
    expect(ci).toContain("db:pg:validate");
  });
});

describe("P2 §1 — package.json produkcjski ukazi", () => {
  test("db:pg:* + build:postgres + db:integrity + migrate:legacy registrirani", async () => {
    const pkg = (await src("package.json")).replace(/\n\s+/g, " ");
    for (const s of [
      '"db:pg:sync"',
      '"db:pg:check"',
      '"db:pg:deploy"',
      '"db:pg:validate"',
      '"build:postgres"',
      '"db:integrity"',
      '"migrate:legacy"',
    ]) {
      expect(pkg).toContain(s);
  }
  });
});

describe("P2 §3 — integrity vrata", () => {
  test("db-integrity-report: --expect-zero vrata + protokol NIKOLI celoten URL", async () => {
    const s = await src("scripts/db-integrity-report.ts");
    expect(s).toContain("--expect-zero");
    expect(s).toContain("urlProtocol"); // samo protokol se izpiše
    expect(s).toContain("url.slice(0, url.indexOf(\"//\") + 2)");
    expect(s).not.toMatch(/console\.(log|error)\(.*url[^)]*\)/); // nikoli URL v izpisu
  });
});

describe("P2 §1/§4 — legacy prenos (matrika v kodi)", () => {
  test("RETIRED seznam vsebuje AIUsageLog (0-AI) in PushSubscription (brez infrastrukture)", async () => {
    const s = await src("scripts/migrate-legacy-data.ts");
    expect(s).toContain('"AIUsageLog"');
    expect(s).toContain('"PushSubscription"');
    expect(s).toContain('"Booking"');
  });
  test("idempotenca: vsak model preveri obstoj PRED create (findUnique/findFirst)", async () => {
    const s = await src("scripts/migrate-legacy-data.ts");
    const creates = (s.match(/\.create\(/g) ?? []).length;
    const finds = (s.match(/findUnique|findFirst/g) ?? []).length;
    expect(creates).toBeGreaterThan(0);
    expect(finds).toBeGreaterThanOrEqual(creates); // vsak create ima svojo preverbo
  });
  test("dry-run je privzet (apply SAMO z --apply) — nikoli slučajno pisanje", async () => {
    const s = await src("scripts/migrate-legacy-data.ts");
    expect(s).toContain('args.includes("--apply")');
    expect(s).toContain("const dryRun = !apply;");
  });
});

describe("P2 §5 — bcrypt prijava prenesenih uporabnikov", () => {
  test("password.ts: bcrypt veja + scrypt kanon ostaja", async () => {
    const s = await src("src/lib/password.ts");
    expect(s).toContain("isLegacyBcryptHash");
    expect(s).toContain("bcrypt.compareSync");
    expect(s).toContain("scryptSync"); // novi računi ostajajo scrypt
  });
});

describe("P2 §8 — health produkcjska pogodba (brez skrivnosti)", () => {
  test("db:cutover: provider/latenca/migracije — NIKOLI povezovalni niz", async () => {
    const s = await src("src/app/api/health/route.ts");
    expect(s).toContain('"db:cutover"');
    expect(s).toContain("_prisma_migrations");
    expect(s).toContain("prisma migrate deploy");
    expect(s).not.toMatch(/detail:.*process\.env\.DATABASE_URL/); // nikoli URL v izpisu
  });
  test("build:meta: SHA iz platformskih env (nikoli izmišljen)", async () => {
    const s = await src("src/app/api/health/route.ts");
    expect(s).toContain('"build:meta"');
    expect(s).toContain("SOURCE_VERSION");
    expect(s).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(s).toContain("GIT_COMMIT");
  });
  test("verzija 2.42.0 (bump na vseh mestih)", async () => {
    const health = await src("src/app/api/health/route.ts");
    expect(health).toContain('version: "2.44.0"');
    const sw = await src("public/sw.js");
    expect(sw).toContain('SW_VERSION = "2.44.0"');
    const pkg = JSON.parse(await src("package.json"));
    expect(pkg.version).toBe("2.44.0");
  });
});

describe("P2 §2/§4 — dokumentacija runbooka in matrike", () => {
  test("PRODUCTION-CUTOVER.md: 10 korakov z ukazi + rollback", async () => {
    const md = await src("docs/PRODUCTION-CUTOVER.md");
    for (const korak of [
      "## 1. BACKUP",
      "## 2. SCHEMA PREFLIGHT",
      "## 3. MIGRATION DRY-RUN",
      "## 4. DATA INTEGRITY",
      "## 5. CUTOVER OKNO",
      "## 6. MIGRACIJA PODATKOV",
      "## 7. DEPLOYMENT",
      "## 8. HEALTH CHECK",
      "## 9. CRITICAL E2E",
      "## 10. ROLLBACK",
    ]) {
      expect(md).toContain(korak);
    }
    expect(md).toContain("pg_dump");
    expect(md).toContain("migrate:legacy --apply");
    expect(md).toContain("--expect-zero");
    expect(md).toContain("STRICT RULE");
  });
  test("RECOVERY-MODEL-MATRIX.md: vseh 39 modelov klasificiranih + povzetek", async () => {
    const md = await src("docs/RECOVERY-MODEL-MATRIX.md");
    expect(md).toContain("RECONCILE 14");
    expect(md).toContain("RETIRE 25");
    expect(md).toContain("RESTORE 0");
    // Kritični modeli so eksplicitno omenjeni z razlogom:
    for (const m of ["AIUsageLog", "PushSubscription", "Owner", "Booking", "Experience", "PayoutSettlement", "TripGuide"]) {
      expect(md).toContain(`\`${m}\``);
    }
  });
});

describe("P2 — iskrenost (nič izmišljenega v prenosu)", () => {
  test("migrate-legacy: demo KONSERVATIVNO true (dvoumen prihodek nikoli pravi)", async () => {
    const s = await src("scripts/migrate-legacy-data.ts");
    expect(s).toContain("demo: true");
    expect(s).toContain("KONSERVATIVNO");
  });
  test("migrate-legacy: anonimni glasovi se izrecno NE prenesejo (razlog v kodi)", async () => {
    const s = await src("scripts/migrate-legacy-data.ts");
    expect(s).toContain("NE PRENESE"); // dokumentiran razlog v poročilu
  });
  test("migrate-legacy: 0 z-ai uvozov (0-AI projekt — migracija je čista skripta)", async () => {
    const s = await src("scripts/migrate-legacy-data.ts");
    expect(s).not.toContain("z-ai");
    expect(s).not.toContain("LLM");
  });
});
