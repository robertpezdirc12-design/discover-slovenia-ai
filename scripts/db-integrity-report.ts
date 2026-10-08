// db-integrity-report.ts — DATA INTEGRITY GATE (issue #2 §3).
//
// Namensko orodje za produkcjski cutover: izpiše število vrstic VSEH tabel
// ciljne baze (SQLite prek bun:sqlite vgrajenega gonilnika; PostgreSQL prek
// paketa pg — glej package.json). Deluje na OBEH providerjih, ker cutover
// poteka stara (legacy 1.163.4 Postgres/Neon) → nova (2.x Postgres):
//
//   # BEFORE (stara baza — zajem pred cutoverjem):
//   DATABASE_URL="postgres://…" bun run db:integrity > before.json
//   # AFTER (nova baza — po migrate deploy + uvozu):
//   DATABASE_URL="postgres://…" bun run db:integrity > after.json
//   # PRIMERJAVA (delta po tabelah + vrata na kritičnih tabelah):
//   DATABASE_URL="postgres://…" bun run db:integrity \
//     --compare before.json --expect-zero "User,NewsletterSubscriber,Lead"
//
// ISKRENOSTNI KANON:
//  - šteje SAMO tabele, ki DEJANSKO obstojijo v ciljni bazi (ne domnevamo);
//  - _prisma_migrations se izpiše LOČENO (migracijsko stanje, ne poslovni
//    podatek — novi pečat pri pravem migrate deploy);
//  - imena tabel se citirajo po providerju in validirajo proti [A-Za-z0-9_]
//    (tabele s čudnimi znaki se izpustijo z opozorilom — nikoli "pametujemo");
//  - KRIPTIČNE tabele (--expect-zero) MORAJO imeti delta 0 brez izrecnega
//    razloga (issue §3: "brez izrecno dokumentiranega razloga delta 0").
//
// Izhod: JSON na stdout (strojno berljiv) + log človeku na stderr.
// Exit kode: 0 = vrata zelena · 1 = vrata rdeča (CHANGED/MISSING na
// --expect-zero, nedosegljiva baza, pokvarjen baseline) · 2 = napaka uporabe.

import { Database } from "bun:sqlite";
import { Client as PgClient } from "pg";

type Report = {
  provider: "sqlite" | "postgresql";
  urlProtocol: string; // SAMO protokol (file:/postgres://…) — NIKOLI celoten URL
  generatedAt: string;
  tables: Record<string, number>;
  prismaMigrations: number | null;
  skipped?: string[];
};

const TABLE_NAME_RE = /^[A-Za-z0-9_]+$/;

export function detectProvider(url: string): {
  provider: "sqlite" | "postgresql";
  urlProtocol: string;
} {
  if (url.startsWith("file:")) {
    return { provider: "sqlite", urlProtocol: "file:" };
  }
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return { provider: "postgresql", urlProtocol: url.slice(0, url.indexOf("//") + 2) };
  }
  throw new Error(
    `Neprepoznan DATABASE_URL protokol (podprta: file: / postgres://). Izpisana je samo vrsta protokola, nikoli vrednost.`,
  );
}

function quoteIdent(provider: "sqlite" | "postgresql", name: string): string {
  return provider === "sqlite" ? `"${name}"` : `"${name}"`;
}

export async function collectCounts(url: string): Promise<Report> {
  const { provider, urlProtocol } = detectProvider(url);
  const tables: Record<string, number> = {};
  const skipped: string[] = [];
  let prismaMigrations: number | null = null;

  if (provider === "sqlite") {
    const path = url.slice("file:".length);
    const db = new Database(path, { readonly: true });
    try {
      const rows = db
        .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as { name: string }[];
      for (const { name } of rows) {
        if (name.startsWith("sqlite_")) continue;
        if (!TABLE_NAME_RE.test(name)) {
          skipped.push(name);
          continue;
        }
        if (name === "_prisma_migrations") {
          prismaMigrations = (
            db.query(`SELECT COUNT(*) AS c FROM ${quoteIdent("sqlite", name)}`).get() as { c: number }
          ).c;
          continue;
        }
        const { c } = db
          .query(`SELECT COUNT(*) AS c FROM ${quoteIdent("sqlite", name)}`)
          .get() as { c: number };
        tables[name] = c;
      }
    } finally {
      db.close();
    }
  } else {
    const client = new PgClient({ connectionString: url });
    await client.connect();
    try {
      const res = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
      );
      for (const { table_name: name } of res.rows) {
        if (!TABLE_NAME_RE.test(name)) {
          skipped.push(name);
          continue;
        }
        if (name === "_prisma_migrations") {
          const m = await client.query<{ c: string }>(
            `SELECT COUNT(*)::int AS c FROM "_prisma_migrations"`,
          );
          prismaMigrations = Number(m.rows[0]?.c ?? 0);
          continue;
        }
        const r = await client.query<{ c: string }>(
          `SELECT COUNT(*)::int AS c FROM ${quoteIdent("postgresql", name)}`,
        );
        tables[name] = Number(r.rows[0]?.c ?? 0);
      }
    } finally {
      await client.end();
    }
  }

  const report: Report = {
    provider,
    urlProtocol,
    generatedAt: new Date().toISOString(),
    tables,
    prismaMigrations,
  };
  if (skipped.length > 0) report.skipped = skipped;
  return report;
}

