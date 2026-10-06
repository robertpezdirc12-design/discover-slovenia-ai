# ISSUE #22 — TRAVEL GUARDIAN & DYNAMIC TRIP INTELLIGENCE
# Podroben implementacijski načrt (raziskava + arhitektura + faze B–G)

> **Vhod za AI agenta.** Temelji na preverjeni kodi HEAD `1.161.1` (commit `f64e1ba`).
> Vsaka trditev o obstoječi kodi je preverjena z branjem vira (`src/lib/journey/` 23
> modulov, go-mode.tsx 1.699 vrstic). Bazna linija: **4.608 testov zelenih** (+1 znana
> sandbox DB napaka issue7-g11 ④), **lint 0, tsc 0.**

---

## DEL 1 — RAZISKAVA (obvezni odgovori §25 — preverjeno na dejanski kodi)

### 1. Kako Issue #21 določa active in next stop?

`buildGoView()` (`go-view.ts`): prvi NE-opravljeni in NE-preskočeni postanek aktivnega
dneva (vrstni red načrta) = `view.next`; ostali = `remaining`. Aktivni dan izbere
`pickActiveDay()` (danes → prvi prihodnji → zadnji pretekli → dan 1) oz. `dayOverride`
(§16). Travel status: `resolveTravelStatus()` + `classifyArrival()` (`travel-state.ts`,
hystereza + stabilnost + stale guard). **#22 nadgrjuje to jedro, ne podvaja.**

### 2. Kako se trenutno izračunava ETA?

SAMO v `go-mode.tsx` `etaInfo`: `heuristicLeg()` — premica ×1,3 pri 55 km/h iz GPS do
naslednjega postanka, kadar obstajata GPS + geo; sicer izrecno `unknown`. Ni OSRM
routinga od žive pozicije (produkcija na Renderu: osm adapter celo odstopa —
"Lokalni vir nedosegljiv", hevristika je zato KANON odžive-pozicije).

### 3. Kateri route source je kanoničen?

DVA, jasno ločena (isti kanon kot LegChip):
- **`legFromPrev: { km, min, source: "osrm"|"heuristic" }`** — noga MED zaporednima
  postankoma NAČRTA (izračunana ob načrtovanju, shranjena v MyTripView);
- **`heuristicLeg()`** (premica ×1,3 / 55 km/h) — ocena od žive GPS pozicije,
  vedno izrecno labelirana kot ocena.
Ni tretjega vira; Guardian ne sme izumiti tretjega.

### 4. Katere reservation time semantike dejansko podpiramo?

`TripEntry.time = { start: "HH:MM"; end? }` — SAMO realni viri (uporabnikov vpis ure
prihoda, trajanje transferja iz vira, čas dogodka). Vsak drug vnos časa NI (in
`timeNote` pove zakaj). Torej podprte semantike:
- **fixed start** (`time.start` obstaja) = trd termin (prihod/transfer/dogodek z uro);
- **flexible/all-day** (`time` manjka) — hotelske/restavracijske/znamenitostne kartice
  (večina dneva!), `timeNote` razloži.
Ni check-in window semantike in ni time-range semantike — NE izmišljujeva jih;
Guardian obravnava SAMO `time.start` kot termin, vse ostalo je flexible.

### 5. Kako so shranjeni opening hours?

`TripEntry.openingHours` — surov niz OSM/Listing vira. **Parser OBSTAJA**:
`src/lib/opening-hours.ts` (409 vrstic): `parseOpeningHours()` → ParsedHours,
`openingStatusAt(raw, moment)` in `openingStatusNow()` → `OPEN|CLOSED|UNKNOWN` +
detail. UI žeton: `OpeningHoursStatus` (useSyncExternalStore, 10-min snapshot).
→ Opening-hours konflikt je DEJANSKO izračunljiv za prihodnji čas (openingStatusAt).

### 6. Kateri nearby source je varen in dejansko dosegljiv?

- **`/api/map/pins?bbox=south,west,north,east&cats=…`** — strežniški POI vir
  (940 markerjev v produkciji), lastni + OSM/FSQ viri, deluje z geo-kategorijami;
