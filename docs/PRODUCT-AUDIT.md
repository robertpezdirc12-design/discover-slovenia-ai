# PRODUCT AUDIT — Discover Slovenia AI (issue #2 P0)

> **Kaj je to:** dokazljiv end-to-end pregled produkcijske pripravljenosti
> vseh pomembnih tokov (UI → API → podatki → integracija → test), izveden
> po zahtevah issue #2. Vsako vrstico nosi dokaz (datoteka:vrstica ali
> izsledki testa). Brez izmišljenih rezultatov — kar ni preverjeno, je
> označeno.
>
> **Izhodišče pregleda:** HEAD `4adb9b1` (main, merge PR #1), verzija
> **2.19.0**, CI run **#28 = success** (lint + typecheck + test + prisma +
> build + smoke). Pregled izveden po istih 6 vratih + E2E preverbe agentov
> po vseh tokovih.
>
> **Status po popravkih tega pregleda:** 1249/1249 testov (+30 novih
> pogodbene zaklenitve), tsc 0, lint 0, `db:pg:check` OK. Popravljeni
> najdi so v razdelku »Popravki iz tega pregleda«.
>
> **P3 dodatek (2.20.0):** §9 točki 3 (prevod it/de/fr/es) in 4-del-1
> (hreflang) zaključeni — ~7.400 prevodov v 71 datotekah, ~73 aktiviranih
> klicnih mest, hreflang na 36 straneh; 1257/1257 testov (10293 expect),
> tsc 0, lint 0, build OK.
>
> **4-c dodatek (2.21.0):** sledilna naloga 4-c ZAKLJUČENA — PlannerLang
> = 6 jezikov (itinerary-engine PLANNER_MSG + GEO_MSG izbor, weather
> weatherLabel, journey/booking statusLabel, trip-dates tedni/meseci,
> go-gps kardinali), FR register harmonizacija (vous → tu, 26 mest v 7
> datotekah), 16 datumskih vrat poenotenih prek `intl-locale.ts`
> (INTL_DATE_LOCALE), `asPickLocale()` vrata; 1292/1292 testov (+18
> i18n-core-activation), tsc 0, lint 0. Znani dolg: 2 SL-stavka v
> trip-collab/trip-reservations (celoten blok je še SL — dosledno
> pusteno, ne mešanje jezikov).

## 1. Matrika tokov (UI → API → podatki → integracija → test)

