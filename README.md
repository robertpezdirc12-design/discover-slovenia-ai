# 🇸🇮 Discover Slovenia AI

> **AI potovalni concierge za Slovenijo in jadransko regijo (SI · HR · ME · AL).**
> Načrtovanje večdnevnih potovanj, odkrivanje 38 kuriranih destinacij, zemljevid z
> realnimi koordinatami in deterministični načrtovalnik poti (isti vhod → isti načrt,
> 0 AI žetonov v jedru).

**Verzija: 2.9.0 — P0-E: UVOZ REZERVACIJ + REALNI DATUMI POTI + DNEVNO VREME + NATISLJIVO POTRDILO + IZPLAČILA TRŽNICE (2026-10-07).**
Izdaje rekonstrukcije: 2.1.0 skupnostne funkcije → 2.2.0 aplikacijska lupina →
2.3.0 issue #1 (živi GPS, booking, pomočnik) → 2.3.1 infra CI → 2.4.0 PWA
offline → 2.5.0 rezervacijski sloj → 2.6.0 partner kanal booking verige →
2.7.0 supply plast (register 19 ponudnikov + matrika aktivacij) + CI vrata
(typecheck/build/prisma) + segmentacija dneva Jutro/Popoldan/Večer →
2.8.0 podatkovni sloj P0-C (STO llms.txt ingest iz ŽIVEGA vira — 752 vnosov
v 7 jezikih; FSQ loader/ingest; KiwiTaxi shema/ingest; OSM Overpass POI po
viewportu; cron reingest; vercel.json) → 2.9.0 P0-E Journey/My Trip
(deterministični uvoz rezervacij: parse → pregled → potrditev z izvorom
IMPORTED; realni datumi poti DST-varno + dnevno vreme po dnevih (Open-Meteo
16 dni, iskren horizont); natisljivo potrdilo poti z rezervacijami in
atestacijami; izplačila lastne tržnice not_due → due → processing → paid z
AuditLog + zahtevki kupca po preklicu).
Izvorni repozitorij (626 commitov, v1.190.0) je bil dvakrat izgubljen v posledici
vdorov v GitHub račun (2026-10-06). Ta aplikacija je temeljita rekonstrukcija iz
obnovitvenih virov (delovni dnevnik + izpisi izvorne kode + produkcijski posnetek +
živi API) — glej `docs/recovery/RECOVERY-REPORT.md` za celotno zgodbo.

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
- **Rezervacijski sloj s provizijo (2.5.0)** — 5 provizijskih partnerjev
  (Booking.com, GetYourGuide, Kiwi.com, Rentalcars.com, Omio): povezave prek
  `/api/affiliate/go` (302 + best-effort zapis klika, `rel="sponsored"`) v
  booking hubu na domači strani, kartici na strani destinacije in popupu
  zemljevida; bencinske črpalke (66, kurirani odprti podatki po osnovi OSM
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
Prisma ORM (SQLite za razvoj; izvirna Neon Postgres shema z 39 modeli je ohranjena v
`docs/recovery/schema-1.163.4.prisma`) · next-intl · Leaflet/OSM · lucide-react

## Razvoj

```bash
bun install
cp .env.example .env      # DATABASE_URL (SQLite)
bun run db:push           # ustvari tabele
bun run dev               # http://localhost:3000
bun run lint
```

PWA offline: service worker se v razvoju registrira na `http://localhost:3000/?sw=1`
(preizkusna pot), v produkciji samodejno.

Rezervacijski sloj (neobvezni env): `AFFILIATE_BOOKING_ID` / `AFFILIATE_GYG_ID` /
`AFFILIATE_KIWI_ID` / `AFFILIATE_RENTALCARS_ID` / `AFFILIATE_OMIO_ID` (ID partnerja
v partnerskem programu) aktivirajo provizijske povezave, `AFFILIATE_*_TMPL`
(neobvezna predloga) jih po potrebi prilagodi — brez žetona povezave delujejo
javno, klikanja se štejejo. Skrbniški dostop do `/owner/provizije` omogoča
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
prisma/               # SQLite razvojna shema
public/sw.js + offline.html  # PWA offline — service worker + zasilna stran
public/content/       # 84 realnih fotografij destinacij
docs/recovery/        # OBNOVITVENI ARHIV: RECOVERY-REPORT, snapshots produkcije,
                      # source-sessions (worklog + 57 izpisov izvorne kode),
                      # production-mirror (statični posnetek strani), shema 1.163.4
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
