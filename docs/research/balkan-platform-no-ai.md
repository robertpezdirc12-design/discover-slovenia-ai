# Balkan Travel Platform brez AI — raziskava in izvedljiv načrt

**Issue:** #35 · **Status:** dokument oddan · **Datum preverjanja:** 2026-10-13
**Metoda:** vsi podatki o licencah/dostopu preverjeni na primarnih virih (uradni repo/LICENSE, uradna dokumentacija); kjer podatek ni potrjen, je izrecno označen **[nepotrjeno]**.
**Kategorije:** [OSS] odprtokodna programska oprema · [BJS] brezplačna javna storitev · [OJP] odprti javni podatki · [PPA] partnerski API z odobritvijo · [OBJ] lastna (objektna) vsebina/koda

---

## 1. Povzetek za odločanje

**Sodba:** sedajšnji `discover-slovenia-ai` je že **~80 % arhitekture**, ki jo #35 opisuje: deterministični načrtovalnik obstaja (1.937 vrstic čiste logike brez AI), Leaflet zemljevid deluje, i18n pokriva 6 jezikov, monetizacija (Stripe, affiliate, listingi, partner portal) je v kodi, testno jeklo je izjemno (2097 enotnih + 10 E2E + smoke). Manjkajo **štiri reči**:

1. **Ploščice** — trenutno `tile.openstreetmap.org` (BJS), kar OSMF politika izrecno prepoveduje za komercialno produkcijo → zamenjava z **OpenFreeMap** [BJS/OSS] (0 EUR, brez registracije, self-host pot enaka kode).
2. **Routing** — obstoječa razdaljna logika je haversine/bbox; za resne poti **Valhalla self-host** [OSS, MIT] nad Geofabrik izvozi petih držav.
3. **Večdržavni podatkovni sloj** — registri so trdo slovenski (38 destinacij, 31 dogodkov); potrebna je normalizacija na državno modeliranje (novi modeli, NE prepis aplikacije).
4. **Katalog ponudnikov** — `Listing` model + moderacija že obstajata; potreben je razred kategorij/regij in preverjanje po #35, ne nov sistem.

**Strošek faze 1 (tehnično začetno):** 0 EUR licence, 0 novih plačljivih storitev; strošek VPS za Valhalla je **[nepotrjen]** (ocena 5–20 EUR/mes za 2–4 vCPU, zahteva ponudbo). **AI: 0 komponent** — vsa logika je filtriranje, uteži, geometrija in pravila.

**Ključno tveganje:** ODbL share-alike za izpeljane baze (mitigirano z ATTRIBUTIONS.md režimom) in eno-vzdrževalčeva odvisnost OpenFreeMap (mitigirano: self-host pot je enaka kode).

---

## 2. Pregled sedanjega repozitorija (preverjeno na glavi PR #40, 2026-10-13)

### 2a. Kaj obstaja in deluje (NE prepisovati)

| področje | implementacija | dokaz |
|---|---|---|
| Deterministični načrtovalnik | `itinerary-engine.ts` (1239 vrstic) + `deterministic-itinerary.ts` (110) + `day-segments.ts` (121) + `next-step.ts` (467) | enotni testi zaklepajo vedenje; 0 AI |
| Zemljevid | Leaflet 1.9.4 + react-leaflet, rasterske ploščice, CSP pining (`csp.ts`), `map-pins`, `geo-bbox` | `travel-map.tsx`, 10 E2E testov vključno z zemljevidom |
| Registri podatkov | 38 destinacij (5 držav!), 31 dogodkov (kanon potrjenih virov, `verifiedAt`), vodniki, lokali, GO, gorilne postaje | `content-data.ts` (67 KB), `lokali-data.ts`, `go-data.ts`, `fuel-stations.ts` |
| i18n | 6 jezikov (sl privzet; en/it/de/fr/es s predponami), `i18n-pick`, `hreflang`, `intl-locale` | vse glavne strani unikatni meta |
| Monetizacija | Stripe (checkout/marketplace/products), affiliate (klik → komisija), konsultacije, slovenia-pass | 27 Prisma modelov |
| Ponudniki | `Listing` + `listing-moderation`, partner portal (`partner-session`), strani `/za-ponudniki`, `/owner` | API: listings/partner/admin |
| Skupinska potovanja | `TravelJourney` + sodelovalci + vabili + rezervacije + ankete + sporočila | API: journey/trips/invites |
| Kakovost | 2097 enotnih testov (bun, 104 datoteke), 10 Playwright E2E (2 projekta), smoke 19/19, tsc 0, eslint 0 | CI definicija (kvotno zadržana) |
| PWA + cron + varnost | `sw.js` s verzijo, cron-auth fail-closed, CSP, nonce | smoke preverbe |

