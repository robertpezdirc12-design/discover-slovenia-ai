/**
 * DB-PUSH GUARDED — varovalka okoli `prisma db push --accept-data-loss`
 * (P0 AUDIT, podatkovna plast — nevarnost nenamernega izgube podatkov).
 * ============================================================================
 * Problem: `db:push` v package.json je nosil `--accept-data-loss` brez
 * varovalke. Danes ga varuje le naključje (glavna shema je SQLite, zato
 * postgres:// URL spusti P1012, še preden se poveže) — en vrstični preklop
 * providerja v prihodnosti pa bi to spremenil v produkcijsko-destruktiven
 * ukaz.
 *
 * Varovalka (fail-closed):
 *  · DATABASE_URL se MORA začeti s `file:` (lokalna razvojna baza);
 *  · vse ostalo (postgres://, postgresql://, mysql:// …) → IZHOD 1 z navodilom
 *    uporabiti `db:pg:deploy` (versioned migracije — kanon PRODUCTION-CUTOVER).
 *
 * Zagon: `bun run db:push` (ime je ohranjeno namenoma — platforma
 * .zscripts/database-runtime-build.sh ga kliče po imenu in VEDNO poda
 * file: URL, zato razvojni peskovnik ostane nedotaknjen).
 */

import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
const SCHEMA_ARG = "--schema=prisma/schema.prisma";

function refuse(reason: string): never {
  console.error("━".repeat(72));
  console.error("⛔ DB-PUSH ZAVRNJEN (varovalka P0 AUDIT):", reason);
  console.error("");
  console.error("  `db:push` nosi --accept-data-loss in je izključno");
  console.error("  RAZVOJNO orodje za lokalno SQLite bazo (file: URL).");
  console.error("");
  console.error("  Za produkcijo/Postgres uporabi versioned migracije:");
  console.error("    bun run db:pg:deploy   (prisma migrate deploy)");
  console.error("");
  console.error("  Kanon: docs/PRODUCTION-CUTOVER.md (nikoli db push na");
  console.error("  produkciji brez izrecne odobritve in preverjene varnostne");
  console.error("  kopije — issue P0 AUDIT §6).");
  console.error("━".repeat(72));
  process.exit(1);
}

if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
  refuse("DATABASE_URL kaže na Postgres (postgres://…).");
}
if (url.startsWith("mysql://") || url.startsWith("mariadb://")) {
  refuse("DATABASE_URL kaže na MySQL/MariaDB.");
}
if (!url.startsWith("file:")) {
  refuse(
    url.length === 0
      ? "DATABASE_URL ni nastavljen (varovalka zahteva izrecen file: URL)."
      : `DATABASE_URL ni file: URL ( dobil: ${url.slice(0, 24)}… ).`
  );
}

console.log("🛡️  db-push varovalka: file: URL potrdjen — izvajam lokalni push …");

const result = spawnSync(
  "bunx",
  ["prisma", "db", "push", "--accept-data-loss", SCHEMA_ARG],
  { stdio: "inherit", env: process.env }
);
process.exit(result.status ?? 1);