export type CompareRow = {
  table: string;
  before: number;
  after: number;
  delta: number;
  status: "OK" | "CHANGED";
  expectZero: boolean;
};

export type CompareResult = {
  provider: string;
  comparedAt: string;
  rows: CompareRow[];
  onlyInBaseline: string[]; // upokojene (RETIRE) — informacijsko, ne vrata
  onlyInCurrent: string[]; // nove 2.x tabele — informacijsko
  gates: { table: string; reason: string }[];
  passed: boolean;
};

export function compareReports(
  baseline: Report,
  current: Report,
  expectZero: string[],
): CompareResult {
  const rows: CompareRow[] = [];
  const gates: { table: string; reason: string }[] = [];
  for (const table of Object.keys(baseline.tables).sort()) {
    if (!(table in current.tables)) continue; // obravnavano v onlyInBaseline
    const before = baseline.tables[table]!;
    const after = current.tables[table]!;
    const delta = after - before;
    const isZero = expectZero.includes(table);
    rows.push({
      table,
      before,
      after,
      delta,
      status: delta === 0 ? "OK" : "CHANGED",
      expectZero: isZero,
    });
    if (isZero && delta !== 0) {
      gates.push({
        table,
        reason: `delta ${delta} ≠ 0 na kritični tabeli (brez izrecno dokumentiranega razloga)`,
      });
    }
  }
  const onlyInBaseline = Object.keys(baseline.tables)
    .filter((t) => !(t in current.tables))
    .sort();
  const onlyInCurrent = Object.keys(current.tables)
    .filter((t) => !(t in baseline.tables))
    .sort();
  // Navedene --expect-zero tabele, ki jih v novi bazi NI → vrata rdeča
  // (pogoj issue §3 velja samo za tabele, ki obstajajo v obeh).
  for (const t of expectZero) {
    if (!(t in baseline.tables) || !(t in current.tables)) {
      if (t in baseline.tables && !(t in current.tables)) {
        gates.push({ table: t, reason: "kritična tabela MANJKA v novi bazi" });
      }
    }
  }
  return {
    provider: current.provider,
    comparedAt: new Date().toISOString(),
    rows,
    onlyInBaseline,
    onlyInCurrent,
    gates,
    passed: gates.length === 0,
  };
}

function printCompareHuman(result: CompareResult): void {
  console.error(`\n── INTEGRITY PRIMERJAVA (${result.provider}) ──`);
  for (const r of result.rows) {
    const gate = r.expectZero ? " [VRATA]" : "";
    console.error(
      `  ${r.status === "OK" ? "✓" : "△"} ${r.table}: ${r.before} → ${r.after} (delta ${r.delta})${gate}`,
    );
  }
  if (result.onlyInBaseline.length > 0) {
    console.error(
      `  ↩ samo v stari (RETIRE po matriki — arhiv v backupu): ${result.onlyInBaseline.join(", ")}`,
    );
  }
  if (result.onlyInCurrent.length > 0) {
    console.error(`  ↳ novo v 2.x: ${result.onlyInCurrent.join(", ")}`);
  }
  if (result.gates.length > 0) {
    console.error(`\n✗ VRATA RDEČA:`);
    for (const g of result.gates) console.error(`  - ${g.table}: ${g.reason}`);
  } else {
    console.error(`\n✓ VRATA ZELENA (vse --expect-zero tabele imajo delta 0).`);
  }
}

async function main(): Promise<number> {
  const argv = Bun.argv.slice(2);
  const compareIdx = argv.indexOf("--compare");
  const compareFile = compareIdx >= 0 ? argv[compareIdx + 1] : null;
  const expectIdx = argv.indexOf("--expect-zero");
  const expectZero = expectIdx >= 0 ? (argv[expectIdx + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : [];

  if (!process.env.DATABASE_URL) {
    console.error("Napaka: DATABASE_URL ni nastavljen (file:… ali postgres://…).");
    return 2;
  }

  try {
    const current = await collectCounts(process.env.DATABASE_URL);
    if (!compareFile) {
      console.log(JSON.stringify(current, null, 2));
      console.error(
        `✓ ${Object.keys(current.tables).length} tabel (provider ${current.provider}, protokol ${current.urlProtocol}), _prisma_migrations: ${current.prismaMigrations}`,
      );
      return 0;
    }
    const baselineRaw = await Bun.file(compareFile).text();
    const baseline = JSON.parse(baselineRaw) as Report;
    const result = compareReports(baseline, current, expectZero);
    console.log(JSON.stringify(result, null, 2));
    printCompareHuman(result);
    return result.passed ? 0 : 1;
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
