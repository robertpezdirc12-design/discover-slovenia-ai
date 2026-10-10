# MINDTRIP PARITY SCORECARD — Discover Slovenia AI

> **Velja za:** 2.24.0 (skriptni svetovalec + skriptni NLU) · Sestavljeno: 2026-10-08, dopolnjeno 2026-10-10.
> Vir za Mindtrip: javni produkt, personalization/FAQ/creator gradivo (raziskava 7. 10. 2026).
> Vir za Discovery: repozitorij `main` (CI zeleni), testi, E2E dokazi v `docs/evidence/`.
>
> **Cilj NI 100 % kopija.** Cilj je: MINDTRIP PARITY na generični travel-agent UX
> + DISCOVERY SUPERIORITY na slovenskih/lokalnih podatkih, transparentnosti,
> determinističnem načrtovanju, provenance, offline in realnem izvajanju pote.
> Po lastnikovi odločitvi (P1, PONOVNO POTRJENA 2026-10-10): **100 %
> deterministično — 0 AI modelov** — vse zmožnosti so skripte/pravila,
> aplikacija deluje brez kakršnegakoli AI žetona. Od 2.24.0 je to izvedeno
> DO KONCA: tam, kjer ima Mindtrip LLM, imamo mi SKRIPTE — prosti opis
> potovanja razume deterministična NLU skripta (src/lib/advisor/nlu.ts),
> @AI svetovalec pa sestavlja odgovore iz kanonskih virov (register + STO
> slovenia.info + živo vreme Open-Meteo — podatkovni API, ne AI) z
> fail-quiet padcem na čisto jedro; z-ai-web-dev-sdk je ODSTRANJEN iz
> odvisnosti (0 AI klicev v celotnem repozitoriju).

## Zmogljivostna matrika