- **`go-audio.ts nearbyDestinations()`** — deterministični paket destinacij
  (klient, offline, radij 100 km, max 4) — SAMO za glasovno pripoved;
- **`/api/pois`** — kategorija + limit (sekundarni).
Za Smart Free-Time je kanoničen **/api/map/pins z bbox okoli GPS** (najmanjši radij,
ki da smiseln rezultat) + ČISTI klientni filter (razdalja/čas/ure/kompatibilnost).
Offline → predlogov preprosto NI (iskrena odsotnost, enak kanon kot vreme).

### 7. Kaj lahko deluje offline?

Načrt (`dai:go-trip`), GPS + razdalja/smer (haversine), arrival detekcija,
travel state + done/skipped (`dai:go-progress`, `dai:go-skipped`), shema dneva
(day-line), opening status (parser je čist), **NOVI Guardian izračuni (čisti)**.
NE: OSRM refresh, vreme (/api/weather), booking overlay (/api/journey/bookings),
map pins (nearby predlogi), shranjena pot (/pot/{shareId} odpre).

### 8. Kaj deluje samo ob odprti strani?

VSE živo stanje (GPS watch, ura 30 s tick, wake lock, Guardian ocene) — greje
zgolj v odprtem zavihku /na-poti. Background execution / push NOT ne obstaja
in ga issue §16 prepoveduje brez lifecycle modela → DOKUMENTIRANO kot meja
(`docs/LIVE-TRIP-NAVIGATOR.md` obstaja; Guardian dodaja svojo matriko).

### 9. Kako se state obnovi po refresh/reopen?

Obstoječe: `loadGoTrip()` + `loadGoProgress()` + `loadGoSkipped()` ob mountu;
active stop se preračuna (NI persistiran); arrival kontekst se začne na novo
(ref, ne disk). Guardian sledi ISTEMU vzorcu: health/rezerva/konflikti so
PROJEKCIJA (pot + progress + ura + GPS) — 0 nove persistance, razen če issue
izrecno zahteva (ne zahteva).

### 10. Kje so realni production blockerji?

