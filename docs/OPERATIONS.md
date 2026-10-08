# OPERACIJSKI PRIPROČNIK (RUNBOOK) — Discover Slovenia AI

> **Velja za:** 2.17.0 (P0-I cron + ops; P1-C watch-check job).
> **Kanon iskrenosti:** vsako stanje se izpiše, kakršno je — noben job se ne
> „pobarva" zeleno, če ni storil ničesar; nobena skrivnost se ne zapiše v
> dnevnik; vse, česar ni (pošta, push, računi), odkrito manjka.

## 1. Cron jobi (issue #1 §21)

Vsi jobi delijo enak vhodni varovalni seznam `requireCronSecret`
(`src/lib/cron-auth.ts`): **glava `Authorization: Bearer <CRON_SECRET>` je
obvezna**. Brez skrivnosti v okolju ali z napačnim žetonom je odgovor **401
(fail-closed)** — jobi so ZAPRTI, nikoli odprti „za silo".

Urnik je registriran v `vercel.json` (Vercel Cron pošilja GET z glavo):

| Pot | Urnik (UTC) | Namen | Idempotenca | AuditLog dejanje |
|---|---|---|---|---|
| `/api/cron/sto-reingest` | torek 7:30 | osvežitev STO llms.txt vsebine | ponovni klic prepiše z istim virom | — (poročilo ingesta) |
| `/api/cron/kiwitaxi-reingest` | sreda 7:30 | osvežitev KT feeda | feed še čaka vir → iskren **204 no-op** | — |
| `/api/cron/recalculate-status` | **vsak dan 6:30** | materializacija izplačil `not_due → due` (zadrževalna doba 7 dni) | ponovni zagon = 0 sprememb; premika SAMO not_due → due (ročni `processing`/`paid` sta lepljiva) | `payout.due_materialized` (actorType `system`, meta from/to) |
| `/api/cron/draft-reminders` | **vsak dan 8:00** | opomnik za partnerjeve osnutke ≥ 7 dni | **dedup 7 dni** po AuditLog zgodovini (en osnutek = en nudge na teden) | `partner.draft_nudge` (meta ageDays, ownerId) |
| `/api/cron/watch-check` | **vsaki 2 uri (:15)** | preverjanje uporabniških spremljanj (P1-C issue #3 §4): cena/vreme/dnevi/rezervacije | **dedupe po `(userId, dedupeKey)`** unique — vzporedni/ponovljeni zagon ne podvoji obvestil (P2002 = že zapisano); bounded ≤ 12 vremenskih lokacij na zagon; vir nedosegljiv → iskreno `unavailable` (brez izmišljenih napovedi) | `watch.check_run` (meta števci: scanned/evaluated/triggered/written/dupes/weatherFetches) |

**Roke zagona ročno** (npr. po obnovitvi baze):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domena>/api/cron/recalculate-status
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domena>/api/cron/draft-reminders
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domena>/api/cron/watch-check
```

### Pošteno NE-obnovljeni jobi izvirnika (issue §21 „samo relevantni")

| Izvirnikov job | Zakaj ni v 2.13.0 |
|---|---|
| `daily-trip-push` | aplikacija nima push infrastrukture (0 web-push žetonov) — job bi pretvarjal pošiljanje, kar ni; P1-C uvaja IN-APP notifikacije (watch-check piše v bazo, zvonček bere) — PWA push ostaja NE-obnovljen |
| `weekly-alerts`, `renewal-reminders` | naročninski paketi lastnika (billing) še niso zgrajeni — opomniki za naročnine bi bili izmišljeni |
| `commission-invoices` | tržnica je eno-prodajalna (izplačila lastniku); izstavljaje računov po partnerju čaka B2B rast |

## 2. Skrivnosti (okolje)

| Ključ | Namembnost | Vedenje brez nastavitve |
|---|---|---|
| `CRON_SECRET` | Bearer žeton za VSE cron poti | jobi ZAPRTI (401 fail-closed) |
| `STRIPE_SECRET_KEY` + `DSA_DEMO_PAYMENTS` | prava/demo plačila tržnice | checkout **503 fail-closed** (nikoli lažna potrditev) |
| `STRIPE_WEBHOOK_SECRET` | podpis webhook dogodkov | webhook odkloni (podpis OBVEZEN) |
| `DSA_ADMIN_EMAILS` | skrbniški dostop /owner/*, /admin, moderacija | prazno = NOBEN račun ni skrbnik (fail-closed) |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL` | seje + baza | prijava/baza ne delujeta |
| `AFFILIATE_*_ID` / `_TMPL` | provizijske povezave /go | povezava javna (0 % provizija, iskerno razkrito), nikoli izmišljena |

**Skrivnosti nikoli niso v repozitoriju** (`.env` je izključen iz sinhronizacije;
`.env.example` vsebuje samo imena). Po vsakem sumu izpostavitve: prekliči žeton
pri izdajatelju in zavrti vrednost v okolju.

## 3. Produkcijski dim (safe smoke)

`bun run smoke` (lokalno privzeto `http://localhost:3000`; preglasi z
`SMOKE_BASE_URL=https://<domena>`) — **samo-bralni** GET dim:

- strani: `/`, `/destinacije`, `/destinacija/bled`, `/trznica`, `/zemljevid`,
  `/na-poti`, `/konzultacija`, `/za-ponudnike`, `/sw.js`;
- API: `/api/health` (status `ok`, verzija ≡ `package.json`, ≥ 8 preverb),
  `/api/destinations` (register ≥ 38);
- affiliate gedelji: znan partner → 302 z Location; neznan → 400 (fail-closed);
- **varnostni negativni dim: vse 5 cron poti BREZ žetona → 401** (če bi se
  kdaj katera odprla, dim pade).

Izhodna koda `0` = zdravo, `1` = padec (primerno za CI — P0-J ga poveže v vrata).
Dim NE piše v bazo (brez POST/PUT/DELETE) in NE pošilja žetonov.

## 4. Zagon/objava

1. `bun install` → `bun run db:push` (SQLite `db/` — shema se izpelje iz
   `prisma/schema.prisma`);
2. `bun run dev` (razvoj) / `bun run build && bun start` (produkcija);
3. po objavi obvezno: `SMOKE_BASE_URL=https://<domena> bun run smoke`;
4. preverba poštenja: `curl -s https://<domena>/api/health | jq` — 9 preverb,
   `ops:cron` pove stanje skrivnosti (DA/NE, brez vrednosti).

## 5. Varnostni pregled (issue §23 — sistemski stražar podatkov)

`src/lib/system-data-guard.ts` (SYSTEM_DATA_GUARD, P0-I):

- **sanitizacija** (`sanitizeUntrustedText`): nadzorni znaki C0/C1, zero-width
  (U+200B–D, U+2060, U+FEFF) in bidi override (U+202A–E, U+2066–9) se
  odstranijo na VSAKI meji zunanjih/uporabniških podatkov + dolžinske meje;
  uporabljeno na: OSM Overpass POJi (ime + relevantne oznake), FSQ dump
  (ime/naslov/kraj), KiwiTaxi feed (imeni lokacij + razred vozila), sporočila
  skupinskega klepeta, konzultacijski obrazec (vprašanje + dodatki), imena
  postankov pote v @AI svetovalcu;
- **zaznavanje navodil za AI** (`detectPromptInjection`, SL+EN vzorci):
  poskus „ignore previous instructions" v klepetu → @AI svetovalec NE izvede
  in NE odmeva vsebine, ampak odkrito odgovori (`AI_GUARD_ANSWER`); v
  konzultaciji odgovor dobi vidno opombo varnostnega stražarja;
- **0 AI žetonov v jedru** — grožnja izvajanja ukazov ne obstaja (determinizem);
  guard ščiti integriteto predlog in higijeno prikaza.

## 6. Varnostne kopije (SQLite)

- baza je ena datoteka: `db/` (dev) — kopiraj ZAPRTO (`sqlite3 .backup` ali
  ustvari z dump); datoteke `db/*` se NE sinhronizirajo v repozitorij;
- AuditLog (`actorType "system"`) je kronika strojnih dejanj — po obnovitvi
  preveri zadnje `payout.due_materialized` / `partner.draft_nudge` vnose:
  obnova NE povozi izpeljave (recalculate-status bo naslednji zagon
  materializiral le, kar je resnično zapadlo — idempotenca).

## 7. Incidentni kanon

1. **Ne prikrivaj**: padec dima / 503 / 401 se javno izpiše z razlogom.
2. **Ne izumljaj**: manjkajoč vir (FSQ/KiwiTaxi feed) ostane „čaka vir".
3. **Ne tiho popravljaj**: vsak ročni popravek stanja (npr. payout ročno v
   `processing`) gre skozi skrbniški API in se zapiše v AuditLog.
4. **Prekliči žetone** ob vsakem sumu izpostavitve (cron, Stripe, affiliate).

## 8. Znane meje (iskreno)

- **e-pošta ne obstaja** — konzultacije in opomnik osnutkov se dostavljajo
  prek zasebnih povezav in portala (nikoli ne trdimo, da je bilo poslano);
- **shared playing state (websocket)** iz §18 ostaja odložen (klepet se
  iskreno osvežuje vsakih 6 s — nikoli „v živo");
- **FSQ dump čaka vir** (mrtvi GitHub račun — matrika `gate data`);
- **daily-trip-push / weekly-alerts / renewal-reminders / commission-invoices**
  niso rekonstruirani (razlogi v tabeli zgoraj).
