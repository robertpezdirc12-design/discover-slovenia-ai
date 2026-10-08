# P1-C E2E dokazi — spremljanje (watch) + notifikacijski center (2.17.0, issue #3 §4/§10)

Datum: 2026-10-08 · Strežnik: dev :3000 (2.17.0, health 9/9) · Preverjanje: curl (API) + agent-browser (UI)

## API plastska preverba (curl)

| # | Preverba | Rezultat |
|---|----------|----------|
| 1 | GET /api/watch + /api/notifications + POST /api/watch brez seje | **401** (3/3 fail-closed) |
| 2 | Cron BREZ žetona + z napačnim žetonom | **401** (2/2 — requireCronSecret) |
| 3 | Registracija A/B (p1c-e2e-a/b@test.local) + prijava | 201 + seji OK |
| 4 | POST price watch (izk-bled-pletna) | 201 — ime cilja določil STREŽNIK („Pletna vožnja do Blejskega otoka"), prag dropPct 10 |
| 5 | POST podvojen price watch | **409** z obstoječim zapisom |
| 6 | POST vrsta availability | **400** iskrena zavrnitev („ponudnik tega stanja ne potrjuje — ne lažno opazovanje") |
| 7 | POST vrsta flight | **400** iskrena zavrnitev („nimamo preverljivega vira — ne bomo izmišljevali") |
| 8 | POST /api/trips + PATCH tripDates (start = danes+7, mejnik!) | 201 + tripDates shranjeni |
| 9 | POST journey watches (weather/trip_day/booking) | 201 ×3 s privzetimi pogoji |
| 10 | IDOR: B PATCH/DELETE A-jev watch | **404** (obstoj se ne razkrije; ne 403) |
| 11 | IDOR: B GET /api/watch | 0 zapisov (samo lastni) |
| 12 | ZASEBNOST: B POST journey watch na A-jevi ZASEBNI poti | **400** „ni dostopna tvojemu računu" |
| 13 | CRON RUN 1 (Bearer CRON_SECRET) | scanned 4 · triggered 1 (trip_day d7) · written 1 · **baseline 1** (cena — IZHODIŠČE brez opozorila, iskrenost §4) · quiet 1 (booking, 0 IDEA) · **unavailable 1** (vreme — vir v peskovniku nedosegljiv → NO lažne napovedi; /api weather ruta enako 502) |
| 14 | CRON RUN 2 (idempotenca) | triggered 1 · **written 0 · duplicatesSkipped 1** — ponovljeni zagon NE podvoji (dedupe (userId, dedupeKey) → P2002 prezrt) |
| 15 | Padec cene v bazi (2500 → 2000 centov, −20 %) + CRON RUN 3 | triggered 2 · written 1 (price) · dupes 1 |
| 16 | Obvestilo o padcu cene | „Cena je padla s **25,00 €** na **20,00 €** (−20 %, prag 10 %). **Obe ceni sta preverjeni iz tržnice.**" — dedupe `price:{watchId}:2500:2000` |
| 17 | POST IDEA rezervacija na poto + CRON RUN 4 | booking watch → **warning** „1 rezervacijo brez potrditve — pot čez 7 dni" |
| 18 | Obvestila: PATCH eno prebrano / ?summary=1 / PATCH all / DELETE ?read=1 | 1 / 1 neprebrano / 1 / 2 pobrisani — vsa lastniška |
| 19 | WATCH PATCH pavza → GET stanje (paused) → PATCH nadaljuj → DELETE | 1/vidno/1/true |
| 20 | AuditLog (p1c) | watch.created ×4, watch.check_run ×4 (števci v meta), notification.read/read_all/cleared, watch.paused/resumed/deleted — actorType customer/system, 0 skrivnosti |

## UI preverba (agent-browser)

| # | Preverba | Dokaz |
|---|----------|-------|
| 1 | Gost: zvonček SKRIT (0 elementov v glavi) | 01-gost-zvoncek-skrit.png |
| 2 | Prijava A → zvonček viden z badge (2) + aria „Obvestila: 2 neprebranih" | 02-zvoncek-badge.png |
| 3 | /notifikacije: inbox (2 neprebrana poudarjena) + gumbi Označi vse/Počisti | 03-center-obvestila.png |
| 4 | Klik „Označi prebrano" na enem → neprebranih 1 | 04-enko-prebrano.png |
| 5 | Sekcija Spremljanja: vrste + cilji + Zadnje preverjanje/opozorilo + Zaustavi/Izbriši | 05-spremljanja.png |
| 6 | Klik Zaustavi (price) → badge „V pavzi" (ostala „Aktivno") | 06-pavza.png |
| 7 | /trznica: 9 gumbov „Spremljaj ceno" (ob Kupi) | 07-trznica-watch-gumb.png |
| 8 | /pot/asdmqeusci (lastnik): gumb „Spremljaj" v akcijski vrstici | 08-pot-watch-menu.png |
| 9 | Dropdown: Vreme na poti / Dnevi do poti / Rezervacije pred potjo z opisi | 09-pot-watch-dropdown.png |
| 10 | Mobilni 390 px: center se prilagodi (full-page) | 10-mobilni-390.png |
| 11 | Napake konzole/strani med vsemi preverbami | **0** |

## Iskrenostne odločitve (vidne v dokazih)

- **Cena**: prvi cron zagon zapiše samo IZHODIŠČE (baseline) — opozorilo nastane IZKLJUČNO iz preverljive primerjave dveh cen (25,00 € → 20,00 €).
- **Vreme**: peskovnik ne doseže api.open-meteo.com → stanje `unavailable` (isti vir kot /api/weather → 502) — NIKOLI izmišljena napoved in NIKOLI optimistični „vsi mirni".
- **Zavrnjene vrste**: razpoložljivost lokala in spremembe letov se odklonijo ob dodajanju z razlogom (vir ne potrjuje).
- **PWA push**: ni implementiran (iskrena opomba na strani) — plast je in-app inbox z zvončkom (poll 60 s).
- **Potrjena idempotenca**: cron run 2 → written 0, duplicatesSkipped 1 (dedupe ključ (userId, dedupeKey)).
