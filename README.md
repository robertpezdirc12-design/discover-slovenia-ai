# 🇸🇮 Discover Slovenia AI

> **AI potovalni concierge za Slovenijo in jadransko regijo (SI · HR · ME · AL).**
> Načrtovanje večdnevnih potovanj, odkrivanje 38 kuriranih destinacij, zemljevid z
> realnimi koordinatami in deterministični načrtovalnik poti (isti vhod → isti načrt,
> 0 AI žetonov v jedru).

**Verzija: 2.5.0 — REZERVACIJSKI SLOJ S PROVIZIJO (2026-10-08).**
Izdaje rekonstrukcije: 2.1.0 skupnostne funkcije → 2.2.0 aplikacijska lupina →
2.3.0 issue #1 (živi GPS, booking, pomočnik) → 2.3.1 infra CI → 2.4.0 PWA
offline → 2.5.0 rezervacijski sloj.
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
  čaka na ključe lastnika), testi (rekonstrukcija: 460+; izvirnik: 5332)
- pravi affiliate žetoni (`AFFILIATE_*_ID`) — registracija v partnerskih
  programih je lastnikovo dejanje; brez žetona povezave delujejo javno
  (brez provizije), klikanja se štejejo

## Varnostna opomba

Žetoni, objavljeni v klepetih med incidentom 2026-10-06, naj bodo vsi preklicani
(GitHub ✅ že, GitLab `glpat-…` po koncu dela, Vercel `vcp_…`, Neon geslo — glej
`docs/recovery/RECOVERY-REPORT.md` §4).
