# 🇸🇮 Discover Slovenia AI

> **AI potovalni concierge za Slovenijo in jadransko regijo (SI · HR · ME · AL).**
> Načrtovanje večdnevnih potovanj, odkrivanje 38 kuriranih destinacij, zemljevid z
> realnimi koordinatami in deterministični načrtovalnik poti (isti vhod → isti načrt,
> 0 AI žetonov). Od 2.24.0: SKRIPTE NAMESTO AI MODELOV — prosti opis potovanja
> razume deterministična NLU skripta (/api/plan-intent), @AI svetovalec pa odgovarja
> z živim vremenom (Open-Meteo) in citati STO slovenia.info nad istim kanonom.
> Od 2.25.0: SKRIPTNI START ANYWHERE — prilepi povezavo (YouTube/članek/TikTok)
> ali besedilo → SSRF-varovano strežniško branje + ujemanje krajev po korenu
> (slovenski skloni) z registrom 38 destinacij + predlog izhodišča za isti
> deterministični motor (/api/start-anywhere); z-ai-web-dev-sdk odstranjen —
> kanon P1: 100 % deterministično, 0 AI modelov.

**Verzija: 2.47.0 — E2E V CI + REGRESIJSKI TESTI FILTROV DESTINACIJ (2026-10-13, issue #38): Playwright E2E job kot drugi CI job (zlata pot + mobilni projekt na sveži SQLite bazi, Chromium z sistemskimi odvisnostmi, artefakti HTML poročila in sledi tudi ob padcu, +~6 min/push); logika filtrov destinacij (/destinacije: iskanje + regija + tip) izvlečena iz odjemalec komponente v src/lib/destinations-filter.ts (1 : 1 semantika) in zaklenjena s 20 regresijskimi zaklepi (tests/destinations-filter.test.ts: rezanje iskalnega niza, neobčutljivost na velikost črk, iskanje po name/tagline/description/highlights, neznana vrednost regije/tipa iz URL-ja → prazen rezultat, „all“ → brez omejitve, ohranjen vrstni red nabora, aktivne regije v kanonskem vrstnem redu REGIONS, integriteta registra 38 destinacij / 21 regij / 9 tipov); 0 AI.

**Faza 2 (2.1.0):** skupnostne funkcije potovanja 1:1 iz izvorne kode (prijava,
sodelovanje z vlogami/vabili/CAS, rezervacije, ankete, skupinski klepet z
determinističnim @AI svetovalcem — 0 žetonov), **6 jezikov** (sl + en/it/de/fr/es),
lastna tržnica z B2C checkoutom (demo fail-closed; prava plačila ob Stripe ključih)
ter testna vrata (86 testov) + GitLab CI.

## Kaj je rekonstruirano ✅

- **30+ strani** — domov (1:1 struktura s produkcijo), destinacije (38 realnih zapisov
  SI/HR/ME/AL), destinacija/[slug] (+ vodniki, things-to-do), zemljevid, lokali,
  načrtuj, potovanje, na-poti (Go Mode), moja-potovanja (hub), tržnica, /go hub
  (10 partnerjev), vodiki/[slug], dogodki, doživetja, primerjava, slovenia-pass,
  kontakt, prijava, owner, za-ponudnike, vir-podatkov, pravne strani, pot/[shareId]
- **Deterministični načrtovalec** — `/api/itinerary` (interests/days/regija/sezona/
  budget → urnik 09:00–19:00, cene, geo-validacija sosednjih postankov)
- **Leaflet zemljevid** — 38 markerjev, filtri, dodajanje v Mojo pot
- **Go Mode „Na poti"** — NOW/NEXT kartice, napredek, persistenca (dai:go-trip)
- **i18n** — 6 jezikov: SL (privzet, brez predpone) + EN/IT/DE/FR/ES (`/{jez}/*`)
  z delnimi slovarji in slovensko rezervo
- **PWA** — manifest, ikone, 84 realnih fotografij destinacij (`public/content/`)
- **API** — `/api/health`, `/api/destinations`, `/api/itinerary`, `/api/contact`,
  `/api/newsletter/subscribe`, `/rss.xml`
- **PWA offline (2.4.0)** — `public/sw.js` s strategijami po vrstah zahtev:
  nespremenljiva vsebina (`/content/*`, ikone, manifest) cache-first,
  `/_next/*` gradniki network-first z zasilnim predpomnilnikom (varno za
  razvoj in produkcijo), OSM ploščice cache-first z omejitvijo 240 (opaque
  dovoljen samo za ploščice), strani network-first z zasilnim predpomnilnikom +
  `offline.html` konec, javni API (`/api/destinations`, `/api/weather`)
  network-first z zasilnim, zasebni API (auth/trips/invites/journey/checkout/
  stripe/contact/newsletter) izključno mreža — uporabniški podatki se nikoli ne
  predpomnijo; registracija v produkciji samodejno ali prek `?sw=1`; preverba
  `pwa:offline` v `/api/health`
- **Rezervacijski sloj s provizijo (2.5.0 → razširitev P0-F 2.10.0)** — 12
  provizijskih partnerjev (Booking.com, GetYourGuide, Kiwi.com, Rentalcars.com,
  Omio + P0-F: Viator, Tiqets, Skyscanner, Airalo, DiscoverCars, WorldNomads,
  SafetyWing): povezave prek
  `/api/affiliate/go` (302 + best-effort zapis klika, `rel="sponsored"`) v
  booking hubu na domači strani, kartici na strani destinacije, popupu
  zemljevida in na /go straneh partnerjev (vodene povezave z razkritvem);
  državne predloge `{country}` (SI/HR/ME/AL — npr. DiscoverCars `/croatia/Zagreb`,
  Airalo `/slovenia-eSIM`); iskrena veriga: partnerji brez javno dokumentiranega
  vzorca žetona (`affiliateTmpl ""`) ob ID-ju ostanejo na javni povezavi —
  lastnikov `AFFILIATE_*_TMPL` s pravim vzorcem iz programa aktivira provizijo;
  provizija `null` = neznana do pogodbe (nikoli izmišljena ocena — vnos iz
  poročila takrat zahteva ročno provizijo); bencinske črpalke (66, kurirani
  odprti podatki po osnovi OSM
  (ODbL), plast na zemljevidu — gorivo izrecno brez provizije); provizijski
  dnevnik in klikanja za skrbnike (`/owner/provizije`, dostop
  `DSA_ADMIN_EMAILS`); izplačilni koledar T+3 meseci, 28. v mesecu
  (vzorec MindTrip)
- **Podatkovni sloj (2.8.0 — issue #1 P0-C)** — **STO uradna vsebina ŽIVA**:
  ingest iz živega vira slovenia.info (llms.txt — 752 vnosov v 7 jezikih,
  `data/sto-content.json`) z determinističnim parserjem (fail-closed: nedovoljeni
  URL ne vstopi), iskanjem po uradni vsebini z ujemanjem slovenskih sklonov
  („blede" najde „Bled"; `/api/sto/search`) in tedenskim cronom
  (`/api/cron/sto-reingest`, `vercel.json`); **OSM Overpass POI sloj** po
  viewportu (`/api/pois` — 3 zrcala, rate limit 5 s, max 0,25°², atribucija
  ODbL v vsakem odzivu; nedosegljivost je iskrena napaka, nikoli izmišljeni
  POI); **FSQ** (Foursquare Open Places, Apache-2.0): loader + stroga
  validacija (geo bbox države, 12 kategorij, dedupe) + `bun run fsq:ingest` —
  množica 125.446 POI čaka vir (mrtvi GitHub; matrika gate „data"); **KiwiTaxi**:
  shema FROM_PRICE + validacija relacij + `bun run kiwitaxi:ingest --csv` —
  feed čaka partner CSV; licenčni pregled vseh virov v
  `docs/DATA-PROVENANCE.md`.
- **Supply plast (2.7.0 — issue #1 P0-B RECOVER+RECONCILE)** — register
  zmožnosti 19 ponudnikov (16 izvirnikovih + Kiwi.com/Rentalcars po MindTrip
  vzorcu + osm-fuel odprti podatki), strojno berljiva matrika življenjskega
  cikla (`src/lib/supply/production-matrix.ts`) in mehanska izpeljeka štirih
  stanj (🟢 dejansko živo / 🔵 konfigurirano / ⚪ ni konfigurirano / 🔴 zunanja
  ovira) z `bun run activation:check` — env preverba SAMO po Boolean
  prisotnosti (kanarček: vrednosti se nikoli ne izpišejo); kanonska stanja cen
  (LIVE_PRICE / FROM_PRICE / UNKNOWN / NOT_SUPPORTED) usklajena čez vse tri
  registre (supply ← /go hub ← affiliate).
- **CI vrata (2.7.0 — issue #1 P0-J)** — typecheck (bun-types, 0 napak tudi v
  testih), prisma validate in build dodana k lint+test vratom na obeh
  platformah (GitLab CI + GitHub Actions); popravljena pokvarjena veja
  `branches:` v ci.yml.
- **Segmentacija dneva + determinizem kot identiteta (2.7.0 — issue #1 P0-D)** —
  časovnica dneva na /nacrtuj in /potovanje nosi glave segmentov
  Jutro/Popoldan/Večer (začetna ura postanka odloča; brez ure → podeduje
  tekoči segment) s poštenimi etapami ~km/~min tudi čez meje segmentov;
  `/api/itinerary` izdaja `engine: "deterministic"` + prstni odtis načrta
  (isti vhod → isti odtis — testno dokazano); stikalo „Z AI / Brez AI" iz
  izvirnika NAMENOMA ni obnovljeno (v 2.x ne obstaja AI pot — izbira bi bila
  lažna).
- **Partner kanal v booking verigi (2.6.0 — issue #1 dokončanje po plasti
  2.5.0)** — modal „Išči ponudbo“ na poti ima ZDAJ dva izrecno ločena kanala:
  **PRI PARTNERJU** (realno; kartice 5 partnerjev z vodeno povezavo
  `/api/affiliate/go`, provizijskim razkritjem in letališčem regije za leti;
  obrazec „Sem rezerviral — dodaj na pot“ → rezervacija v Moja potovanja s
  statusom **PENDING** — potrditev izstavi partner na svoji strani, uporabnik
  jo atestira s številko in ceno iz potrdila (PENDING → CONFIRMED, kanonska
  atestacija); „Upravljaj pri partnerju“ za spremembo/preklic — DEJANSKA
  sprememba teče pri partnerju, tu iskreno stanje) in **DEMO SIMULATOR**
  (izrecno oranžen, nespremenjen). Kanal zapisa razrešuje STREŽNIK iz zapisa
  `note` (nikoli iz telesa zahteve); POST telo ne sme nositi številke/cene —
  ti sta atestacija ob PATCH `confirm`. Hub `/moja-potovanja` prikazuje števce
  po kanalih (partner smaragdno, demo oranžno) in števec „čaka potrditev“.
  Direktni ponudniški API ostaja fail-closed (503) — realne rezervacije
  potečejo pri partnerjih, nikoli ne lažemo

## Tehnični sklad

Next.js 16 (App Router) · TypeScript 5 (strict) · Tailwind CSS 4 + shadcn/ui ·
Prisma ORM (SQLite za razvoj/peskovnik/CI; **PostgreSQL za produkcijo** —
`prisma/postgres/schema.prisma` + versioned migracije, glej `docs/PRODUCTION-CUTOVER.md`;
izvirna Neon Postgres shema z 39 modeli je klasificirana v
`docs/RECOVERY-MODEL-MATRIX.md`) · next-intl · Leaflet/OSM · lucide-react

## Razvoj

```bash
bun install
cp .env.example .env      # DATABASE_URL (SQLite)
bun run db:push           # ustvari tabele
bun run dev               # http://localhost:3000
bun run lint
```

**Playwright E2E (2.45.0, issue #38 P1)** — zlata pot destinacije → načrtuj →
na-poti (2 testa, izoliran kontekst z začasnim stanje na test):

```bash
bun run db:generate       # prisma klient (enkrat)
bun run db:push           # tabele (enkrat)
bun run e2e               # webServer sam zažene next dev :3100 (reuse izven CI)
```

**Mobilni E2E projekt (2.46.0, issue #38 P2)** — `chromium-mobile` (Pixel 7:
dotik, mobilni UA) teče izključno proti `e2e/mobile.e2e.ts` — zlata pot na
desktopu se ne podvaja. Pokritje: vodoravni preliv 5 strani × 320/375/390/768/1440,
mobilni meni (odpri → Escape → navigacija), zlata pot na dotiku (skrajšana) in
uporabnost zemljevida (Leaflet vsebnik + zoom + OSM atribucija):

```bash
bun run e2e:mobile        # samo mobilni projekt; bun run e2e = obe projekta
```

**E2E v CI (2.47.0, issue #38)** — oba projekta tečeta tudi kot drugi job
(`e2e`) v `.github/workflows/ci.yml`, vzporedno z „vrata“: sveža SQLite baza
(`prisma db push` na /tmp/e2e.db), Playwright Chromium z sistemskimi
odvisnostmi, artefakti (`playwright-report/`, `test-results/`) se naložijo
tudi ob padcu; v CI je `reuseExistingServer` izklopljen, retries = 1.

**Produkcija (PostgreSQL)** — priprava in prevezava:

```bash
bun run db:pg:sync        # regeneriraj postgres shemo iz glavne (po vsaki spremembi)
bun run db:pg:check       # vrata: shema ≡ glavna + baseline ≡ from-empty dif
bun run db:pg:deploy      # prisma migrate deploy (SAMO ta mehanizem v produkciji)
bun run build:postgres    # produkcjski build (prisma generate iz postgres sheme)
bun run db:integrity      # štetja tabel (before/after cutover primerjava)
bun run migrate:legacy    # prenos podatkov 1.163.4 → 2.x (dry-run privzeto)
```

Celoten postopek: **`docs/PRODUCTION-CUTOVER.md`** (backup → preflight →
dry-run → integrity vrata → migracija → deployment → health → E2E →
rollback). Klasifikacija vseh 39 modelov izvirnika:
`docs/RECOVERY-MODEL-MATRIX.md`.

PWA offline: service worker se v razvoju registrira na `http://localhost:3000/?sw=1`
(preizkusna pot), v produkciji samodejno.

Rezervacijski sloj (neobvezni env): `AFFILIATE_BOOKING_ID` / `AFFILIATE_GYG_ID` /
`AFFILIATE_KIWI_ID` / `AFFILIATE_RENTALCARS_ID` / `AFFILIATE_OMIO_ID` in P0-F
`AFFILIATE_VIATOR_ID` / `AFFILIATE_TIQETS_ID` / `AFFILIATE_SKYSCANNER_ID` /
`AFFILIATE_AIRALO_ID` / `AFFILIATE_DISCOVERCARS_ID` / `AFFILIATE_WORLDNOMADS_ID` /
`AFFILIATE_SAFETYWING_ID` (ID partnerja
v partnerskem programu) aktivirajo provizijske povezave, `AFFILIATE_*_TMPL`
(neobvezna predloga) jih po potrebi prilagodi — brez žetona povezave delujejo
javno, klikanja se štejejo. Pri P0-F partnerjih brez javno dokumentiranega
vzorca žetona (Viator/Tiqets/Skyscanner/Airalo/DiscoverCars/WorldNomads/
SafetyWing) ID sam ne zgradi provizijske povezave — aktivira jo šele
`AFFILIATE_*_TMPL` s pravim vzorcem iz odobrenega partnerskega programa.
Skrbniški dostop do `/owner/provizije` omogoča
`DSA_ADMIN_EMAILS` (vejica ločen seznam e-poštnih naslovov).

## Struktura

```
src/app/[locale]/     # vse strani (sl privzet brez predpone, /en/*)
src/app/api/          # health, destinations, itinerary, contact, newsletter,
                      # affiliate (rezervacije/provizije), map/fuel (črpalke)
src/components/       # layout (navigacija, MobileTabBar, footer), map, plan, ui (shadcn)
src/components/pwa/   # registracija service workerja + offline obvestila
src/lib/              # slovenia-data (38 destinacij), itinerary-engine (deterministični),
                      # my-trip, plan-store, lokali/trznica/go/content-data, i18n,
                      # affiliate-providers + affiliate-server (provizije), fuel-stations
prisma/               # SQLite razvojna shema (en vir resnice)
prisma/postgres/      # PRODUKCIJA: postgres shema (izpeljana) + migracije 0_init
scripts/              # pg-schema-sync, db-integrity-report, migrate-legacy-data,
                      # activation-check, smoke, ingesti (sto/fsq/kiwitaxi)
public/sw.js + offline.html  # PWA offline — service worker + zasilna stran
public/content/       # 84 realnih fotografij destinacij
docs/recovery/        # OBNOVITVENI ARHIV: RECOVERY-REPORT, snapshots produkcije,
                      # source-sessions (worklog + 57 izpisov izvorne kode),
                      # production-mirror (statični posnetek strani), shema 1.163.4
docs/RECOVERY-MODEL-MATRIX.md   # 39 modelov: RECONCILE/RETIRE z razlogi + prenos
docs/PRODUCTION-CUTOVER.md      # runbook: 10 korakov cutoverja z ukazi
docs/evidence/        # dokazni posnetki rekonstrukcije
```

## Kaj ŠE MANJKA (iscron kanon — nič izmišljenega)

- dopolnjevanje delnih prevodnih slovarjev (poti in preklopnik pokrivajo vseh 6
  jezikov; del komponent ima še samo sl/en), skupnostni dnevnik potovanj (klepet,
  ankete in vabila so že rekonstruirani), Stripe checkout (demo fail-closed; pravi
  čaka na ključe lastnika), testi (rekonstrukcija: 590+; izvirnik: 5332)
- pravi affiliate žetoni (`AFFILIATE_*_ID`) — registracija v partnerskih
  programih je lastnikovo dejanje; brez žetona povezave delujejo javno
  (brez provizije), klikanja se štejejo

## Varnostna opomba

Žetoni, objavljeni v klepetih med incidentom 2026-10-06, naj bodo vsi preklicani
(GitHub ✅ že, GitLab `glpat-…` po koncu dela, Vercel `vcp_…`, Neon geslo — glej
`docs/recovery/RECOVERY-REPORT.md` §4).
→ 2.16.0 P1-B agent nad kanoničnim kontekstom (issue #3 §3/§5/§6/§7):
NOV plan-edit-engine (deterministični SL razčlenjevalnik ukazov dodaj/
odstrani/premakni/zamenjaj/skrajšaj/podaljšaj/optimiziraj s toleranco
slovenskih sklonov + nespremenljive mutacije nad KANONSKIM SharedPlan +
strukturiran diff; brezstanjska ruta /api/plan-edit — nič se ne shrani,
shranjevanje ostane na obstoječih poteh; undo sklad na klientu);
NOVA plošča v načrtovalniku „Uredi načrt z ukazi" (diff predogled +
Shrani/Razveljavi) + „Iz mojih preferenc" (prijavljeni: čipi preferenc →
en klik sestavi načrt prek obstoječega /api/itinerary); NOV
recommendation-reasons (strukturirani dokazov podprti razlogi — razdalja/
cena/proračun/sezona/interesi(s sinonimi kanonskega motorja)/ocena/
primernost; delovni čas destinacij v registru NE obstaja → iskreno
izpuščen) integriran v @AI predloge („zakaj:" vrstica) + namen „zakaj";
NOV booking-summary (samo-bralna inteligenca rezervacij §7 — povzetek
stanj/kanalov iz atestacijskih zapisov, agent NIKOLI ne mutira; @AI nov
namen „rezervacije"); messages ruta podaja kanonske rezervacije poti;
ZASEBNOST: skupinski klepet NAMENOMA brez osebnega spomina (sodelavci
ne vidijo zasebnih podatkov); 34 novih testov = 1076/1076, tsc 0, lint 0
→ 2.17.0 P1-C watch/monitoring + notifikacije (issue #3 §4/§10):
NOVA modela WatchItem (userId, kind, targetKind, targetId, condition,
state active/paused, lastObservation/lastCheckedAt/lastTriggeredAt;
@@unique([userId,kind,targetKind,targetId])) + Notification (source,
severity, data, readAt, dedupeKey; @@unique([userId,dedupeKey]) →
idempotenten cron); NOV watch-engine (0-AI čista plast: 4 vrste —
price×product, weather×journey, trip_day×journey, booking×journey;
ZAVRŽENE vrste availability/flight → iskrena zavrnitev, vir ne
potrjuje; cena pade SAMO iz dveh preverljivih cen — prvi zagon zapiše
izhodišče (baseline) BREZ opozorila; vreme z izhodom postanka +
horizontom 16 dni — pred tem PENDING, nikoli lažni mir; dedupeKey na
dogodku → eno obvestilo na dan/mejnik/prehod); NOV watch-server
(runWatchCheck: bounded ≤ 12 lokacij/zagon deterministično, Open-Meteo
fail-closed, zasebnost §11 — pote brez dostopa se NE vrednotijo;
revizijska sled watch.*/notification.*); API /api/watch (GET/POST —
ime cilja določi strežnik, meja 50/uporabnik, 409 podvojeni) +
/api/watch/[id] (PATCH pavza/nadaljuj/pragi, DELETE — IDOR {id,userId}
→ 404) + /api/notifications (GET bounded 100 + ?summary=1 za zvonček,
PATCH eno/vse prebrano, DELETE prebrana/vse) + /api/cron/watch-check
(Bearer CRON_SECRET fail-closed, urnik */2h v vercel.json); UI: zvonček
z neprebranimi v glavi (poll 60 s, samo prijavljeni) + /notifikacije
(center: inbox + spremljanja + iskrenost) + gumb »Spremljaj ceno« na
tržnici + meni »Spremljaj« na pote (vreme/dnevi/rezervacije, ≥VIEWER);
PWA push ISKRENO NI implementiran (in-app plast) →
2.18.0 P1-D personalizirana domov + parity scorecard (issue #3 §9/§14):
/api/trips razširitev dateStart/dateEnd + firstStop strežniško;
personal-home-section 7 ploščic SAMO prijavljenim (Nadaljuj pot,
Obvestila, Spremljanja, Vreme naslednje pote — iskrena stanja, Ideje
zate iz preferenc z razlogi, V bližini — 100 % klientni GPS, Odprte
naloge); docs/PARITY-SCORECARD.md 20 zmožnosti z dokazi (18 PARITY +
5 SUPERIOR + iskrene vrzeli) →
2.19.0 P2 Postgres data plane (issue #2): prisma/postgres/schema.prisma
(IZPELJANA iz glavne z db:pg:sync — provider edina razlika, vrata
db:pg:check v CI) + versioned baseline migracija 0_init (CI dokazuje
migracije ≡ shema z migrate diff from-empty) + build:postgres
(prisma generate iz postgres sheme + next build za produkcijo) +
scripts/db-integrity-report.ts (štetja po tabelah, --compare +
--expect-zero vrata na kritičnih tabelah) + scripts/migrate-legacy-data.ts
(idempotenten prenos 1.163.4 → 2.x po matriki — E2E testiran: dry-run →
apply → apply = 0 novih) + bcrypt zapisi 1.163.4 se preverijo (prijava
prenesenih uporabnikov) + /api/health db:cutover (provider/latenca/
migracijsko stanje) + build:meta (SHA iz platforme) + matrika 39 modelov
(docs/RECOVERY-MODEL-MATRIX.md: RECONCILE 14 z mehanskim prenosom,
RETIRE 25 z razlogi, RESTORE 0) + docs/PRODUCTION-CUTOVER.md runbook
(10 korakov z ukazi: backup → preflight → dry-run → integrity → okno →
migracija → deployment → health → E2E → rollback) →
2.22.0 posočje regija (issue #2 §9 ostanek 4): preverjeni popravek kobarid+reka-soca
  iz „gorenjska“ v novo regijo „posocje“ (preverba proti produkciji 1.190.0:
  API+stran+sitemap 2026-10-10; STO „Soča Valley“; eksonimi Isonzo), 21 regij,
  letališče TRS, značke/slovarji usklajeni
2.23.0 CSP nonce (issue #2 §9 priporočilo): Content-Security-Policy z
  'nonce-<random>' + 'strict-dynamic' (script-src), object-src 'none',
  frame-ancestors 'none', form-action/base-uri 'self'; edini zunanji
  brskalniški vir = OSM ploščice (img-src); connect-src 'self' (0 absolutnih
  klientnih fetch, rg dokaz); [locale] force-dynamic (nonce zahteva svež
  izris); next-themes nonce prop; korenska 404 = mila degradacija (dokumentirano)
2.21.0 4-c jedrska i18n aktivacija (issue #2 §9): PlannerLang 6 jezikov
  (itinerary-engine PLANNER_MSG, weather, statusLabel, trip-dates, go-gps
  kardinali), FR register harmonizacija (vous → tu, 26 mest), 16 datumskih
  vrat prek INTL_DATE_LOCALE, asPickLocale vrata; test i18n-core-activation
  (18); sync.yml fail-fast varovalka GitLab žetona (kvota Actions)
2.20.0 P3 i18n štirijezična razširitev (issue #2 §9): prevod ~7.400 nizov
v 71 datotekah (it/de/fr/es v L-slovarjih po kanonu 48-b; iskrenostni
kanon — sl ostaja resnica/fallback) + aktivacija ~73 klicnih mest
(ternariji → pick(), INTL_DATE_LOCALE mapa, regionLabel/typeLabel) +
hreflang alternatesFor() na vseh 36 straneh (26 klientnih razdeljenih na
page.tsx strežniški ovoj + view.tsx — Next 16 prepoveduje generateMetadata
v "use client"; 6 source-contract testov usklajenih) + zadnji ostanki
prevodov (weather WMO_LABELS, recommendation reasons, legal-page) +
pogodbenski test tests/i18n-quadrilingual.test.ts (pariteta slovarjev
z prazno izjemo, pokritost hreflang 36/36, enota alternatesFor) →
1257/1257 testov (10293 expect).
