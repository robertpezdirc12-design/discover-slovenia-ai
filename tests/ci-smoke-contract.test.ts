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
