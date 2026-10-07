# Tekmovanaliza: Kako Discover-Slovenia-AI preseže najboljše na trgu
**Datum:** 2026-02-14 · **Vir:** spletna raziskava (30+ virov: App Store, Reddit r/travel, Trustpilot, Product Hunt, strokovne recenzije 2024–2026) · **Naročnik:** lastnik repo `markec12345678/Discover-Slovenia-AI`

---

## 1. Kdo so najboljši in kaj imajo

| # | Aplikacija | Kategorija, kjer zmaguje | Ključne prednosti (dokazano) | Šibkosti (dokazano iz recenzij) |
|---|-----------|--------------------------|------------------------------|--------------------------------|
| 1 | **Wanderlog** | #1 brezplačni kolaborativni načrtovalnik | Neomejene točke, optimizacija proge, vizualni zemljevid, sledenje stroškov, desktop-first | „Če vaša skupina obožuje raziskovanje in želi ročno izrisati vsako podrobnost …“ — orodje za **načrtovanje**, ne za **izvedbo**. Občutek „domače naloge“. |
| 2 | **TripIt** | #1 organizator obstoječih rezervacij | Samodejno gradnje itinerarja iz e-pošte, boarding pass/QR integracija | Reddit: „My trip data is gone“, „data accuracy, parsing errors, clunky UI, clearly not built by travelers, lack of obvious features“. Uporabniki množično odhajajo. Krhko e-poštno parsiranje kot edini vir resnice. |
| 3 | **Roadtrippers** | #1 road-trip načrtovalnik | Do 150 postankov, RV navigacija, offline zemljevidi, **Autopilot™** (AI načrtovanje iz 42 M poti) | **Samo ZDA/Kanada/NZ/AU — nikoli Evropa.** Pritožbe: „take away features while significantly hiking price“. Navigacija samo točka-do-točke, brez itinerar-ozaveščene izvedbe. |
| 4 | **Sygic** | #1 offline navigacija + vodniki | 100 % offline zemljevidi, živi promet, incidenti na progi, Premium+ | Najprej navigacija, itinerar je drugotenčen. Plačljivo. |
| 5 | **Layla** | #1 AI načrtovalnik, ki rezervira | Žive cene, rezervacija v 35 min, zabavna vizualija | Samo načrtovanje. Generični podatki. Ni izvedbenega dela. |
| 6 | **Mindtrip** | #1 UX med AI načrtovalniki | „UX/UI absolutely brilliant, simple and sleek“ + odlični zemljevidi | Ne rezervira, ne izvaja. Načrtovanje-only. |
| 7 | **Uradne SI aplikacije** (I feel Slovenia, Slovenia Outdoor, Nexto, Nomago/Arriva, Top 50) | Lokalni podatki, vodniki | Uradni, kakovostni vsebinski viri | **Fragmentirane** (5+ aplikacij), brez AI, brez poti kot take, brez Jadran-regiona. |

**Ugotovitev o uradnih virih:** turisti v Sloveniji dejansko uporabljajo … **Wanderlog** (potrjeno v FB-skupinah). Uradne aplikacije ne pokrivajo potrebe „vodi me skozi mojo pot“.

---

## 2. Strateška ugotovitev: modri ocean

**Vsi zmagovalci optimizirajo pred-potovanje. Nihče ne poseduje časa MED potovanjem.**

- Wanderlog = risalna deska. TripIt = mapa rezervacij. Roadtrippers = načrt proge. Layla/Mindtrip = AI generator.
- Ko uporabnik sede v avto, ga vse te aplikacije izpustijo — prestavi se na Google Maps in načrtovani itinerar „zaživi“ le še kot seznam.
- **Live Activities / Dynamic Island** danes uporabljajo samo čiste navigacijske aplikacije (Ride with GPS, Google Maps) — za en cilj, ne za itinerar. **Noben načrtovalnik potovanj na svetu nima zaklenjeno-zaslonskega napredka po lastnem itinerarju.**
- Roadtrippers Autopilot™ (AI načrtovanje iz 42 M poti) dokazuje vrednost koncepta — a je geografsko zaprt (brez Evrope).

**To je natančno #21 → #22 → #23 v DSAI. Odprti issue-i že ciljajo v modri ocean.**

---

## 3. Primerjalna matrika: DSAI (z načrtom #21–#23) vs. najboljši

