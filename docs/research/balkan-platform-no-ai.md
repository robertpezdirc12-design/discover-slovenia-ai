# Balkan Travel Platform brez AI — raziskava in izvedljiv načrt

**Issue:** #35 · **Status:** dokument oddan (07f1f9e, v2.50.0) + **posodobljen na stanje v2.65.2 (refresh 2026-10-14: faza 2 PoC + self-host runbook z viri)**
**Metoda:** vsi podatki o licencah/dostopu preverjeni na primarnih virih (uradni repo/LICENSE, uradna dokumentacija) na dan **13. 10. 2026**; repo-pregled posodobljen na glavo main `9230f20` (v2.60.0) dne **14. 10. 2026**; kjer podatek ni potrjen, je izrecno označen **[nepotrjeno]**.
**Kategorije:** [OSS] odprtokodna programska oprema · [BJS] brezplačna javna storitev · [OJP] odprti javni podatki · [PPA] partnerski API z odobritvijo · [OBJ] lastna (objektna) vsebina/koda

**Posodobitev 14. 10. 2026 (v2.60.0):** vmes je zaključena balkanska ekspanzija **F0–F5 + follow-up** (issue #41; PR #42 `62dccd8` v2.54.0, PR #46 `185bf01` v2.57.0, PR #48 `cf23ec6` v2.58.0, PR #49 `0c4f7cc` v2.59.0, PR #50 `fd50d4e` + `e942254` v2.60.0). Tri od štirih prvotnih vrzeli so (delno ali v celoti) rešene — poglavji 1, 2, 5 in 9 sta osveženi; raziskava SDK-jev, podatkovnih virov, partner API-jev, stroškov in virov (pogl. 3, 4, 6, 7, 8, 10, 11, 12) ostaja veljavna v obliki iz 13. 10. 2026.

---

## 1. Povzetek za odločanje

**Sodba (osvežena 14. 10. 2026):** sedajšnji `discover-slovenia-ai` je po zaključku F0–F5 **~90 % arhitekture**, ki jo #35 opisuje: deterministični načrtovalnik obstaja (itinerary-engine + road-routing Valhalla odjemalec + detectBorderCrossings — 0 AI), **večdržavni podatkovni sloj je ŽIV** (74 destinacij × 10 držav, /drzava/[code] × 10, sitemap 738 × 6 jezikov, NLU kanon 74, affiliate aktivacija × 10 držav), Leaflet zemljevid deluje, i18n pokriva 6 jezikov, monetizacija (Stripe, affiliate, listingi, partner portal) je v kodi, testno jeklo je 2338 enotnih (26 134 expect) + 16 E2E na produkciji. Manjka še **pet reči**:

1. **Ploščice** — še vedno `tile.openstreetmap.org` (BJS), kar OSMF politika izrecno prepoveduje za komercialno produkcijo → zamenjava z **OpenFreeMap** [BJS/OSS] (0 EUR, brez registracije, self-host pot enaka kode). Sprememba: 1 URL + CSP vrstica.
2. **Routing self-host** — `road-routing-server.ts` (in `/api/plan/directions`) je od 2.65.0 (faza 2 PoC) preklopljen na **javni Valhalla primerek FOSSGIS** `valhalla1.openstreetmap.de` [BJS; OpenStreetMap graf, ODbL; motor MIT] — iskrenostni kanon ohranjen (cache 24 h/600, circuit breaker, hevristični fallback izrecno označen, `source valhalla|heuristic`). Za produkcijo ob rasti je potreben **Valhalla self-host** [OSS, MIT] nad Geofabrik izvozi — self-host = `VALHALLA_BASE_URL` override, KODA ISTA; javni primerek ostaja operativna odvisnost (tveganje R11).
3. **Katalog ponudnikov s prijavo/preverjanjem** — affiliate/globalna aktivacija × 10 držav je živa (F4), Listing + moderacija obstajajo; manjka `Provider` model iz pogl. 6 (prijava, identiteta, dedup, report, 12-mesečni potek preverjanja).
4. **Geokodiranje/autocomplete** — Photon [OSS, Apache-2.0] (faza 3); danes so koordinate ročno kurirane v registrih.
5. **Partnerski API sloj** — vse [nepotrjeno] brez odobritve (pogl. 7); zakonita pot danes: označene globoke povezave prek `/api/affiliate/go` (302) + `bookingMode: "request"`.

**Strošek faze 1 (tehnično začetno):** 0 EUR licence, 0 novih plačljivih storitev; strošek VPS za Valhalla je **[nepotrjen]** (ocena 5–20 EUR/mes za 2–4 vCPU, zahteva ponudbo). **AI: 0 komponent** — vsa logika je filtriranje, uteži, geometrija in pravila.

**Ključno tveganje:** ODbL share-alike za izpeljane baze (mitigirano z ATTRIBUTIONS.md režimom), eno-vzdrževalčeva odvisnost OpenFreeMap (mitigirano: self-host pot enaka kode) in R11 — odvisnost od javnega usmerjevalnika (v 2.65.0 prenešen z OSRM demo na javni Valhalla FOSSGIS; mitigirano: iskrenostni kanon + breaker + `VALHALLA_BASE_URL` self-host override).

---

## 2. Pregled sedanjega repozitorija (posodobljeno na main `9230f20`, v2.60.0, 2026-10-14)

### 2a. Kaj obstaja in deluje (NE prepisovati)

| področje | implementacija | dokaz |
|---|---|---|
| Deterministični načrtovalnik | `itinerary-engine.ts` + `deterministic-itinerary.ts` + `day-segments.ts` + `next-step.ts` + `plan-edit-engine.ts` + `start-anywhere` (deterministično NLU, kanon 74 igel) | enotni testi zaklepajo vedenje; 0 AI |
| Routing (NOVO odkritje tega refresha) | `road-routing-server.ts`: strežniški OSRM odjemalec proti `router.project-osrm.org` (profil driving) — cache 24 h/600, circuit breaker 4 → 10 min, geometrija > 400 točk se redči, hevristični fallback (haversine × 1,3 @ 55 km/h) IZRECNO označen `source: "heuristic"` (nikoli „osrm“) | modul z injiciranim fetch/uro/timeout; testi brez pravega omrežja |
| **Večdržavni sloj (NOVO — F0–F5, #41)** | `CountryCode` × 10 (SI/HR/ME/AL/BA/RS/MK/XK/BG/GR) + `COUNTRIES` meta (6-jezična imena, valuta, klicna, 112, eSIM regija, zastava); **74 destinacij · 44 regij · 10 tipov** (slovenia-data 38: SI 22 · HR 8 · ME 4 · AL 4 + balkan-data 36: BA 6 · RS 6 · MK 6 · XK 6 · BG 6 · GR 6); `CommunityEvent.country` (+8 balkanskih dogodkov: BA 2 · RS 2 · BG 1 · GR 1 · MK 1 · XK 1); URL semantika `?country=`; državni chips | `slovenia-data.ts`, `balkan-data.ts`, `countries-data.ts`, `content-data.ts` |
| Čezmejna potovanja (NOVO — F5) | `TripStop.country` + `detectBorderCrossings` (deterministično izpeljani prehodi `{from, to, day}`) + čezmejna opomba v povzetku + državni filter »Cel Balkan« | `itinerary-engine.ts` (zadetki 827/897/1049), `types.ts` |
| SEO balkan (NOVO — F3) | sitemap.xml **738 `<url>` × 6 jezikov** (spot-check produkcije 14. 10.: 738 URL, 5166 hreflang); landing strani `/drzava/[code]` × 10; hreflang + JSON-LD `countryTouristDestination` | `sitemap-data.ts`, `countries-seo.ts`, `hreflang.ts` |
| Zemljevid | Leaflet 1.9.4 + react-leaflet, rasterske ploščice `tile.openstreetmap.org`, CSP pining (`csp.ts`), `map-pins`, `geo-bbox` | `travel-map.tsx`; E2E vključno z zemljevidom |
| Monetizacija | Stripe (checkout/marketplace/products), affiliate register (12 moniziranih + gorivo; klik → komisija), **COUNTRY_URL_NAMES × 10 držav (F4)** — 302 `/api/affiliate/go` gradi državne povezave (airalo, discovercars) za 74 destinacij; vzorci curl 200 preverjeni 14. 10. | 27 Prisma modelov, `affiliate-providers.ts`, `supply/production-matrix.ts` |
| Ponudniki | `Listing` + `listing-moderation`, partner portal (`partner-session`), strani `/za-ponudniki`, `/owner` | API: listings/partner/admin |
| Skupinska potovanja | `TravelJourney` + sodelovalci + vabili + rezervacije + ankete + sporočila | API: journey/trips/invites |
| Podatkovna provenance | FSQ (Apache-2.0, z atribucijo), OSM/Overpass (ODbL, 3 zrcala + rotacija), STO llms.txt, kurirane črpalke — sloj → vir → licenca | `docs/DATA-PROVENANCE.md` (v2.8.0) |
| i18n | 6 jezikov (sl privzet; en/it/de/fr/es s predponami), `i18n-pick`, `hreflang`, `intl-locale`; meta/manifest copy 74 × „cel Balkan“ (e942254) | `messages/*.json`, `public/manifest.json` |
| Kakovost | **2245 enotnih testov (25 859 expect)** · tsc 0 · eslint 0 · build OK · **E2E 16/16 na produkciji (2,9 min)** · PWA sw.js 2.60.0 | health endpoint v2.60.0: status ok, 10/11 startup (ops:cron skip = pričakovano) |

### 2b. Kaj obstaja, a je nepopolno

- **Routing**: OSRM odjemalec je živ (distanca/čas/geometrija), a brez profilov peš/kolo, brez TSP 2-opt na matriki in z odvisnostjo od JAVNEGA demo strežnika (R11).
- **Geokodiranje**: koordinate v registrih so ročno kurirane; uporabniški autocomplete naslovov ne obstaja.
- **Listingi**: model + moderacija so; brez držav/regij, sezonskosti po #35, preverjanja ponudnika (verified/lastVerifiedAt) in kategorij iz pogl. 6.
- **Jeziki**: 6 jezikov pokriva UI lupino; balkanski jeziki (hr/bos/sr/me/sq) so ARHITEKTURNO pripravljeni (PickLocale tip + predpona), a vsebinsko (registri) samo dvojezični (sl/en) + 6-jezična državna meta.
- **Dogodki**: balkanski dogodki (7; EXIT Novi Sad odstranjen 15.10.2026 — festival ukinjen po izdaji 2025: Wikipedia „Years active 2000–2025“ + organizatorjev „global tour“) so v kanonu z `eventCountry`; termini 2027 potrjeni pri primarnih virih: SIFF Sofija 11.–21.3., Vinska vigred Metlika 21.–23.5., Jurjevanje 21.–25.6., Tolminator 28.7.–1.8.; ostali ostanejo iskreno nepotrjeni (`dateUnconfirmed`) — kanon „nikoli ne ugibaj“ velja za vse države.

### 2c. Kaj manjka (za cilj #35) — re-evaluirano 14. 10. 2026

- ~~Ploščični ponudnik za produkcijo~~ → ŠE VEDNO ODPRTI (R1; faza 1).
- ~~Večdržavni podatkovni model~~ → ✅ **REŠENO z F0–F5** (#41, v2.54.0–v2.60.0): država/regija/kraj so prvotne dimenzije; 74 destinacij × 10 držav; /drzava landingi; sitemap; NLU 74; affiliate × 10.
- ~~BA/ME/AL (+ RS/MK/XK/BG/GR) POI kuracija~~ → ✅ **REŠENO z F1** (kanon 74 destinacij s provenance kanonom #38; 6 držav × 6 destinacij).
- Routing engine z profili + optimizacija vrstnega reda postankov → ◐ **PoC ODDAN (2.65.0, faza 2)**: `road-routing-server.ts` in `/api/plan/directions` zdaj govorita **Valhalla** (javni FOSSGIS primerek `valhalla1.openstreetmap.de` — BJS; native trip format, shape polyline6, `units=kilometers`) po ISTEM iskrenostnem kanonu (cache 24 h/600 + breaker 4→10 min + `source valhalla|heuristic`); self-host = `VALHALLA_BASE_URL` override, koda ISTA; 2-opt optimizer še ODPRT (šele ob potrebah obsega).
- Photon geokodiranje/autocomplete → ◐ **PoC ODDAN (2.64.0, faza 3)**: javni Photon BJS prek strežniškega `/api/geocode` (iskrenostni kanon: cache 24 h/600 + breaker 4→10 min + rate 30/min + `source photon|none`); vstavljen v prijavnico ponudnika (`/za-ponudnike`) — ROČNI VNOS ostaja; self-host = `PHOTON_BASE_URL` override, koda ista.
- Katalog ponudnikov: Provider model s prijavo/verifikacijo/dedup/report → **ZAKLJUČEN (4a 2.61.0 + 4b 2.62.0)**; kuracija onkraj kanona 74 ostaja človeško delo.
- Partnerski API sloj → ŠE VEDNO [nepotrjeno] (pogl. 7).

### 2d. Podvajanje, ki se ga izogibamo

- NE uvajati MapLibre, dokler ni vektorski/PMTiles use-case → use-case ZDAJ OBSTAJA (OFM javni primerek je vektorski, verifikacija 14. 10.) — PoC izveden v 2.63.0 (`?zemljevid=vektorji`); polna menjava ostaja lastniška odločitev.
- NE uvajati OR-Tools/Vroom za 3–15 postankov (lastni greedy+2-opt zadošča; Vroom šele pri časovnih oknih/več vozilih).
- NE graditi novega CMS-ja za ponudnike (Listing + moderacija + owner stran so osnova).
- NE uvajati OTP (0/5 nacionalnih GTFS feedov — glej pogl. 5).
- NE prepisovati `road-routing-server.ts` za Valhalla — obstoječ iskrenostni kanon (realna pot vsa izrecno označena hevristika) se ohrani; zamenjava BASE URL + formata odgovora je dovolj → **IZVEDENO v 2.65.0 (faza 2 PoC)**: kanon ena-ob-ena (cache/breaker/hevristika/redčenje geometrije), zamenjan je SAMO request/response sloj; `source: "valhalla" | "heuristic"`.

---

## 3. Primerjalna matrika SDK-jev

*(nespremenjena iz 13. 10. 2026 — vsi podatki o licencah/verzijah preverjeni na primarnih virih tistega dne)*

| komponenta | kategorija | licenca (vir, datum) | verzija | sodba | ključni razlog |
|---|---|---|---|---|---|
| **Leaflet** (obstoječ) | OSS | BSD-2 (repo LICENSE) | 1.9.4 | **IZBRATI — ostane** | 42 KB, 0 odvisnosti; 2D rastri pokrijejo vse faze 1–3 |
| MapLibre GL JS | OSS | BSD-3 (LICENSE.txt, preverjeno 13.10.2026) | 6.14.0 | **PoC IZVEDEN (2.63.0)** | merjeno: chunk 1,1 MB / **277 kB gzip** (≈6,6× Leaflet), se naloži ŠELE ob `?zemljevid=vektorji` (pogojni dynamic ssr:false → 0 vpliva na privzeto pot); worker blob: že pokrit v CSP; brez default exporta v v6 (named imports); worker URL prek uradnega `config.WORKER_URL` → datoteka v `/maplibre/` (fix 2.63.1 — bundlerjev import.meta.url ne zadošča, odkrito z brskalniško verifikacijo produkcije) |
| **OpenFreeMap** (ploščice) | BJS+OSS | ODbL podatki; javni primerek brez ključev | — | **RE-DEIZIJA (verifikacija 14.10.2026)** | javni primerek je VEKTORSKI (TileJSON `/planet` → datirani `.pbf` zapis, 16 vektorskih plasti) + raster SAMO Natural Earth relief — uličnih rasterskih ploščic za Leaflet NIMA → "sprememba 1 URL" NI izvedljiva; poti: (a) MapLibre + OFM slog (premaknjena iz faze 6 — NOVO dejstvo upravičuje), (b) self-host raster (faza 2 infra), (c) status quo OSMF pri lahkotni uporabi; "completely free, no limits" ostaja potrjeno (stran + TileJSON atribucija); **PoC pot (a) IZVEDEN 2.63.0** — MapLibre + Liberty deluje, VSE pridobitve (slog/vektor/glyphs/sprite/NE) iz ENEGA hosta (curl 14. 10.), CSP connect-src+img-src, ATTRIBUTIONS.md stoji |
| tile.openstreetmap.org | BJS | ODbL | — | **ZAVRNITI** za produkcijo | OSMF politika: umik komercialnim storitvam |
| Geofabrik izvozi/self-host | OJP+OSS | ODbL | dnevni izvozi | PREIZKUSITI | zakonita pot pri rasti |
| **Valhalla** (routing) | OSS | **MIT** (COPYING, preverjeno 13.10.2026) | 3.9.1 | **IZBRANO — primarni (2.65.0 faza 2 PoC: javni FOSSGIS primerek + `VALHALLA_BASE_URL` override)** | auto/peš/kolo + multimodalno, vgrajen costmatrix/TSP, nizek pomnilniški odtis |
| OSRM | OSS | BSD-2 | 26.10.0 | ZAVRNITI kot primarni | statični profili ob predobdelavi; meritvena referenca — javni demo je bil VMESNA rešitev do 2.64.0 (v fazi 2 PoC 2.65.0 ukinjen iz kode — glej R11) |
| GraphHopper OSS | OSS | Apache-2.0 | 11.1 | ZAVRNITI | Java ops brez funkcionalne prednosti |
| OR-Tools | OSS | Apache-2.0 | 9.15 | ZAVRNITI | overkill za VRP 3–15 postankov |
| Vroom | OSS | BSD-2 | 1.15.0 | PREIZKUSITI (faza 3) | šele časovna okna/več vozil; naravna zveza z Valhalla |
| lastna optimizacija (greedy + 2-opt) | OBJ | — | — | **IZBRATI ZDAJ** | 0 odvisnosti, <50 vrstic na Valhalla matriki |
| OpenTripPlanner 2 | OSS | LGPL-3 | 2.10.0 | ZAVRNITI za začetek | **0/5 nacionalnih GTFS** (glej pogl. 5) |
| Nominatim (javni) | BJS/OSS | GPL | 5.3.2 | PREIZKUSITI (demo) | 1 req/s, brez autocomplete; samo uporabniško sproženo |
| **Photon** (geokodiranje) | BJS/OSS | **Apache-2.0** (LICENSE, preverjeno 13.10.2026) | 1.3.0 | **IZBRATI za produkcijo** | autocomplete, toleranca napak, večjezično; trivialen self-host |

**Licenca knjižnice ≠ licenca podatkov:** Leaflet/MapLibre/Valhalla licence urejajo KODO; vsi OSM-izpeljani podatki (ploščice, grafi, geokodiranje, POI baza) so ODbL — glej pogl. 4 in R1/R2.

---

## 4. Podatkovni viri: licence in pogoji

*(nespremenjeno iz 13. 10. 2026; stanje provenance plasti v kodi je dokumentirano v `docs/DATA-PROVENANCE.md` v2.8.0 — FSQ loader, Overpass adapter s 3 zrcali, STO llms.txt, kurirane črpalke)*

| vir | kategorija | licenca/pogoj | uporaba v platformi | tveganje |
|---|---|---|---|---|
| OpenStreetMap (prek OpenFreeMap) | OJP | ODbL 1.0 — atribucija „© OpenStreetMap contributors“ vidna; share-alike za izpeljane baze | ploščice, geokodiranje, routing grafi | share-alike (R2) |
| Geofabrik izvozi | OJP | ODbL; izviri brezplačni, self-host dovoljen | Valhalla grafi 10 držav (izvozi za vse obstajajo) | svežina (dnevno) |
| Uradni nacionalni turizmi (STB, HTZ, …) | OJP/PPA | različno — **[nepotrjeno] po posameznem viru** | kurirani POI/dogodki | pogoji posamezne organizacije |
| lastna kuracija (registri app) | OBJ | © platforma | opisi, dogodki, cene | NISPODAJO pod ODbL |
| fotografije ponudnikov | PPA/OBJ | po pogodbi pri prijavi ponudnika | profili | NE kopirati s spleta brez licence |
| Booking/Viator/GYG/Expedia | PPA | pogodbeni — glej pogl. 7 | šele po odobritvi | brez odobritve NE uporabljati |

**Obveznost od pričetka faze 1:** voditi `ATTRIBUTIONS.md` — sloj → vir → licenca → datum. Share-alike ocena na nivoju vsake izpeljane baze (glej R2).

**Posodobitev 17.10.2026 (FSQ OS Places — vir za zaprtje vrata „data"):** izgubljena množica POI (125.446, snapshot 2025-02-06) je **natanko reproducibilna** — uradni HuggingFace dataset `foursquare/fsq-os-places` vsebuje vse mesečne izdaje (baseline = izdaja `dt=2025-02-06`), zadnja `dt=2026-10-15` (2 dni sveža, 100 parquet shardov ≈ 11,58 GB). Licenca Apache-2.0 z atribucijo POTRJENA (README + NOTICE.txt). Dostop: brezplačen HF račun + samodejno soglasje (gated auto) + read žeton — lahek lastniški korak (~5–10 min); stari javni S3 žeg in source.coop/fused.io so MRTVI (NoSuchBucket/404; preusmerjeni na Overture). Cevovod po žetonu: duckdb pushdown bbox SI·HR·ME·AL → surov .jsonl → obstoječ `bun run fsq:ingest` — **brez spremembe kode** (loader pobere `data/fsq-places/` samodejno). Odločitveni paket + surova sled: `docs/research/fsq-os-places-vir.md` · `docs/evidence/fsq-vir/raziskava.txt`.

---

## 5. Pokritost držav in vrzeli (osveženo 15. 10. 2026 — GTFS verifikacija + Valhalla meritve)

Številke so iz registrov v kodi (`slovenia-data.ts` + `balkan-data.ts`), preverjene na `9230f20`:

| država | destinacije v kanonu | routing (Geofabrik) | geokodiranje (OSM/Photon) | javni prevoz (GTFS) | vrzel |
|---|---|---|---|---|---|
| Slovenija | 22 | ✓ dnevni izvoz | ✓ | 6 v katalogu Mobility DB (LPP + 5 lokalnih); nacionalni CKAN 0 (13.10.2026) | nacionalni agregat |
| Hrvaška | 8 | ✓ | ✓ | 4 (ZET + **HŽPP nacionalne železnice** ×2 + Gradski parking) | — |
| Bosna in Hercegovina | 6 (Sarajevo, Mostar, …) | ✓ | ✓ | 1 (LivnoBus, lokalni) | POI sloj za ne-kanonska mesta |
| Črna gora | 4 (Kotor, Budva, Podgorica, Durmitor) | ✓ | ✓ | 2 (**ŽPCG nacionalne železnice** + Podgorica Putevi) | obalna sezonskost |
| Albanija | 4 (Tirana, Berat, Gjirokastër, Sarandë) | ✓ | ✓ | 3 (Tirana, Vlora, ShowMeBus) | cestna kvaliteta **izmerjena 15.10.2026: funkcionalna** (6/6 rut status 0, ±7–11 % od referenc, kontinuiteta ≤ baseline HR — vzorec 3 intercity + 3 reference) |
| Srbija | 6 (Beograd, Novi Sad, …) | ✓ | ✓ | 7 (**Srbijavoz nacionalne železnice** + Beograd prigradski + Lasta, Niš Ekspres, Niš Direkcija, Kragujevac) | — |
| Severna Makedonija | 6 (Ohrid, Skopje, …) | ✓ | ✓ | 2 (JSP Skopje + Makedonski železnici Transport) | — |
| Kosovo | 6 (Priština, Prizren, …) | ✓ | ✓ | **0 (potrjeno 15.10.2026)** | javni prevoz |
| Bolgarija | 6 (Sofija, Plovdiv, Rila, …) | ✓ | ✓ | 4 (Sofija ×2, Burgas, Pleven) | — |
| Grčija | 6 (Solun, Meteora, …) | ✓ | ✓ | 4 (OASA Atene ×3 + TrainOSE) | — |
| **SKUPAJ** | **74 · 44 regij · 10 tipov** | 10/10 izvozi | ✓ | **29 feedov / 10 držav (XK edina 0)** | vsebinska kuracija onkraj kanona |

**Zaključek (osvežen 15.10.2026):** prvotna „vrzel: celoten POI sloj“ za BA in „širitev SRB/MKD/KOS faza 3+“ sta **zaprta** (F1 kanon s provenance #38). Osnovni zemljevid/routing/geokodiranje pokrijejo vseh 10 držav iz istega ZDROJA (OSM). **NOVO dejstvo (15.10.2026, MobilityData katalog @ HEAD, 2488 GTFS schedule feedov — seznam prebran v celoti):** javni GTFS obstaja za 9/10 držav (29 feedov), tudi NACIONALNI železniški (Srbijavoz, HŽPP, ŽPCG, Makedonski železnici, TrainOSE) — premisa izključitve OTP („brez nacionalnega GTFS“) je za 6 držav padla; re-evaluacija OTP je odprto vprašanje za lastniško sodbo (zavrnjeno stanje ostaja, dokler lastnik ne presodi obsega). Kosovo edina brez vira. Preostale vrzeli: vsebinska kuracija onkraj kanonskih 74.

**Posodobitev 17.10.2026 (GTFS static PoC — meritev javno dostopnih SI feedov):** od 6 SI feedov v katalogu je **javno dostopen samo LPP** (`data.lpp.si/api/gtfs/feed.zip`, svež ~30-dnevni okno; zrcalo `mdb-latest` je za isti feed ZASTARELO jun–jul 2026); preostalih 5 (med njimi **DUJPP = nacionalni prevoznik JPP**) vrača **HTTP 401 — B2B registracija na NAP.si**; nacionalni CKAN re-check: še vedno 0 GTFS. Meritev cevovoda (skripta `scripts/gtfs-poc-meritve.ts`, dokazila `docs/evidence/gtfs-poc/`): LPP = 725 postaj / 1 545 193 odhodov; pokritost kanona **1/74 (samo Ljubljana)**; SQLite prototip: uvoz 1,55 M vrstic 6,5 s → baza 314,5 MB, odhodna poizvedba 1 ms. Nacionalna pokritost je zato vezana na NAP B2B registracijo (lastniški korak). Odločitveni paket (opcije A–D + priporočilo): **`docs/research/gtfs-javni-prevozi-poc.md`**. To ni uvedba OTP — zavrnjeno stanje OTP ostaja. *Posodobitev istega dne (pozno dop.):* LPP je vir preselil — `data.lpp.si` zdaj 302 → **`avl.lpp.si/transit/api/gtfs`** (neposredni prenos čist 42,5 MB; preusmerjena pot vrača odrezan zip); meritve istega dne **reproducirane 1:1** (paket §2/§3).

---

## 6. Podatkovni model ponudnika ter model lokacije/dogodka

### 6a. Provider (razširitev obstoječega `Listing` — NE nova tabela za vse)

*(nespremenjeno iz 13. 10. 2026 — model ostaja predlog za fazo 4)*

Novi Prisma modeli `Provider` (ali rozširitev Listing) z obveznimi polji #35:

```prisma
model Provider {
  id            String   @id @default(cuid())   // stabilni ID
  countryCode   String   // ISO-3166: SI HR BA ME AL (kasneje SR MK XK) — zdaj že × 10 kanona
  region        String   // kurirane regije (NUTS-3 ali turistične)
  place         String   // kraj/naselje
  lat           Float
  lng           Float
  category      String   // accommodation | food | guide | activity | transport | attraction | event | wellness
  subcategory   String?  // hotel | apartment | camp | konoba | winery | rafting | ...
  name          String
  description   String
  languages     String   // CSV: sl,en,hr,...
  photos        String   // JSON: [{url, license, source}]
  contact       String   // JSON: {phone,email}
  officialUrl   String?
  season        String?  // JSON: [{from,to}] sezonskost
  openingHours  String?  // JSON: OpeningHoursSpecification[]
  priceFrom     Float?
  currency      String?  // EUR, BAM, ALL, RSD, MKD, BGN — po državi (COUNTRIES meta)
  availability  String?  // manual | request | partnerApi
  bookingMode   String   // none | request | redirect | partner
  verification  String   // unverified | claimed | verified   (OSM POI = ZAVIHE unverified!)
  verifiedAt    DateTime?
  sourceId      String?  // povezava na izvor (OSM id, TO id, prijava)
  updatedAt     DateTime @updatedAt
  status        String   // draft | published | suspended
}
```

Pravila: `verified` SAMO po prijavi/identiteti ponudnika (glej 6c); OSM-izpeljani zapisi so VEČNO `unverified`, dokler ponudnik ne potrdi.

### 6b. Lokacija/dogodek — STANJE PO F0–F5

- ~~`Destination` dobi `countryCode` + `region`~~ → ✅ **REŠENO**: `country` je kanonsko polje (F0), regije × 44, balkanski kanon v `balkan-data.ts` s provenance kanonom #38.
- `CommunityEvent.country` → ✅ **REŠENO** (F0, default „SI“, 8 balkanskih dogodkov); kanon iskrenosti datuma (`dateUnconfirmed`, „nikoli ne ugibaj“) se OHRANJA kot standard za vse države.

### 6c. Postopek prijave in preverjanja ponudnika

*(nespremenjeno iz 13. 10. 2026 — ostaja načrt faze 4)*

1. prijava (existing `/za-ponudniki` tok → Listing/Provider) z dokazili (URL, lastništvo domene, KMRC/registrska številka **[nepotrjeno katero dokazilo za vsako državo]**);
2. identiteta: e-pošta domene ≥ ponudnikova domena ali telefonski klic;
3. moderacija: obstoječa `listing-moderation` + admin UI;
4. prijava napak: javni „report“ gumb na profilu (nov mal API);
5. podvajanja: dedup na normalizirano ime + geohash ±50 m;
6. potek preverjanja: `verifiedAt` stari > 12 mesecev → opozorilo → padec na `claimed`.

---

## 7. Partnerski API-ji: pogoji in status (vse še brez odobritve!)

*(nespremenjeno iz 13. 10. 2026; v kodi že je zakonita afiliatna plast — 302 `/api/affiliate/go` z javno preverjenimi vzorci URL-jev × 10 držav (F4) — to NI partner API in NI rezervacija, le označena preusmeritev)*

| API | vstop | funkcije brez odobritve | provizija | sandbox | pokritost držav kanona | status |
|---|---|---|---|---|---|---|
| Booking.com Demand | samo „Managed Affiliate Partner“ po pogodbi | nič | **[nepotrjeno]** | obstaja (po pogodbi) | **[nepotrjeno]** | **ZAVRNITI zdaj** |
| Viator Partner API | javna prijava | sandbox + Postman; preusmeritve | **[nepotrjeno]** | ✓ javen | aktivnosti v vseh 10 **[nepotrjena globina]** | PREIZKUSITI ob obsegu (faza 5) |
| GetYourGuide | najmanj pregleden | — | — | — | — | ZAVRNITI zdaj |
| Expedia Rapid | najzahtevnejši vstop | — | — | — | — | ZAVRNITI zdaj |

**Zakonita alternativa brez API-ja (ŽIVA v kodi):** označena neposredna povezava na ponudnika (`officialUrl`) + affiliate globoka povezava (`/api/affiliate/go` 302, 12 partnerjev, kanon „partner brez ID-ja preusmeri na javno iskanje in klik se zabeleži `affiliateActive:false`“), klic/e-pošta, povpraševanje (`bookingMode: "request"`). **Nikoli lažni rezervacijski gumb.** Scrape vsebin: ne, razen če pogoji izrecno dovoljujejo.

---

## 8. Predlagana arhitektura in tok podatkov (osveženo: OSRM vmesni sloj)

```
┌─ Next.js 16 (obstoječ) ──────────────────────────────────────────────┐
│  UI (i18n 6+ jezikov) · PWA · Leaflet/OFRM ploščice · CSP            │
│  deterministični načrtovalnik (itinerary-engine — obstoječi)          │
│    ↓ parametri: datumi, proračun, interesi, družina, čas na dan      │
│  0) NLU IGLE (start-anywhere/plan-import, kanon 74 — obstoječi)       │
│  1) FILTRIRANJE registrov + Provider katalog (pravila, uteži)         │
│  2) DOSEGLJIVOST: DANES OSRM demo (road-routing-server, iskrenostni   │
│     kanon) → FAZA 2: Valhalla costmatrix (HTTP self-host)             │
│  3) VRSTNI RED: greedy + 2-opt na matriki (lastna, <50 vrstic)        │
│  4) RAZPORED: dan-segmenti, odpiralni časi, sezona, proračun          │
│  5) OPOZORILA: nepotrjeni časi/cene, pretesen načrt, mejni prehodi    │
│     (detectBorderCrossings — obstoječi od F5)                         │
│  6–8) ročno urejanje → preracun → shrani (TravelJourney — obstoječi)  │
└──────────────────────────────────────────────────────────────────────┘
        ↓ self-host (VPS)                    ↓ samo uporabniško sproženo
   Valhalla (Geofabrik 10 držav)         Photon (ali javni Nominatim v demo)
   [+ faza 3: Vroom; MapLibre/PMTiles ob potrebi]
```

Pravilo: **vsako pravilo/utež pregledna + testirana** (obstoječi standard zaklepov); uteži NISO „objektivno najboljše“ — dokumentiran hevristični izbor, empirična ovrednotenje šele z uporabniškimi podatki. Iskrenostni kanon routingu se je v fazi 2 OHRANIL ena-ob-ena (2.65.0): `source: "valhalla" | "heuristic"`, hevristika nikoli prikazana kot realna pot.

---

## 9. Faze izvedbe in odvisnosti (osveženo 14. 10. 2026)

| faza | vsebina | stanje 14. 10. 2026 | strošek | tveganje-utor |
|---|---|---|---|---|
| **0 — dokument** | #35 raziskava oddana + osvežena na v2.60.0 | ✅ (07f1f9e + ta refresh) | 0 | — |
| **(F0–F5 #41)** | večdržavni sloj: 10 držav, 74 destinacij, /drzava, sitemap 738 × 6, affiliate × 10, čezmejni prehodi, NLU 74 | ✅ **MERGANO v produkcijo v2.54.0–v2.60.0** | 0 | — |
| **1 (re-deizija 14. 10.)** | ploščice: verifikacija je REFUTIRALA fazo, kot je bila napisana — OpenFreeMap javni primerek = vektorski (Leaflet ne more direktno); re-deizija: MapLibre PoC (iz faze 6 premaknjena naprej na podlagi NOVIH dejstev) ALI status quo OSMF pri lahkotni uporabi do faze 2 infra; ATTRIBUTIONS.md ostaja obveznost pred vsako menjavo | ◐ **PoC ODDAN (2.63.0)**: MapLibre 6.14.0 + OFM Liberty na `/zemljevid?zemljevid=vektorji` (74 markerjev, atribucija vidna, CSP en host, chunk 277 kB gzip se nalaga šele v PoC, privzeti Leaflet nespremenjen; ATTRIBUTIONS.md izpolnjen) — **odločitev ŠE VEDNO lastniška** (MapLibre vs status quo vs self-host) | 0 EUR (obe poti) | eno-vzdrževalec OFM (self-host ista koda); paket MapLibre +4–7× (merjeno ≈6,6×) |
| **2 (2–4 tedni)** | Valhalla: zamenjava javnega primerka s self-host nad Geofabrik izvozi za 10 držav; 2-opt optimizer + zaklepi | ◐ **PoC ODDAN (2.65.0)**: `road-routing-server.ts` + `/api/plan/directions` na JAVNEM FOSSGIS primerku `valhalla1.openstreetmap.de` (BJS; curl verifikacija 14. 10.: `trip.status 0`, `summary length/time`, shape polyline6 — dekoder 1e6 ena-ob-ena, noge staknjene brez mejnih dvojnikov); kanon OHRANJEN (cache 24 h/600, breaker 4→10 min, hevristika izrecno označena); UI oznake OSRM→Valhalla v 6 jezikih; ATTRIBUTIONS.md v istem PR-ju — **self-host = `VALHALLA_BASE_URL`, koda ISTA**; 2-opt ostaja šele ob potrebah | VPS **podprto 14. 10.: 16,40 EUR/mes** (Hetzner CX42 8 vCPU/16 GB, uradni vir jun. 2024; izvedba = runbook `docs/SELF-HOST-RUNBOOK.md`) | obremenitev VPS pri rasti; fair-use javnega primerka (cache+breaker+rate kanon) |
| **3 (1–2 tedna)** | Photon self-host (autocomplete); Nominatim javni ostane samo za demo; Vroom šele za časovna okna | ◐ **PoC ODDAN (2.64.0)**: strežniški `/api/geocode` (javni Photon BJS `photon.komoot.io`, `lang=en` — `sl` javni primerek NE podpira, HTTP 400, verificirano curl 14. 10.) + prijavnica `/za-ponudnike` dobi krajevno iskanje (zadetek izpolni kraj/regijo/državo/koordinati; filtrirano na 10 kanonskih držav; atribucija OSM vidna; ROČNI VNOS ostaja vedno) — self-host = `PHOTON_BASE_URL`, koda ISTA; Vroom ostaja šele za časovna okna | 0 | fair-use javnega primerka (cache+breaker+rate kanon) |
| **4 (1–3 tedni)** | Provider model (pogl. 6a) + prijava/verifikacija/dedup/report — **osnova Listing+moderacija že stojita; Destination.country je rešen (F0)**; kuracija onkraj kanona 74 | ✅ **4a+4b ZAKLJUČENA (2.61.0/2.62.0)**: Prisma `Provider`+`ProviderReport`, čista logika (normalizacija imena, geohash, dedupKey, 12-mesečni potek preverjanja, valuta iz COUNTRIES meta — testno zaklenjeno), POST `/api/providers/report` + javna prijava `/api/providers/apply` (dedup 409, claimed+draft — NIKOLI samodejna objava) + admin `/api/admin/providers` (publish/unpublish/suspend/verify, AuditLog, fail-closed) + prijavnica `/za-ponudnike` + admin zavihek Ponudniki; kuracija onkraj kanona 74 ostaja človeško delo | 0 (človeški čas kuracije je glavni strošek) | svežina podatkov |
| **5 (šele ob obsegu)** | Viator sandbox pilot; meritve prikazi/kliki/povpraševanja (diagnostika brez osebnih podatkov); PLUS paket ponudnikov | ⬜ ODPRTA | 0 do odobritve | pogodbeni pogoji |
| **6 (opcija)** | MapLibre + PMTiles (offline/regionalni vektorji) | ⬜ opcija | 0 | paket +4–7× |

**Zavrnjeno z utemeljitvijo** (ne vračati se k temu brez novih dejstev): OR-Tools, GraphHopper, OSRM kot PRIMARNI self-host (javni demo pa dovoljen kot vmesni BJS), OTP (premisa „dokler ni nacionalnega GTFS“ je 15.10.2026 padla za 6 držav — glej §5; re-evaluacija počaka na lastniško sodbo obsega), OSMF javne ploščice v produkciji, MapTiler/Stadia free stopnji (izrecno ne-komercialne), Booking/GYG/Expedia pred odobritvijo.

---

## 10. Stroški gostovanja: osnovni scenarij in scenarij rasti

*(nespremenjeno iz 13. 10. 2026)*

**ZNANI stroški (0 EUR):** vse licence OSS (Leaflet BSD-2, Valhalla MIT, Photon Apache-2.0, MapLibre BSD-3, Vroom BSD-2); OpenFreeMap javni primerek; Geofabrik izvozi; Next.js/Bun/Prisma/Leaflet.

**POSTAVKE, KI POTREBUJEJO PONUDBO (nepotrjene cene):**

| postavka | osnovni scenarij (do ~10k prikazov/mes) | scenarij rasti (>100k/mes) |
|---|---|---|
| VPS za Valhalla+Photon (2–4 vCPU, 8–16 GB) | runbook `docs/SELF-HOST-RUNBOOK.md` (14. 10.): **16,40 EUR/mes** (Hetzner CX42 8 vCPU/16 GB/160 GB, uradni vir jun. 2024) · deljeni vCPU od 5,99 EUR/mes · Geofabrik 10 držav ≈ 1,47 GB PBF izmerjeno — cene se spreminjajo, preveri pred naročilom | ločen graf na državo; 3–8 instanc; load balancer **[nepotrjeno]** |
| ploščice | OpenFreeMap javni primerek 0 EUR | self-host tileserver (istega kode) — VPS v isti ponudbi **[nepotrjeno]** |
| Next.js hosting | obstoječ (Hobby workaround v produkcijskem cronu) | standardni VPS/PaaS **[nepotrjeno]** |
| Postgres (prek db:pg migracij) | obstoječ | upravljani PG **[nepotrjeno]** |
| partner API-ji | 0 (brez odobritve) | pogodbeno, po obsegu **[nepotrjeno]** |

Merila za sprožitev rasti: presežek OSMF/OpenFreeMap poštene uporabe, p95 routing > 300 ms, povpraševanje ponudnikov > ročna zmogljivost, hit-limit na javnem OSRM demo strežniku (R11).

---

## 11. Register tveganj (dodano R11)

| # | tveganje | vrsta | mitigacija |
|---|---|---|---|
| R1 | OSMF politika javnih ploščic prepoveduje komercialno produkcijo | licenčno-pravna | faza 1: OpenFreeMap (izrecno za ta use-case); fallback self-host |
| R2 | ODbL share-alike: izpeljane baze (kurirana POI baza z OSM koordinatami) lahko postanejo ODbL | licenčno-pravna | ločevanje slojev (OBJ vsebina ≠ OJP koordinate); ATTRIBUTIONS.md; pravni pregled pred fazo 4 |
| R3 | OpenFreeMap = 1 vzdrževalec | zanesljivost | self-host pot ista koda; monitoring; zakasnitev 2 tedna za switch |
| R4 | GTFS 0/5 → brez javnega prevoza | podatkovna | Valhalla avto/peš/kolo; GTFS monitoring (mobilitydatabase.org); OTP šele ob feedih |
| R5 | zastareli podatki (cene, odpiralni časi) | podatkovna | kanon iskrenosti (unconfirmed/verifiedAt — obstoječi standard dogodkov) razširjen na Providerje; 12-mesečni potek |
| R6 | osebni podatki (prijava ponudnikov, pošiljatelji sporočil, leads) | GDPR | obstoječi standardi (fail-closed cron, audit log); DPA z VPS ponudnikom |
| R7 | partner API pogoji se spreminjajo | poslovna | vse [nepotrjeno] do pisne odobritve; prikaz brez odobritve = NE |
| R8 | obremenitev javnih servisov (Nominatim 1 req/s) | operativna | cache + rate limit + Photon (2.64.0 PoC: javni primerek ZA strežniškim `/api/geocode` — odjemalec ga ne vidi; cache 24 h/600 + breaker 4→10 min + rate 30/min; self-host `PHOTON_BASE_URL` od faze 3) |
| R9 | rezervacije → odgovornost za plačilo/odpoved | poslovno-pravna | samo redirect/request mode; nikoli lasten booking brez pogodbe; lažni gumbi NE |
| R10 | MapLibre 2.0 prelomi | tehnična | Leaflet ostane v fazi 1–3; MapLibre šele v fazi 6 na zamrznjeni verziji |
| **R11** | **routing je odvisen od JAVNEGA primerka** — od 2.65.0 (faza 2 PoC) javni Valhalla FOSSGIS `valhalla1.openstreetmap.de` (BJS za lahkotno uporabo; prej OSRM demo `router.project-osrm.org`) | operativna | obstoječe mitigacije v kodi: cache 24 h/600 + circuit breaker (4 napake → 10 min) + iskren hevristični fallback z izrecno oznako; trajna rešitev: **Valhalla self-host — `VALHALLA_BASE_URL` override, koda ISTA (kanon faze 2, izveden kot PoC 2.65.0)** |

---

## 12. Uradni viri (preverjeni 2026-10-13, razen kjer je navedeno)

- Leaflet — https://github.com/Leaflet/Leaflet (BSD-2)
- MapLibre GL JS — https://github.com/maplibre/maplibre-gl-js (LICENSE.txt: BSD-3 — preverjeno prek raw LICENSE datoteke)
- OpenFreeMap — https://www.openfreemap.org/ („completely free … no limits“, self-host izrecno dokumentiran — preverjeno prek uradne strani)
- OSMF tile politika — https://operations.osmfoundation.org/policies/tiles/
- Geofabrik izvozi — https://download.geofabrik.de/ (izvozi za vseh 10 držav kanona obstajajo, dnevna svežina — ponovno potrjeno 14. 10. 2026)
- Valhalla — https://github.com/valhalla/valhalla (COPYING: **MIT**, potrjeno prek raw datoteke; verzija 3.9.1); javni primerek FOSSGIS `valhalla1.openstreetmap.de` (BJS; `/route?json=…` verificirano curl 14. 10. 2026: trip.status 0, summary length/time, shape polyline6 — `lang`/`units` podprta; v kodi od 2.65.0)
- GraphHopper — https://github.com/graphhopper/graphhopper (Apache-2.0)
- OR-Tools — https://github.com/google/or-tools (Apache-2.0)
- Vroom — https://github.com/VROOM-Project/vroom (BSD-2)
- OpenTripPlanner — https://docs.opentripplanner.org/ (LGPL-3)
- Nominatim — https://nominatim.org/ (GPL; javni primerek: 1 req/s)
- Photon — https://github.com/komoot/photon (LICENSE: **Apache-2.0**, potrjeno prek raw datoteke)
- (verifikacija 14. 10. 2026) Photon javni primerek — https://photon.komoot.io/api/?q=Ljubljanski%20grad&limit=3 (GeoJSON FeatureCollection, lokalizirana imena, `countrycode`, [lng,lat]; `lang=sl` → HTTP 400 „Language is not supported. Supported are: default, de, en, fr“ → v kodi `lang=en`)
- Booking.com Demand API pogoji — https://developers.booking.com/demand/docs/getting-started/prerequisites
- Viator Partner API — https://docs.viator.com/partner-api/technical/
- GetYourGuide API zahteve — https://partner.getyourguide.support/hc/en-us/articles/13981133907613-API-integration-and-requirements
- Expedia Rapid — https://developers.expediagroup.com/rapid/setup
- SI odprti podatki (GTFS preiskava) — https://podatki.gov.si/ (CKAN: 0 GTFS datasetov, preverjeno 13.10.2026)
- GTFS katalog — https://mobilitydatabase.org/
- (refresh 14. 10. 2026) produkcija: https://i-feel-slovenia.vercel.app/api/health (v2.60.0; 74 destinacij · 44 regij · 10 tipov · 10 držav), /destinacije?country=HR (200), /drzava/GR (200), sitemap.xml (738 `<url>`, 5166 hreflang) — spot-check žive produkcije
- (verifikacija 14. 10. 2026) OpenFreeMap TileJSON — https://tiles.openfreemap.org/planet (tilejson 3.0.0; tiles = datirani vektorski `.pbf` zapis, 16 vector_layers) + https://tiles.openfreemap.org/styles/liberty (sources: openmaptiles=vector, ne2_shaded=raster Natural Earth) → javni primerek NIMA uličnega rasterja za Leaflet (diferencialni test: OSMF ploščica 6987B image/png v istem peskovniku — metoda zanesljiva)

---

*Zaključek (osvežen 14. 10. 2026, 2.65.0): platforma je izvedljiva z 0 EUR licenčnih stroškov in brez AI. Balkanska ekspanzija (F0–F5, #41) je zaprla podatkovno-modelirno vrzel; faza 4a+4b (Provider sloj + prijava/moderacija) je zaključena v 2.61.0/2.62.0; faza 1 je dobila izveden PoC (2.63.0: MapLibre + OpenFreeMap na `?zemljevid=vektorji`, merjeno 277 kB gzip, privzeti Leaflet nespremenjen, ATTRIBUTIONS.md stoji); faza 3 je dobila izveden PoC (2.64.0: strežniški `/api/geocode` nad javnim Photon BJS + krajevno iskanje v prijavnici ponudnika, ročni vnos ostaja, self-host = `PHOTON_BASE_URL`); faza 2 je dobila izveden PoC (2.65.0: routing na javnem Valhalla FOSSGIS primerku — R11 OSRM demo ukinjen, iskrenostni kanon ena-ob-ena, self-host = `VALHALLA_BASE_URL`). Ostajajo: Valhalla/Photon self-host na lastniškem VPS, lastniška re-deizija faze 1, faza 5 Viator (odobritev) ter materializacija Postgres tabel (db:pg:deploy, PRODUCTION-CUTOVER). Odločitve ostanejo reverzibilne in majhne.*
