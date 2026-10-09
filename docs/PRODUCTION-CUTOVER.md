# PRODUCTION CUTOVER RUNBOOK — iz sandboxa 2.x v produkcijo (issue #2)

> **Kaj je to:** korak-po-korak postopek varne prevezave produkcije z
> izvirnika 1.190.0 (Render/Vercel + Neon Postgres) na **ta** repozitorij
> (GitLab `main`, 2.x) z **PostgreSQL podatkovno plastjo**, brez izgube
> podatkov in z dokazljivo rollback potjo.
>
> **Kaj je ŽE pripravljeno v repu (mehansko, CI-varovano):**
> - `prisma/postgres/schema.prisma` — produkcjska shema (izpeljana iz
>   `prisma/schema.prisma` z `bun run db:pg:sync`; vrata `db:pg:check` v CI
>   dokazujejo identiteto razen providerja na vsak push)
> - `prisma/postgres/migrations/0_init/` — versioned baseline migracija
>   (CI dokazuje: baseline ≡ `prisma migrate diff --from-empty`)
> - `scripts/db-integrity-report.ts` — štetja po tabelah + `--compare`
>   + `--expect-zero` vrata (§3)
> - `scripts/migrate-legacy-data.ts` — idempotenten prenos podatkov
>   1.163.4 → 2.x po matriki (`docs/RECOVERY-MODEL-MATRIX.md`)
> - `src/lib/password.ts` — bcrypt zapisi 1.163.4 se preverijo (prijava
>   prenesenih uporabnikov brez izgube)
> - `/api/health` — `db:cutover` (provider/latenca/migracijsko stanje) +
>   `build:meta` (SHA iz platforme) — brez skrivnosti
>
> **Kaj zahteva LASTNIKOVA zunanja dejanja** (peskovnik/CI tega NE more
> izvesti namesto tebe — iskrena meja): dostop do Neon konzole, Vercel/Render
> računov in produkcijskih skrivnosti. Vsi ukazi so pripravljeni.
>
> **STRICT RULE (issue #2 §12):** ne označi cutover kot DONE, dokler koraki
> 6–9 niso zeleni NA PRODUKCIJI in rollback (korak 10) ni bil preizkušen.

---

## 1. BACKUP STARE PRODUKCIJSKE BAZE (Neon/Postgres)

```bash
# Celoten dump (shema + podatki) z žigom časa + kontrolna vsota:
pg_dump "$STARA_DATABASE_URL" --format=custom --file=backup-1.163.4-$(date +%Y%m%d-%H%M).dump
sha256sum backup-1.163.4-*.dump > backup.SHA256SUM

# Preveri, da dump vsebuje VSE tabele (število mora biti ≥ 39 + _prisma_migrations):
pg_restore --list backup-1.163.4-*.dump | grep -c "TABLE DATA"
```

**Vrata:** dump obstoja, vsota zapisana, `TABLE DATA` števec se ujema s
prijčakovanim. Hrani kopijo NE samo v Neonu (načelo 3-2-1).

## 2. SCHEMA PREFLIGHT (suhe preverbe, brez pisanja)

```bash
# CI iste vrata lokalno:
bun install && bunx prisma generate
bun run db:pg:check        # postgres shema ≡ glavna; baseline ≡ from-empty dif
bun run db:pg:validate     # provider postgresql veljaven

# (Opcijsko, z ŽIVO bazo — replay celotne migracijske zgodovine v shadow bazi):
bunx prisma migrate diff \
  --from-migrations prisma/postgres/migrations \
  --to-schema-datamodel prisma/postgres/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" --script
# Pričakovani izhod: "-- This is an empty migration." (migracije ≡ shema)
```

**Vrata:** oba `db:pg:*` koraka zelena; (opcijsko) prazna difa.

## 3. MIGRATION DRY-RUN (na novi, PRAZNI bazi)

```bash
# Ustvari NAMENSKO novo bazo (npr. nova Neon projektna baza ali branch) in:
export DATABASE_URL="$NOVA_DATABASE_URL"
bunx prisma migrate deploy --schema prisma/postgres/schema.prisma
# Pričakovano: "applying migration 0_init" → "1 migration found … applied".

# Štetje tabel (27 + _prisma_migrations):
DATABASE_URL="$NOVA_DATABASE_URL" bun run db:integrity
```

**Vrata:** `migrate deploy` uspešen; integrity poročilo izpiše 27 tabel;
`prismaMigrations: 1`.

## 4. DATA INTEGRITY — BEFORE (zajem stanja STARE baze)

```bash
DATABASE_URL="$STARA_DATABASE_URL" bun run db:integrity > integrity-before.json
# Preglej: vseh 39 tabel + števci vrstic (to je baseline za primerjavo po
# cutoverju; RETIRE tabele bodo prikazane kot "samo v stari" — pričakovano).
```

## 5. CUTOVER OKNO (načrt)

- Odkrij: trenutek najnižjega prometa (npr. nedelja 04:00 CET).
- Trajanje: 30–60 min (backup 1 je ŽE narejen v koraku 1).
- Komunikacija: statusna stran / objava o kratki nedosegljivosti (neobvezno,
  a priporočeno za javne uporabnike).
- Zastavica: `DSA_DEMO_PAYMENTS` na novi produkciji izrecno nastavi (1 = demo
  plačila varno; STRIPE_SECRET_KEY dodaj ŠELE ko so podpisani webhooki — glej
  `docs/PRODUCTION-ACTIVATION-STATUS.md`).

## 6. MIGRACIJA PODATKOV (stara → nova)

```bash
# 6.1 DRY-RUN (brez pisanja) — preglej izpuste nad matriko:
LEGACY_DATABASE_URL="$STARA_DATABASE_URL" \
DATABASE_URL="$NOVA_DATABASE_URL" \
  bun run migrate:legacy            # = --dry-run

# 6.2 APPLY:
LEGACY_DATABASE_URL="$STARA_DATABASE_URL" \
DATABASE_URL="$NOVA_DATABASE_URL" \
  bun run migrate:legacy --apply

# 6.3 idempotenca (ponoven apply MORA prenesti 0):
LEGACY_DATABASE_URL="$STARA_DATABASE_URL" \
DATABASE_URL="$NOVA_DATABASE_URL" \
  bun run migrate:legacy --apply    # pričakovano: "skupno prenesenih: 0"

# 6.4 ROČNI PREGLEDI (izrecno iz matrike — zapiši odločitve v komentar issue #2):
#    - JourneyBooking 1.163.4 (provider potrditve): ali obstajajo zapisi?
#      SELECT COUNT(*), status FROM "JourneyBooking" GROUP BY status;
#      (semantično neskladni s 2.x lupino — vsak zapis obravnavaj posamično)
#    - SavedItinerary anonimne/nerazčrljive poti (števec v poročilu skripte):
#      ostanejo v backupu — odloči, ali jih arhiviraš javno (/pot ostane 404).

# 6.5 AFTER + primerjava z vrati (kritične tabele morajo imeti delta 0):
DATABASE_URL="$NOVA_DATABASE_URL" bun run db:integrity > integrity-after.json
DATABASE_URL="$NOVA_DATABASE_URL" bun run db:integrity \
  --compare integrity-before.json \
  --expect-zero "User,NewsletterSubscriber,Consultation,Lead,ProcessedStripeEvent,AuditLog"
```

**Vrata:** `--expect-zero` izpiše ✓ ZELENA; vsak izpust ima števec in razlog
(dokumentiran v `docs/RECOVERY-MODEL-MATRIX.md`); dry-run poročilo shranjeno
kot dokaz.

## 7. DEPLOYMENT (Vercel/Render na GitLab main)

Pripravljena ukaza v `package.json`:

```jsonc
"build:postgres": "prisma generate --schema prisma/postgres/schema.prisma && next build && cp …"
"db:pg:deploy":   "prisma migrate deploy --schema prisma/postgres/schema.prisma"
```

- **Vercel:** Build Command = `bun install && bun run db:pg:deploy && bun run build:postgres`;
  env: `DATABASE_URL` (nova, Postgres), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
  `CRON_SECRET`, ostalo po `docs/OPERATIONS.md`. Render (alternativa):
  Build = isti ukaz; Start = `bun run start` (standalone).
- **Prevezava domene:** stara produkcija OSTANE prižgana do koraka 9
  (kanarčna faza: najprej nova URL brez domene, nato preslikava DNS).
- **PWA/SW:** verzija se dviguje z vsakim releaseom (kanarček
  `tests/pwa-sw.test.ts`) — po deployu preveri `sw.js` na novi domeni
  (korak 9.5).

## 8. HEALTH CHECK (na novi produkciji)

```
GET /api/health
```

Pričakovano (ključne preverbe): `status: "ok"` · `version` = trenutna ·
`db:cutover: ok — PostgreSQL povezljiv (… ms) · 1 apliciranih migracij ·
zadnja: 0_init (datum)` · `build:meta: ok — build SHA …` · `ops:cron`,
`supply:matrix`, `marketplace:moderation` … skladno z `docs/OPERATIONS.md`.

**Rdeče zastavice (NE nadaljuj):** `db:cutover` omenja
»materializirana ZUNAJ migracij« (bila je narejena z db push namesto
`db:pg:deploy`) · `config:secrets` prijavlja manjkajoče obvezne ključe ·
katera koli preverba `skipped` brez razloga.

## 9. CRITICAL E2E (produkcijski smoke)

```bash
# Samo-bralni dim nad NOVO produkcijo (isti suite kot CI):
SMOKE_BASE_URL="https://<nova-domena>" bun run smoke

# Zlata pot ročno (ali z brskalnikom):
# HOME → DESTINACIJA → ZEMLJEVID → NAČRTOVALEC → SHRANI POT → MOJA POTOVANJA
# → GO MODE → REZERVACIJA (IDEA→CONFIRMED atestacija) → DELITEV → VABILO
# + prijava PRENESENEGA uporabnika (bcrypt — korak 6) z obstoječim geslom
```

**Dodatno:** mobilni viewport (390 px), SL/EN, 404/503 fail-closed poti
(`docs/OPERATIONS.md` dim seznam), offline stran `/offline.html`.

## 9.5 PWA/OFFLINE PO REALNEM DEPLOYU (issue §10)

- `manifest.json` dosegljiv + namestljivost (Chrome DevTools → Application).
- `sw.js` verzija = `package.json` verzija (grepanje na produkciji).
- Offline: prireži omrežje → APP_SHELL (`/`, `/na-poti`, `offline.html`) deluje.
- Zasebni API (`/api/memory`, `/api/notifications`, …) NI v predpomnilniku
  (strategija `api-private` — preveri v `sw.js`).

## 10. ROLLBACK (dokazljiva pot nazaj)

**Merilo za zagon:** katera koli RDEČA zastavka iz korakov 6–9 ali sum na
izgubo podatkov.

```bash
# 10.1 DNS/domeno vrni na STARO produkcijo (še vedno prižgana — korak 7):
#      (TTL nastavi na 60 s ŽE PRED cutoverjem, da je preklop hiter.)
# 10.2 Če so v novi bazi nastali NOVI podatki po cutoverju, jih izvozi:
DATABASE_URL="$NOVA_DATABASE_URL" bun run db:integrity > integrity-postmortem.json
pg_dump "$NOVA_DATABASE_URL" --format=custom --file=rollback-novih-podatkov.dump
# 10.3 Stara produkcija NE potrebuje obnovitve (ni je nihče spreminjal).
# 10.4 Vzrok analiziraj; popravek → nov commit → CI 6 vrat → ponovi od §2.
```

**Dokaz rollbacka (issue §11 »rollback je izvedljiv«):** pred produkcijskim
cutoverjem izvedi VADBO na preizkušnih okoljih (Render preview / Vercel
preview z novo bazo): cutover → dim → rollback → dim stare — in jo zabeleži
v tem runbooku (dodaj datum + URL dokaza spodaj).

---

## 10.5 RAZVOJ SHEME PO CUTOVERJU (re-baseline past — P0 AUDIT)

> **Ključno pravilo:** ko je bil `0_init` ENKRAT apliciran na živo bazo,
> ga **NIKOLI VEČ ne povozimo** z `bun run db:pg:baseline`. Povozitev spremeni
> kontrolno vsoto migracije → `prisma migrate deploy` na produkciji **pade**
> (fail-closed, brez izgube podatkov, a je to izpad).

Kako se shema pravilno razvija PO cutoverju:

```bash
# 1. Spremeni prisma/schema.prisma (SQLite razvoj — kanon "samo dodajaj")
# 2. Izpelji postgres varianto (mehansko, enako kot vedno):
bun run db:pg:sync
# 3. USTVARI NOVO migracijo (NIKOLI re-baseline):
bun run db:pg:dev          # → prisma/postgres/migrations/1_<ime>/migration.sql
# 4. CI vrata db:pg:check morajo ostati zelena:
#    (baseline 0_init ≡ from-empty dif + nova migracija ≡ dif 0_init→shema)
bun run db:pg:check
# 5. Na produkciji:
bun run db:pg:deploy
```

`scripts/pg-schema-sync.ts` ob povozitvi obstoječega, različnega `0_init`
izpiše glasno opozorilo (⚠⚠⚠ RE-BASELINE) — to je zadnja obramba pred pastjo.

---

## Dnevnik izvedbe (izpolni ob cutoverju)

| Datum | Korak | Rezultat | Dokaz (URL/SHA) | Izvajalec |
|---|---|---|---|---|
| | 1 backup | | | |
| | 6.1 dry-run | | | |
| | 6.2 apply | | | |
| | 6.3 idempotenca | | | |
| | 8 health | | | |
| | 9 E2E | | | |
| | 10 vadba rollback | | | |

## Preverjanje sprejemnih kriterijev issue #2 (§11)

- [x] Production datasource = PostgreSQL (shema + migracije v repu)
- [x] Versioned Prisma migrations obstajajo in so CI-preverjene
- [x] Recovery 39-model shema je model-po-modelu klasificirana (matrika)
- [x] Data migration ima before/after integrity report (`db:integrity`)
- [ ] Backup + restore DOKAZANA na produkciji (korak 1 — lastnik)
- [x] Noben production secret v repu/logu (skripte izpisujejo samo protokole)
- [x] Auth/IDOR/BOLA regresija zelena (P0-G vrata + `trip-security-contract`)
- [x] Stripe production path fail-closed in podpisan (P0 + `ops:cron` dim)
- [x] Affiliate redirecti varni in sledljivi (P0-F)
- [x] Production cron zaščiten in idemponten (P0-I + P1-C dedupe)
- [x] `/api/health` daje produkcijsko pripravljenost brez skrivnosti
- [x] Production smoke avtomatiziran (`scripts/smoke.ts` + CI 6. vrata)
- [ ] PWA offline preverjen PO realnem deploymentu (korak 9.5 — lastnik)
- [ ] Vercel/Render cutover na GitLab main izveden in dokumentiran (koraki 5–9)
- [x] Rollback je izvedljiv (korak 10; vadba = zadnji odkljukan element)
- [x] Stara produkcija ostane do uspešnega cutoverja (runbook eksplicitno)
- [x] Issue #1 funkcionalnosti niso regresirale (CI + 1159+ testov na vsak push)
- [x] GitLab pipeline ostaja zelen (6/6 vrat na vsak push)

> Iskrena meja: trije odkljukani kvadratki z »lastnik« so ZUNANJA dejanja,
> ki jih peskovnik/CI ne more izvesti. Vse ostalo je v repu in mehansko
> preverjeno na vsak push.
