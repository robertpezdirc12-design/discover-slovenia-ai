// pg-schema-sync.ts — POSTGRESQL DATA PLANE SINHRONIZACIJA (issue #2 §1).
//
// EN VIR RESNICE: prisma/schema.prisma (SQLite — razvoj/peskovnik/CI).
// IZPELJANA DATOTEKA: prisma/postgres/schema.prisma (PostgreSQL — produkcija).
// Ta skripta je EDINI dovoljeni način nastanka izpeljane datoteke:
// mehansko preslika provider sqlite → postgresql, vse ostalo je IDENTIČNO
// (modeli, relacije, indeksi, komentarji).
//
// Migracije (versioned, issue #2): prisma/postgres/migrations/0_init/
// migration.sql je BASELINE, izpeljan iz `prisma migrate diff --from-empty
// --to-schema-datamodel` (deluje BREZ baze — suha, deterministična preverba).
// `prisma migrate deploy --schema prisma/postgres/schema.prisma` ga aplicira
// na produkcijo; db push NI produkcijski mehanizem (kanon issue #2).
//
// Načini:
//   bun scripts/pg-schema-sync.ts               → zapiše postgres shemo
//   bun scripts/pg-schema-sync.ts --baseline    → + (preno)zapiše 0_init SQL
//   bun scripts/pg-schema-sync.ts --check       → preveri usklajenost (exit 1)
//   bun scripts/pg-schema-sync.ts --check --baseline → + preveri 0_init SQL
//
// FAIL-CLOSED preverbe (transformacija se ZAVRNE, če):
//   - glavna shema nima NATANČNO enega `provider = "sqlite"`,
//   - vsebuje `@db.` (nativni tipi — obnašanje se razlikuje po providerjih),
//   - vsebuje `previewFeatures` (可能性 razlike med providerji → ročno).
// ISKRENO: če kdaj dodate @db. ali previewFeatures, se ta skripta ustavi z
// razlogom — takrat preslikavo POVEDITE eksplicitno (ročna difa + test).

import { existsSync } from "node:fs";

const ROOT = import.meta.dir + "/..";
const SQLITE_SCHEMA = `${ROOT}/prisma/schema.prisma`;
const PG_DIR = `${ROOT}/prisma/postgres`;
const PG_SCHEMA = `${PG_DIR}/schema.prisma`;
const PG_MIGRATIONS = `${PG_DIR}/migrations`;
const PG_BASELINE = `${PG_MIGRATIONS}/0_init/migration.sql`;
const PG_LOCK = `${PG_MIGRATIONS}/migration_lock.toml`;

const PG_HEADER = `// Prisma shema — PRODUKCIJSKA (PostgreSQL/Neon) različica temelja.
//
// IZPELJANA DATOTEKA — en vir resnice je prisma/schema.prisma (SQLite:
// razvoj, peskovnik, CI). Generira jo \`bun run db:pg:sync\`
// (scripts/pg-schema-sync.ts): mehanska preslikava provider
// sqlite → postgresql, vse ostalo (modeli, relacije, indeksi, komentarji)
// je IDENTIČNO glavni shemi. NE urejaj ročno — naslednja sinhronizacija bi
// ročno spremembo pripisala kot razliko (CI vrata db:pg:check padejo).
//
// PRODUKCIJA (issue #2 — PRODUCTION CUTOVER + POSTGRES):
//   - migracije: prisma/postgres/migrations (baseline 0_init; deploy z
//     \`bun run db:pg:deploy\` = prisma migrate deploy --schema ta datoteka)
//   - build produkcijskega klienta: \`bun run build:postgres\`
//     (prisma generate iz TE sheme + next build standalone)
//   - runbook: docs/PRODUCTION-CUTOVER.md (backup → preflight → cutover)
//
// OPOMBA: shema je namenoma brez enumov in brez @db. nativnih tipov
// (hišni stil: String + komentarji — identična obnašanja na obeh
// providerjih; to velja tudi za izvirno 39-model shemo 1.163.4).

`;

