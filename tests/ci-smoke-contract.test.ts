/**
 * CI-SMOKE-CONTRACT (P0-J, issue #1 §24 + sprejemni kriterij
 * „CI has lint + typecheck + test + build + smoke") — mehanska zaklenitev
 * 6. vrat (smoke), artefaktov/reportov in varnosti migracij na OBEH
 * platformah (GitLab .gitlab-ci.yml + GitHub Actions ci.yml).
 *
 * SOURCE-CONTRACT (pošteno označeno): CI vrst v peskovniku ni mogoče
 * zagnati unit — zaklenemo STRUKTURO konfiguracij in skript. Če kdo
 * odstrani smoke vrata, izpusti artefakte, prikrje padec (when: on_success)
 * ali vnese destruktivno pot (db push --accept-data-loss v CI), regresijska
 * mreža pade.
 *
 * Zgodovinska lekcija (iskreno razkrita v glavi GitHub ci.yml): sprožilec
 * „branches: ain]" je od 2.7.0 tiho onemogočal GitHub CI — to zaklenemo
 * z oznakami ⑨/⑩, da se ne ponovi.
 */

import { describe, expect, test } from "bun:test";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

// ── GitLab CI: 6 vrat ──────────────────────────────────────────────────────

describe("p0j [source-contract]: GitLab CI ima 6. vrata smoke + artefakte", () => {
  test("① stopnje vsebujejo smoke (6. vrata po lint/typecheck/test/prisma/build)", async () => {
    const yml = await src(".gitlab-ci.yml");
    for (const stage of [
      "lint",
      "typecheck",
      "test",
      "prisma",
      "build",
      "smoke",
    ]) {
      expect(yml).toContain(`- ${stage}`);
    }
    expect(yml).toContain("smoke:");
    expect(yml).toContain("stage: smoke");
  });

  test("② smoke vrata vsebujejo MIGRATION SAFETY (db:materialize, brez --accept-data-loss)", async () => {
    const yml = await src(".gitlab-ci.yml");
    // Preverba po VRSTICAH ukazov (ne po vsebi) — komentarji smejo
    // prepoved dokumentirati, ukazne vrstice je ne smejo izvesti:
    const commandLines = yml
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .filter((l) => /^\s*-\s/.test(l));
    expect(commandLines.some((l) => l.includes("db:materialize"))).toBe(true);
    // Destruktivna zastavica v CI ukazih je PREPOVEDANA — kar bi zahtevalo
    // uničenje podatkov, mora pošteno pasti (fail-closed):
    expect(commandLines.some((l) => l.includes("--accept-data-loss"))).toBe(
      false
    );
    expect(commandLines.some((l) => l.includes("db:push"))).toBe(false);
  });

  test("③ smoke vrata poganjajo produkcijski standalone strežnik + dim", async () => {
    const yml = await src(".gitlab-ci.yml");
    expect(yml).toContain(".next/standalone/server.js");
    expect(yml).toContain("bun scripts/ci-wait-ready.ts");
    expect(yml).toContain("SMOKE_BASE_URL");
    expect(yml).toContain("bun run smoke");
    expect(yml).toContain("SMOKE_REPORT=reports/smoke-report.json");
    // CI-only NEXTAUTH lutilo (pošteno poimenovano, nikoli produkcijsko):
    expect(yml).toContain('NEXTAUTH_SECRET: "ci-dummy-secret-samo-za-dim"');
    // HOSTNAME mora biti eksplicitno 0.0.0.0 — Docker runnerji nastavijo
    // HOSTNAME na ime vsebnika in se strežnik sicer veže napačno
    // (naučeno iz prvega zagona pipeline 2927141601):
    expect(yml).toContain('HOSTNAME: "0.0.0.0"');
  });

  test("④ artefakti se naložijo OB VSAKEM izidu (when: always — padec je dokaz)", async () => {
    const yml = await src(".gitlab-ci.yml");
    expect(yml).toContain("when: always");
    expect(yml).toContain("reports/junit.xml");
    expect(yml).toContain("reports/smoke-report.json");
    // server.log mora biti zajet tudi ob padcu pripravljenosti:
    expect(yml).toContain("reports/server.log");
  });

  test("⑤ test vrata proizvedejo JUNIT poročilo (zavihek Testi + artefakt)", async () => {
    const yml = await src(".gitlab-ci.yml");
    expect(yml).toContain(
      "bun test --reporter=junit --reporter-outfile=reports/junit.xml"
    );
    expect(yml).toContain("junit: reports/junit.xml");
  });
});

