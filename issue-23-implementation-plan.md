# ISSUE #23 — GUIDED PLATFORM EXPERIENCE
# Implementacijski načrt (temelji na reviziji Faze A na HEAD 1.162.4)

> **Vhod za AI agenta.** Tri revizije (23-A-audit-home / 23-A-audit-trip /
> 23-A-audit-infra) so potrdile dejansko stanje. Bazna linija: **4.689 pass
> + 1 znana sandbox DB napaka (issue7-g11 ④)**, lint 0, tsc 0. #21 in #22
> sta zaključena (Go Mode = najbogatejši "next step" motor, a le sredi poti).

---

## DEL 1 — ARHITEKTURNE ODLOČITVE (ADR)

### 1. Kje živi "kaj je naslednji korak"?
V novem čistem modulu **`src/lib/guidance/`** (pure, determinističen, brez
I/O, brez Reacta) — točno po vzoru `trip-health.ts` (dejstva → stanje):
- `types.ts` — `GuidanceState`, `GuidanceAction`, `Guidance`, `GuidanceInput`
- `guide-engine.ts` — `selectGuidance(input): Guidance` (urа je parameter)
- `guidance-snapshot.ts` — klientni bralec: sestavi `GuidanceInput` IZKLJUČNO
  iz kanoničnih virov (`getMyTripItems`, `loadGoTrip/loadGoProgress/loadGoSkipped`,
  `getSavedTrips`, `buildGoView`) — 0 novih virov resnice, 0 podvajanj.

### 2. Stanja (usklajena z #21/#22)
`NEW_USER → DISCOVERING → TRIP_BUILDING → BOOKING_PENDING → TRIP_READY →
TRIP_STARTED → NAVIGATING → ARRIVED → FREE_TIME → NEEDS_ATTENTION →
BLOCKED → RECOVERY → COMPLETED` + `UNKNOWN` (iskrena negotovost, §30).
- Prej-pot: iz myTripCount / savedTripsCount / goTripActive.
- Med-pot: goTripActive + `buildGuardian` health + arrivalContext + konflikti.
- TERMINALNA VRZEL (revizija): zadnji postanek zadnjega dne danes pokaže samo
  "ni več postankov" → nov stanje COMPLETED (povzetek + naslednje akcije).

### 3. Veriga (progress): `DISCOVER(1) → ADD(2) → PLAN(3) → BOOK(4) → GO(5) → FINISH(6)`
Izpeljana iz istih vhodov; prikazana kot indikator korakov (točke) na traku.

### 4. Prioritete (deterministično, §32, preverjeno združljivo z #21/#22):
BLOCKED(100) > NEEDS_ATTENTION(90) > ARRIVED(80) > NAVIGATING(70) >
RECOVERY(60) > FREE_TIME(50) > TRIP_STARTED(40) > TRIP_READY(30) >
BOOKING_PENDING(25) > TRIP_BUILDING(20) > DISCOVERING(10) > NEW_USER(5).
Površina (`surface`) vpliva SAMO na razpoložljivost akcij, nikoli na stanje.

### 5. ENA primarna akcija (pravila, dokumentirana + testirana):
NEW_USER/DISCOVERING→ODKRIJ · TRIP_BUILDING→NAČRTUJ · BOOKING_PENDING→REZERVIRAJ ·
TRIP_READY→ZAŽENI NA POTI (primarna) / REZERVIRAJ (sekundarna; obratno SAMO
kadar ima načrt potrjene termine, ki zahtevajo zaklep — §10) ·
TRIP_STARTED→ODPRI NA POTI · NAVIGATING→#naslednje · ARRIVED→OPRAVI ·
FREE_TIME→PROST ČAS · NEEDS_ATTENTION/BLOCKED→RECOVERY (obstoječi guardian
kartici sta kanonični; trak le usmerja) · COMPLETED→DOKUMENTIRAJ/NOVA POT.
Akcija se izriše SAMO če je dejansko mogoča (npr. NAVIGIRAJ le z veljavnim
geo — fail-closed iz resolveStopGeo; ZAŽENI le s shranjenim načrtom).

### 6. GPS/zasebnost: trak NE bere GPS pozicije (nikoli). Izjema: arrival/
health izpeljki že obstoječih #21/#22 projekcij (go-view/guardian) — ti so
že revizirani (0 analitike s pozicijo). Nova analitika nosi SAMO state/
surface/action ključe (brez imen, brez koordinat, brez teksta).

### 7. Trajanje stanja (dismissable, §7/§33):
- nekritični trak: `sessionStorage dai:guidance-strip:{surface}:{state}` (ponudi
  se znova naslednja seja — progresivno, ne nadležno);
- first-run kartica: `localStorage dsa_first_run_seen` (enkrat za vselej);
- tour način ("Ne vem — pokaži mi"): `localStorage dai:guided-tour` — izklopi
  se samodejno, ko stanje doseže TRIP_STARTED (guidance_completed event);
