#!/usr/bin/env bash
# =============================================================================
# scripts/cutover.sh — PRODUCTION CUTOVER (issue #2) — IZVEDLJIVI RUNBOOK
#
# Namen: koraki §1–§9 iz docs/PRODUCTION-CUTOVER.md kot varno zaporedje
# ukazov z vrati (fail-fast: rdeče = STOP, brez nadaljevanja). Faze se
# poganjajo POSAMEZNO, da ima lastnik pregled med koraki:
#
#   export LEGACY_DATABASE_URL="postgres://…stara 1.163.4…"
#   export DATABASE_URL="postgres://…nova 2.x…"
#   ./scripts/cutover.sh backup          # §1  pg_dump + sha256 + štetje tabel
#   ./scripts/cutover.sh preflight       # §2  db:pg:check + db:pg:validate
#   ./scripts/cutover.sh migrate-deploy  # §3  prisma migrate deploy (nova)
#   ./scripts/cutover.sh before          # §4  integrity BEFORE (stara)
#   ./scripts/cutover.sh transfer        # §6.1 migrate:legacy DRY-RUN
#   ./scripts/cutover.sh transfer-apply  # §6.2 migrate:legacy --apply
#   ./scripts/cutover.sh idempotence     # §6.3 ponoven apply MORA prenesti 0
#   ./scripts/cutover.sh after           # §6.5 integrity AFTER + --expect-zero
#   ./scripts/cutover.sh health          # §8  GET /api/health (SMOKE_BASE_URL)
#   ./scripts/cutover.sh smoke           # §9  bun run smoke (SMOKE_BASE_URL)
#   ./scripts/cutover.sh all             # §1→§6.1 (brez applyja — suha pot)
#
# ISKRENOSTNI KANON (isti kot scripts/migrate-legacy-data.ts):
#  - povezovalni nizi se NE izpisujejo nikoli (samo protokol);
#  - vsaka faza ima VRATA — rdeče ustavi izvajanje (exit ≠ 0);
#  - `transfer` je NEPIŠOČ (dry-run); pisanje je IZRECNO v `transfer-apply`.
#
# PG-CLIENT VAROVALKA (2026-10-10): preflight/transfer/transfer-apply/
#  idempotenca zgenerirajo Prisma klienta iz POSTGRES sheme
#  (`bun run db:pg:generate`) — privzeti klient (SQLite razvojna shema) bi
#  padel na postgres DATABASE_URL. Dokazano na PostgreSQL 17 (issue #2).
#  PO cutover delu vrni razvojni klient z `bunx prisma generate`.
#
# ROČNI KORAKI (jih ta skripta NE more namesto tebe — iskrena meja):
#  - §5  izbira cutover okna (najnižji promet) + komunikacija;
#  - §7  Vercel/Render: git povezava repa, Build Command
#        (`bun install && bun run db:pg:deploy && bun run build:postgres`)
#        + env: DATABASE_URL(nova) NEXTAUTH_URL NEXTAUTH_SECRET CRON_SECRET
#        DSA_ADMIN_EMAILS DSA_DEMO_PAYMENTS=1 (glej docs/OPERATIONS.md);
#  - §6.4 ročni pregledi JourneyBooking/SavedItinerary (matrika);
#  - §9.5 PWA preverba po deployu (manifest, sw.js verzija, offline);
#  - §10 ROLLBACK VADBA na preizkušnem okolju + dnevnik izvedbe v runbooku.
#
# STRICT RULE (issue #2 §12): cutover NI done, dokler `health` + `smoke`
# nista zelena NA PRODUKCIJI in rollback (§10) ni bil preizkušen.
# =============================================================================
set -euo pipefail

BACKUP_DIR="${CUTOVER_BACKUP_DIR:-./cutover-evidence}"
PHASE="${1:-}"

log() { printf '\n── %s ──────────────────────────────────────────\n' "$1"; }
ok()  { printf '   ✓ %s\n' "$1"; }
red() { printf '   ✗ %s\n' "$1" >&2; }
die() { red "$1"; exit 1; }

# Povezovalni niz se izpiše SAMO kot protokol (kanon: brez skrivnosti v log).
proto() { printf '%s' "${1%%://*}"; }

require_env() {
  for v in "$@"; do
    if [ -z "${!v:-}" ]; then die "okoljska spremenljivka $v NI nastavljena (glej glavo skripte)"; fi
  done
}