### 2b. Kaj obstaja, a je nepopolno

- **Geokodiranje**: `geo-bbox.ts` in koordinate v registrih so ročno kurirani; uporabniško iskanje naslovov (autocomplete) ne obstaja.
- **Routing**: razdalje so haversine ocene; ni profilno pogojenega časa (peš/avto/kolo) niti TSP optimizacije postankov (greedy izbira je v engine, brez 2-opt).
- **Listingi**: model + moderacija so, ampak brez držav/regij, sezonskosti po #35, preverjanja ponudnika (verified/lastVerifiedAt) in brez kategorij iz 3. poglavja #35.
- **Jeziki**: 6 jezikov pokriva UI lupino; balkanski jeziki (hr/bos/ср/me/sq) so ARHITEKTURNO pripravljeni (PickLocale tip + predpona), a vsebinsko (registri) samo dvojezični (sl/en).

### 2c. Kaj manjka (za cilj #35)

- Ploščični ponudnik za produkcijo (zdaj OSMF javne ploščice — glej tveganje R1).
- Routing engine + optimizacija vrstnega reda postankov z realnimi profili.
- Večdržavni podatkovni model (država/regija/kraj kot prvotne dimenzije).
- Katalog ponudnikov 5 držav s postopkom prijave/preverjanja.
- Partnerski API sloj (status: vse [nepotrjeno] — glej pogl. 7).

### 2d. Podvajanje, ki se ga izogibamo

- NE uvajati MapLibre, dokler ni vektorski/PMTiles use-case (Leaflet 2D rastri pokrijejo faze 1–3).
- NE uvajati OR-Tools/Vroom za 3–15 postankov (lastni greedy+2-opt zadošča; Vroom šele pri časovnih oknih/več vozilih).
- NE graditi novega CMS-ja za ponudnike (Listing + moderacija + owner stran so osnova).
- NE uvajati OTP (0/5 nacionalnih GTFS feedov — glej pogl. 5).

---

## 3. Primerjalna matrika SDK-jev

| komponenta | kategorija | licenca (vir, datum) | verzija | sodba | ključni razlog |
|---|---|---|---|---|---|
| **Leaflet** (obstoječ) | OSS | BSD-2 (repo LICENSE) | 1.9.4 | **IZBRATI — ostane** | 42 KB, 0 odvisnosti; 2D rastri pokrijejo vse faze 1–3 |
| MapLibre GL JS | OSS | BSD-3 (LICENSE.txt, preverjeno 13.10.2026) | 6.14.0 | PREIZKUSITI (PoC) | vektor/3D/PMTiles ob potrebi; 4–7× večji paket |
| **OpenFreeMap** (ploščice) | BJS+OSS | ODbL podatki; javni primerek brez ključev | — | **IZBRATI ZDAJ** | „completely free, no limits“ (uradna stran, 13.10.2026); self-host pot enaka kode |
| tile.openstreetmap.org | BJS | ODbL | — | **ZAVRNITI** za produkcijo | OSMF politika: umik komercialnim storitvam |
| Geofabrik izvozi/self-host | OJP+OSS | ODbL | dnevni izvozi | PREIZKUSITI | zakonita pot pri rasti |
| **Valhalla** (routing) | OSS | **MIT** (COPYING, preverjeno 13.10.2026) | 3.9.1 | **IZBRATI — primarni** | auto/peš/kolo + multimodalno, vgrajen costmatrix/TSP, nizek pomnilniški odtis |
| OSRM | OSS | BSD-2 | 26.10.0 | ZAVRNITI kot primarni | statični profili ob predobdelavi; meritvena referenca |
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