- pravilo §40.20: zavrnitev traku NE skrije kritičnega stanja — v Go Mode-u
  guardian/konflikt kartice ostanejo (obstoječe, nedotaknjene).

### 8. i18n (iskrena meja, kot v #21/#22):
- 6-jezične površine (domov, hub, planner, add-toast): next-intl ns `guidance`
  v vseh 6 jezikih (parity test to izsili);
- Go Mode (SL/EN L-canon, `/na-poti` izven IT/DE/FR/ES whitelist — obstoječa
  dokumentirana meja): trip-complete po L vzorcu `{sl,en}`.

### 9. Analitika — 8 novih dogodkov, 3-datotečna zaklenjenost (union →
VALID_EVENTS → docs/ANALYTICS-EVENTS.md, parity test w3):
`guidance_shown`, `guidance_action_clicked`, `guidance_dismissed`,
`guidance_completed`, `first_run_started`, `first_run_completed`,
`intent_selected`, `next_step_completed` — props: state/surface/action ONLY.

### 10. Konflikt CTA (§33): trak se pojavi ENKRAT na površino na določenem
sidru; NE ustvarja modalov/dashboradrov. Domov: first-run kartica NA mestu
welcome banerja (1. obisk) namesto njega (returning → welcome banner;
nikoli oba). BetaBanner: dodana trajna zavrnitev (localStorage) — manj šuma.
Obstoječi CTA-ji ostanejo (ZERO FEATURE LOSS — matrika CURRENT → NEW v
docs/GUIDANCE-ARCHITECTURE.md).

---

## DEL 2 — FAZE

- **B (jedro):** `src/lib/guidance/{types,guide-engine,guidance-snapshot}.ts`
  + testi (~45): stanja/tranzicije/prioritete/akcije-fail-closed/determinizem/
  UNKNOWN/snapshot roundtrip.
- **C (first-run + returning):** `guidance/first-run-card.tsx` (nameni +
  "Ne vem — pokaži mi" = tour), nadgradnja WelcomeBackBanner (stanje-vedno
  nadaljevanje), popravki: #kviz sidro → `/nacrtuj#kviz`, visitCount dvojna
  semantika (addVisitedDestination ne šteje obiskov), odstranitev mrtve
  TripProfileOnboarding (nikoli montirana — matrika).
- **D (kontekst):** `guidance/guidance-strip.tsx` (univerzalni trak + veriga
  korakov) na: domov (pod hero), hub /moja-potovanja (glava Moja pot),
  /nacrtuj (rezultati); add-to-trip toast + "Načrtuj potovanje" (count ≥ 1);
  planner po SHRANI: toast pove naslednje korake (Na poti + rezervacije);
  akcijska vrstica po GENERATE dobi utemeljitveni vrstni red (Shrani primarno
  — varuje delo; po shranitvi trak prevzame ZAŽENI).
- **E (kontinuiteta):** Go Mode COMPLETED stanje (povzetek poti: dnevi/
  opravljeno/preskočeno + naslednje: deli pot, dnevnik, nova pot — nadomesti
  golo "ni več postankov" ko remaining=0 in laterDays prazni);
  moja-potovanja kartica: "Kje sem bil" kontekst (št. opravljenih iz
  dai:go-progress, če je shareId aktiven) + opomba pri resume (zamenja
  aktivno pot — en sam aktivni trip, iskreno).
- **F (a11y/i18n/meritve):** ns `guidance` ×6; aria-live=polite + role=status,
  Escape/focus-visible/44px/reduced-motion; skip-link (ACCESSIBILITY-REVIEW ❌
  — znana vrzel, naravna pobuda); analitika (zgoraj); 0 horizontalni overflow.
- **G (regresija + dokazi):** cel suite (4.689 + ~60 novih), lint, tsc;
  produkcijski dokazi G1–G10 (agent-browser na Render, po pushu).
- **H (dokumentacija):** docs/GUIDANCE-ARCHITECTURE.md (vklj. matriko
  CURRENT→NEW), docs/GUIDANCE-STATE-MATRIX.md, docs/GUIDANCE-EVIDENCE.md,
  CHANGELOG 1.163.0, README kjer se sklicuje, §29-format komentar na #23.

## DEL 3 — INVARIANTE (vsaka s testom)
1. Jedro čisto: selectGuidance brez Date.now()/I/O — isti vhodi → izhod.
2. Nobena akcija ni ponujena, kadar ni mogoča (geo fail-closed, brez načrta
   ni ZAŽENI ipd.).
3. Zavrnitev traku ne odstrani kritičnega stanja v Go Mode (guardian ostaja).
4. 0 novih virov resnice — snapshot bere SAMO kanonične bralce.
5. Analitika brez PII (state/surface/action ključi samo).
6. i18n pariteta 6 jezikov za ns guidance (test task71 to izsili).
7. ZERO FEATURE LOSS: vsi obstoječi CTA/naslovi testi ostanejo zeleni.
8. Stanje UNKNOWN ostane UNKNOWN (ni izmišljanja, §30).