- Vercel deploy (kvota API-deployments 100/100 do 2026-10-02 17:39 UTC; GitHub App
  ni nameščena — priporočilo že v dokazih #21); Render avtomatsko gradi — primarni
  produkcijski dokazi gredo na Render.
- 0 API_BOOKING ponudnikov (0 poverilnic) → rezervacijski statusi ostajajo
  EXTERNAL/odstotni; Guardian mora to iskreno odraziti (DATA LIMITATIONS).
- osm adapter na Renderu občasno odstopa → hevristika je kanon od žive pozicije.

---

## DEL 2 — ARHITEKTURNE ODLOČITVE (skladne z #21 ADR)

1. **Guardian je ČISTA projekcijska plast** — novi moduli v `src/lib/journey/`:
   `trip-health.ts`, `time-reserve.ts`, `conflict-detect.ts`, `free-time.ts`,
   `recovery.ts`, `day-start.ts`. 0 omrežja, 0 db, 0 localStorage, 0 AI.
   Determinizem: `now` je VEDNO parameter; isti vhodi → isti izhodi.
2. **Ne podvajaj**: `buildGoView`, `resolveStopGeo`, `classifyArrival`,
   `heuristicLeg`, `openingStatusAt`, `goNavLinks`, `bookingBadgeOf`, done/skipped
   persistanca — Guardian jih pokliče, ne reimplementira.
3. **AI ni vir resnice** (§3): Guardian izpisuje SAMO iz dejstev; DataQuality
   (VERIFIED/ESTIMATED/UNKNOWN/STALE/MISSING §18) na vsakem pomembnem rezultatu.
4. **Reservation ≠ travel** ostaja (invarianta #21): Guardian NIKOLI ne spreminja
   ConfirmationStatus; CANCELLED rezervacija vpliva SAMO na prikaz/predlog akcije.
5. **Ne pozitivni status brez podatkov** (§4): ON_TRACK zahteva DEJANSKO podprto
   oceno; nezanesljivi vhodi (stale GPS, missing geo, unknown duration) → UNKNOWN.
6. **Free-time safety reserve** (§10): konfigurabilna konstanta (privzeto 15 min +
   10 % okna), nikoli ne porabimo celotnega okna; neznan route time → UNKNOWN
   oz. skrajšano okno z izrecno oznako.
7. **UX: ONE DECISION AT A TIME** (§21): en Guardian banner na vrhu Go Mode
   (🟢/🟠/⚪ z eno vrstico dejstev), konflikt kartica s 2–3 akcijami, free-time
   sekvenca šele ko DEJANSKO obstaja okno. Novo gradnjo v podkomponente
   `go-mode/guardian-*.tsx` (strategija E iz #21: dodajanje, ne predelava).
8. **Vstopne točke** (§30/§31): `/moja-potovanja` kartice dobijo "Nadaljuj na poti"
   (reusable vzorec shared-trip: saveItineraryGoTrip + push /na-poti);
   Go Mode dobi ZAČNI DAN povzetek, kadar jutro + nič opravljenih + GPS idle;
   homepage/My Trip potreb ne dotikava (že križajo NAČRTUJ → REZERVIRAJ → ZAČNI
   prek planner CTA; dodamo samo manjkajoči člen moja-potovanja → na-poti).
9. **Nearby dodajanje v pot**: SAMO za v2 zapise (AI itinerer) — kandidat iz
   /api/map/pins se doda kot nov TripEntry na konec aktivnega dneva
   (saveItineraryGoTrip, obstoječa persistanca). V1 zapisi (journey): iskrena
   opomba + povezava na /zemljevid (ne mutiramo kanonske strukture).

---

## DEL 3 — FAZNI NAČRT (B–G; A = ta dokument)

### FAZA B — Jedro Guardiana: trip health + time reserve + conflict detection
- **B1 `time-reserve.ts`**: `evaluateTimeReserve({ next, now, position })` →
  `{ eta?: { hhmm; min; km; quality: ESTIMATED (hevristika) } , reserveMin?, status:
  ON_TIME|TIGHT|LATE|UNKNOWN, terminal: "fixed_start"|"flexible", quality }`.
  SAMO fixed_start termini imajo rezervo; flexible → terminal brez rezerve
  (iskreno). ETA iz `heuristicLeg` (kanon od žive pozicije, vedno ESTIMATED).
  Pragi: reserve ≥ 15 → ON_TIME; 0–15 → TIGHT; < 0 → LATE. Bez GPS/geo → UNKNOWN.
- **B2 `conflict-detect.ts`**: `detectConflicts({ view, now, reserve, bookingRows })`
  → seznam `GuardianConflict` s `{ kind, severity, facts, reason, impact,
  actions[] }`. Vrste (§6): AT_RISK_BOOKING (ETA > termin), OVERLAP_FIXED (dva
  time.start istega dne prekrivata z durationMin/leg), TOO_TIGHT_LEG
  (legFromPrev.min + durationMin > razpon), STARTED_BOOKING (time.start preteklost
  + nič done), MISSING_GEO_FOR_PLAN (postanek brez navigabilnega geo),
  UNKNOWN_ROUTE (brez leg in brez GPS), CLOSED_ON_ARRIVAL (openingStatusAt za
  ETA ~ CLOSED). CANCELLED booking → prikazna opomba (ne vrstni red).
- **B3 `trip-health.ts`**: `assessTripHealth({ view, conflicts, reserve })` →
  `ON_TRACK | NEEDS_ATTENTION | BLOCKED | UNKNOWN` + `reason` (strojno izpeljan;
  BLOCKED = ni izvedljivega naslednjega koraka brez posega; UNKNOWN = premalo
  podatkov za sklep). Oznake: 🟢/🟠/🔴/⚪ (§30.E uporabniška imena!).
- **B4 testi**: rezerva (pragi, brez GPS, flexible vs fixed), konflikti (vsi
  kinds + negativni), health matrika (podatkovne kombinacije), determinizem,
  invariante (guardian ne spreminja ConfirmationStatus — tipovni test).

### FAZA C — Dynamic Trip Recovery + data quality + day start
- **C1 `recovery.ts`**: `assessRecovery({ view, now, conflicts, position })` →
  `RecoveryPlan | null` (kaj se je spremenilo, prizadeti postanki, kaj ostaja
  veljavno, naslednji izvedljiv cilj, akcije za potrditev: Nadaljuj/Preskoči/
  Preuredi). Sprožilci (§7): zamujen postanek (time.start < now − 30 min, nič
  done, GPS daleč ali brez), preskočena aktivnost (restart predlog ob view.skipped),
  cancelled rezervacija (iz bookingRows — prikaz, brez avtomatske odpovedi),
  GPS odstopanje (razdalja do naslednjega cilja raste čez mejo — SAMO informativno).
- **C2 data-quality klasifikacija** (§18): `dataQualityOf(...)` pomožne na
  reserve/geo/route/booking; oznake VERIFIED (own geo, osrm leg, booking vrstica),
  ESTIMATED (hevristika, approximate geo), UNKNOWN, STALE (stale GPS), MISSING.
- **C3 `day-start.ts`**: `buildDayStartSummary({ view, now })` → št. postankov,
  št. fiksnih terminov, prvi cilj, skupna znana pot (activeDayRoute), opozorila
  (konflikti), manjkajoči podatki (koliko postankov brez geo/ure).
- **C4 testi.**

### FAZA D — Smart Free-Time engine + nearby
- **D1 `free-time.ts`**: `detectFreeTimeWindow({ view, now, position })` →
  okno { startMin, endMin, minutes, quality } SAMO kadar: naslednji fixed termin
  > now + min. okno (30 min) in med postankoma ni vezane aktivnosti; sicer null.
  Safety reserve: `SAFETY_RESERVE_MIN = 15` + 10 % okna — uporabniku ponujamo
  SAMO okno − rezerva. Neznan route time → okno skrajšano za rezervo in označeno.
- **D2 `filterNearbyCandidates()`** (čista): kandidati (map pins) × okno →
  relevantni (haversine km → hevristika min + durationMin ≤ okno − rezerva;
  openingStatusAt(ETA) ≠ CLOSED kjer ure obstajajo; izvzem današnje postanke;
  max 4). Vrni z razlogi (zakaj primeren / zakaj izpadel — za test).
- **D3 integracija `/api/map/pins`** (klient, v Go Mode samo ob odprtem oknu +
  GPS): bbox ~5 km okoli pozicije, kategorije hrana/kava/znamenitost/park;
  fail-closed (napaka → iskrena opomba, neblokirajoče).
- **D4 testi**: okno (z/rezervo, neznan route), filtriranje (vsi pogoji,
  negativni: zaprto ob prihodu, predolgo, premalo časa), dodajanje kandidata
  (v2 record mutacija — nov TripEntry na konec dneva; v1 zavrnitev).

### FAZA E — UX integracija (go-mode.tsx + podkomponente, ZERO FEATURE LOSS)
- **E1 `go-mode/guardian-banner.tsx`**: na vrh (nad NASLEDNJE): 🟢 VSE TEČE PO
  NAČRTU / 🟠 POTREBUJE TVOJO POZORNOST / ⚪ PODATKOV NI DOVOLJ + ena vrstica
  (naslednja rezervacija + predviden prihod + rezerva / razlog). aria-live=polite.
- **E2 rezerva v NASLEDNJE kartici**: "NASLEDNJA REZERVACIJA 18:30 · predviden
  prihod ~18:17 · rezerva 13 min" (SAMO fixed termin; quality oznaka).
- **E3 `go-mode/guardian-conflict.tsx`**: 🟠 kartica s FACTS→REASON→IMPACT +
  akcije [NAVIGIRAJ] [PRESKOČI] [PRILAGODI POT → nazaj na načrt]; CANCELLED
  rezervacija → opozorilo pred navigacijo.
- **E4 `go-mode/guardian-free-time.tsx`**: "Imaš približno X min prostega časa —
  Kaj lahko narediš v bližini?" + [Znamenitosti][Hrana][Kava][Sprehod] + max 4
  kandidati (razdalja/ocena časa/ure) + [Dodaj v mojo pot] (v2) / opomba (v1).
- **E5 `go-mode/guardian-day-start.tsx`**: jutranji povzetek + [ZAČNI DAN]
  (vklopi GPS, usmeri na NASLEDNJE) — SAMO ko: današnji dan, 00:00–11:00 ura,
  0 done, GPS idle, naslednji postanek obstaja.
- **E6 `/moja-potovanja`**: "Nadaljuj na poti" na karticah shranjenih poti
  (saveItineraryGoTrip + /na-poti) — zapre §30.C vrzeli (pot → na-poti člen).
- **E7 a11y + testi**: aria-live, tipkovnica, ≥44px; komponentni testi za vsa
  stanja (ON_TRACK/ATTENTION/UNKNOWN, konflikt, free-time, day-start, v1/v2).

### FAZA F — Dokumentacija + offline matrika + privacy revizija
- **F1 `docs/TRAVEL-GUARDIAN.md`**: arhitektura (nova plast na #21), DEL 1 raziskava,
  matrika zmožnosti (kaj dela offline / samo online / samo ob odprti strani — §16/§17),
  data quality legenda, UX entry point mapa (§30.L FEATURE → ENTRY → ACTION →
  RESULT → EVIDENCE).
- **F2 privacy revizija**: `rg` dokaz, da Guardian/nearby klici ne nosijo GPS
  pozicije naprej (map pins bbox je sicer iz pozicije — bbox je GROBA posplošitev;
  dokumentirano; analytics brez koordinat; ni nove persistance).
- **F3 uskladitev LIVE-TRIP-NAVIGATOR.md / CHANGELOG / README.**

### FAZA G — Regresija + produkcijski dokazi + zaključek
- **G1**: celoten suite zelen (4.608 + ~120–160 novih), lint 0, tsc 0; vsi
  obstoječi #21 testi ostanejo zeleni (zero feature loss).
- **G2 produkcijski dokazi** (agent-browser na Render, mobilni 390px):
  guardian banner ON_TRACK; konflikt NEEDS_ATTENTION (zamujen termin);
  free-time okno + kandidati; day-start; Nadaljuj na poti z moja-potovanja;
  dodajanje nearby kandidata v2; PNG dokazi v `docs/evidence/issue22/`.
- **G3 `docs/TRAVEL-GUARDIAN-STATUS.md`** (CURRENT STATE → IMPLEMENTATION → TEST →
  PRODUCTION EVIDENCE → FINAL STATUS) + §29 finalni komentar na issue #22 + push.

---

## DEL 4 — INVARIANTE (vsaka prisiljena s testom)

1. Guardian je ČIST: nikoli ne kliče omrežja/db/localStorage; `now` je parameter.
2. Guardian NIKOLI ne spremeni ConfirmationStatus (tipovno + runtime).
3. ON_TRACK samo z dejansko podprto oceno; sicer UNKNOWN (ne lažna pozitiva).
4. Free-time NIKOLI ne ponudi celotnega okna (safety reserve vedno odšteta).
5. Nearby predlog ne sme ogroziti naslednjega termina (isto pravilo v testu).
6. Zero feature loss: vsi obstoječi testi (4.608) ostanejo zeleni.
7. Dodajanje nearby SAMO v2 zapis (v1 kanonična pot ostaja nedotaknjena).
8. Vsako opozorje nosi dejanske podatke (facts), razlog (reason) in akcijo.

## DEL 5 — ZEMLJEVID DOSEŽKOV (§26 → faze)

| §26 dostavljivec | Faza |
|---|---|
| Travel Guardian engine + trip health | B1+B3 |
| time reserve engine | B1 |
| conflict detection | B2 |
| Dynamic Trip Recovery + user-controlled UI | C1+E3 |
| Smart Free-Time + nearby + safety | D1–D3+E4 |
| morning/day-start flow | C3+E5 |
| data-quality classification | C2 |
| offline capability matrix | F1 |
| privacy/security review | F2 |
| accessibility review | E7 |
| unit + integration + E2E/negativni | B4/C4/D4/E7 |
| production evidence | G2 |
| architecture documentation | F1 |

**Ocena:** 8–12 agent-dni. Vrstni red B→C→D→E→F→G obvezen (E odvisen od B–D).
