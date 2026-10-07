# RECONSTRUCTION PLAN — Discover-Slovenia-AI (pot C, "obnavljaj temeljito")

> Cilj: temeljita rekonstrukcija aplikacije **Discover-Slovenia-AI / I Feel Slovenia**
> (original: 626 commitov, v1.190.0, 40 strani, 39 DB modelov, 5332 testov — izgubljen 2×).
> Gradimo v `/home/z/my-project` → push na GitLab `markec-group/discover-slovenia-ai`.
> Verzija rekonstrukcije: **2.0.0-rc.1** (deterministično jedro, SL+EN, 38 destinacij z realnimi podatki).

## Viri (READ-ONLY)
| Vir | Pot |
|---|---|
| Izluščena izvorna koda (45 datotek) | `/home/z/recovered-src/` |
| Živi API podatki (38 destinacij, health) | `/home/z/merge-dsa/snapshots/` |
| Statični posnetek produkcije (201 strani, 84 slik, manifest, ikone, rss.xml) | `/home/z/merge-dsa/production-mirror/` |
| Delovni dnevnik celotnega projekta (SPEC, 1179 vrstic) | `/home/z/my-project/worklog.md` |
| Domača stran produkcije (struktura za 1:1) | `/home/z/merge-dsa/production-mirror/index.html` |

## Karta rekonstruiranih datotek (`/home/z/recovered-src/`)
| Datoteka | Original |
|---|---|
| `read_1790842521755_3cf84405b2d3.ts` | README.md (najnovejši, ~1.163.x) |
| `read_1790842578812_8279579212c2.prisma` | prisma/schema.prisma — 39 modelov (postgres/Neon) |
| `read_1790842646684_bb6955cc1a36.ts` | /api/itinerary — načrtovalnik z vremenskim kontekstom (t11) |
| `read_1790842652332_f99d5e72e6e1.ts` | src/lib/supply registry (PROVIDER_REGISTRY) |
| `read_1790848327880_c01c3dc3a462.ts` | src/lib/supply lifecycle matrix |
| `read_1790859608974_23e4c05e3e6e.ts` | GoMode „Na poti" Now&Next UI (1.64.0, 1280 vrst.) |
| `read_1791012217208_1ddcd6ce62c5.ts` | GoMode UI v2 (2002 vrstice) |
| `read_1790859645269_5763f9d885ba.ts` | src/lib/types.ts (centralni tipi) |
| `read_1790966184579_95fc9a2fb3d7.ts` | src/lib/journey/geo-validacija (P0.2) |
| `read_1790886398746_0ac5c79a4e58.ts` | JourneyPlanner — osrednji UI potovanja (Task 58) |
| `read_1790953571522_908bb727ccfd.ts` | navigation.tsx (NAV_L, useNavLinks) |
| `read_1790973233090_3cac0baa9ecf.ts` | /pot/[shareId] strežniška stran |
| `read_1790886447215_b91dab78e9ce.ts` | shared-trip odjemalški prikaz |
| `read_1790956846903_52a42b958a6c.ts` | AI mehurček (trip klepet/komentarji) |
| `read_1790957760964_58a105b35c54.ts` | komponente s slo. helperji (ednina/dvojina/množina) |
| `read_1790957761446_0ae5336eea1e.ts` | TripCollab |
| `read_1790957761726_49e467279afb.ts` | Trip Reservations |
| `read_1790957773809_5c50f61d1da9.ts` | Trip Polls |
| `read_1790859607854_0b02a6b449d5.ts` | komponente Moja pot / uporabniška potovanja |
| `read_1790878796842_f8a548a31eb9.md` | issue: TRAVEL GUARDIAN spec |
| `read_1790886278902_66e968d24918.md` | issue: GUIDED PLATFORM spec |
| `read_1790966023624_e49bfb99c504.ts` | **Explore inšpekcijsko poročilo (vrstice 1–22!) — arhitektura** |
| `read_1790859683429_f5ca5a853ab8.html` | offline.html |
| `read_1790842600834_7bf4054c07ff.ts` | ROLES matrika |