// ── GitHub Actions: pariteta dim + popravljen sprožilec ────────────────────

describe("p0j [source-contract]: GitHub Actions CI pariteta + sprožilec [main]", () => {
  test("⑥ sprožilca push/pull_request ciljata na main (popravljen hrošč iz 2.7.0)", async () => {
    const yml = await src(".github/workflows/ci.yml");
    const lines = yml.split("\n");
    // Funkcionalna vrstica (ne komentar — komentar sme hrošča iskreno
    // dokumentirati, vrstica `branches:` pa mora biti veljavna):
    expect(lines.some((l) => l.trim() === "branches: [main]")).toBe(true);
    expect(
      lines.some((l) => /^\s*branches:\s*ain\]/.test(l))
    ).toBe(false);
  });

  test("⑦ migration safety + standalone strežnik + dim so v korakih joba", async () => {
    const yml = await src(".github/workflows/ci.yml");
    expect(yml).toContain("bun run db:materialize");
    expect(yml).toContain(".next/standalone/server.js");
    expect(yml).toContain("bun scripts/ci-wait-ready.ts");
    expect(yml).toContain("SMOKE_REPORT=reports/smoke-report.json");
    // CI-only NEXTAUTH lutilo (pošteno poimenovano, nikoli produkcijsko) —
    // brez njega SessionProvider piše CLIENT_FETCH_ERROR v konzolo:
    expect(yml).toContain('NEXTAUTH_SECRET="ci-dummy-secret-samo-za-dim"');
    // Eksplicitna vezava na vse vmesnike (ne na ime runnerja):
    expect(yml).toContain('HOSTNAME="0.0.0.0"');
    // Ukazne vrstice (brez komentarjev in imen korakov) ne smejo nositi
    // destruktivne zastavice:
    const commandOnly = yml
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .filter((l) => !/^\s*-?\s*name:/.test(l));
    expect(
      commandOnly.some((l) => l.includes("--accept-data-loss"))
    ).toBe(false);
    expect(commandOnly.some((l) => l.includes("bun run db:push"))).toBe(false);
  });

  test("⑧ artefakti se naložijo z if: always() (upload-artifact)", async () => {
    const yml = await src(".github/workflows/ci.yml");
    expect(yml).toContain("if: always()");
    expect(yml).toContain("actions/upload-artifact@v4");
    expect(yml).toContain("junit.xml");
    expect(yml).toContain("smoke-report.json");
  });

  test("⑨ junit reporter je v testnem koraku (enako kot GitLab)", async () => {
    const yml = await src(".github/workflows/ci.yml");
    expect(yml).toContain(
      "bun test --reporter=junit --reporter-outfile=reports/junit.xml"
    );
  });
});

// ── Skripti: dim poročilo + pripravljenost ─────────────────────────────────

describe("p0j [source-contract]: dim piše poročilo, readiness je iskren", () => {
  test("⑩ smoke.ts zapiše JSON poročilo, ko je nastavljen SMOKE_REPORT", async () => {
    const code = await src("scripts/smoke.ts");
    expect(code).toContain("process.env.SMOKE_REPORT");
    expect(code).toContain("JSON.stringify(report, null, 2)");
    // Poročilo se zapiše NEODVISNO od izida (tudi padec je artefakt):
    expect(code).toContain("ok: passed === results.length");
  });

  test("⑪ smoke.ts ostaja SAMO-BRALEN (izključno GET, brez POST/PUT/DELETE)", async () => {
    const code = await src("scripts/smoke.ts");
    expect(code).toContain('method: "GET"');
    expect(code).not.toContain('method: "POST"');
    expect(code).not.toContain('method: "PUT"');
    expect(code).not.toContain('method: "DELETE"');
  });

  test("⑫ ci-wait-ready.ts je iskren: konča z izhodno kodo 1 po 30 poskusih", async () => {
    const code = await src("scripts/ci-wait-ready.ts");
    expect(code).toContain("ATTEMPTS = 30");
    expect(code).toContain("process.exit(1)");
    expect(code).toContain("process.exit(0)");
    expect(code).toContain('method: "GET"');
  });
});

