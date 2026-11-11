# Balkan & konkurenca — analiza vrzeli

> Stanje: 2026-11-10. Cilj: razširitev Discover Slovenia AI na »cel Balkan«
> (SI · HR · BA · RS · XK · ME · AL · MK) ob primerjavi s TripMind in
> sorodnimi AI načrtovalci.

---

## 1. Naša dejstva (dokazano iz kode)

| Področje | Trenutno stanje | Opomba |
|---|---|---|
| Vodič (regije) | 5 slovenskih regij (gorenjska, osrednja, primorska, štajerska, koroška) | GUIDE_REGIONS v src/lib/guide-store.ts |
| Destinacije (SEO strani) | 7 (Bled, Bohinj, Ljubljana, Dolina Soče, Piran, Maribor, Dravograd) | TRIP_PLAN v src/lib/trip-plan.ts |
| Jezik UI | slovenščina (ena) | ni i18n sloja; `next-intl` je v deps, a neuporabljen |
| Valute | EUR (formatEur) | ni večvalutne podpore; obstaja /api/open-data/rates |
| Zemljevid | OSM globalno (Leaflet) | ploščice globalne |
| Iskanje prenočišč | GLOBALNO (Photon/OSM: »Skopje, Zagreb …« deluje) | stays API ni omejen na SI |
| POI ob poti | Overpass GLOBALNO + urejen izbor (only SI znamenitosti) | katalog je SI-only, OSM deluje povsod |
| RKD sloj | Slovenija (31.107 enot) | register je nacionalen |
| Javni prevoz | OJPP/brezavta — SLOVENIJA (izvor fiksno Ljubljana) | nomin ni mednarodni |
| Višine/LiDAR | ARSO — Slovenija | Copernicus rezerva globalna (90 m) |
| Vreme | Open-Meteo GLOBALNO | ✓ |
| Deljenje/uvoz poti | ✓ | /pot/[id] |
| GPX / tisk / PDF | ✓ | |
| Prerazporeditev, proračun, dnevni trak | ✓ | |
| AI pogovor / asistent | ✗ | ni klepeta (samo vodeni tok) |
| Skupinsko načrtovanje | ✗ | |
| Rezervacije (hoteli/leta/taksi) | ✗ | rezervacije »poštene«, brez plačila |
| Offline zemljevidi | ✗ (GPX izvoz le) | |
| Mobilna aplikacija | ✗ (responsivno web) | |

---

## 2. Razširitev na Balkan — viri, ki že delujejo / so na voljo

| Vir | Stanje | Uporaba za Balkan |
|---|---|---|
| OSM ploščice + Leaflet | ✓ globalno | zemljevid vseh držav |
| Photon/Nominatim (iskanje, reverse) | ✓ globalno | iskalnik krajev (»Skopje, Zagreb …« že dela) |
| Overpass (POI) | ✓ globalno | zanimivosti povsod; katalog razširiti po državah |
| Open-Meteo | ✓ globalno | vreme za poljuben kraj |
| Open-data rates (ER-API/currency-api) | ✓ (RSD/MKD/ALL/BAM že podprti) | večvalutni proračun |
| Open-data prazniki (nager) | ✓ po državah | prazniki HR/BA/RS/ME/AL/MK/XK |
| Javni prevoz: OJPP/brezavta | samo SI | za mednarodne relacije: FlixBus, avtobusi (Arriva HR), vlaki (HŽPP/ŽS), trajekti (Jadrolinija) — zunanje povezave, brez API-ja |
| Kulturne registre (RKD ekvivalenti) | nacionalni: HR »Registar kulturnih dobara«, RS »Nepokretna kulturna dobra«, ME »IKTK«, AL »IKTK«, BA »KONS«, XK | po enaka predlogdelava kot RKD |
| Jezikovni sloj | next-intl v deps | i18n (sl/en + balkanski jeziki) |

---

## 3. Konkurenca (dejstva iz raziskave, 2026-11-10)