| Tok | Status | Dokaz (datoteka:vrstica / test) |
|---|---|---|
| Zemljevid/POI | **DONE** | Leaflet 1.9.4 + OSM ploščice brez ključa, atribucija (`travel-map.tsx:1706`); 38 destinacij × točne koordinate (Bled 46.3683/14.0944, Ljubljana, Piran, Postojna, Triglav — vse preverjene) + 26 odvodnih prizorišč iskreno označenih `destination_center` (`src/lib/map-pins.ts:203`); gorivo 66 postaj `approximate` brez cen (`fuel-stations.ts:9-17`); živi POI Overpass fail-closed 400/429/502 (`overpass.ts:210-292`) |
| Načrtovanje poti | **DONE** | 0 `Math.random`/`Date.now` v izhodni poti (`itinerary-engine.ts`); isto geslo → byte-identičen JSON, prstni odtis FNV-1a, `engine:"deterministic"`, `aiTokensUsed: 0` (prehodno preverjeno v peskovniku; test `itinerary-engine.test.ts:37`); proračun realne cene registra z iskreno sprostitvijo (`itinerary-engine.ts:526`) |
| Dnevni itinerar | **DONE** | Sidro + ≤100 km sosedi, vrsta raznolikosti, 09–19; segmenti Jutro/Popoldan/Večer (`day-segments.ts:57`); delovni čas iskreno izpuščen — v registru ne obstaja (`recommendation-reasons.ts:8`) |
| GPS/navigacija | **DONE** | `watchPosition` client-only (`use-geolocation.ts`); lega strežniku SAMO zaokrožena 4 dec. (~11 m) ob izrecnem preusmerjanju + strežniška ponovna zaokrožitev (`go-gps.ts:259`, `journey/route/route.ts:118`); offline Go Mode s SW predpomnilnikom `/na-poti` (`sw.js:73`) |
| Vreme | **DONE** | Open-Meteo brez ključa; 8 s timeout; predpomnilnik 10 min; 16-dnevni horizont; fail-closed 502, nikoli izmišljeno (`api/weather/route.ts:212`) |
| Journey/My Trip | **DONE** | vloge OWNER/EDITOR/VIEWER strežniško (`trip-auth.ts:64`); zasebne pote 404 ne 403; CAS preimenovanje (baseVersion → 409); ankete transakcijsko, glasovi VIEWER+; sporočila 2–500 znakov s sanitizacijo |
| Uvoz rezervacij | **DONE** | deterministični razčlenjevalnik (0 AI, 0 omrežje), vsa polja so PREDLOGI, uporabnik potrdi; brez atestacije → iskreni osnutek IDEA (`reservation-import.ts:362`, `reservation-import-dialog.tsx:71`) |
| Booking (3 kanali) | **DONE** (iskrenost) + real API **BLOCKED** | glej §2 — življenjski cikel kanon `lib/journey/booking.ts:32`; demo kanal eksplicitno označen; partner PENDING do atestacije; real API kanal fail-closed 503 (3 mesta) |
| Marketplace + checkout | **DONE** | atomska transakcija, pogojni dekrement zaloge (P2025→409), kompenzacija ob padcu seje; demo plačila izrecno označena; izdelki iz kanonskih cen (nič izmišljenih) |
| Affiliate/partnerji | **DONE** (0 ugibanih povezav) | glej §3 |
| Uporabniški račun | **DONE** | NextAuth JWT 30 dni; scrypt + sol + timingSafeEqual (`password.ts:23`); bcrypt veja za prenesene (2.19.0); register validacija + rate limit (nov popravek) |
| Offline/PWA | **DONE** (push iskreno NE) | namestljiva PWA (manifest + SW); offline lupina + strani; zasebni API-ji NIKOLI predpomnjeni (iskreni 503 `offline:true`, `sw.js:220`); push iskreno razkrit kot neimplementiran (README + `notification-bell.tsx:8`) |
| Jeziki | **PARTIAL** (iskreno) | 6 lokalov (sl privzeti + en/it/de/fr/es), preklopnik ponuja samo podprte (`i18n-pick.ts:70`); SI·HR·ME·AL so DRŽAVE destinacij, ne jeziki — README ne trdi drugače; 10/69 datotek polnih 6 jezikov, 59 sl/en s SL rezervo — README to izrecno priznava; ME/AL kot jezika NE obstajata in nista ponujena (iskreno) |
| Mobilni prikaz | **DONE** | lepljiva noga `flex min-h-screen flex-col` + `mt-auto` (`footer.tsx:115`); tab vrstica 56 px + FAB; `.tap-target` ≥44 px (`globals.css:174`); safe-area (`globals.css:163`); dokazi 390 px v `docs/evidence/` |
| Dostopnost | **DONE** (5 manjših vrzeli) | skip-link, semantični mejniki, aria-labels na vseh ikonskih gumbih, Label htmlFor na obrazcih, kontrast primarne 6,47:1 (AA); popravki iz tega pregleda: focus-obroči v mobilnem meniju, `lang="en"` opombi, poln slovar zvončka |
| Provenance podatkov | **DONE** | `/vir-podatkov` izračunan iz dejanske množice; 19 ponudnikov z življenjskim ciklom in razlogi (`supply/production-matrix.ts`); aktivacijska matrika `bun run activation:check` (OSM 🟢, STO 🟢, ostali ⚪ iskreno čakajo) |

## 2. Booking — resničnost ponudnikov (zahteva §3 issue)

**Ugotovitev: NI poti, ki bi prikazala potrditev brez ponudnikove verifikacije.**