backup() {
  require_env LEGACY_DATABASE_URL
  TS="$(date +%Y%m%d-%H%M)"
  mkdir -p "$BACKUP_DIR"
  F="$BACKUP_DIR/backup-1.163.4-$TS.dump"
  log "§1 BACKUP STARE PRODUKCIJSKE BAZE ($(proto "$LEGACY_DATABASE_URL"))"
  command -v pg_dump >/dev/null 2>&1 || die "pg_dump manjka (namesti postgresql-client)"
  pg_dump "$LEGACY_DATABASE_URL" --format=custom --file="$F"
  [ -s "$F" ] || die "VRATA: dump je PRAZEN ali ne obstaja"
  ( cd "$BACKUP_DIR" && sha256sum "$(basename "$F")" >> backup.SHA256SUM )
  TABLES=$(pg_restore --list "$F" | grep -c "TABLE DATA" || true)
  echo "   dump: $F ($(du -h "$F" | cut -f1)) · TABLE DATA vnosov: $TABLES"
  [ "$TABLES" -ge 39 ] || die "VRATA: pričakovano ≥ 39 tabel s podatki, dobljenih $TABLES"
  ok "backup + sha256 zapisana (hrani kopijo tudi izven Neon — 3-2-1)"
}

preflight() {
  log "§2 SCHEMA PREFLIGHT (suhe preverbe, brez pisanja)"
  # CI-only dummy URL (oblika, ne povezava) — enako kot vrata v .github/workflows/ci.yml
  export DATABASE_URL="${DATABASE_URL:-postgres://cutover-preflight:skip@localhost:5432/preflight}"
  bun run db:pg:check \
    || die "VRATA: db:pg:check (postgres shema ≡ glavna; baseline ≡ from-empty)"
  bun run db:pg:validate \
    || die "VRATA: db:pg:validate (provider postgresql)"
  pg_client 
  ok "obe suhi preverbi zeleni + postgres Prisma klient generiran"
}

# PG-CLIENT VAROVALKA (2026-10-10, dokazano na PostgreSQL 17 — issue #2):
# @prisma/client je privzeto generiran iz RAZVOJNE (SQLite) sheme; brez te
# koraka bi transfer/apply/idempotenca padli na postgres DATABASE_URL z
# napako gonilnika (P1012/P1001 — protokol file:// vs postgres://).
# Vsi prenosi ciljajo postgres — klient MORA biti postgres flavoured.
pg_client() {
  bun run db:pg:generate \
    || die "VRATA: prisma generate (postgres) ni uspel — NE nadaljuj"
  ok "Prisma klient (re)generiran iz prisma/postgres/schema.prisma"
}

migrate_deploy() {
  require_env DATABASE_URL
  log "§3 MIGRATE DEPLOY na NOVO, PRAZNO bazo ($(proto "$DATABASE_URL"))"
  bunx prisma migrate deploy --schema prisma/postgres/schema.prisma \
    || die "VRATA: prisma migrate deploy ni uspel"
  bun run db:integrity \
    || die "VRATA: db:integrity po deployu"
  ok "baseline 0_init apliciran — integrity poročilo zgoraj (pričakovano 27 tabel + _prisma_migrations: 1)"
}

integrity_before() {
  require_env LEGACY_DATABASE_URL
  mkdir -p "$BACKUP_DIR"
  log "§4 INTEGRITY BEFORE (stara baza — baseline za primerjavo)"
  DATABASE_URL="$LEGACY_DATABASE_URL" bun run db:integrity \
    > "$BACKUP_DIR/integrity-before.json" \
    || die "VRATA: integrity na stari bazi ni uspel"
  ok "zapisano: $BACKUP_DIR/integrity-before.json (RETIRE tabele bodo »samo v stari« — pričakovano)"
}

transfer() {
  require_env LEGACY_DATABASE_URL DATABASE_URL
  log "§6.1 TRANSFER — DRY-RUN (brez pisanja!)"
  pg_client
  LEGACY_DATABASE_URL="$LEGACY_DATABASE_URL" DATABASE_URL="$DATABASE_URL" \
    bun run migrate:legacy --dry-run \
    || die "VRATA: dry-run ni uspel — NE poženi transfer-apply"
  ok "preglej izpuste nad matriko (docs/RECOVERY-MODEL-MATRIX.md) → nato transfer-apply"
}

transfer_apply() {
  require_env LEGACY_DATABASE_URL DATABASE_URL
  log "§6.2 TRANSFER — APPLY (pisanje po NOVI bazi)"
  pg_client
  LEGACY_DATABASE_URL="$LEGACY_DATABASE_URL" DATABASE_URL="$DATABASE_URL" \
    bun run migrate:legacy --apply \
    || die "VRATA: apply ni uspel"
  ok "prenos izveden (poročilo zgoraj — shrani ga kot dokaz v $BACKUP_DIR)"
}

idempotence() {
  require_env LEGACY_DATABASE_URL DATABASE_URL
  mkdir -p "$BACKUP_DIR"
  log "§6.3 IDEMPOTENCA — ponoven apply MORA prenesti 0"
  pg_client
  OUT=$(LEGACY_DATABASE_URL="$LEGACY_DATABASE_URL" DATABASE_URL="$DATABASE_URL" \
    bun run migrate:legacy --apply 2>&1) \
    || { printf '%s\n' "$OUT"; die "VRATA: ponoven apply ni uspel"; }
  printf '%s\n' "$OUT" | tee "$BACKUP_DIR/idempotence.txt"
  printf '%s\n' "$OUT" | grep -q "prenesenih: 0" \
    || die "VRATA: ponoven apply NI bil 0 — idempotenca prelomljena!"
  ok "idempotenca dokazana (0 novih zapisov)"
}

