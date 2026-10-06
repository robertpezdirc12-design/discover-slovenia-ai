# ISSUE #21 — LIVE TRIP NAVIGATOR
# Podroben implementacijski načrt (arhitekturna odločitev + fazni načrt A–G)

> **Vhod za AI agenta.** Temelji na preverjeni kodi HEAD `1.158.1` (commit `0cde09c`),
> ne na predpostavkah. Vsako trditev o obstoječi kodi v tem dokumentu je bila
> preverjena z branjem dejanskega vira (`src/lib/journey/` — 19 modulov, 4.497 vrstic).
> Bazna linija: **4.462 testov zelenih, lint 0, tsc 0.**

---

## DEL 1 — ARCHITECTURE DECISION (obvezen odgovor na §23, točke 1–10)

### 1. Kateri je kanonični model cilja?

**`JourneyProduct`** (`src/lib/journey/types.ts`) ostaja kanonični *izdelek/ponudnik* model.
**`TripEntry`** (`src/lib/journey/trip-view.ts`, izvoz `buildMyTrip`) ostaja kanonični
*vnos poti* v Moji poti.

**Novo:** uvedemo **`LiveStop`** — vendar NE kot tretji vzporedni podatkovni model, ampak
kot **čisto projekcijo (derived view model)**: `TripEntry` + geo pogodba + rezervacijski
kontekst + travel status. `LiveStop` se nikoli ne persistira samostojno — vedno se
izračuna iz (shranjena pot + progress + sedaj).

Kanonična resolucija geo podatkov: **ena sama funkcija** `resolveStopGeo(product/entry) → StopGeo`
(novo, faza B). Vsa mesta, ki danes berejo koordinate neposredno (mapa, planner, My Trip,
Go Mode), gredo čeznjo. To je odgovor tudi na §19 (konsistenca podatkov).

**Ključno dejstvo iz #20:** v produkciji ima 0/20 objavljenih zapisov popravljene
koordinate prek lastne tržnice; geo podatki zunanjih ponudnikov so nezanesljivi.
→ Geo pogodba MORA biti **fail-closed**: brez veljavnih koordinat ni navigacijskega
cilja, ne pa približnih izmišljenih.

### 2. Kje živi trenutni GPS?

V React hooku **`useGeolocation()`** (`src/lib/journey/use-geolocation.ts`, 106 vrstic,
TASK 64). Živi SAMO na klientu: `position` v `useState`, nikoli v localStorage, nikoli
na strežniku. `GeoStatus = idle|requesting|active|denied|unavailable|error`.

**Odločitev:** GPS ostane izključno v tem hooku — isto datoteko **nadgradimo** (v2),
ne delamo vzporednega hooka. Manjka (potrjeno s pregledom kode):
- zaznavanje zastarele pozicije (`stale`) — `timestamp` se shranjuje, a ne primerja z `now`;
- klasifikacija natančnosti (`accuracyM` se zajame, a se ne razvrsti high/medium/low);
- izguba signala medtem, ko je watch odprt (watch ostane "active" brez novih fiksov).

### 3. Kje živi active stop?

**V novem čistem modulu `src/lib/journey/live-stop.ts`** (pure funkcija, brez Reacta,
brez I/O, deterministična):

```ts
selectLiveStops(input: {
  trip: MyTripView | ItineraryGoView;   // obstoječi kanonični pogled
  progress: TravelProgress;              // V3 (faza B) — persisted
  now: Date;
  manualDayKey?: string | null;          // obstoječi ročni izbor dneva ostane
}): { current: LiveStop | null; next: LiveStop | null; later: LiveStop[] }
```

**Active stop se NE persistira** — je izpeljano stanje, izračunano ob vsakem renderju
iz (pot + progress + ura). To avtomatsko reši refresh/reopen in spremembo dneva.
Persistira se SAMO per-stop travel status (glej točko 6).

### 4. Kdo določa next stop?

**Isto deterministično jedro** `live-stop.ts` — pravila, po prioriteti:
1. izpusti postanke s statusom `completed` / `skipped`;
2. znotraj ročno izbranega dneva (kjer UX to že dovoljuje) ali tekočega dneva;
3. uredi po (day, startTime | orderIndex);
4. prvi neopravljeni = `current`, drugi = `next`, ostali = `later`.