export type SyncMode = {
  check: boolean;
  baseline: boolean;
};

export function parseArgs(argv: string[]): SyncMode {
  return {
    check: argv.includes("--check"),
    baseline: argv.includes("--baseline"),
  };
}

/** Mehanska transformacija SQLite → PostgreSQL (čista, brez I/O). */
export function transformToPostgres(source: string): string {
  // FAIL-CLOSED preverbe — transformacija zavrnjena, če se obnašanje
  // med providerjima lahko razlikuje (iskrena meja, ne tiha predpostavka).
  if (source.includes("@db.")) {
    throw new Error(
      "FAIL-CLOSED: glavna shema vsebuje @db. nativne tipe — preslikava na postgres NI mehanska. Ročno uskladi shemi in dodaj eksplicitno preverbo.",
    );
  }
  if (source.includes("previewFeatures")) {
    throw new Error(
      "FAIL-CLOSED: glavna shema vsebuje previewFeatures — feature zastavice se lahko razlikujejo med providerji. Ročno uskladi shemi.",
    );
  }
  const providerRe = /^(\s*)provider\s*=\s*"sqlite"\s*$/m;
  const matches = source.match(new RegExp(providerRe.source, "gm")) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      `FAIL-CLOSED: pričakovana NATANČNO ena vrstica provider = "sqlite", najdenih ${matches.length}.`,
    );
  }
  const withoutHeader = source.slice(source.indexOf("generator client {"));
  const withPgProvider = withoutHeader.replace(
    providerRe,
    `$1provider = "postgresql"`,
  );
  return PG_HEADER + withPgProvider;
}

/** Normalizacija SQL za primerjavo (končni pražni prostor/vrstice). */
export function normalizeSql(sql: string): string {
  return sql.replace(/\s+$/, "");
}