integrity_after() {
  require_env LEGACY_DATABASE_URL DATABASE_URL
  mkdir -p "$BACKUP_DIR"
  log "§6.5 INTEGRITY AFTER + VRATA (stroga + z razlogom — matrika §1)"
  DATABASE_URL="$DATABASE_URL" bun run db:integrity \
    > "$BACKUP_DIR/integrity-after.json" \
    || die "VRATA: integrity AFTER ni uspel"
  [ -f "$BACKUP_DIR/integrity-before.json" ] \
    || die "manjka $BACKUP_DIR/integrity-before.json — poženi najprej fazo \`before\`"
  # STROGA vrata: tabele BREZ dokumentirane izpustne poti (matrika) — delta MORA biti 0:
  DATABASE_URL="$DATABASE_URL" bun run db:integrity \
    --compare "$BACKUP_DIR/integrity-before.json" \
    --expect-zero "User,NewsletterSubscriber,Consultation,ProcessedStripeEvent" \
    || die "VRATA: --expect-zero NI zelena — preveri ročno pred nadaljevanjem"
  # VRATA Z RAZLOGOM (dokazano na PostgreSQL 17, 2026-10-10): Lead (status ∉
  # nov/kontaktiran → arhiv) in AuditLog (brez resourceType/Id → arhiv) imata
  # DOKUMENTIRANO izpustno pot — slepa vrata bi padla na produkcijskih
  # podatkih. cutover-gate.ts mehansko preveri, da delta NATANČNO ustreza
  # številu arhiviranih vrstic (zrcalo mapLead/mapAuditLog pogojev):
  LEGACY_DATABASE_URL="$LEGACY_DATABASE_URL" DATABASE_URL="$DATABASE_URL" \
    bun scripts/cutover-gate.ts \
    || die "VRATA Z RAZLOGOM RDEČA: izpusti NE ustrezajo matriki — preveri ročno"
  ok "stroga vrata (delta 0) + vrata z razlogom (arhiv po matriki) ZELENA — podatkovna stran cutoverja DOKAZANA"
}

health() {
  require_env SMOKE_BASE_URL
  log "§8 HEALTH CHECK ($SMOKE_BASE_URL/api/health)"
  BODY=$(curl -sf --max-time 30 "$SMOKE_BASE_URL/api/health") \
    || die "VRATA: /api/health nedosegljiv"
  printf '%s\n' "$BODY" | python3 -m json.tool || true
  printf '%s' "$BODY" | grep -q '"status": *"ok"' \
    || die "VRATA: \"status\" ni \"ok\" — NE preklapljaj prometa"
  VER=$(python3 -c "import json; print(json.load(open('package.json'))['version'])")
  printf '%s' "$BODY" | grep -q "\"version\": *\"$VER\"" \
    || die "VRATA: verzija na produkciji ≠ package.json ($VER)"
  if printf '%s' "$BODY" | grep -qi "materializirana ZUNAJ migracij"; then
    die "RDEČA ZASTAVKA: db:cutover kaže db push namesto migrate deploy (§8)"
  fi
  printf '%s' "$BODY" | grep -q "PostgreSQL povezljiv" \
    || die "VRATA: db:cutover ne poroča o PostgreSQL povezljivosti"
  ok "health zelena (preveri še build:meta + ostale preverbe v izpisu zgoraj)"
}

smoke() {
  require_env SMOKE_BASE_URL
  log "§9 PRODUKCIJSKI SMOKE (samo-bralni dim, isti suite kot CI)"
  SMOKE_BASE_URL="$SMOKE_BASE_URL" bun run smoke \
    || die "VRATA: smoke rdeč — NE preklapljaj prometa"
  ok "smoke zelen — zlata pot ročno (§9) + PWA (§9.5) sta še na tebi"
}

case "$PHASE" in
  backup)          backup ;;
  preflight)       preflight ;;
  migrate-deploy)  migrate_deploy ;;
  before)          integrity_before ;;
  transfer)        transfer ;;
  transfer-apply)  transfer_apply ;;
  idempotence)     idempotence ;;
  after)           integrity_after ;;
  health)          health ;;
  smoke)           smoke ;;
  all)
    backup
    preflight
    migrate_deploy
    integrity_before
    transfer
    printf '\n>>> DRY-RUN pregledan? Nadaljuj z: %s transfer-apply (potem idempotence, after, deploy, health, smoke)\n' "$0"
    ;;
  *)
    printf 'uporaba: %s {backup|preflight|migrate-deploy|before|transfer|transfer-apply|idempotence|after|health|smoke|all}\n' "$0"
    exit 64
    ;;
esac