| vir | kategorija | licenca/pogoj | uporaba v platformi | tveganje |
|---|---|---|---|---|
| OpenStreetMap (prek OpenFreeMap) | OJP | ODbL 1.0 — atribucija „© OpenStreetMap contributors“ vidna; share-alike za izpeljane baze | ploščice, geokodiranje, routing grafi | share-alike (R2) |
| Geofabrik izvozi | OJP | ODbL; izviri brezplačni, self-host dovoljen | Valhalla grafi 5 držav | svežina (dnevno) |
| Uradni nacionalni turizmi (STB, HTZ, …) | OJP/PPA | različno — **[nepotrjeno] po posameznem viru** | kurirani POI/dogodki | pogoji posamezne organizacije |
| lastna kuracija (registri app) | OBJ | © platforma | opisi, dogodki, cene | NISPODAJO pod ODbL |
| fotografije ponudnikov | PPA/OBJ | po pogodbi pri prijavi ponudnika | profili | NE kopirati s spleta brez licence |
| Booking/Viator/GYG/Expedia | PPA | pogodbeni — glej pogl. 7 | šele po odobritvi | brez odobritve NE uporabljati |

**Obveznost od pričetka faze 1:** voditi `ATTRIBUTIONS.md` — sloj → vir → licenca → datum. Share-alike ocena na nivoju vsake izpeljane baze (glej R2).

---

## 5. Pokritost petih začetnih držav in vrzeli

| država | destinacije v kanonu | routing (Geofabrik) | geokodiranje (OSM/Photon) | javni prevoz (GTFS) | vrzel |
|---|---|---|---|---|---|
| Slovenija | 12 | ✓ dnevni izvoz | ✓ | **0 datasetov** (podatki.gov.si CKAN, preverjeno 13.10.2026) | nacionalni GTFS |
| Hrvaška | 7 (Split, Hvar, Dubrovnik, Zadar, Pula, Rijeka, Plitvice + zagreb) | ✓ | ✓ | samo lokalni ZET (uradno objavljen) | nacionalni GTFS |
| Bosna in Hercegovina | 0 | ✓ | ✓ | 0 | **celoten POI sloj** |
| Črna gora | 4 (Kotor, Budva, Podgorica, Durmitor) | ✓ | ✓ | 0 | POI sloj + obalna sezonskost |
| Albanija | 5 (Tirana, Berat, Gjirokastër, Sarandë + obala) | ✓ | ✓ | 0 | POI sloj; kvaliteta OSM cestnega omrežja **[nepotrjena — izmeriti na Valhalla grahu]** |
| (širitev: SRB/MKD/KOS) | 0 | ✓ izvozi obstajajo | ✓ | **[nepotrjeno]** | faza 3+ |

**Zaključek:** osnovni zemljevid/routing/geokodiranje pokrijejo vseh 5 držav iz istega ZDROJA (OSM); vrzeli so VSEBINKE (POI katalog) in javni prevoz (brez GTFS → OTP zavrnjen; avto/peš/kolo pokrije Valhalla).

---

## 6. Podatkovni model ponudnika ter model lokacije/dogodka

### 6a. Provider (razširitev obstoječega `Listing` — NE nova tabela za vse)

Novi Prisma modeli `Provider` (ali rozširitev Listing) z obveznimi polji #35:

```prisma
model Provider {
  id            String   @id @default(cuid())   // stabilni ID
  countryCode   String   // ISO-3166: SI HR BA ME AL (kasneje SR MK XK)
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
  currency      String?  // EUR, BAM, EUR(me), ALL — po državi
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

### 6b. Lokacija/dogodek

- `Destination` (obstoječ) dobi `countryCode` + `region` (migracija 38 zapisov — povraten sloj države).
- `CommunityEvent` (obstoječ kanon z `source`/`verifiedAt`/`dateUnconfirmed`) se razširi na `countryCode`; kanon iskrenosti datuma („nikoli ne ugibaj“) se OHRANI kot standard za vse države.

### 6c. Postopek prijave in preverjanja ponudnika

1. prijava (existing `/za-ponudniki` tok → Listing/Provider) z dokazili (URL, lastništvo domene, KMRC/registrska številka **[nepotrjeno katero dokazilo za vsako državo]**);
2. identiteta: e-pošta domene ≥ ponudnikova domena ali telefonski klic;
3. moderacija: obstoječa `listing-moderation` + admin UI;
4. prijava napak: javni „report“ gumb na profilu (nov mal API);
5. podvajanja: dedup na normalizirano ime + geohash ±50 m;
6. potek preverjanja: `verifiedAt` stari > 12 mesecev → opozorilo → padec na `claimed`.

---

## 7. Partnerski API-ji: pogoji in status (vse še brez odobritve!)

| API | vstop | funkcije brez odobritve | provizija | sandbox | pokritost 5 držav | status |
|---|---|---|---|---|---|---|
| Booking.com Demand | samo „Managed Affiliate Partner“ po pogodbi | nič | **[nepotrjeno]** | obstaja (po pogodbi) | **[nepotrjeno]** | **ZAVRNITI zdaj** |
| Viator Partner API | javna prijava | sandbox + Postman; preusmeritve | **[nepotrjeno]** | ✓ javen | aktivnosti v vseh 5 **[nepotrjena globina]** | PREIZKUSITI ob obsegu (faza 4) |
| GetYourGuide | najmanj pregleden | — | — | — | — | ZAVRNITI zdaj |
| Expedia Rapid | najzahtevnejši vstop | — | — | — | — | ZAVRNITI zdaj |

**Zakonita alternativa brez API-ja:** označena neposredna povezava na ponudnika (`officialUrl`), klic/e-pošta, povpraševanje (`bookingMode: "request"`). **Nikoli lažni rezervacijski gumb.** Scrape vsebin: ne, razen če pogoji izrecno dovoljujejo.

---

## 8. Predlagana arhitektura in tok podatkov

```
┌─ Next.js 16 (obstoječ) ──────────────────────────────────────────────┐
│  UI (i18n 6+ jezikov) · PWA · Leaflet/OFRM ploščice · CSP            │
│  deterministični načrtovalnik (itinerary-engine — obstoječi)          │
│    ↓ parametri: datumi, proračun, interesi, družina, čas na dan      │
│  1) FILTRIRANJE registrov + Provider katalog (pravila, uteži)         │
│  2) DOSEGLJIVOST: Valhalla costmatrix (HTTP self-host)                │
│  3) VRSTNI RED: greedy + 2-opt na matriki (lastna, <50 vrstic)        │
│  4) RAZPORED: dan-segmenti, odpiralni časi, sezona, proračun          │
│  5) OPOZORILA: nepotrjeni časi/cene, pretesen načrt                   │
│  6–8) ročno urejanje → preracun → shrani (TravelJourney — obstoječi)  │
└──────────────────────────────────────────────────────────────────────┘
        ↓ self-host (VPS)                    ↓ samo uporabniško sproženo
   Valhalla (Geofabrik SI/HR/BA/ME/AL)   Photon (ali javni Nominatim v demo)
   [+ faza 3: Vroom; MapLibre/PMTiles ob potrebi]