// ── E2E vrata: produkcijski način + seed (2.65.3) ──────────────────────────

describe("p0j [source-contract]: e2e teče nad produkcijskim buildom + seed (2.65.3)", () => {
  test("⑮ e2e (GitLab): seed + standalone + E2E_BASE_URL, dev webServer PREPOVEDAN", async () => {
    const yml = await src(".gitlab-ci.yml");
    const commandLines = yml
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .filter((l) => /^\s*-\s/.test(l));
    // Seed — brez njega zlata pot ne najde Bleda (sveža baza = 0 destinacij):
    expect(commandLines.some((l) => l.includes("bun prisma/seed.ts"))).toBe(true);
    // Produkcijski način: standalone strežnik + E2E_BASE_URL (testiramo,
    // kar pošiljamo — lekcija 1 uporabljena tudi na CI):
    expect(commandLines.some((l) => l.includes("reports/e2e-server.log"))).toBe(
      true
    );
    expect(
      commandLines.some((l) => l.includes('E2E_BASE_URL="http://localhost:${PORT}"'))
    ).toBe(true);
    // Dev-mode webServer je v CI PREPOVEDAN: turbopack panic + dev prekrivanja
    // falijo overflow teste (ujeto z lokalno CI-paritetno verifikacijo 15.10.):
    expect(commandLines.some((l) => l.includes("next dev"))).toBe(false);
  });

  test("⑯ e2e (GitHub): ista pariteta — seed + standalone + E2E_BASE_URL, dev webServer PREPOVEDAN", async () => {
    const yml = await src(".github/workflows/ci.yml");
    const commandLines = yml
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .filter((l) => !/^\s*-?\s*name:/.test(l));
    expect(commandLines.some((l) => l.includes("bun prisma/seed.ts"))).toBe(true);
    expect(commandLines.some((l) => l.includes("reports/e2e-server.log"))).toBe(
      true
    );
    expect(
      commandLines.some((l) =>
        l.includes('E2E_BASE_URL="http://localhost:3100"')
      )
    ).toBe(true);
    expect(commandLines.some((l) => l.includes("next dev"))).toBe(false);
  });
});

// ── PostgreSQL live vrata: živ PG 17 na OBEH platformah (2.66.0) ───────────