| # | Capability | Mindtrip (javno) | Discovery — trenutno | Discovery — cilj | Dokaz (Evidence) |
|---|---|---|---|---|---|
| 1 | **Personalization** (osebni profil preferenc) | ✅ nastavitve personalization | ✅ PARITY — 9 preferenc s source/provenance (USER_STATED), validacija proti kanonskemu besednjaku, upravljanje na /moj-profil | ✅ doseženo | `src/lib/user-preferences.ts`, `/api/preferences` (GET/PUT/DELETE), `docs/evidence/p1-a/`, testi `user-preferences.test.ts` (41) |
| 2 | **Long-term memory** | ✅ spomin o uporabniku | ✅ PARITY — „Kaj si zapomnim o tebi": CRUD + pozabi-vse + retention 90 dni + confidence + opt-out fail-closed (izklop = spomin se sploh ne bere) | ✅ doseženo | `MemoryItem` model, `/api/memory*`, `docs/evidence/p1-a/`, testi `p1a-security-contract.test.ts` |
| 3 | **Conversational planning** (pogovorno načrtovanje) | ✅ klepet gradi pot | ✅ PARITY — SL ukazni razčlenjevalnik (dodaj/odstrani/premakni/zamenjaj/skrajšaj/podaljšaj/optimiziraj, toleranca sklonov) nad KANONSKIM planom z diff + undo; brezstanjska ruta (plan ostaja resnica); od 2.24.0 tudi PROSTI OPIS („3 dni v gorah z družino") → skriptni NLU → isti motor (0 AI) | ✅ doseženo | `plan-edit-engine.ts`, `/api/plan-edit`, `src/lib/advisor/nlu.ts` + `/api/plan-intent`, plošča na /nacrtuj, `docs/evidence/p1-b/`, testi (razčlenjevalnik + mutacije + diff + NLU) |
| 4 | **Reasoning / decision support** (razlogi) | ✅ „zakaj ta predlog" | ✅ PARITY + SUPERIOR — strukturirani razlogi IZKLJUČNO iz kanonskih podatkov (razdalja/cena/proračun/sezona/interesi/ocena); delovni čas iskreno izpuščen (v registru ne obstaja) | ✅ doseženo | `recommendation-reasons.ts` (ISTI slovar interesov kot engine), @AI „zakaj:" vrstice, testi |
| 5 | **Proactive assistant** (naslednji korak) | ✅ proaktivni predlogi | ✅ PARITY — NextStep (7 pravil, localStorage kontekst) + osebna plošča domov (nadaljuj pot, obvestila, naloge) | ✅ doseženo | `next-step.ts`, `personal-home-section.tsx`, `docs/evidence/p1-d/` |
| 6 | **Watch / alerts** (spremljanje + opozorila) | ✅ spremljanje stvari | ✅ PARITY — 4 vrste (cena/vreme/dnevi/rezervacije) z lastništvom, pogoji, pavzo, zadnjim opažanjem; zavrnjene vrste (razpoložljivost/leti) odklonjene z razlogom | ✅ doseženo | `WatchItem` model, `watch-engine.ts`, `/api/watch*`, `docs/evidence/p1-c/`, testi `watch-engine.test.ts` (44) |
| 7 | **Price monitoring** (spremljanje cen) | ✅ price-drop alerti | ✅ PARITY — padec SAMO iz dveh preverljivih cen (prvi zagon = izhodišče brez opozorila); E2E: „s 25,00 € na 20,00 € (−20 %) — obe ceni preverjeni iz tržnice" | ✅ doseženo | `evaluatePriceWatch`, cron `watch-check`, `docs/evidence/p1-c/` (run 1–3) |
| 8 | **Booking** (rezervacije) | ✅ realne rezervacije (določene kategorije) | ✅ PARITY po resnici — kanonski model 14 statusov z atestacijo (CONFIRMED SAMO z dokazom ponudnika); demo jasno DEMO; partner prenos jasno EXTERNAL; real kanal fail-closed 503 brez konfiguracije; uvoz rezervacij z izvorom IMPORTED | ✅ doseženo (real kanal čaka partnerje — iskreno) | `journey/booking.ts` + `booking-provider.ts`, `/api/journey/bookings`, testi `journey-booking.test.ts` (53) + `partner-booking.test.ts` (56) |
| 9 | **Itinerary** (dnevni načrt) | ✅ večdnevni načrti | ✅ PARITY + SUPERIOR — deterministični engine (isti vhod → isti načrt), geo validacija (urnik overlap/gap), 38 kanonskih destinacij, OSRM route s hevrističnim fallbackom, Go Mode izvedba | ✅ doseženo | `itinerary-engine.ts`, `deterministic-itinerary.ts`, `/api/itinerary`, `road-routing-server.ts`, testi `itinerary-engine.test.ts` |
| 10 | **Maps** (zemljevid) | ✅ zemljevid s pin-i | ✅ PARITY + SUPERIOR — OSM plast s pins-in-bbox, FSQ/OSM POI prek viewporta, geo: URI sistemski izbirnik, geofence prihoda (~250 m) v Go Mode | ✅ doseženo | `map-pins.ts`, `/api/pois`, `go-gps.ts`, testi `map-pins.test.ts` + `osm-overpass.test.ts` |
| 11 | **Collaboration** (sodelovanje) | ✅ skupne pote | ✅ PARITY — vloge OWNER/EDITOR/VIEWER strežniško, vabila z žetoni, ankete, skupinski klepet z @AI (0 AI žetonov), zasebne pote 404 (obstoj se ne razkrije) | ✅ doseženo | `trip-auth.ts` (fail-closed), `TripCollaborator/Invite/Poll/Vote/Message`, testi `trip-security-contract.test.ts` |
| 12 | **Guides / creators** (vodiči ustvarjalcev) | ✅ creator program | ⚠️ DELNO — uredniški vodiči (`/vodici`) obstajajo; creator plast (objava, sledenje, monetizacija, uvoz PDF/linka) NI implementirana — iskreno odprto (ocena vrednosti za slovenski trg pred implementacijo, sprejemni kriterij issue #3) | 🔜 po lastnikovi odločitvi | `content-data.ts`, matrika §12 (issue #3) |
| 13 | **Affiliate / provizije** | ✅ monetizacija | ✅ PARITY + SUPERIOR — register 19 ponudnikov z matriko aktivacij, žetoni IZKLJUČNO iz lastnikove konfiguracije (brez javno dokumentiranega vzorca se povezave NE gradijo — iskrenost), provizije iz poročil (nikoli samodejno „potrjeno"), dnevnik izplačil | ✅ doseženo | `affiliate-providers.ts`, `AffiliateClick/CommissionEntry`, testi `affiliate-registry-p0f.test.ts` |
| 14 | **Offline / PWA** | ✅ PWA | ✅ PARITY — service worker (asset/tile/page/api strategije), offline lupina (domov, Na poti, offline.html), namestljiva; iskreno: push NI implementiran (in-app obvestila so) | ✅ doseženo | `public/sw.js` (verzijski kanarček v CI), testi `pwa-sw.test.ts`, `docs/evidence/issue1*` |
| 15 | **GPS / on-trip** (izvedba pote) | ✅ mobilna izvedba | ✅ SUPERIOR — Go Mode z živim GPS (watchPosition, zasebnostni kanon: zaokrožena lega samo ob eksplicitnem preračunu), geofence PRISPEL, offline, dnevni segmenti Jutro/Popoldan/Večer, vreme na postanku | ✅ doseženo | `use-geolocation.ts`, `go-gps.ts`, `go-data.ts`, `/na-poti`, testi `go-gps.test.ts` + `go-data.test.ts` |
| 16 | **Local / official source provenance** (sledljivost virov) | ✅ (neprimerljivo — globalni) | ✅ SUPERIOR — 38 kuriranih SI destinacij z coords/cenami/sezonami, STO llms.txt ingest (752 vnosov, 7 jezikov), FSQ/KiwiTaxi/OSM/ARSO-style viri z `vir-podatkov` stranjo, Open-Meteo z iskrenim horizontom, affiliate register z viri | ✅ doseženo | `slovenia-data.ts` (provenance polja), `supply/*`, `/vir-podatkov`, testi `slovenia-data.test.ts` + `sto-content.test.ts` |
| 17 | **Notification center** | ✅ obvestila | ✅ PARITY — in-app center (source/severity/read/dedupe), zvonček z neprebranimi, idempotenten cron; iskreno: PWA push ne | ✅ doseženo | `Notification` model, `/api/notifications`, `/notifikacije`, `docs/evidence/p1-c/`, testi `p1c-security-contract.test.ts` (25) |
| 18 | **Personalized home** (osebna domov) | ✅ nadzorna plošča | ✅ PARITY — po prijavi: nadaljuj pot, obvestila, spremljanja, vreme naslednje pote (iskreni stanji), osebne ideje z razlogi, v bližini (GPS samo klient), odprte naloge; gost = javni Discover | ✅ doseženo | `personal-home-section.tsx`, `/api/trips` (datumi + prvi postanek), `docs/evidence/p1-d/` |
| 19 | **Zasebnost / IDOR izolacija** | ✅ (trditve) | ✅ SUPERIOR — dokazljiva: A ne vidi B (memory/watch/notification 404), sodelavec vidi samo trip-scope, personalizacija OFF = fail-closed brez brisanja, revizijska sled vseh osebnih dejanj (append-only AuditLog) | ✅ doseženo | testi `p1a/p1c-security-contract.test.ts`, `trip-security-contract.test.ts`, E2E IDOR dokazi |
| 20 | **Deterministično jedro (0-AI)** | ✗ AI-odvisno | ✅ SUPERIOR — CELOVITO jedro deluje z 0 AI žetoni (1186+ testov istih vhodov → istih izhodov); po lastnikovi odločitvi tudi izboljšave ostajajo skripte/pravila | ✅ doseženo (stalni kanon) | vsa `*-engine.ts`, `bun test` v CI (6 vrat zelenih) |

## Iskrene vrzeli (kaj Discovery NIMA in tega ne skriva)

1. **PWA push** — ni web-push infrastrukture; obvestila so in-app (zvonček + center). Odkrito zapisano v UI, runbooku `docs/OPERATIONS.md` in testih.
2. **Real booking kanal** — brez preverjenega partner API-ja kanal `real` odpove 503 (fail-closed); nikoli lažen „confirmed". Demo/partner kanala sta jasno označena.
3. **Creator/guide plast (§8 issue #3)** — uredniški vodiči obstajajo; objavljanje ustvarjalcev/monetizacija ne (čaka lastnikovo oceno vrednosti).
4. **Vremenski vir v peskovniku** — zunanje omrežje je blokirano, zato E2E kaže iskreno stanje „vir nedosegljiv"; enak vir v produkciji deluje (`/api/weather` proxy).

## Sklep

Na generični travel-agent UX (vrste 1–11, 17–19) je **MINDTRIP PARITY dosežena z dokazi**;
na slovenskih/lokalnih podatkih, transparentnosti virov, determinističnem jedru, offline
izvedbi in Go Mode je **Discovery superior** (vrste 9, 10, 13–16, 19, 20).
Odprta ostaja samo creator/guide plast (vrsta 12) — zavestno odložena na lastnika.
