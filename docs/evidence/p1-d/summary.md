# P1-D E2E dokazi — personalizirana domov + parity scorecard (2.18.0, issue #3 §9/§14)

Datum: 2026-10-08 · Strežnik: dev :3000 (2.18.0, health 9/9) · Preverjanje: curl (API) + agent-browser (UI)

## API preverba (curl)

| # | Preverba | Rezultat |
|---|----------|----------|
| 1 | PUT /api/preferences (budget €€ + interesi [gore, jame, morje]) | 200 ×2 (kanonski JSON) |
| 2 | GET /api/trips — RAZŠIRJENO (P1-D §9) | `dateStart: "2026-10-15"`, `dateEnd: "2026-10-16"`, `firstStop: { name: "Bled", lat, lng }` — strežniško razrešen prvi postanek |

## UI preverba (agent-browser)

| # | Preverba | Rezultat | Dokaz |
|---|----------|----------|-------|
| 1 | Gost na /: osebna sekcija SKRITA | »Dobrodošel nazaj« NI v DOM (javni Discover nedotaknjen) | 01-gost-brez-osebne-plosce.png |
| 2 | Prijava A → /: osebna sekcija VIDNA | vseh 7 ploščic | 02-osebna-plosca.png |
| 3 | Nadaljuj pot | »P1C E2E pot na Bled« z dnevi/postanki/datumi + gumb Odpri pot | 02 |
| 4 | Obvestila | neprebrano »Pot se začenja čez 7 dni« + števec | 02 |
| 5 | Spremljanja | 2 čipa (P1C E2E pot na Bled) | 02 |
| 6 | Vreme naslednje pote | ISKRENO: »Vremenski vir trenutno ni dosegljivo — napoved NE izmišljujemo« (peskovnik blokira zunanje omrežje; isto vedenje kot /api/weather 502) | 02 |
| 7 | Ideje zate | Triglav + Bohinj (+ tretja) z razlogi »Zakaj: ~15 € na osebo, ustreza proračunu (€€)« — ISTI reason slovar kot @AI | 02 |
| 8 | V bližini (klik gumba) | ISKRENO zavrnjeno dovoljenje: »Dovoljenje za lokacijo je zavrnjeno« (headless brskalnik zavrne — pravilno stanje) | 03 |
| 9 | Mobilni 390 px | plošča se prilagodi (full-page) | 03-mobilni-390.png |
| 10 | EN jezik (/en) | »Welcome back« + »Ideas for you« — SL/EN pokrito | 04-en-jezik.png |
| 11 | Napake konzole/strani | **0** | — |

## §14 Parity scorecard

`docs/PARITY-SCORECARD.md` — 20 zmožnosti × (Mindtrip | Discovery trenutno | cilj | Evidence):
- **PARITY dosežena z dokazi**: personalization, memory, conversational planning, reasoning, proactive assistant, watch/alerts, price monitoring, booking (po resnici), itinerary, maps, collaboration, affiliate, offline/PWA, GPS/on-trip, provenance, notification center, personalized home, zasebnost/IDOR
- **SUPERIOR**: deterministično jedro (0-AI, 1159 testov), provenance, offline/Go Mode, transparentnost
- **Iskreno odprto**: creator/guide plast (§8 — čaka lastnikovo oceno); PWA push (ni infrastrukture)
- Test `tests/p1d-home.test.ts` ⑪–⑬ zaklene obstoj + pokritje + iskrene vrzeli

## Vrata

- tsc 0, lint 0, **1159/1159** testov (+13 p1d), verzija 2.18.0 na 4 mestih + kanarček