## Arhitektura (iz Explore poročila + mirror)
- **Mentalni model:** ODKRIJ → DODAJ → MOJA POT → NAČRTUJ → POJDI (v navigaciji, vodeni plasti in tab baru)
- **Navigacija:** desktop 4+Več (Sheet); MobileTabBar (dno): Odkrij | Zemljevid | **MOJA POT** (sredinska krogla+badge) | Pojdi | Več — aria-current, ≥44px, safe-area
- **i18n:** next-intl; sl privzet BREZ prefixa (as-needed), en polno; ostali (it/de/fr/es) kasneje; **komponente uporabljajo lokalni vzorec `const L = {sl: {...}, en: {...}}`** (kanon izvirnika!) + `useLocale()`
- **Tema:** primarna ZELENA `#2d6a3e` (iz manifest.json theme_color); svetlo/temno (next-themes); BREZ indigo/modre
- **PWA:** manifest.json (4 bližnjice), ikone, offline.html, sw.js
- **Jedro načrtovalnika:** DETERMINISTIČNO (isti vhod → isti načrt)
- **Zemljevid:** Leaflet/OSM + OSRM poti (leaflet + react-leaflet ŽE nameščena)
- **DB:** sandbox = SQLite minimalna podmnožica; original 39-model postgres shema → ohranjena v `docs/recovery/schema-1.163.4.prisma`
- **Iskrenost kanon:** vsa nezanesljiva stanja izrecno NEZNANO (nikoli izmišljeno)

## Inventar poti (strani)
`/` (domov, 13 blokov), `/destinacije`, `/destinacija/[slug]` (8 bogatih: bled, bohinj, kobarid, ljubljana, piran, postojnska-jama, reka-soca, triglav; podstrani things-to-do ipd.), `/zemljevid`, `/lokali`, `/nacrtuj`, `/potovanje`, `/na-poti` (Go Mode), `/moja-potovanja` (hub), `/go` (+ partnerji: hotels, flights, cars, transfers, transport, activities, viator, tickets, insurance, esim), `/trznica`, `/vodici`, `/dogodki`, `/dozivetja`, `/primerjava`, `/slovenia-pass`, `/kontakt`, `/prijava`, `/owner`, `/za-ponudnike`, `/vir-podatkov`, `/pogoji-uporabe`, `/politika-zasebnosti`, `/zaupanje-in-varnost`, `/pot/[shareId]`, `/en/*`, `/rss.xml`

## API
`/api/health` (status+startup preverbe), `/api/destinations` ({destinations, total} — oblika 1:1 iz snapshot), `/api/itinerary` (deterministični načrtovalnik — rekonstruiran vir), `/api/journey/plan`, `/api/contact`, `/api/newsletter/subscribe`

## Data
- 38 destinacij (SI/HR/ME/AL; 20 regij; 9 tipov) — 1:1 iz `snapshots/render-api-destinations.json` v `src/lib/slovenia-data.ts`
- 84 slik v `content/` → `public/content/`
- rss.xml (vodniki z opisi) + mirror HTML = vsebina za vodici/dogodki/doživetja/destinacija podstrani

## Pravila
1. Next.js 16 App Router + TS strict; shadcn/ui obstaja v `src/components/ui` (NE spreminjaj)
2. `z-ai-web-dev-sdk` SAMO strežniško (za AI funkcije kasneje)
3. Lepljivi footer (`min-h-screen flex flex-col` + `mt-auto`); mobile-first; a11y; 44px dotiki
4. Brez testov; lint čist (`bun run lint`); dev strežnik ŽE teče (port 3000, NE ponovno zaganjaj; glej `dev.log`)
5. Vsak agent: pred delom preberita worklog.md + ta načrt; po delu DODAJ zapis v worklog.md
6. Tokeni/ščitniki: v kodo NOBENIH skrivnosti
7. UI jezika: SL privzeto + EN (lokalni L vzorec {sl,en})