- **Trip rezervacije (S1):** `CONFIRMED` zahteva atestacijo (bookingId + cena iz
  ponudnikovega potrdila) — brez nje 400 (`api/trips/[shareId]/reservations`
  `hasProviderFields` guard; `validateConfirmationRecord` `booking.ts:221`).
  Uporabniška atestacija je VEDNO ločeno označena (vijolični znak
  „Potrjeno (uporabniški vnos)", `trip-reservations.tsx:380`).
- **Demo simulator:** edini „takojšnji" CONFIRMED — povsod eksplicitno
  označen (`demo:true` v zapisu + odzivu + oranžni znak + besedilo
  „SIMULIRANA potrditev … ni je mogoče unovčiti pri ponudniku"). Strežnik
  ponudbo reši sam iz `OWN_PRODUCTS` — klient cene nikoli ne pošlje.
- **Partner kanal:** rezervacija nastane kot **PENDING** („potrditev izstavi
  partner na svoji strani — iskreno", `journey/bookings/route.ts:190`);
  uporabnik atestira po ponudnikovem potrdilu; prehod PENDING→CONFIRMED
  prek kanonskega `assertTransition`.
- **Real API kanal:** `channel:"real"` → **503 fail-closed** na VSEH 3 mestih
  („brez poverilnic nikoli ne lažemo") — **BLOCKED** na ponudnikovih
  poverilnicah/pogodbah (lastnik).
- **Stripe checkout:** brez ključa → 503 „Plačila niso konfigurirana";
  `paid` NASTAVI SAMO podpisno preverjen webhook z ujemanjem zneska
  (`marketplace-checkout.ts:77-90`); dedup prek `ProcessedStripeEvent`
  unique eventId.
- **Provizije:** IZKLJUČNO ročno iz poročil partnerjev (MANUAL/CSV_IMPORT);
  klik NIKOLI ne ustvari provizije; neznan odstotek ostane `null`
  („ocena NEZNANA do pogodbe — nikoli ne izmišljujemo odstotka").
- **Popravek iskrenosti (ta pregled):** pasica `?placilo=uspeh` je prej
  trdila „naročilo je potrjeno" iz podtakljivega URL parametra — zdaj
  iskreno govori o oddanem plačilu in potrdilu po webhooku
  (`payment-return-banner.tsx`).

## 3. Affiliate (zahteva §4 issue)

**Ugotovitev: 0 ugibanih povezav — vzorec „ID brez znanega vzorca ne more
zgraditi provizijske povezave" je zaklenjen s testi.**

- 13 ponudnikov; žetoni SAMO v env (`.env.example` vse komentirane);
  v bazi/registru ni žetonov.
- 7 ponudnikov ima `affiliateTmpl: ""` — z ID-jem brez dokumentiranega
  vzorca padejo na javno predlogo `affiliateActive:false`; ID se NE razkrije
  (test `affiliate-registry-p0f.test.ts:167` zaklene za vseh 7).
- Države SI/HR/ME/AL: `COUNTRY_URL_NAMES` (`affiliate-providers.ts:322`)
  — samo te 4; neznana država → null (fail-closed), nikoli izmišljeno ime.
  `{country}` uporabljata samo discovercars in airalo; brez države iskreni
  namestnik (`noCountryTmpl`) brez pokvarjenih ostankov.
- Brez UTM parametrov (zavestno — atribucija prek ponudniških žetonov);
  zapis klika pred preusmeritvijo brez PIJ v URL; `dsa_aff` piškotek
  anonimni UUID httpOnly/lax (zdaj tudi `secure` v produkciji — popravek).
- Odprta preusmeritev: NE obstaja — provider zamrznjen register (sicer 400),
  `dest` razrešen prek kanonskega sluga, `encodeURIComponent` povsod.
- **Popravek (ta pregled):** lastnikov TMPL override zdaj zahteva `https://`
  (sicer iskren padec na javno predlogo); domena zavestno NE preverjena
  (affiliate programi izdajo vzorce na sledilnih domenah; test zaklene).

## 4. Varnost (zahteva §5 issue)

Močno (že pred pregledom): scrypt + timingSafeEqual; fail-closed cron
(Bearer), admin (DSA_ADMIN_EMAILS), partner (vloga iz baze vsakic); IDOR
sestavljene poizvedbe povsod ({id, userId} / {id, ownerId}); zasebne pote
404; Stripe podpis + znesek + dedup; GPS client-only z dvojno zaokrožitvijo;
0 skrivnosti v kodi; SystemDataGuard; GDPR-ish življenjski cikel spomina
(mehki izbris + 90-dnevni fizični čiščenje); 6 pogodbenih testnih datotek.

**Popravljeno s tem pregledom (vsako zaklenjeno z testi
`tests/p0-audit-hardening.test.ts`):**

| # | Resnost | Najdi | Popravek |
|---|---|---|---|
| H1 | VISOKA | `Math.random()` za shareId + žetone vabil (napovedljiv PRNG → eskalacija vloge na zasebnih potah) | `crypto.randomBytes` z zavrnitvijo pristranskih bajtov (`trip-auth.ts`, `trips/route.ts`) |
| M1/M2 | SREDNJA | register/contact/newsletter brez meja (masovne prijave, spam v bazo) | 5/min + 429 + Retry-After |
| M3 | SREDNJA | checkout brez meje — vrtenje visitorKey zaklene zalogo 60 min (DoS) | 10/min |
| M4 | SREDNJA | cron Bearer primerjava `!==` (komentar je napačno trdil konstantno) | `timingSafeEqual` na dolžinsko izenačenih zapisih |
| M5 | SREDNJA | 0 varnostnih glav | X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy geolocation=(self), HSTS (`next.config.ts`) |
| M6 | SREDNJA | Prisma `log:['query']` tudi v produkciji (vezani parametri = PIJ v dnevnikih) | `['error']` v produkciji, `['query']` v razvoju (`db.ts`) |
| M8 | SREDNJA | trips sporočila/rezervacije/ankete/glasovi + POST neomejeni | 30/min (10/min za nove pote) |
| L1 | NIZKA | `err.message` prva vrstica k odjemalcu (503 contact/newsletter) | splošno sporočilo, dnevnik na strežniku |
| L2 | NIZKA | checkout success URL iz glav zahteve (host-header lažna „uspešno plačano" past) | `NEXT_PUBLIC_SITE_URL` (https) ima prednost |
| — | NIZKA | affiliate zapis klika neomejen (botsko napihovanje statistike) | 30/min SAMO na zapis — preusmeritev NIKOLI zavrnjena |

**Ostaja (lastnikova odločitev, iskreno):**
- V pomnilniku rate limit je NA PRIMER (per serverless instanca) — nadgradnja
  v skupno shrambo (Upstash) ob večjem prometu.
- Polni CSP zahteva nonce-arhitekturo (Leaflet/Stripe/Next) — naslednji korak,
  glave so zdaj osnovne.
- `DSA_DEMO_PAYMENTS=1` privzeto v `.env.example` — pri produkciji izklopiti.
- Caddyfile `XTransformPort` proxy je RAZVOJNA izključno datoteka peskovnika —
  ne sme iti v produkcijo (dokumentirano tukaj).
- Javne pote razkrijejo zgodovino klepeta + rezervacije anonimnim bralcem —
  zavestna odločitev (lastnik upravlja `isPublic`), po želji dodatna plast.
- `typescript.ignoreBuildErrors: true` v next.config — CI vrata (tsc) to
  nadomeščajo, a priporočamo odstranitev, ko bo izdaja stabilna.

## 5. Podatkovna plast + PostgreSQL cutover (zahteva §6 issue)

- **Shema:** 27 modelov, 0 primitivnih seznamov, 34 indeksov, 6 sestavljenih
  unikatov; kaskade smiselne (OrderItem→Product Restrict).
- **Postgres plast:** izpeljana shema + baseline `0_init`; CI dokazuje
  „migracije ≡ shema" na vsak push (`db:pg:check` — preverjeno zeleno ob
  temu pregledu). `migrate-legacy-data.ts`: dry-run privzet, `--apply`
  izrecen, idempotenten (dokazano E2E testom); bcrypt prijava brez izgube.
- **`db:push --accept-data-loss` (nevarnost §6):** prej golo v skripti —
  varovalo ga je le naključje providerja (P1012 pri postgres URL). Zdaj:
  `bun scripts/db-push-guarded.ts` zavrača VSE ne-`file:` protokole (izhod 1
  + navodilo na `db:pg:deploy`); platforma `.zscripts` (vedno `file:`) je
  nepoškodovana; test ⑬ krepi pogodbo. **Na produkciji se nikoli ne zažene
  destruktiven ukaz.**
- **cutover.sh:** faza `backup` (pg_dump + sha256 + vrata ≥39 tabel) je PRVA;
  brez `--accept-data-loss` kjerkoli; idempotenčna faza zahteva „prenesenih: 0".
- **Popravek:** `cutover-evidence/` (pg_dump z e-poštami + hash-i) dodan v
  `.gitignore`; `pg-schema-sync.ts` opozori (⚠⚠⚠) ob povozitvi obstoječega
  različnega `0_init`; runbook §10.5 dodan (razvoj sheme po cutoverju z
  NOVIMI migracijami — re-baseline past).

## 6. Testi — dejanski rezultati (zahteva §7 issue)

| Vrsta | Ukaz | Rezultat (lokálni peskovnik, HEAD po popravkih) |
|---|---|---|
| Enote/pogodbe | `bun test` | **1249 prehodov / 0 padcev** (10.095 expect; 54 datoteke; 2,92 s) |
| Tipi | `bun run typecheck` | **0 napak** |
| Lint | `bun run lint` | **0 napak** |
| Prisma usklajenost | `bun run db:pg:check` | **OK** (shema ≡ glavna; baseline ≡ from-empty dif) |
| Aktivacija | `bun run activation:check` | **izhod 0** — OSM 🟢, STO 🟢, fsq/kiwitaxi/booking/… ⚪ iskreno „ni konfigurirano" |
| Build | `bun run build` | **USPEŠEN (izhod 0)** — vse rute zgrajene (SSG + dinamične API), standalone izhod |

**Produkcijski test (živa domena) NI izveden** — projekt še ni prevezan na
produkcijo (cutover je lastnikovo zunanje dejanje po runbooku). To je iskrena
meja peskovnika, ne izpuščen korak.

## 7. Dostopnost / CWV / mobilno (zahteva §8 issue)

- Dostopnost: glej §1 (DONE, 5 manjših vrzel; 3 od 5 odpravljene s tem
  pregledom: focus-obroči, jezikovna opomba, slovar zvončka).
- Preostali 2: hreflang na `vodici/[slug]` samo sl+en (iskreno — vsebina
  vodnikov je sl/en; razširitev = vsebinska odločitev); Leaflet delno
  tipkovnico (zmanjšano z `role="region"` + fokusicimi kontrolami).
- CWV/Lighthouse: niso izmerjeni v peskovniku (ni žive produkcijske instance);
  tvegания nizka: hero = CSS (brez LCP slike), next/image povsod, fonti
  self-hosted. Izbrisani 4 nekoreferencirani PNG (~1,8 MB balasta).
- Ni dodanih dragih storitev.

## 8. Popravki iz tega pregleda (vsi zaklenjeni s testi)

1. **H1** crypto žetoni (shareId + vabila) — `trip-auth.ts`, `trips/route.ts`
2. **M4** timing-safe cron — `cron-auth.ts`
3. **M5** varnostne glave — `next.config.ts`
4. **M6** dnevnik Prisma samo razvoj — `db.ts`
5. **M1/M2/M3/M8** rate limiti na 9 poteh + skupni helper `lib/rate-limit.ts`
   (+ zapis klika affiliate 30/min, preusmeritev nikoli zavrnjena)
6. **L1** brez razkritja napak — `contact`, `newsletter`
7. **L2** checkout origin pripet na env — `checkout/route.ts`
8. **D** `db:push` varovalka (`scripts/db-push-guarded.ts` + test ⑬)
9. **D** `cutover-evidence/` gitignored; re-baseline opozorilo + runbook §10.5
10. **I** iskrena pasica plačila + nevtralno besedilo checkout modal
11. **A** affiliate cookie `secure` + TMPL override https varovalka
12. **UX** mrtev link `/destinacija/[slug]/guide/[tema]` → `/vodici`;
    manifest screenshots 404 odstranjen; mrtva `/icons/` predpona SW;
    `lang="en"` opombi offline; focus-obroči mobilni meni; poln slovar
    zvončka; slovnica vremena; 4 PNG balast izbrisani
13. **Novo:** `tests/p0-audit-hardening.test.ts` (30 testov)

## 9. Preostale blokade in naslednji konkretni koraki

**Blokirano na lastniku (zunanja dejanja — runbook/activation-check vodita):**
1. PostgreSQL cutover po `docs/PRODUCTION-CUTOVER.md` (Neon backup →
   preflight → migracija → deploy → health → smoke → rollback vaja).
2. Stripe produkcijski ključi + webhook skrivnost (checkout zdaj iskren 503).
3. Affiliate programi: registracija + `AFFILIATE_*_ID` (+ TMPL vzorci iz
   programov) — brez njih povezave delujejo javno, iskreno, brez provizije.
4. Ponudniki rezervacij: poverilnice/pogodbe za real API kanal (zdaj 503).
5. FSQ dump + KiwiTaxi partner CSV (ingest koda pripravljena).
6. `DSA_ADMIN_EMAILS` za skrbniške pulta.

**Priporočeni naslednji koraki v kodi (ni blokirano, prioriteta nizka/srednja):**
1. Polni CSP z nonce (zahteva arhitekturno delo — Leaflet/Stripe).
2. Skupna shramba rate limitov (Upstash/DB) ob rasti prometa.
3. ~~Prevod 59 sl/en datotek v it/de/fr/es~~ ✅ **P3 (2.20.0) zaključeno:**
   ~7.400 prevodov v 71 datotekah + aktivacija ~73 klicnih mest
   (ternariji → `pick()`).
   ~~Ostanek (sledilna naloga 4-c)~~ ✅ **4-c (2.21.0) zaključeno:**
   PlannerLang 6 jezikov v jedru (PLANNER_MSG/GEO_MSG/statusLabel/
   weatherLabel/trip-dates/go-gps) + FR tu/vous harmonizacija (26 mest)
   + 16 datumskih vrat (`INTL_DATE_LOCALE`).
4. ~~hreflang razširitev po prevodu~~ ✅ **P3 (2.20.0) zaključeno:**
   `alternatesFor()` na vseh 36 straneh (26 klientnih razdeljenih na
   page.tsx + view.tsx po kanonu Next 16).
   ~~Kobarid/Soča regija~~ ✅ **2.22.0 REŠENO (preverba proti produkciji
   izvedena 2026-10-10):** produkcija 1.190.0 (API + stran + sitemap)
   razvršča `kobarid` + `reka-soca` v „gorenjska“ — geografska napaka
   izvirnika (Kobarid/korita Soče = Posočje/goriška; STO trži „Soča
   Valley“). Popravek po kanonu (urejanje DOVOLJENO po preverbi): nova
   regija „posocje“ (6 jezikov, eksonimi Isonzo), letališče TRS, 21
   regij; zaklep v tests/slovenia-data.test.ts.
5. Odstranitev `ignoreBuildErrors` po stabilizaciji.

## 10. Definition of Done (issue #2)

- [x] Matrika vseh tokov z dejanskimi dokazi (§1)
- [x] Vsi testi zabeleženi z resničnimi rezultati (§6)
- [x] Booking in affiliate status poštena — brez lažnih potrditev (§2, §3)
- [x] Kritične napake, varno popravljive, popravljene in testirane (§4, §8)
- [x] `docs/PRODUCT-AUDIT.md` vsebuje preostale blokade in konkretne korake (§9)

---

*Dokument izdelan ob HEAD po popravkih; vsaka trditev ima pot do vira.
Skrivnosti niso zapisane nikjer v tem dokumentu.*
