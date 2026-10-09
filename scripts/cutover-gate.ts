// cutover-gate.ts — VRATA Z RAZLOGOM za tabele z DOKUMENTIRANO izpustno potjo
// (issue #2 §6.5: "vsak izpust ima števec in razlog — dokumentiran v matriki").
//
// Problem, ki ga ta skripta rešuje (dokazano na PostgreSQL 17, 2026-10-10):
// slepa vrata `db:integrity --expect-zero Lead,AuditLog` padajo na PRODUKCIJSKIH
// podatkih, ker matrika RECOVERY-MODEL-MATRIX.md ZAVESTNO arhivira:
//   · Lead:    status ∉ {nov, kontaktiran} ("zakljucen" → arhiv — matrika §1)
//   · AuditLog: brez action/resourceType/(resourceId|resourceName) → arhiv
//
// Rešitev (iskrenostni kanon): vrata preverjajo, da je delta NOVA−STARA
// NATANČNO enaka številu arhiviranih vrstic v stari bazi — izračunano
// MEHANSKO iz istih pogojev, kot jih uporablja mapLead/mapAuditLog
// (scripts/migrate-legacy-data.ts). Vsako odstopanje → rdeče + izhod 1.
//
// ZAGON (poganja ga scripts/cutover.sh — faza `after`):
//   LEGACY_DATABASE_URL="postgres://…" DATABASE_URL="postgres://…" \
//     bun scripts/cutover-gate.ts
//
// ISKRENOSTNI KANON: povezovalni nizi se NE izpisujejo (samo protokol);
// izpisujejo se SAMO števci in aritmetika vrat.
// Izhod: 0 = vrata zelena · 1 = vrata rdeča (odstopanje od matrike).

import { Client } from "pg";

function proto(url: string): string {
  return url.slice(0, url.indexOf("//") + 2);
}

async function count(client: Client, sql: string): Promise<number> {
  const res = await client.query<{ c: number }>(sql);
  return Number(res.rows[0]?.c ?? 0);
}

async function main(): Promise<number> {
  const legacyUrl = process.env.LEGACY_DATABASE_URL;
  const newUrl = process.env.DATABASE_URL;
  if (!legacyUrl || !newUrl) {
    console.error("Napaka: potrebna sta LEGACY_DATABASE_URL in DATABASE_URL.");
    return 2;
  }

  const legacy = new Client({ connectionString: legacyUrl });
  const target = new Client({ connectionString: newUrl });
  await legacy.connect();
  await target.connect();
  console.error(
    `── VRATA Z RAZLOGOM (${proto(legacyUrl)} → ${proto(newUrl)}) — matrika §1 RECONCILE ──`,
  );

  let failed = false;

  // ── Lead: arhiv = status ∉ {nov, kontaktiran} ALI brez e-pošte (zrcalo mapLead)
  {
    const legacyTotal = await count(legacy, `SELECT count(*)::int AS c FROM "Lead"`);
    // mapLead: null ⇐ !email ALI !LEAD_STATUS_MAP[status]
    const archived = await count(
      legacy,
      `SELECT count(*)::int AS c FROM "Lead"
       WHERE "email" IS NULL OR "email" = ''
          OR "status" IS NULL OR "status" NOT IN ('nov', 'kontaktiran')`,
    );
    const newTotal = await count(target, `SELECT count(*)::int AS c FROM "Lead"`);
    const expected = legacyTotal - archived;
    const okGate = newTotal === expected;
    if (!okGate) failed = true;
    console.error(
      `  ${okGate ? "✓" : "✗"} Lead: stara ${legacyTotal} − arhivirani ${archived} (status ∉ nov/kontaktiran ali brez e-pošte — matrika) = pričakovana ${expected} · nova ${newTotal}`,
    );
  }

  // ── AuditLog: arhiv = brez action ALI brez resourceType ALI brez (resourceId|resourceName)
  //    (zrcalo mapAuditLog: resourceId = str(row.resourceId) ?? str(row.resourceName))
  {
    const legacyTotal = await count(legacy, `SELECT count(*)::int AS c FROM "AuditLog"`);
    const archived = await count(
      legacy,
      `SELECT count(*)::int AS c FROM "AuditLog"
       WHERE "action" IS NULL OR "action" = ''
          OR "resourceType" IS NULL OR "resourceType" = ''
          OR ( ("resourceId" IS NULL OR "resourceId" = '')
           AND ("resourceName" IS NULL OR "resourceName" = '') )`,
    );
    const newTotal = await count(target, `SELECT count(*)::int AS c FROM "AuditLog"`);
    const expected = legacyTotal - archived;
    const okGate = newTotal === expected;
    if (!okGate) failed = true;
    console.error(
      `  ${okGate ? "✓" : "✗"} AuditLog: stara ${legacyTotal} − arhivirani ${archived} (brez action/resourceType/(resourceId|resourceName) — matrika) = pričakovana ${expected} · nova ${newTotal}`,
    );
  }

  await legacy.end();
  await target.end();

  if (failed) {
    console.error("✗ VRATA RDEČA: delta NE ustreza dokumentiranemu arhivu — preveri ročno (matrika §1) pred nadaljevanjem");
    return 1;
  }
  console.error("✓ vrata z razlogom ZELENA: izpusti točno po matriki (števec + razlog)");
  return 0;
}

process.exitCode = await main();
