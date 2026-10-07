### IMPLEMENTED

**Izdaje:** 1.159.0 (`98bcbfa`) → 1.160.0 (`d492ae8`) → 1.161.0 (`6d7b9e0`) → 1.161.1 produkcijski dokazi (`f64e1ba`), vse na `main`.

- **Jedro Live Trip Navigatorja (§5–§8):** `src/lib/journey/travel-state.ts` — `TravelStatus` (driving/near/arrived + prihod/naslednji), arrival detekcija z **geofence od natančnosti fiksacije** (slaba fiksacija NE sproži lažnega prihoda) + **stabilnost 8 s** (minStableMs), skip/restore, stabilni ključi postankov; GPS življenjski cikel v `use-geolocation.ts` (6 statusov, EN samodejni retry po prehodni napaki po 4 s, NE po zavrnitvi; cleanup brez lukenj)
- **ZDAJ hierarhija Go Mode (§10/§12):** `buildGoView()` — projekcija next/nextAfter/line/remaining/done/skipped iz poti + napredka + zdaj; SHEMA DNEVA (`go-day-line.tsx`, a11y role=list, aria-current) + ZEMLJEVID DNEVA (Maps URL API, strop 10 waypointov, injekcijsko varno) + NASLEDNJE PO TEM (trak „Nato")
- **GEO DATA CONTRACT (§4):** `resolve-stop-geo.ts` — ena kanonska geo resnica, `GeoPrecision = exact | approximate | missing | invalid` (exact = SAMO lastna tržnica; zunanji viri poimenovano approximate; fail-closed), `isNavigableGeo()`, geo projekcija na VSEH karticah; UI znacke „Preverjena lokacija" / „Približna lokacija (vir: X)" / izrecna opomba „Lokacija ni znana — navigacija ni na voljo"
- **Razred natančnosti (§6):** AccuracyClass high/medium/low (≤50/≤200/>200 m, null = neznano) prikazan ob ±X m
- **Stale guard (§18-5):** zastarela fiksacija (>60 s) NE more držati „Prišel si"
- **Wake lock (delta D1):** `use-wake-lock.ts` — zaslon prižgan dokler GPS aktiven (W3C, iskrena opustitev brez podpore)
- **Persistanca:** go-persist V1/V2 migraciji + GoDoneMap (max 200 ključev); napredek preživi reload

### VERIFIED

- **4.608 testov pass** (+42 novih v #21 valovih: travel-state, go-travel, stop-geo, wake-lock, consistency, day-line; 845 testov v jedru 1.159.0) — `bun test`, tsc 0 napak, lint 0 napak; edini fail je znana sandbox DB odvisnost (issue7-g11 ④, brez Neon poverilnice v peskovniku — v CI/produkciji nerelevantna)
- **7 invariant prisiljenih s testi:** GPS NIKOLI ne piše ConfirmationStatus; GPS zgodovina se NE persistira; active stop se NE persistira (deterministični preračun); geo resolucija fail-closed; stale fiksacija razveljavi prihod; wake lock čisti ob izklopu GPS; konsistenčna projekcija (§24-F3)
- **Lokalni E2E (agent-browser, `next dev -p 3100`):** 6 PNG dokazov — prazno stanje → vse tri geo resnice (exact/approximate/missing) → GPS prihod → samodejna progresija → brez-lokacije opomba → mobilni 390 px; 0 konzolnih napak → `docs/evidence/issue21/`

### PRODUCTION VERIFIED

**Render `https://i-feel-slovenia.onrender.com`, samodejni deploy 1.161.0 iz pusha, 2026-10-01** (`docs/evidence/issue21/prod-*.png|json`, README z metodologijo):

- `/api/health` → status ok, **version 1.161.0**, 22/22 zagonskih preverb
- deploy-check: `/` `/en` `/en/nacrtuj` vse 200
- **ZLATA POT v živi produkciji** (mobilni 390×844, 0 konzolnih napak, 0 page errorjev): načrt Brnik → Postojnska jama (`/api/journey/plan` 200 — realni FSQ produkti: 12 nastanitev, 12 znamenitosti, 12 restavracij, 8 bencinskih; transfer 0 z ISKRENO opombo) → izbira 2 postankov (Vivarium, Muzej Krasa) → „Zaženi Na poti (Go Mode)" → `/na-poti` živ: ZDAJ postanek + shema dneva + DANES NAČRTOVANO → GPS vklop → **„✓ Prišel si na lokacijo Prihod: Ljubljana Airport (Brnik)"** + **„GPS prihod NE potrdi rezervacije"** + **„natančnost ±12 m · natančnost dobra"** → opravi → **samodejna progresija na Vivarium** z znacko **„Približna lokacija (vir: fsq)"** + trak „NATO: 🏛️ Muzej Krasa" → drugi prihod (Vivarium) + **„zaslon ostaja prižgan"** (wake lock) → reload ohrani stanje potovanja
- Iskrena metoda: headless brskalnik nima GPS senzorja — `navigator.geolocation` simuliran z JS override-om vtiča na koordinatah postanka (±12 m, 2 s); VSA ostala logika je tekla čez produkcjsko kodo in produkcjske podatke

### EXTERNAL BLOCKERS

- **Vercel:** GitHub App integracija za `i-feel-slovenia` NI nameščena (0 instalacij — vsi dosedanji Vercel deployji so bili API-ustvarjeni), dnevna kvota Hobby (100 API-deployev/dan) je bila ob pushu izčrpana → Vercel ob preverbi še strežni 1.158.1 (health OK); kvota se ponastavi 2026-10-02 ~17:40 UTC. **Priporočilo:** namestitev Vercel GitHub App (git deployi ne štejejo v API kvoto) — potem vsak push deploya samodejno, kot na Renderu
- **Pravi GPS na fizični napravi (G2):** dovoljenja, iOS quirks, zaklenjen zaslon — zahteva mobilno napravo; sandbox nima GPS senzorja (metoda JS vtiča dokumentirana v README dokazov)
- **Native Live Activities / Dynamic Island:** platformna meja spletne aplikacije (izrecno dokumentirano v LIVE-TRIP-NAVIGATOR.md ZUNANJE MEJE); wake lock pokriva splošen primer

### REMAINING

- ni znanih tehničnih vrzeli #21 na `main` — vseh 16 §24 dostavljivcev pokritih (zadnji, „production evidence", zaprt z 1.161.1)
- (naslednji korak projekta, ne #21: #22 Travel Guardian — `TravelStatus`/`ArrivalContext` sta že pripravljena vhoda; #23 za njim)

### ARCHITECTURE DECISIONS

1. **LiveStop = čista projekcija** (ne vzporedni model) — `buildGoView()` preračuna iz pot + progress + now; active stop se NE persistira
2. **TravelStatus ≠ ConfirmationStatus** — tipovno ločena avtomata (14 rezervacijskih stanj ostaja nedotaknjenih); **GPS NIKOLI ne piše rezervacijskega statusa** („GPS prihod NE potrdi rezervacije" je vidno v UI)
3. **GPS živi izključno v `useGeolocation`** — en watch, session-only, ni sledi po zaslonu
4. **Ena kanonska geo resolucija `resolveStopGeo()`** za vse poglede (My Trip, Go Mode, zemljevid dneva) — pogledi se ne morejo raziti (§19)
5. **Geo natančnost je pogodba, ne okras:** exact = SAMO lastna tržnica (edini per-objekt preverjen vir, dokaz #20: 0/20 zunanjih z zanesljivimi koordinatami); zunanji viri so poimenovano approximate; navigacija fail-closed
6. **Prihod = geofence od natančnosti + stabilnost 8 s** — slaba fiksacija (npr. ±800 m) ne more sprožiti prihoda; zastarela fiksacija (>60 s) prihod razveljavi
7. **Napredek persistiran kot GoDoneMap** (max 200 ključev, LRU-štetje) — obnovitev po reloadu brez vzporednega modela aktivnega postanka

### REGRESSION

- `bun test`: **4.608 pass / 1 znana sandbox DB napaka** (issue7-g11 ④ — odvisna od DATABASE_URL, v peskovniku nerelevantna, CI/produkcija Neon)
- `tsc --noEmit`: 0 · `eslint .`: 0
- Produkcija (Render 1.161.0): health 22/22, 3×200 smoke, zlata pot Go Mode 0 konzolnih napak
- Dokumentacija usklajena: `docs/LIVE-TRIP-NAVIGATOR.md` (PREVERJENO + produkcijski dokazi), `docs/evidence/issue21/README.md`, CHANGELOG 1.159.0–1.161.1