- **TripMind**: spletna storitev tripmind.com NE obstaja (parkirana domena, Cloudflare). Obstaja iOS aplikacija TripMind (8/2025, 0 ocen, AI itinerarji + offline, stealth: brezplačno + premium). Primerjava z njo je torej primerjava s kategorijo, ne z uveljavljenim produktom.
- **Wanderlog** (vodja kategorije): mapa + itinerar + skupinska kolaboracija v realnem času + proračun z delitvijo stroškov + uvoz rezervacij + AI asistent + offline/optimizacija (Pro 39,99 $/leto). Slabosti: generična priporočila, brez pretvorbe valut, brez PDF exporta.
- **Komoot**: outdoor načrtovanje, turn-by-turn, offline karte, skupnost (50M+ članov). Ni turističnega načrtovanja, rezervacij ali proračuna.
- **Roadtrippers**: road trip + 5M POI + ocena goriva + RV; večinoma ZDA; free tier zelo omejen.
- **Mindtrip**: AI klepet + itinerarji z viri + rezervacije (Priceline/Viator) + Start Anywhere (uvoz iz socialnih omrežij). Brezplačno (provizije).
- **Tripomatic (Sygic Travel)**: offline vodiči za 10.000+ lokacij, stroški, kolaboracija, AI.
- **Layla AI**: AI klepet + človeški agenti + rezervacije; premium 49,99 $/leto (ni uradno potrjeno).
- **Google Travel/Maps**: shranjeni seznami, "things to do", rezervacije iz Gmaila (ni samostojen produkt).

### Skupne zmogljivosti konkurence, ki jih nimamo
1. **Kolaborativno načrtovanje** (Wanderlog, Mindtrip, Tripomatic, TripWise, Roadtrippers)
2. **AI pogovor/klepet** (Mindtrip, Layla, Wanderlog AI, iplan.ai …)
3. **Rezervacije v aplikaciji** (Mindtrip, Layla, Roadtrippers)
4. **Offline karte** (Komoot, Tripomatic, Wanderlog Pro, iplan.ai)
5. **Socialni dokazi/skupnost** (Wanderlog vodiči, Komoot Highlights, Mindtrip TripAdvisor)
6. **Skupinsko potovanje** (Wanderlog, Mindtrip, TripWise …)

### Kje smo MI pred njimi (razlikovalniki)
- **Poštenost brez paywalla**: vse ključno je brezplačno, brez računa, brez skritih stroškov (konkurenca zapira offline/skupnost za Pro).
- **Resnični regionalni podatki**: RKD register (31k enot s fotografijami), ARSO LiDAR, OJPP javni prevoz, OSRM cestna pot — konkurenca teh nima.
- **PDF/tisk in GPX izvoz**: PDF export pri konkurenci NI potrjen pri nobenem.
- **Deterministična personalizacija** prek vprašanj (ne generičnih »prompts«), z izrecno navedbo virov.
- **SEO strani destinacij** (/kraj/[slug]) — večina konkurence je SPA brez SEO strani.

---

## 4. Predlog: načrt širitve na Balkan (faze)

### Faza A — Balkan katalog (mali trud, velik učinek) ⭐ najprej
Razširiti `GUIDE_REGIONS` + `TRIP_PLAN` na 8 držav (SI + HR + BA + RS + XK + ME + AL + MK), npr. 3–5 destinacij na državo (Zagreb, Plitvice, Split, Dubrovnik, Sarajevo, Mostar, Beograd, Niš, Kotor, Budva, Skopje, Ohrid, Tirana, Berat, Priština, Prizren, …). Vse obstoječe funkcije že delujejo globalno (mapa, vreme, prenočišča, POI/Overpass, vodič), zato novi katalog takoj rok funkciojo **SEO strani**, mapo in vodič v novih državah. Dopolniti še kurirani POI katalog za nove države.

### Faza B — i18n (srednji trud)
`next-intl` (že v odvisnostih): sl → en (+ postopoma hr/sr/sq/mk). Predpogoj za mednarodne uporabnike in za SEO v drugih jezikih.

### Faza C — Večvalutni proračun (mali trud)
Obstoječi `/api/open-data/rates` že vrača RSD/MKD/ALL/BAM → ob izbiri države prikazati proračun v lokalni valuti (s EUR referenco).

### Faza D — Mednarodni prevoz + meje (srednji trud)
Informativni modul »Kako čez mejo«: bus/vlak/trajekt (FlixBus, Arriva HR, HŽPP, ŽS, Jadrolinija …) z zunanjimi povezavami; opombe o potnih dokumentih (EU/Schengen/non-EU meje) — kurirano, brez API-ja.

### Faza E — Skupinsko načrtovanje (visoki trud, opcija)
Razširitev deljene poti v »povabi sopotnike« (kolaborativni predlogi sprememb). Po Fazi A–D.

### Faza F — AI asistent (visok trud, drugačen model, opcija)
Klepet AI, ki iz prompta generira itinerar — vendar je to odstop od »deterministične/0 ključev« filozofije; priporočam šele potem, ko so Faze A–D zaključene in ob jasni odločitvi o modelu/skrajšavah.