```

Pravilo: **vsako pravilo/utež pregledna + testirana** (obstoječi standard zaklepov); uteži NISO „objektivno najboljše“ — dokumentiran hevristični izbor, empirična ovrednotenje šele z uporabniškimi podatki.

---

## 9. Faze izvedbe in odvisnosti

| faza | vsebina | odvisnosti | strošek | tveganje-utor |
|---|---|---|---|---|
| **0 — ta dokument** | #35 zaključen | — | 0 | — |
| **1 (≤1 teden)** | OpenFreeMap ploščice: zamenjava URL v `travel-map.tsx` + `CSP_TILE_HOSTS`; ATTRIBUTIONS.md; atribucija vidna v UI | — | 0 EUR | eno-vzdrževalec (self-host ista koda) |
| **2 (2–4 tedni)** | Valhalla self-host: Geofabrik izvozi → graf za 5 držav; API route `routing-matrix`; 2-opt optimizer + zaklepi | VPS **[nepotrjena cena]** | licence 0; ops ocena 5–20 EUR/mes | obremenitev VPS pri rasti |
| **3 (1–2 tedna)** | Photon self-host (autocomplete); Nominatim javni ostane samo za demo; Vroom šele za časovna okna | faza 2 (isti VPS) | 0 | — |
| **4 (2–6 tednov)** | Provider katalog: migracija Destination (countryCode), Provider model, prijava/verifikacija, dedup, report; BA/ME/AL POI kuracija (kurirana, ne scrape) | faza 1 | 0 (človeški čas kuracije je glavni strošek) | svežina podatkov |
| **5 (šele ob obsegu)** | Viator sandbox pilot; meritve prikazi/kliki/povpraševanja (diagnostika brez osebnih podatkov); PLUS paket ponudnikov | faza 4 + obseg uporabe | 0 do odobritve | pogodbeni pogoji |
| **6 (opcija)** | MapLibre + PMTiles (offline/regionalni vektorji) | faza 2 + izražen use-case | 0 | paket +4–7× |

**Zavrnjeno z utemeljitvijo** (ne vračati se k temu brez novih dejstev): OR-Tools, GraphHopper, OSRM kot primarni, OTP (dokler ni nacionalnega GTFS), OSMF javne ploščice v produkciji, MapTiler/Stadia free stopnji (izrecno ne-komercialne), Booking/GYG/Expedia pred odobritvijo.

---

## 10. Stroški gostovanja: osnovni scenarij in scenarij rasti

**ZANANE stroške (0 EUR):** vse licence OSS (Leaflet BSD-2, Valhalla MIT, Photon Apache-2.0, MapLibre BSD-3, Vroom BSD-2); OpenFreeMap javni primerek; Geofabrik izvozi; Next.js/Bun/Prisma/Leaflet.

**POSTAVKE, KI POTREBUJEJO PONUDBO (nepotrjene cene):**

| postavka | osnovni scenarij (do ~10k prikazov/mes) | scenarij rasti (>100k/mes) |
|---|---|---|
| VPS za Valhalla+Photon (2–4 vCPU, 8–16 GB) | ocena **5–20 EUR/mes [nepotrjeno — zahtevati ponudbe]** | ločen graf na državo; 3–8 instanc; load balancer **[nepotrjeno]** |
| ploščice | OpenFreeMap javni primerek 0 EUR | self-host tileserver (istega kode) — VPS v isti ponudbi **[nepotrjeno]** |
| Next.js hosting | obstoječ (Hobby workaround v produkcijskem cronu) | standardni VPS/PaaS **[nepotrjeno]** |
| Postgres (prek db:pg migracij) | obstoječ | upravljani PG **[nepotrjeno]** |
| partner API-ji | 0 (brez odobritve) | pogodbeno, po obsegu **[nepotrjeno]** |

Merila za sprožitev rasti: presežek OSMF/OpenFreeMap poštene uporabe, p95 routing > 300 ms, POVpraševanje ponudnikov > ročna zmogljivost.

---

## 11. Register tveganj

| # | tveganje | vrsta | mitigacija |
|---|---|---|---|
| R1 | OSMF politika javnih ploščic prepoveduje komercialno produkcijo | licenčno-pravna | faza 1: OpenFreeMap (izrecno za ta use-case); fallback self-host |
| R2 | ODbL share-alike: izpeljane baze (kurirana POI baza z OSM koordinatami) lahko postanejo ODbL | licenčno-pravna | ločevanje slojev (OBJ vsebina ≠ OJP koordinate); ATTRIBUTIONS.md; pravni pregled pred fazo 4 |
| R3 | OpenFreeMap = 1 vzdrževalec | zanesljivost | self-host pot ista koda; monitoring; zakasnitev 2 tedna za switch |
| R4 | GTFS 0/5 → brez javnega prevoza | podatkovna | Valhalla avto/peš/kolo; GTFS monitoring (mobilitydatabase.org); OTP šele ob feedih |
| R5 | zastareli podatkи (cene, odpiralni časi) | podatkovna | kanon iskrenosti (unconfirmed/verifiedAt — obstoječi standard dogodkov) razširjen na Providerje; 12-mesečni potek |
| R6 | osebni podatki (prijava ponudnikov, pošiljatelji sporočil, leads) | GDPR | obstoječi standardi (fail-closed cron, audit log); DPA z VPS ponudnikom |
| R7 | partner API pogoji se spreminjajo | poslovna | vse [nepotrjeno] do pisne odobritve; prikaz brez odobritve = NE |
| R8 | obremenitev javnih servisov (Nominatim 1 req/s) | operativna | cache + rate limit + Photon self-host od faze 3 |
| R9 | rezervacije → odgovornost za plačilo/odpoved | poslovno-pravna | samo redirect/request mode; nikoli lasten booking brez pogodbe; lažni gumbi NE |
| R10 | MapLibre 2.0 prelomi | tehnična | Leaflet ostane v fazi 1–3; MapLibre šele v fazi 6 na zamrznjeni verziji |

---

## 12. Uradni viri (vsi preverjeni 2026-10-13, razen kjer je navedeno)

- Leaflet — https://github.com/Leaflet/Leaflet (BSD-2)
- MapLibre GL JS — https://github.com/maplibre/maplibre-gl-js (LICENSE.txt: BSD-3 — preverjeno prek raw LICENSE datoteke)
- OpenFreeMap — https://www.openfreemap.org/ („completely free … no limits“, self-host izrecno dokumentiran — preverjeno prek uradne strani)
- OSMF tile politika — https://operations.osmfoundation.org/policies/tiles/
- Geofabrik izvozi — https://download.geofabrik.de/ (SI/HR/BA/ME/AL obstajajo, dnevna svežina)
- Valhalla — https://github.com/valhalla/valhalla (COPYING: **MIT**, potrjeno prek raw datoteke; verzija 3.9.1)
- OSRM — https://github.com/Project-OSRM/osrm-backend (BSD-2)
- GraphHopper — https://github.com/graphhopper/graphhopper (Apache-2.0)
- OR-Tools — https://github.com/google/or-tools (Apache-2.0)
- Vroom — https://github.com/VROOM-Project/vroom (BSD-2)
- OpenTripPlanner — https://docs.opentripplanner.org/ (LGPL-3)
- Nominatim — https://nominatim.org/ (GPL; javni primerek: 1 req/s)
- Photon — https://github.com/komoot/photon (LICENSE: **Apache-2.0**, potrijeno prek raw datoteke)
- Booking.com Demand API pogoji — https://developers.booking.com/demand/docs/getting-started/prerequisites
- Viator Partner API — https://docs.viator.com/partner-api/technical/
- GetYourGuide API zahteve — https://partner.getyourguide.support/hc/en-us/articles/13981133907613-API-integration-and-requirements
- Expedia Rapid — https://developers.expediagroup.com/rapid/setup
- SI odprti podatki (GTFS preiskava) — https://podatki.gov.si/ (CKAN: 0 GTFS datasetov, preverjeno 13.10.2026)
- GTFS katalog — https://mobilitydatabase.org/

---

*Zaključek: platforma je izvedljiva z 0 EUR licenčnih stroškov in brez AI — z obstoječo arhitekturo + 4 konkretne pridobitve (OpenFreeMap, Valhalla, Photon, Provider katalog). Odločitev za fazo 1 je reverzibilna in majhna (sprememba 1 URL + CSP vrstice).*
