/**
 * CUTOVER-PIPELINE-CONTRACT (issue #2) — zaklep podatkovnega cutover pipeline.
 *
 * SOURCE-CONTRACT (pošteno označeno): faze poganjajo žive baze, kar v
 * peskovniku ni enotsko testabilno brez Neon povezovalnih nizov — zato
 * zaklenemo STRUKTURO: če kdo odstrani pg-klient varovalko, vrata z
 * razlogom, potrditev PRENESI ali PII varovalke, regresijska mreža pade.
 *
 * Dokazano na PostgreSQL 17 (2026-10-10, issue #2): celoten §1–§6.5 pipeline
 * (backup → preflight → migrate-deploy → before → transfer → apply →
 * idempotenca → after) + bcrypt prijava prenesenega uporabnika.
 */

import { describe, expect, test } from "bun:test";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("cutover-pipeline [source-contract]: pg-klient varovalka (PG17 dokaz)", () => {
  const PHASES_WITH_CLIENT = ["transfer-apply", "idempotence", "transfer", "preflight"];

  test("① cutover.sh ima pg_client () varovalko", async () => {
    const sh = await src("scripts/cutover.sh");
    expect(sh).toContain("pg_client()");
    expect(sh).toContain("bun run db:pg:generate");
    // razlaga ZAKAJ (kanon: vsaka varovalka ima razlog):
    expect(sh).toContain("privzeti klient (SQLite razvojna shema) bi");
  });

  test("② vse 4 faze, ki uporabljajo Prisma klienta, kličejo pg_client", async () => {
    const sh = await src("scripts/cutover.sh");
    for (const phase of PHASES_WITH_CLIENT) {
      // funkcija faza → v telesu mora biti klic pg_client
      const m = sh.match(
        new RegExp(`${phase.replace("-", "_")}\\(\\) \\{[\\s\\S]*?\\n\\}`),
      );
      expect(m).toBeTruthy();
      expect(m?.[0]).toContain("pg_client");
    }
  });

  test("③ cutover-gate.ts zrcali mapLead/mapAuditLog arhivske pogoje (vrata z razlogom)", async () => {
    const gate = await src("scripts/cutover-gate.ts");
    // Lead: status ∉ nov/kontaktiran (matrika §1 — LEAD_STATUS_MAP)
    expect(gate).toContain(`NOT IN ('nov', 'kontaktiran')`);
    // AuditLog: brez action/resourceType/(resourceId|resourceName)
    expect(gate).toContain(`"action" IS NULL`);
    expect(gate).toContain(`"resourceType" IS NULL`);
    expect(gate).toContain(`"resourceId" IS NULL`);
    // izpisuje SAMO protokol, nikoli povezovalni niz:
    expect(gate).toContain("url.slice(0, url.indexOf(");
  });
});

describe("cutover-pipeline [source-contract]: vrata z razlogom v after fazi", () => {
  test("④ stroga vrata ne vsebujejo Lead/AuditLog (dokumentirana izpustna pot)", async () => {
    const sh = await src("scripts/cutover.sh");
    const m = sh.match(/--expect-zero "([^"]+)"/);
    expect(m?.[1]).toBe("User,NewsletterSubscriber,Consultation,ProcessedStripeEvent");
  });

  test("⑤ after faza zahteva obe povezovalni niza in pokliče cutover-gate", async () => {
    const sh = await src("scripts/cutover.sh");
    const m = sh.match(/integrity_after\(\) \{[\s\S]*?\n\}/);
    expect(m?.[0]).toContain("require_env LEGACY_DATABASE_URL DATABASE_URL");
    expect(m?.[0]).toContain("bun scripts/cutover-gate.ts");
  });
});

describe("cutover-pipeline [source-contract]: workflow cutover-data.yml", () => {
  test("⑥ transfer-apply zahteva potrditev PRENESI (osebna varovalka)", async () => {
    const wf = await src(".github/workflows/cutover-data.yml");
    expect(wf).toContain('[ "${{ inputs.phase }}" = "transfer-apply" ]');
    expect(wf).toContain(`!= "PRENESI"`);
  });

  test("⑦ NODE_ENV=production (PIJ: brez Prisma query dnevnika — P0 AUDIT M6)", async () => {
    const wf = await src(".github/workflows/cutover-data.yml");
    expect(wf).toContain("NODE_ENV: production");
  });

  test("⑧ workflow pokliče scripts/cutover.sh (en vir resnice, ne duplikat)", async () => {
    const wf = await src(".github/workflows/cutover-data.yml");
    expect(wf).toContain('./scripts/cutover.sh "${{ inputs.phase }}"');
  });

  test("⑨ artefakti imajo omejeno zadrževanje (PII — 7/14 dni, ne večno)", async () => {
    const wf = await src(".github/workflows/cutover-data.yml");
    expect(wf).toContain("retention-days: 7");
    expect(wf).toContain("retention-days: 14");
    expect(wf).not.toContain("retention-days: 90");
  });

  test("⑩ concurrency NE prekinja podatkovne faze (cancel-in-progress: false)", async () => {
    const wf = await src(".github/workflows/cutover-data.yml");
    expect(wf).toContain("cancel-in-progress: false");
  });
});

describe("cutover-pipeline [source-contract]: preference prenos (matrika §1)", () => {
  test("⑪ migrate-legacy-data.ts prenaša preferences → UserPreference IMPORTED", async () => {
    const s = await src("scripts/migrate-legacy-data.ts");
    expect(s).toContain("export function planUserPreferences");
    expect(s).toContain('source: "IMPORTED"');
    // SAMO kanonsko validirane vrednosti (isti sloj kot /api/preferences):
    expect(s).toContain("validatePreferenceValue(key, rawValue)");
    // FK vrstni red: v zanki se transferLegacyPreferences pokliče ŠLE ZA
    // db.user.create (dokazano 2026-10-10 — P2003 brez tega vrstnega reda):
    const fkOrder = s.match(
      /if \(!dryRun\) await db\.user\.create\(\{ data: mapped\.user \}\);[\s\S]*?await transferLegacyPreferences\(mapped\.user\.id/,
    );
    expect(fkOrder).toBeTruthy();
    // obstoječi uporabnik (email zadetek): preference na OBSTOJEČI id:
    expect(s).toContain("await transferLegacyPreferences(exists.id");
  });

  test("⑫ poročilo vključuje User→UserPreference(IMPORTED) vrstico", async () => {
    const s = await src("scripts/migrate-legacy-data.ts");
    expect(s).toContain('report("User→UserPreference(IMPORTED)"');
  });
});