describe("p0j [source-contract]: PostgreSQL live vrata — pg-live (2.66.0)", () => {
  test("⑰ pg-live stopnja (GitLab) in korak (GitHub) obstajata v pravilnem vrstnem redu", async () => {
    const gitlab = await src(".gitlab-ci.yml");
    expect(gitlab).toContain("pg-live:");
    expect(gitlab).toContain("stage: pg-live");
    // Vrstni red: pg-live za suhimi prisma vrati, PRED build/smoke/e2e
    // (podatkovna plast se dokaže pred porabo build minut):
    const stages = gitlab.indexOf("- pg-live");
    const prisma = gitlab.indexOf("- prisma");
    const build = gitlab.indexOf("- build");
    expect(stages).toBeGreaterThan(prisma);
    expect(stages).toBeLessThan(build);
    // Poročilo kot artefakt tudi ob padcu (isti vzorec kot smoke):
    const commandLines = gitlab
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .filter((l) => /^\s*-\s/.test(l));
    expect(
      commandLines.some((l) =>
        l.includes("PG_LIVE_REPORT=reports/pg-live-report.json"),
      ),
    ).toBe(true);
    expect(gitlab).toContain("when: always");

    const gh = await src(".github/workflows/ci.yml");
    expect(
      gh.includes("bun scripts/pg-live-verify.ts"),
    ).toBe(true);
    expect(gh).toContain("PG_LIVE_REPORT=reports/pg-live-report.json");
  });

  test("⑱ pg-live-verify.ts je fail-closed: asertira izhode + samokalibracija", async () => {
    const code = await src("scripts/pg-live-verify.ts");
    // Shadow replay mora ASERTIRATI prazno difo (migracije ≡ shema, §2):
    expect(code).toContain("-- This is an empty migration.");
    // Deploy + idempotenca + status morajo ASERTIRATI pričakovane nize (§3):
    expect(code).toContain("All migrations have been successfully applied");
    expect(code).toContain("No pending migrations to apply");
    expect(code).toContain("Database schema is up to date");
    // Samokalibracija: št. tabel ≡ št. modelov (brez trdo-kodiranih števil —
    // vrata ostanejo zvesta, ko shema zraste):
    expect(code).toContain("countModels");
    // Data plane: seed števec "skupaj ≡ pričakovano" je asertiran:
    expect(code).toContain("(pričakovano");
    // Čistilo: SQLite klient se obnovi tudi ob napaki (nadaljnji CI koraki):
    expect(code).toContain("db:generate");
  });

  test("⑲ bun 1.3.x okoljske pasti so zaklenjene v skripti", async () => {
    const code = await src("scripts/pg-live-verify.ts");
    // Hidracija knjižnic s KOPIJAMI (symlinki niso vedno dovoljeni; bun
    // postinstall je blokiran — skripta je neodvisna od njega):
    expect(code).toContain("pg-symlinks.json");
    expect(code).toContain("cpSync");
    // NIKOLI "localhost" kot host (Bun AggregateError quirk) — vedno 127.0.0.1:
    expect(code).toContain('const HOST = "127.0.0.1"');
    expect(code).not.toContain('host: "localhost"');
    // Bun 1.3.x + import embedded-postgres izgubi process.exitCode (izhod 0
    // tudi ob napaki — izmerjeno 15. 10.) → eksplicitni process.exit:
    expect(code).toContain("process.exit(await main())");
    // Dev odvisnost (binarke) je deklarirana — CI instalacija jih prinese:
    const pkg = await Bun.file("package.json").json();
    const devDeps = pkg.devDependencies as Record<string, string>;
    expect(devDeps["embedded-postgres"]).toContain("17.");
  });
});

// ── Kanonični skripti + higiena ────────────────────────────────────────────

describe("p0j [source-contract]: db:materialize je varen kanon", () => {
  test("⑬ package.json ima db:materialize BREZ --accept-data-loss", async () => {
    const pkg = await Bun.file("package.json").json();
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts["db:materialize"]).toBe("prisma db push --skip-generate");
    // P0 AUDIT (podatkovna plast): db:push ima --accept-data-loss SAMO za
    // lokalni peskovnik in je zdaj ZAKLENJEN z varovalko, ki zavrača vse
    // ne-file: DATABASE_URL protokole (postgres://… → izhod 1 + navodilo
    // na db:pg:deploy). Prej je bil --accept-data-loss golo v skripti —
    // varovalka zdaj IZVAJA ta namen namesto naključja providerja.
    expect(scripts["db:push"]).toBe("bun scripts/db-push-guarded.ts");
    const guard = await src("scripts/db-push-guarded.ts");
    expect(guard).toContain("--accept-data-loss");
    expect(guard).toContain("file:");
    expect(guard).toContain("postgres://");
    expect(guard).toContain("db:pg:deploy");
    expect(scripts["smoke"]).toBe("bun scripts/smoke.ts");
  });

  test("⑭ reports/ je gitignored (artefakti se ne sledijo v git)", async () => {
    const gitignore = await src(".gitignore");
    expect(gitignore).toContain("reports/");
  });
});
