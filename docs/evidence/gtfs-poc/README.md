# GTFS PoC — javni prevozi (dokazila, merjeno 17. 10. 2026)

Merilna skripta: `scripts/gtfs-poc-meritve.ts` (0 novih odvisnosti; bun:sqlite).
Odločitveni paket: `docs/research/gtfs-javni-prevozi-poc.md`.

## Datoteke

| datoteka | vsebina |
|---|---|
| `meritve-lpp.txt` | celoten izpis meritve proti SVEŽEMU neposrednemu LPP feedu (data.lpp.si, okno 2026-10-16 → 11-15) z SQLite prototipom |

## Ključne izmerjene številke (LPP, svež feed)

- feed: 40,5 MB zip → 725 postaj · 31 linij · 60 446 voženj · **1 545 193 odhodov** (250 MB stop_times)
- veljavnost: 2026-10-16 → 2026-11-15 (~30-dnevno okno, brez calendar.txt — 31 storitev, ena na dan)
- aktivno za dan meritve (2026-10-17): 1 storitev, **30 964 odhodov**
- pokritost kanona 74: **1/74 ≤1 km** (samo `ljubljana`; najbližja postaja Bavarski dvor 0,05 km; 44 postaj ≤1 km, 131 ≤2 km)
- SQLite prototip: uvoz 1 545 193 vrstic v 6 469 ms + indeks 1 121 ms = **baza 314,5 MB**, odhodna poizvedba **1 ms**
- pretakanje stop_times (250 MB CSV): 5 576 ms

## Virovski dejstva (isti dan)

- MobilityData katalog: 6 SI feedov; **javno dostopen je samo LPP**
- 5× NAP.si `b2b.nap.si/data/...` → **HTTP 401** (B2B registracija; med njimi **DUJPP = nacionalni prevoznik JPP**)
- zrcalo `mdb-latest` za LPP je **ZASTARELO** (okno jun–jul 2026) — uporabiti izključno neposredni vir
- podatki.gov.si CKAN: iskanje "gtfs" = 1 zadetek ("Register linijskih odsekov" — ni GTFS) → **nacionalni CKAN še vedno 0 GTFS** (potrjeno znova 17. 10. 2026)
- NAP.si portal: stari ASP.NET s captcha, brez javnega API — registracija edina pot

## Okolje meritve

bun 1.3.14, Linux x64 peskovnik; datum/ura po Europe/Ljubljana (zagon 20261017 08:32).