## Zaporedje
- **45-a TEMELJ** (en agent): i18n, layout, navigacija+tab bar+footer, tema, sredstva (public/), slovenia-data, tipi, Prisma+seed, vse route stub-ovi, /api/health + /api/destinations, not-found
- **45-b VSEBINA** (paralelno): domov (13 blokov 1:1 po index.html), destinacije, destinacija/[slug]+podstrani, vodici (iz rss.xml), dogodki, doživetja, vir-podatkov, primerjava, slovenia-pass, kontakt, za-ponudnike, pravne strani, prijava, owner, rss.xml
- **45-c ZEMLJEVID+TRŽNICA** (paralelno): zemljevid (leaflet markerji destinacij+lokalov), lokali, trznica (supply registry), /go hub + partner strani
- **45-d NAČRTOVALNIK** (paralelno): /nacrtuj (deterministični planner + /api/itinerary rekonstrukcija), /potovanje (journey + JourneyMap), /na-poti (Go Mode), /moja-potovanja hub
- **46 VERIFIKACIJA**: lint + agent-browser (domov, destinacije, zemljevid, načrtuj, jezik, footer) + popravki
- **47 GITLAB**: push + RECOVERY-REPORT posodobitev + poročilo

---

# FAZA 3 (2.2.0) — živi viri + booking lifecycle (Taski 51-a/b/c/d)

> Kontekst: rekonstrukcija Faz 1+2 (2.1.0, 145 testov) je pushana na GitLab
> (main @ 1275f64). Faza 3 dopolnjuje funkcionalnost do izvirnika (v1.190.0),
> kolikor je dosegljivo iz peskovnika, po načelu ISKRENOSTI (vsa nezanesljiva
> stanja izrecno razkrita). Viri specifikacije: izvirni avditski zapis
> (recovered-src/read_1791301651555_b12324cc0c9d.md §"booking lifecycle",
> "Zasebnost", "OSRM/route"), prisma model JourneyBooking
> (read_1790842578812_8279579212c2.prisma:773-821) + ŽIVI produkciji API
> (i-feel-slovenia.vercel.app: /api/map/pins oblika, /api/listings).

## Preverjena dosegljivost iz peskovnika (2026-10-07)
- ✅ api.open-meteo.com (HTTP 200, živi podatki)
- ✅ router.project-osrm.org (HTTP 200, realna pot Ljubljana→Bled 76,9 km)
- ✅ i-feel-slovenia.vercel.app (produkcija živi; /api/map/pins oblika spodaj)
- ❌ FSQ dataset 125.445 krajev (nameščen SAMO na produkciji — NE preskušamo
  rekreirati; /api/map/pins rekonstrukcija pošteno streže LASTNE podatke)

## 51-a /api/weather + Go Mode vreme
- `src/app/api/weather/route.ts` GET `?lat&lng`: validacija lat ±90 / lng ±180
  (regex, 400 pri napaki); rate-limit 60/min (in-memory); proxy Open-Meteo
  `current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&timezone=auto&forecast_days=1`,
  timeout 8 s; NAPAKA = 502 fail-closed (NIKOLI izmišljenih podatkov);
  in-memory cache ključ zaokrožen na 2 decimalki, TTL 10 min, cap 200;
  0 persistencije (nikoli DB).
- `src/lib/weather.ts` (client-safe): fetchWeather(lat,lng) + WMO weather_code
  → oznaka {sl,en} (clear/mainly clear/cloudy/fog/drizzle/rain/snow/thunder
  — samo nabor, ki ga znamo pošteno imenovati; NERAZPOZNANA koda → "vreme"
  brez lažne natančnosti).
- `na-poti/page.tsx`: kartica "Vreme na naslednjem postanku" — koordinate
  NASLEDNEGA POSTANKA (nikoli uporabnikove GPS); stanja: skeleton /
  napaka (iskrena) / skrito, če postanek nima koordinat.

