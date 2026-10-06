# 🇸🇮 Discover Slovenia AI

> **AI potovalni concierge za Slovenijo in jadransko regijo (SI · HR · ME · AL).**
> Načrtovanje večdnevnih potovanj, odkrivanje 38 kuriranih destinacij, zemljevid z
> realnimi koordinatami in deterministični načrtovalnik poti (isti vhod → isti načrt,
> 0 AI žetonov v jedru).

**Verzija: 2.0.0-rc.1 — REKONSTRUKCIJA (2026-10-06).**
Izvorni repozitorij (626 commitov, v1.190.0) je bil dvakrat izgubljen v posledici
vdorov v GitHub račun (2026-10-06). Ta aplikacija je temeljita rekonstrukcija iz
obnovitvenih virov — glej `docs/recovery/RECOVERY-REPORT.md` za celotno zgodbo.

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
- **i18n** — SL (privzet, brez predpone) + EN (`/en/*`); ostali jeziki izvirnika
  (it/de/fr/es) sledijo
- **PWA** — manifest, ikone, 84 realnih fotografij destinacij (`public/content/`)
- **API** — `/api/health`, `/api/destinations`, `/api/itinerary`, `/api/contact`,
  `/api/newsletter/subscribe`, `/rss.xml`

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

## Struktura

```
src/app/[locale]/     # vse strani (sl privzet brez predpone, /en/*)
src/app/api/          # health, destinations, itinerary, contact, newsletter
src/components/       # layout (navigacija, MobileTabBar, footer), map, plan, ui (shadcn)
src/lib/              # slovenia-data (38 destinacij), itinerary-engine (deterministični),
                      # my-trip, plan-store, lokali/trznica/go/content-data, i18n
prisma/               # SQLite razvojna shema
public/content/       # 84 realnih fotografij destinacij
docs/recovery/        # OBNOVITVENI ARHIV: RECOVERY-REPORT, snapshots produkcije,
                      # source-sessions (worklog + 57 izpisov izvorne kode),
                      # production-mirror (statični posnetek strani), shema 1.163.4
docs/evidence/        # dokazni posnetki rekonstrukcije
```

## Kaj ŠE MANJKA (iscron kanon — nič izmišljenega)

- 4 dodatni jeziki (it/de/fr/es), Stripe checkout, NextAuth prijava, skupnostne
  plošče (klepet/ankete/dnevnik), testi (izvirnik: 5332), CI pipeline, sw.js offline

## Varnostna opomba

Žetoni, objavljeni v klepetih med incidentom 2026-10-06, naj bodo vsi preklicani
(GitHub ✅ že, GitLab `glpat-…` po koncu dela, Vercel `vcp_…`, Neon geslo — glej
`docs/recovery/RECOVERY-REPORT.md` §4).