Brez AI, brez LLM klica, brez strežnika — enaki vhodi vedno dajo enak izhod
(reproducibilnost, testibilnost). To je v skladu z obstoječim pristopom: jedro
potovanja (`orchestrator.ts` 789 vrstic) je že danes deterministično.

### 5. Kdo določa arrival?

**Nov čist modul `src/lib/journey/arrival.ts`:**

```ts
evaluateArrival(input: {
  position: GoPosition;           // obstoječi tip iz go-view.ts
  stopGeo: StopGeo;               // faza B — z geoPrecision
  previous: ArrivalState;         // za hysteresis
  config: ArrivalConfig;          // izvožene konstante (testabilno)
}): ArrivalState  // approaching | near_destination | arrived | uncertain
```

Pravila (konfigurabilna konstanta, ne čarovnija):
- **radij prihoda** = `baseRadius(150 m) + accuracyBuffer(0.5 × accuracyM)`,
  povečan za velika območja, kadar je `geoPrecision = approximate`
  (npr. ×2 do 300 m + buffer);
- **hysteresis:** `arrived` zahteva N zaporednih fiksov (privzeto 2) znotraj radija
  ALI min. bivanje 30 s; izhod iz `arrived` zahteva odhod izven radija × 1.5 —
  brez utripanja ob GPS šumu;
- **uncertain:** kadar je `accuracyM > 500 m` ali je pozicija stale → NE prikažemo
  "prišel si", ampak iskreno negotovost (§6/§7 issue-ja);
- geoPrecision `missing`/`invalid` → arrival NIKOLI ni mogoč (fail-closed).

Klicalca: Go Mode komponenta (na vsakem GPS fiksnu). **Arrival piše SAMO v travel
state — nikoli v reservation state** (invarianta, testirano v fazi D).

### 6. Kako sta ločena reservation state in travel state?

**Dva popolnoma ločena tipa univerzuma, ki se nikjer ne prekrivata:**