## 51-b /api/map/pins + OSRM poti + zemljevid
- `src/app/api/map/pins/route.ts` GET `?bbox=south,west,north,east&zoom=N`
  (oblika 1:1 iz produkcije): bbox CSV validacija (4 števila, south<north,
  west<east, razpon ≤10°/≤15° sicer 400); zoom int 3–19 (default 10);
  zoom < 15 → `mode:"grid"` (celice ~0,05°: {lat,lng,count,cats:[{type,count}]});
  zoom ≥ 15 → `mode:"pins"` (cap 500, `capped` zastavica).
  Viri: 38 destinacij (precision "exact") + lokali z destinationSlug
  (26; precision "destination_center" — izpeljano, pošteno označeno;
  4 brez povezave IZPUŠČENI — nimajo koordinat). Pin: {id,lat,lng,type,name,precision}.
  Odziv: {mode,cells?,pins?,total,returned,capped,dataset:{installed:true,
  places:N,lastUpdated,snapshotDate},generatedAt,source:{slug:"own",
  label:"Lastni kanonski podatki (rekonstrukcija)"}} — dataset pošteno
  opisuje LASTNE podatke, NE FSQ 125k.
- `src/lib/road-routing-server.ts` (server-only): OSRM strežniški odjemalec —
  pomnilniški cache (ključ lat/lng zaokroženo 4 dec., TTL 24 h, cap 600),
  circuit breaker (4 zaporedne napake → odprt 10 min), NaN/negativna varovalka,
  fallback hevristika (haversine×1,3 @ ~55 km/h) ZAMENJANO oznako
  source:"heuristic" (nikoli "osrm" za hevristiko).
- `src/app/api/journey/route/route.ts` POST {slugs:[2..12]} (samo iz nabora
  38): {legs:[{from,to,km,min,source,geometry:[lat,lng][]}],totalKm,totalMin,
  method:"osrm"|"heuristic"|"mixed"}; rate-limit 30/min.
- `travel-map.tsx`: ① plast "Lokali" (toggle): fetch pins ob moveend
  (debounce 400 ms), zoom ≥ 15 pokaže markerje lokalov, zoom < 15 iskren
  hint "Povečaj za lokalne pin"; ② plast "Pot": če ima uporabnik ≥ 2
  destinacije v Moji poti → gumb "Prikaži pot" → POST /api/journey/route →
  Polyline po realni geometriji (heuristična = črtkana premica + oznaka).

## 51-c JourneyBooking lifecycle (izvorni model 1:1 kolikor dokumentiran)
- `src/lib/journey/booking.ts`: 14 statusov (DRAFT|SELECTED|BOOKING_REQUESTED|
  PENDING|PAYMENT_REQUIRED|PAID|CONFIRMED|MODIFIED|REFUNDED|EXPIRED|FAILED|
  CANCELLED|UNKNOWN|EXTERNAL); INITIAL_CONFIRMATION_STATUSES=[SELECTED,
  EXTERNAL, BOOKING_REQUESTED, DRAFT]; ALLOWED_TRANSITIONS (EXTERNAL
  absorpcijsko; REFUNDED/EXPIRED/CANCELLED terminalni; DRAFT→SELECTED|
  CONFIRMED|CANCELLED — import pot); BOOKING_SOURCES=[USER,IMPORTED,PROVIDER];
  validateConfirmationRecord: CONFIRMED zahteva providerBookingId+ceno;
  source USER/IMPORTED samo DRAFT/CONFIRMED; provider polja nosi SAMO
  source PROVIDER (sicer reject — iskrenost izvora).
- Utrditev `api/trips/[shareId]/reservations/route.ts` (S1):
  POST ne sprejme klientovega "CONFIRMED" brez atestacije (providerBookingId +
  confirmedPrice + source:"USER" — izvirna import pot); PATCH prehode
  validira; poskus source:"PROVIDER" brez JOURNEY_PROVIDER_TOKEN → 503
  fail-closed.
- `trip-reservations.tsx`: modal "Potrdi rezervacijo" (št. rezervacije +
  cena — uporabniška atestacija, izrecno "uporabnikov vnos, ne provider");
  statusne oznake z razkritjem izvora.

## 51-d Testi + regresija
- Novi testi po modulih (weather, map-pins, road-routing, journey-booking) v
  house stilu (čisti lib testi, mock fetch kjer treba); regresija: 145 + novi
  vsi zeleni; `bun run lint` čist.