| Zmogljivost | Wanderlog | TripIt | Roadtrippers | Sygic | Layla | DSAI danes | DSAI + #21–#23 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Kolaborativno načrtovanje | ✅ zmagovalno | ➖ | ✅ | ➖ | ➖ | ✅ (pot, skupna izbira) | ✅ |
| AI načrtovanje poti | ⚠️ osnovno | ❌ | ✅ Autopilot™ | ❌ | ✅ | ✅ (AI Travel Steward) | ✅ |
| Rezervacije z eksplícitnim statusom resnice | ❌ | ⚠️ krhko parsiranje | ❌ | ❌ | ✅ a črno-skatla | ✅ (14-stopenjski ConfirmationStatus, EXTERNAL≠CONFIRMED) | ✅ |
| **Živa izvedba itinerarja med vožnjo** (aktivna postaja, detekcija prihoda, avtomatsko napredovanje) | ❌ | ❌ | ⚠️ točka-do-točke | ⚠️ nav-only | ❌ | ❌ **največja vrzel** | ✅ **edini na trgu** |
| Guardian (vreme/promet/varnost med potjo) | ❌ | ❌ | ⚠️ promet v nav | ⚠️ incidenti | ❌ | ⚠️ osnove | ✅ |
| AI vodnik med potjo | ❌ | ❌ | ❌ | ⚠️ statični vodniki | ❌ | ⚠️ delno | ✅ |
| Offline izvedba | 💰 premium | ❌ | 💰 premium | ✅ zmagovalno | ❌ | ⚠️ delno | ✅ (zahteva v #21) |
| Live Activities / Dynamic Island | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **delta — glej §5** |
| Pokritje SI·HR·ME·AL z lokalno globino | ⚠️ generično | ⚠️ generično | ❌ ne obstaja | ⚠️ generično | ⚠️ generično | ✅ **jarek** | ✅ |
| GPS nikoli ne piše statusa rezervacije | nedefinirano | nedefinirano | nedefinirano | nedefinirano | nedefinirano | ✅ (arhitektura) | ✅ |

---

## 4. Kako premagamo najboljše — 6 potez

1. **Izvedba, ne načrtovanje (#21).** Deterministična projekcija aktivne postaje (pot + napredek + zdaj), detekcija prihoda, HUD med vožnjo. Nihče od „najboljših“ tega nima — to je naš glavni adut.
2. **Resnica o rezervacijah, pošteno po zasnovi.** Tam, kjer TripIt razpada (parsiranje e-pošte, izguba podatkov, nemijenjivi statusi), DSAI vzdržuje eksplicitni 14-stopenjski statusni avtomat z ločnimi tipi EXTERNAL ≠ CONFIRMED in pravilom „GPS nikoli ne piše statusa“. To je merljivo boljše.
3. **Regionalni jarek.** SI·HR·ME·AL geo-podatkovna zaloga s fail-closed geo razreševanjem (0/20 zunanjih zapisov z zanesljivimi koordinatami → zato lastni, kurirani). Roadtrippers ne pokriva Evrope; Wanderlog je generičen; uradne SI aplikacije so fragmentirane. DSAI = edini AI sopotnik regije.
4. **AI načrtovanje z lokalno globino.** Roadtrippers Autopilot™ dokazuje vrednost AI-je v 42 M poti — a brez Evrope. DSAI-jev AI Travel Steward + kurirana lokalna baza ponuja isti koncept tam, kjer ni konkurence.
5. **Offline-odpornost kot zahteva, ne premium.** Sygic dokazuje pomembnost offline v regiji (ropa, mrtvi koti v Julijcih). #21 mora biti offline-first (podatki poti že obstajajo; navigacijski hand-off mora delovati brez signala).
6. **Zaklenjen zaslon kot prizorišče (delta za #21).** Live Activities karta naslednje postaje na Dynamic Island. Danes to počnejo samo navigacijske aplikacije — noben planner. Prvi na svetu = trajna diferenciacija.

## 5. Konkretne delte za obstoječe specifikacije (izhodišče iz raziskave)

**#21 Live Trip Navigator** ( dopolnitev obstoječega načrta `issue-21-implementation-plan.md`):
- **D1 — Live Activities karta:** naslednja postaja, ETA, preostanek proge — na zaklopljenem zaslonu. Zaželeno v fazi D/E.
- **D2 — Offline-first izvedba:** HUD in detekcija prihoda morata delovati brez povezave (geo podatki so lokalni; navigacija se preda nativnemu navigacijskemu sistemu).
- **D3 — Navigacijski hand-off s pravim waypointom:** kot Roadtrippers („navigation preview and live GPS navigation from one waypoint to another“) — globoka povezava do nativnega navigacijskega sistema s prednaloženo PRAVO postajo, ne le prvo točko poti.

**#22 Travel Guardian:** potrditev pozicioniranja — vreme/promet/varnost med potjo ne obstaja pri NOBENEM zmagovalcu; vstopamo v prazno kategorijo.

**#23 Guided Experience:** benchmark = Nexto (samo Ljubljana, statično) in Sygic vodniki (generično). Naš adut: celotna regija, AI-generirano, večjezično, vezano na trenutno postajo.

## 6. Česa NE gradimo (anti-cilji)

- ❌ Še en kolaborativni canvas — Wanderlog to zmagovito ponuja zastonj; nizek ROI.
- ❌ E-poštno parsiranje rezervacij — TripIt-ovo pokopališče; krhko po zasnovi.
- ❌ Splošna navigacija v konkurenci z Google Maps/Sygic — nezmagovljivo; delamo itinerar-ozaveščeno izvedbo, ne nadomestek za navigacijo.
- ❌ Globalna širitev — regionalni jarek (SI·HR·ME·AL) je prednost, ne omejitev.

## 7. Priporočilo

**Izvedba #21 je najhitrejša pot do „boljši od najboljših“.** Načrt obstaja (`issue-21-implementation-plan.md`, faze A–G), teste imamo (4.462 zelenih), odprta vrzeli (detekcija prihoda, stale GPS, aktivna postaja) so točno tiste, ki najboljšim manjkajo. V #21 vpletimo delte D1–D3. Potem #22 (prazna kategorija) in #23 (nadomesti fragmentirane uradne vodnike). #20 ostane na zunanji odvisnosti (Stripe/Viator/affiliate).

**Vir: ta dokument + `issue-21-implementation-plan.md` skupaj tvorita popoln vhodni paket za AI-agenta, ki bo izvajal #21.**