/** Odstrani ANSI CSI kontrolne sekvence, ki jih Prisma/Bunx v CI včasih vstavi v stdout. */
export function stripAnsiCsiSequences(output: string): string {
  return output.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

/** Prisma CLI izhod: from-empty difa postgres sheme (BREZ baze, suho). */
export function baselineSql(): string {
  const proc = Bun.spawnSync([
    "bunx",
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    PG_SCHEMA,
    "--script",
  ]);
  if (proc.exitCode !== 0) {
    throw new Error(
      `prisma migrate diff (from-empty) je padel (exit ${proc.exitCode}):\n${proc.stderr.toString()}`,
    );
  }
  // CI zajema stdout brez terminala; Prisma/Bunx lahko vseeno odda ANSI
  // progresijske sekvence pred SQL. Pred primerjavo jih odstrani, da ne
  // ustvarjajo lažnega odmika v vrstici 1 (migracije ostanejo nedotaknjene).
  return stripAnsiCsiSequences(proc.stdout.toString());
}

const MIGRATION_LOCK = `# Please do not edit this file manually
# It should be added in your version-control system (e.g., Git)
provider = "postgresql"
`;

async function main(): Promise<number> {
  const mode = parseArgs(Bun.argv.slice(2));
  const source = await Bun.file(SQLITE_SCHEMA).text();
  const generated = transformToPostgres(source);

  let failed = false;

  // 1) Usklajenost/izpis postgres sheme.
  if (mode.check) {
    if (!existsSync(PG_SCHEMA)) {
      console.error("✗ prisma/postgres/schema.prisma NE OBSTOJA — poženi: bun run db:pg:sync");
      failed = true;
    } else {
      const current = await Bun.file(PG_SCHEMA).text();
      if (current === generated) {
        console.log("✓ postgres shema usklajena z glavno (provider je edina razlika)");
      } else {
        console.error(
          "✗ postgres shema NI usklajena z glavno — poženi: bun run db:pg:sync",
        );
        failed = true;
      }
    }
  } else {
    await Bun.write(PG_SCHEMA, generated);
    console.log(`✓ zapisano prisma/postgres/schema.prisma (${generated.length} znakov)`);
  }

  // 2) Baseline migracija (0_init) — izpis ali preverba po potrebi.
  if (mode.baseline) {
    if (!existsSync(PG_SCHEMA) && mode.check) {
      // Že prijavljeno zgoraj — baseline preverba brez datoteke nima smisla.
    } else {
      const fresh = normalizeSql(baselineSql());
      if (mode.check) {
        if (!existsSync(PG_BASELINE)) {
          console.error(
            "✗ prisma/postgres/migrations/0_init/migration.sql NE OBSTOJA — poženi: bun run db:pg:baseline",
          );
          failed = true;
        } else {
          const current = normalizeSql(await Bun.file(PG_BASELINE).text());
          if (current === fresh) {
            console.log("✓ baseline 0_init IDENTIČEN svežemu from-empty difu (migracije ≡ shema)");
          } else {
            // Pokaži prvo razliko, da lahko odpravo naredimo varno:
            // samodejni re-baseline bi lahko spremenil že uporabljeno migracijo.
            const currentLines = current.split("\n");
            const freshLines = fresh.split("\n");
            let line = 0;
            while (
              line < currentLines.length &&
              line < freshLines.length &&
              currentLines[line] === freshLines[line]
            ) {
              line++;
            }
            console.error(
              `✗ baseline 0_init se RAZLIKUJE od svežega from-empty difa — prva razlika v vrstici ${line + 1}.`,
            );
            console.error(
              `  0_init: ${JSON.stringify(currentLines[line] ?? "<konec datoteke>")}`,
            );
            console.error(
              `  fresh:  ${JSON.stringify(freshLines[line] ?? "<konec datoteke>")}`,
            );
            console.error(
              `  velikost: 0_init=${current.length}, fresh=${fresh.length} znakov; re-baseline ni bil izveden.`,
            );
            console.error("  Za varno diagnozo preveri dif — ne prepisuj migracije na slepo.");
            failed = true;
          }
        }
      } else {
        // P0 AUDIT (re-baseline past): če 0_init ŽE OBSTOJA in se od novega
        // razlikuje, povišamo glas — po tem ko je bil 0_init apliciran na
        // produkcijo, povozitev spremeni kontrolno vsoto in `migrate deploy`
        // USTAVI (fail-closed, brez izgube — a presenetljivo). Po cutoverju
        // se shema razvija z NOVIMI migracijami (bun run db:pg:dev → 1_xxx),
        // nikoli več z re-baseline. Glej docs/PRODUCTION-CUTOVER.md §11.
        if (existsSync(PG_BASELINE)) {
          const existing = normalizeSql(await Bun.file(PG_BASELINE).text());
          if (existing !== fresh) {
            console.warn("");
            console.warn("⚠⚠⚠  RE-BASELINE PREPIŠE OBSTOJEČI 0_init ⚠⚠⚠");
            console.warn("  Če je bil 0_init KDARKOLI apliciran na živo bazo,");
            console.warn("  bo `prisma migrate deploy` po tem padel na kontrolni");
            console.warn("  vsoti (fail-closed). Po cutoverju shemo razvijaj z");
            console.warn("  NOVIMI migracijami: bun run db:pg:dev (→ 1_xxx).");
            console.warn("");
          }
        }
        await Bun.write(PG_BASELINE, fresh + "\n");
        console.log("✓ zapisan prisma/postgres/migrations/0_init/migration.sql (baseline)");
      }
    }
    if (!mode.check && !existsSync(PG_LOCK)) {
      await Bun.write(PG_LOCK, MIGRATION_LOCK);
      console.log("✓ zapisan prisma/postgres/migrations/migration_lock.toml");
    }
  }

  if (failed) {
    console.error("\nREZULTAT: NEUSKLAJENO — CI vrata bodo padla (to je namen).");
    return 1;
  }
  const scope = mode.baseline ? "shema + baseline" : "shema";
  console.log(`REZULTAT: OK (${mode.check ? "preverjeno" : "zapisano"}: ${scope}).`);
  return 0;
}

// Vsak dobesedni zagon skripte (ne uvoz v testih):
if (import.meta.main) {
  process.exitCode = await main();
}
