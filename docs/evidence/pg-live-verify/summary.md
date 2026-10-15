# Dokaz: PostgreSQL LIVE verifikacija (§2 shadow replay + §3 deploy) — 2.66.0

**Datum:** 15. 10. 2026 · **Kje:** peskovnica (user-space, brez root-a, brez
Docker services) · **Kaj:** runbook `docs/PRODUCTION-CUTOVER.md` §2 + §3
izveden NAD ŽIVIM PostgreSQL 17 — prvič (dotlej je bil `db:pg:deploy`
teoretičen: lekcija 9 na podatkovno plast).

---

## 1. Živi PostgreSQL

- Binarna različica: **PostgreSQL 17.11** (zonky embedded binarke) za ročno
  verifikacijo; **17.10.0** (npm `@embedded-postgres/linux-x64`) za
  skripto/CI — obe 17.x, produkcija = PG 17 (kanon).
- Način: `initdb -A trust -E UTF8 --no-locale` + `pg_ctl start -p 5543x`
  v uporabniškem prostoru; bazi `dsa` (cilj) + `dsa_shadow` (shadow replay).

## 2. Izmerjena sekvenca (ročno, ena-po-ena)

| # | korak | rezultat |
|---|---|---|
| 1 | `bun run db:pg:check` | ✓ shema ≡ glavna (provider edina razlika), baseline ≡ from-empty dif |
| 2 | `bun run db:pg:validate` | ✓ "The schema … is valid" |
| 3 | **§2 shadow replay** `prisma migrate diff --from-migrations … --shadow-database-url … --script` | ✓ **`-- This is an empty migration.`** (migracije ≡ shema, na živi bazi) |
| 4 | **§3 deploy** `bun run db:pg:deploy` | ✓ "Applying migration `0_init`" → "All migrations have been successfully applied." |
| 5 | idempotenca (2. deploy) | ✓ "No pending migrations to apply." |
| 6 | `prisma migrate status` | ✓ "Database schema is up to date!" |
| 7 | `bun run db:integrity` | ✓ **29 tabel** (= 29 modelov v shemi) · `prismaMigrations: 1` |
| 8 | `bun run db:pg:generate` + `bun prisma/seed.ts` nad PG | ✓ **Seed DESTINATIONS: +74 novih — skupaj 74 (pričakovano 74)** · LISTINGS +34/34 |
| 9 | `db:integrity` ponovno | ✓ `Destination: 74` · `Listing: 34` · 29 tabel · 1 migracija |
| 10 | obnova `bun run db:generate` (SQLite klient) | ✓ |

**Ujeta dokumentacijska odmika (iskreno):**
1. runbook §3 je pričakoval »27 tabel« — shema je od pisanja zrasla na **29**
   (runbook popravljen; pričakovanje je sedaj samokalibracijsko = št. modelov);
2. komentar v `prisma/seed.ts` trdi »38 zapisov« — dejanski dataset = **74**
   (komentar je zgodovinski; vrata berejo dejanski števec).

## 3. Avtomatizirana skripta `scripts/pg-live-verify.ts` (2.66.0)

- Celotna sekvenca iz §2 (17 korakov, fail-closed, samokalibracijska):
  **17/17 ZELENO, 7 502 ms, exit 0** (izpis v logu CI kot artefakt
  `reports/pg-live-report.json`).
- Rdeča pot dokazana: zaseden port → `REZULTAT: RDEČO … (Error: timeout
  expired)` → **exit 1** (CI pade, kot mora).

## 4. Okoljske pasti bun 1.3.x (izmerjeno, zaklenjeno v skripti + testih ⑰–⑲)

| past | izmerjeno | rešitev v skripti |
|---|---|---|
| bun postinstall privzeto BLOKIRAN (`bun pm untrusted`) | `@embedded-postgres/linux-x64` hydrate-symlinks se ne izvede → binarke ne najdejo `libicuuc.so.60` | skripta sama hidrira `pg-symlinks.json` z **KOPIJAMI** (symlinki so v peskovnici prepovedani; linker ne vidi razlike) |
| Bun + `host: "localhost"` | `AggregateError` (paketova `createDatabase` se obesi brez timeouta) | vse veze eksplicitno `127.0.0.1` + `connectionTimeoutMillis: 5000` |
| Bun 1.3.x + import `embedded-postgres` | `process.exitCode` IZGUBLJEN (izhod 0 tudi ob napaki — ročno izmerjeno 15. 10.) | ekspliciten `process.exit(await main())` |

Kontrola: `pg` import SAM je NEŠKODLJIV (exit koda deluje) — `db-integrity-report.ts`,
`cutover-gate.ts`, `migrate-legacy-data.ts` so zato zdravi (preverjeno:
rdeča `db:integrity --compare … --expect-zero` vrne exit 1).

## 5. Pomen za owner-item ⑤ (db:pg:deploy / cutover)

- Runbook §2 (shadow replay) + §3 (deploy dry-run) sta zdaj **dokazano zelena**
  nad živim PG 17 — preostanek cutoverja (backup stare baze, migrate:legacy,
  health/E2E na produkciji) ostaja lastniško zunanje dejanje, a z zmanjšanim
  tveganjem: podatkovna plast ni več teoretična.
- Od 2.66.0 se sekvenca ponavlja na VSAKEM pushu (obe CI platformi), takoj ko
  tečeta: GitLab (stopnja `pg-live`) / GitHub (korak v `vrata`) — trenutno še
  čaka lastniško odpiranje (GitLab identity verification / GitHub Actions
  billing), kar je edini preostali razlog, da dokazov ni še v CI UI.