| | Reservation state | Travel state |
|---|---|---|
| Tip | `ConfirmationStatus` (booking.ts, 14 stanj, `ALLOWED_TRANSITIONS` tabelarna, EXTERNAL absorbcijsko) | NOVO `TravelStatus = "upcoming" \| "active" \| "navigating" \| "near_destination" \| "arrived" \| "completed" \| "skipped"` |
| Živi v | booking lifecycle / server-side tok | `dai:go-progress` V3 (localStorage, klient) |
| Kdo spreminja | samo booking lifecycle (fail-closed, iz #20) | uporabnik (Začni/Potrdi zaključek/Skip) + deterministic engine (active/navigating/near) |
| GPS vpliv | **NIČEN** — GPS ne more spremeniti rezervacije | edini lastnik arrival detekcije |

**Invarianta (obvezen unit test):** nobena funkcija v novi kodi ne sme sprejemati
`ArrivalState`/`GoPosition` in vračati/spreminjati `ConfirmationStatus`.
Primer iz issue-ja: `Reservation = CONFIRMED` + `Travel = ARRIVED` sta dve ločeni
resnici in obe lahko sočasno obstajata.

### 7. Kaj se zgodi offline?

Obstoječa kultura iskrenosti (go-view.ts: "razdalja/smer PREPROSTO NI [znana]" brez GPS)
se razširi v **matrico zmogljivosti** (faza F), osnovano na dejanski kodi:

| Funkcija | Internet | GPS | Deluje offline? |
|---|---|---|---|
| Ogled shranjene poti | ✗ | ✗ | **DA** (localStorage `dai:go-trip`) |
| GPS pozicija + natančnost | ✗ | ✓ | **DA** (naprava) |
| Razdalja/smer (haversine premica) | ✗ | ✓ | **DA** (čista matematika, go-view.ts) |
| Arrival detekcija | ✗ | ✓ | **DA** (čista matematika, arrival.ts) |
| External navigacijski handoff | delno | ✗ | `geo:` URI **DA** (sistemsko); web nav povezava NE |
| OSRM vozna razdalja/ETA | ✓ | ✓ | NE → izrecno označena hevristična ocena (obstoječe vedenje ohranjeno) |
| Vreme (go-weather.ts) | ✓ | ✗ | NE → skrij/označi |
| Booking/provider status | ✓ | ✗ | NE → zadnje znano + iskrena oznava "ni na voljo" |

### 8. Kaj ostane na napravi?

- `dai:go-trip` — referenca na pot (V1 journey / V2 itinerary+shareId) — **nespremenjeno**;
- `dai:go-progress` — **nadgradnja na V3**: iz `GoDoneMap = Record<string,string>`
  (danes: ključ → timestamp) v strukturiran `TravelProgress` (per-stop status + timestamps);
  ohrani se max-200-ključev guard iz obstoječe kode;
- **GPS zgodovina: NE shranjujemo nikoli** — pozicija živi samo v pomnilniku seje
  (obstoječe pravilo, zapisano v glavi use-geolocation.ts, se ohrani);
- analytics: brez koordinat (faza F — revizija z `rg`, da noben analytics klic ne nosi
  position objekta);
- shared-trip handoff: posredujejo se SAMO ciljne koordinate (ne uporabnikove).

**Invarianta:** `go-persist.ts` tipovno zavrača `GoPosition` (test: saveGoProgress
ne sprejme objekta z lat/lng).

### 9. Kako se Go Mode obnovi po refresh/reopen?

Obstoječi mehanizem ostane: `loadGoTrip()` + `loadGoProgress()` ob mountu.
V3 doda: travel statusi se obnovijo; **active stop se NE obnavlja iz pomnilnika,
ampak se deterministično preračuna** iz (pot + progress + now) — zato refresh,
sprememba dneva, sprememba shared trip ali zamaknjjen tab nikoli ne pustijo
zastarelega "current" cilja. GPS se po refreshu NE vklopi samodejno — uporabnik
znova pritisne gumb (permission prompt samo na uporabnikovo dejanje; obstoječe
vedenje, pravilno).

### 10. Kako se prepreči divergentno stanje med My Trip in Go Mode?

Z istim vzorcem, ki ga projekt že uporablja v **`selection-mirror.ts`**
(`reconcileSelectionFromCollection` — en sam vir resnice + rekonsilijacija):

- **Moja pot = kanonični kontekst** (shranjena pot v `dai:go-trip` referenci);
- **Go Mode = živi izvajalni projekciji** — nikoli ne hrani lastne kopije imen/časov/geo;
- vsak prikaz imena, časa, koordinat, booking statusa v Go Mode gre čez
  `buildGoView()`/`buildItineraryGoView()` + novo `resolveStopGeo()` — ne more
  izračunati svojih podatkov;
- **konsistenčni invariantni test:** isti cilj, brskan prek (mapa → planner → My Trip →
  Go Mode → saved trip), mora imeti iste ID/ime/čas/koordinate/source — en test,
  ki gra vse poglede iz istih vhodov in primerja (faza F).

---

## DEL 2 — FAZNI IMPLEMENTACIJSKI NAČRT (A–G)

Vsaka faza se zaključi z: testi zeleni + `bun run lint` + `tsc` čist + delovni commit.
Vrstni red je obvezen (odvisnosti). Ocene so "agent-dni" (fokusiran AI agent).

---

### FAZA A — Architecture map + ADR (0,5–1 dan) — §22.4
**Cilj:** dokumentirati obstoječi tok, preden se kaj spremeni.

- A1: Preberi in izdelaj `docs/ARCHITECTURE-LIVE-TRIP.md`: zemljevid modulov
  (19 journey modulov + njihovi odnosi), tok podatkov
  izbira → `dai:go-trip` → `buildGoView()` → go-mode.tsx, in DEL 1 tega dokumenta
  (10 odgovorov) kot ADR z utemeljitvami.
- A2: Pripravi bazne teste-netže: potrdi 4.462 zelenih, posneti `go-mode.tsx`
  (1.279 vrstic — monolit, glej tveganja) funkcionalno popis (checklist za ZERO
  FEATURE LOSS v fazi E).

**Izhod:** ADR dokument + functional checklist obstoječega Go Mode UX.

---

### FAZA B — Kanonični tipi + geo pogodba + persistanca V3 (2–3 dnevi) — §3, §4, §13

- **B1 `src/lib/journey/live-trip-types.ts`** (nova datoteka, da types.ts ostane
  stabilna): `TravelStatus`, `GeoPrecision = "exact" | "approximate" | "missing" | "invalid"`,
  `StopGeo { lat; lng; canonicalAddress?; source; sourceId?; precision }`,
  `TravelProgressV3`, `LiveStop` (projekcija).
- **B2 `src/lib/journey/resolve-stop-geo.ts`:** validacija koordinat (razpon
  ±90/±180, ne-NaN, ne-0/0 sredi oceana guard), klasifikacija precision, enojni
  vir resolucije. Fail-closed: `missing`/`invalid` → brez navigacije (§4).
- **B3 `go-persist.ts` nadgradnja:** V3 struktura progressa + migracija V1/V2→V3
  (kronološko: V1 journey → V2 itinerary sta že ločena zapisa; GoDoneMap
  string-vrednosti se preslikajo v `completed` + ohranjen timestamp).
  Ohrani max-200 guard. Dodaj `saveGoTravelStatus(key, status, at)`.
- **B4 testi:** geo validacija (pozitivni/negativni/robni primeri), persistanca
  roundtrip, migracija starih zapisov, **invarianta: persistanca zavrača GoPosition**.

**Izhod:** tipovna osnova, brez spremembe UX. Suite raste za ~40–60 testov.

---

### FAZA C — GPS upgrade (1–2 dnevi) — §6

- **C1 `use-geolocation.ts` v2** (ista datoteka, isto ime hooka — nikoli vzporedni hook):
  - `stale` detekcija: `now - timestamp > STALE_MS (privzeto 60 s)` → status
    ostane `active`, pozicija dobi `stale: true` (ločeno od statusa, ker je
    pozicija še vedno uporabna za kontekst, a ne za arrival);
  - klasifikacija natančnosti: `accuracyClass = high (<50 m) | medium (50–200) | low (>200)`;
  - napaka med vožnjo watcha (timeout po fiksaciji) → `error` s ponudbo ponovnega
    starta (obstoječe vedenje: error zapre watch — ohrani, a dodaj recovery path);
  - čiščenje watcherja ob unmount — ŽE obstaja (useEffect cleanup) — ohrani;
  - `maximumAge: 30_000` obstaja — dodaj izrecno `isStale(position, now)` izvoženo
    čisto funkcijo (testabilno brez DOM).
- **C2 testi** z mockanim `navigator.geolocation` (jsdom pattern, ki ga projekt
  že uporablja v task64 testih — sledi obstoječemu mock pristopu).

**Izhod:** GPS hook pokriva vseh 9 zahtev iz §6 issue-ja.

---

### FAZA D — Active stop engine + arrival detekcija (3–4 dnevi) — §5, §7, §12 — **jedro**

- **D1 `live-stop.ts`:** `selectLiveStops()` (spec iz DEL 1/3–4) + integracija
  ročnega izbira dneva (obstoječi UX ostane; manualDayKey samo zoža množico).
  Determinizem: isti vhodi → izhod; brez `Date.now()` znotraj (ura je parameter).
- **D2 `arrival.ts`:** `evaluateArrival()` s hysteresis stateom (spec DEL 1/5) +
  `ArrivalConfig` izvožene konstante. Čiste funkcije — ploljno testabilno.
- **D3 razširitev `go-view.ts`:** `GoView` dobi polja `activeStop`, `arrivalState`,
  `nextAfterCurrent` — obstoječa polja (dnevni/prihodnji postanki, opravljanje,
  vreme, avdio kontekst) ostanejo NEOHKRJENA (zero feature loss).
  `buildGoView()` dobi nov opcionalni parameter (arrival rezultat) — nazavidno
  združljivo (default = brez arrival, obstoječi testi ostanejo zeleni).
- **D4 testi (unit):**
  - state machine: vse tranzicije TravelStatus (vključno skip → vrnitev na prejšnji);
  - hysteresis: simulirana sekvenca fiksov (v/iz/v/iz) → ni utripanja;
  - natančnost: low accuracy → `uncertain`, ne `arrived`;
  - stale pozicija → arrival PADE na `uncertain`;
  - next-stop izbira: sprememba dneva, preskočen postanek, vrnitev nazaj,
    prazen dan, rezervacija CANCELLED (rezervacija vpliva SAMO na prikaz, ne na
    vrstni red — razloči v testu);
  - **invarianta rezervacija≠travel:** evaluateArrival izhod ne more spremeniti
    ConfirmationStatus (tipovni test + runtime test).

**Izhod:** celotno jedro deluje, še brez novega UX.

---

### FAZA E — Go Mode UX: ZDAJ hierarhija (3–4 dnevi) — §10, §11, §12, §17

**Pozor:** `go-mode.tsx` ima 1.279 vrstic — monolit. Refaktoriranje je tukaj
največje tveganje regresije. Strategija:
1. NE spreminjaj obstoječih sekcij (dnevni/prihodnji postanki, vreme, avdio) —
   le dodaj/plasiraj novo ZDAJ sekcijo na vrh;
2. novo logiko v podkomponente (`go-mode/live-now.tsx`, `go-mode/arrival-banner.tsx`)
   z lastnimi testi, go-mode.tsx jih samo sestavi;
3. A2 checklist iz faze A je merilo zero feature loss.

- **E1 ZDAJ sekcija** (telefonsko usmerjena hierarhija iz §10):
  `ZDAJ` (kaj se dogaja) → `NASLEDNJE` (en aktiven cilj z imenom/časom/rezervacijskim
  statusom/ponudnikom) → **NAVIGIRAJ** (velik primarni gumb ≥ 48 px, obstoječi
  `goNavLinks`/`pickGoNavHref` handoff — ne izumljaj turn-by-turn) → `PRIHAJAŠ`
  (razdalja + smer + ETA SAMO kadar je dejansko znan: haversine premica je
  izrecno označena kot premica; OSRM ETA le kadar je route source dejaven) →
  `PRIŠEL SI` (ko je arrival state izpolnjen: "✓ Prišel si na lokacijo X") →
  `NASLEDNJE PO TEM` (naslednji cilj po current).
- **E2 arrival → zaključek:** `arrived` prikaže potrditveni CTA "Zaključi postanek"
  (§25.D — uporabnik izrecno potrdi; GPS SAMO ne zaključi). Ob potrditvi:
  `✓ Apartma zaključen → 🍽 Naslednje: Restavracija X → danes 19:30 → NAVIGIRAJ`
  (§12) — samodejna progresija brez vračanja v planer.
- **E3 rezervacijski kontekst na postanku** (§11): naziv, datum/čas, rezervacijski
  status (iz ConfirmationStatus — obstoječe oznake), ponudnik, lokacija, kontakt
  kjer legitimno, zunanja povezava kjer je ponudnik kanonični vir, travel status.
  EXTERNAL rezervacije: provider ostaje kanonični vir (obstoječe pravilo booking.ts).
- **E4 a11y:** `aria-live="polite"` za razdaljo/prihod objave, touch targeti ≥ 44 px,
  tipkovnična dostopnost NAVIGIRAJ/Potrdi/Skip, honest stanja GPS denied/stale z
  jasnimi ukrebi ("Dovoli dostop do lokacije v nastavitvah brskalnika").
- **E5 testi:** komponentni testi (obstoeči bun test pattern) za: ZDAJ sekcija
  z/ber GPS, arrival banner, progresija, denied/stale stanja; snapshot/checklist
  primerjava z A2 (zero feature loss).

**Izhod:** nov UX na /na-poti, obstoječe funkcionalnosti nedotaknjene.

---

### FAZA F — Offline matrika + zasebnost + konsistenca (1–2 dnevi) — §15, §16, §19

- **F1 `docs/OFFLINE-CAPABILITY-MATRIX.md`:** matrika iz DEL 1/7, vsaka vrstica
  z sklicom na dejansko kodo (datoteka:vrstica) — ne generične obljube.
- **F2 zasebnostni revizija (§16):** `rg` pregled vseh analytics klicev — dokaz,
  da niti eden ne nosi `GoPosition`/lat/lng; pregled provider handoffa (grants
  minimalne parametre); shared-trip vedenje; rezultat v
  `docs/PRIVACY-GPS-AUDIT.md` s seznamom preverjenih mest.
- **F3 konsistenčni test:** za vzorce ciljev (z exact/approximate/missing geo;
  z booked/external/sanz booking) graj poglede mapa→planner→MyTrip→GoMode→saved
  in primerjaj ID/ime/čas/geo/source — en test, ki izvaja §19.

**Izhod:** trije dokumenti + test dokaza.

---

### FAZA G — Regresija + produkcijski dokazi + status (1–2 dnevi) — §20, §21, §27

- **G1 regresija:** celoten suite (pričakujemo 4.462 + ~150–200 novih), lint, tsc;
  obstoječi task64/task65/task8-f2b/task91 testi MORAJO ostati zeleni (to je
  zero-feature-loss dokaz).
- **G2 produkcijski dokazi** (vzorec iz #20 — agent-browser na produkciji,
  PNG/video v `docs/evidence/issue21/`):
  - realen GPS flow na mobilnem brskalniku (ali pošteno dokumentirana omejitev
    sandboxa + emulator/devtools location);
  - realen navigation handoff (geo: URI / web nav);
  - active stop pravilnost na shranjeni poti;
  - arrival → potrditev → progresija na naslednji postanek;
  - booking status ločenost (CONFIRMED + ARRIVED sočasno vidna).
- **G3 statusna dokumentacija:** `docs/LIVE-TRIP-STATUS.md` po šabloni
  CURRENT STATE → IMPLEMENTATION → TEST → PRODUCTION EVIDENCE → FINAL STATUS
  (kot PRODUCTION-ACTIVATION-STATUS.md iz #20); posodobi README kjer se sklicuje
  na /na-poti zmogljivosti.
- **G4 zaključno poročilo v issue #21 po §27 formatu:**
  IMPLEMENTED / VERIFIED / PRODUCTION VERIFIED / EXTERNAL BLOCKERS / REMAINING /
  ARCHITECTURE DECISIONS / REGRESSION.

**Izhod:** issue #21 zaprljiv (razen eksplicitno označenih zunanjih blockerjev).

---

## DEL 3 — MATRIKA NAPAK (§18 — vseh 20 načinov)

| # | Napaka | Pričakovano vedenje | UI | Test |
|---|---|---|---|---|
| 1 | GPS denied | status `denied`, watch zaprt, načrt viden brez lokacije | iskren banner + ukrepi za ponovni poskus | C2 (mock PERMISSION_DENIED) |
| 2 | GPS unsupported | `unavailable`, brez crasha | načrt brez GPS praga | C2 |
| 3 | GPS timeout/error | watch zaprt (obstoječe) + recovery gumb | napaka + ponovni poskus | C2 |
| 4 | Low accuracy | `accuracyClass=low`, arrival pada na `uncertain` | prikazana natančnost ±X m | D4 |
| 5 | Stale position | `stale:true`, arrival NE velja | oznaka zastarele lokacije | C2+D4 |
| 6 | Uporabnik zunaj trase | razdalja raste, brez lažne "izgube" | razdalja/smer ostanejo iskreni | D4 (sekvenca fiksov) |
| 7 | Cilj brez koordinat | `precision=missing` → brez NAVIGIRAJ, brez arrival | "Lokacija ni znana — navigacija ni na voljo" | B2+D4 |
| 8 | Invalid coordinates | validacija jih zavrne (fail-closed) | kot 7 | B2 |
| 9 | Booking missing | postanek je izbran, a brez rezervacijskega konteksta | prikaz samo travel status | D4 |
| 10 | Booking pending | rezervacijski status prikazan, NE vpliva na vrstni red | oznaka pending | D4 |
| 11 | Booking cancelled | prikazan status, opozorilo pred navigacijo | CANCELLED oznaka | D4 |
| 12 | External nav nedosegljiv | `geo:` URI fallback na coarse pointerju; sicer web link | izrecna oznava | obstoječi task64 testi |
| 13 | Network offline | matrika §7 — jedro deluje | honest banner | F1 (dokaz) |
| 14 | Route provider down | haversine + oznaka "premica/ocena" | obstoječa iskrena oznaka | obstoječi testi |
| 15 | Ročni skip | travel `skipped`, engine nadaljuje z naslednjim | gumb Skip z undo | D4+E5 |
| 16 | Vrnitev na prejšnjega | možna — status se lahko vrne (tranzicije dovoljene) | gumb na kasnejšem dnevu | D4 |
| 17 | Refresh/reopen | vse iz persistanc + preračun active stop | nemoten nadaljevanje | B3+E5 |
| 18 | Tab suspension | po budenju: stale detekcija zazna zamudo | iskrena oznaka | C2 |
| 19 | Sprememba dneva | `now` parameter → nov current (brez persistanca) | samodejna progresija | D4 |
| 20 | Sprememba shared trip | `dai:go-trip` referenca se uskladi (obstoječi V2 shareId tok) | usklajen pogled | B3 |

---

## DEL 4 — INVARIANTE (vsaka prisiljena z testom)

1. **GPS/arrival NIKOLI ne spremeni `ConfirmationStatus`** (tipovno + runtime).
2. **GPS zgodovina se ne persistira** — `dai:go-*` tipovno zavrača `GoPosition`.
3. **Nobena izmišljena koordinata** — fail-closed geo resolucija (B2).
4. **Hevristika nikoli kot dejanska navigacija** — premica/ocena vedno označeni.
5. **Determinizem jedra** — `selectLiveStops` brez skritega stanja/ure.
6. **Zero feature loss** — vsi obstoječi GoView tripi testi ostanejo zeleni.
7. **EXERNAL ≠ CONFIRMED** — ohranjeno iz booking.ts (obstoječi testi).

---

## DEL 5 — ZEMLJEVID DOSEŽKOV (§24 → faze)

| §24 zahtevek | Faza |
|---|---|
| kanonični Live Trip state model | B1 |
| geo validation/resolution | B2 |
| active/next stop engine | D1 |
| robusten GPS lifecycle | C1 |
| arrival/near-destination engine | D2 |
| navigation orchestration | E1 (obstoječi go-nav handoff v novo hierarhijo) |
| booking ↔ travel integracija | D4+E3 |
| automatic next-stop progression | E2 |
| My Trip ↔ Go Mode konsistenca | B3+F3 |
| offline capability matrix | F1 |
| privacy/security evidence | F2 |
| accessibility QA | E4 |
| unit+integration+negative testi | B4/C2/D4/E5 |
| production evidence | G2 |
| arhitekturna dokumentacija | A1 |
| statusna dokumentacija | G3 |

---

## DEL 6 — TVEGANJA IN OCENA

| Tveganje | Verjetnost | Ublažitev |
|---|---|---|
| Regresija monolita go-mode.tsx (1.279 vrstic) | visoka | strategija E (dodajanje, ne predelava; podkomponente; A2 checklist) |
| Lažni arrival v mestnem kanjonu / slaba natančnost | srednja | hysteresis + accuracy buffer + `uncertain` stanje (D2) |
| GPS testiranje v jsdom | srednja | obstoječi mock pattern task64; čista funkcija `isStale` brez DOM |
| iOS Safari permission quirks | srednja | honest stanja + recovery pot; produkcijski dokaz na realni napravi (G2) |
| Geolokacijski podatki ponudnikov slabih (0/20 v produkciji iz #20) | visoka | fail-closed B2; lastna tržnica prva vir exact koordinat |

**Skupna ocena:** 12–18 agent-dni. Vrstni red A→G obvezen; znotraj B in C je
paralelizacija mogoča (B1/B2 pred B3; C neodvisen od B3).

---

## DEL 7 — PRAVILA ZA AGENTA (kratek povzetek §22, prilagojeno temu načrtu)

1. Pred vsako fazo preberi trenuten HEAD — ta načrt velja za `1.158.1`; novejši
   commiti lahko spremenijo dejstva (npr. napredek na #20).
2. Ne podvajaj: useGeolocation, goNavLinks, buildGoView, GoDoneMap, booking
   lifecycle, selection-mirror — vse nadgrajuj, ne ustvarjaj vzporednega.
3. Vsaka faza = commit + testi + lint + tsc; brez "bom popravil kasneje".
4. Ob vsakem zunanjem blockerju (npr. ni realne GPS naprave v CI) dokončaj
   tehnični del in blocker eksplicitno zabeleži v statusnem dokumentu.
5. Spodnja meja kvalitete: bazna linija 4.462 testov ostane ZELENA ves čas.

---

*Konec načrta. Pripravljeno kot neposreden vhod za AI agenta, ki izvaja issue #21
v repozitoriju markec12345678/Discover-Slovenia-AI.*
