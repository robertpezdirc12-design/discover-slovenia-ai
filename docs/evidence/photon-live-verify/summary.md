# Živi dokaz: Photon self-host pot (faza 3) — peskovnica, 15. 10. 2026

Namen: dokazati, da je uradni import + serve pot (runbook §3) **izvedljiva resnica, ne teorija**
— ista lekcija kot pg-live preverba (2.66.0): »config je koda, ki se mora vsaj enkrat izvesti,
preden se nanjo zanašaš«. Vse merjeno v peskovnici (≈1 vCPU, 2,7 GB RAM, 5,8 GB disk), brez
dockera, brez root-a.

## Pot (uradni komoot/photon 1.3.0, brez vmesnikov tretjih)

| Korak | Ukaz | Rezultat | Čas |
|---|---|---|---|
| 1. jar | `curl -L komoot/photon releases download 1.3.0` | 98 219 380 B | 10 s |
| 2. dump | `curl r2.koalasec.org/public/europe/slovenia/photon-dump-slovenia-master-latest.jsonl.zst` | 52 268 840 B | 2,8 s |
| 3. MD5 | mirror `.md5` vs `md5sum` | `5b144eb090290e33c8a89b32bb74fcf5` = ujema ✓ | — |
| 4. dekompresija | python `zstandard` `copy_stream` | 680 667 411 B JSONL | 0,8 s |
| 5. import | `java -Xmx1400m -jar photon-1.3.0.jar import -import-file slovenia.jsonl` | **593 956 dokumentov** | **141 s** |
| 6. serve | `java -jar photon-1.3.0.jar serve` (port 2322) | zdrav zagon | ~20 s |
| 7. žive poizvedbe | `/api`, `/reverse` (spodaj) | pravi zadetki | <1 s |

Skupaj: **~3 min** od nič do delujočega self-host geokodirnika (plus ~40 s downloadov).

## Žive poizvedbe (izrez, 15. 10. 2026)

- `GET /api?q=Bled&limit=2` →
  `{ "name": "Bled", "country": "Slovenija", "postcode": "4260", "countrycode": "SI",
     "osm_key": "place", "osm_value": "town", "coordinates": [14.1100595, 46.3684202] }` ✓
- `GET /api?q=Ljubljanski%20grad&limit=1` →
  `Ljubljanski grad | Ljubljana | Slovenija | [14.5085383, 46.0487819]` ✓
- `GET /reverse?lon=14.5060&lat=46.0624&limit=1` →
  `Pleteršnikova ulica | Ljubljana | Slovenija` ✓

Tarča 1 je tista ista, ki jo naša e2e zlata pot uporablja (Ljubljana→Bled), tarča 2/3 sta
iz 2.64.0 brskalniške verifikacije geokodiranja — tj. self-host instanca bi našo aplikacijo
skrmila brez spremembe kode (`PHOTON_BASE_URL` override, kanon 2.64.0).

## Meritve za sizing (§3.2 popravki)

- Heap: **1400 m dovolj** za SI import (2,7 GB skupnega RAM); §3.2 priporočilo 2–4 GB za
  celotno regijo ostane smiselno.
- Indeks: **202 MB** za Slovenijo (→ celotna regija 10 držav realno ≈ 1,5–2,5 GB, NE 1–3 GB
  zgolj za eno državo; stara ocena je bila za red velikosti previsoka).
- Import hitrost: 141 s za SI (~594 tisoč dokumentov) na ~1 vCPU → celotna regija
  ≈ 20–40 min enkratni import (SSD, §3.2 opomba o SSD-ih ostaja zaveza).

## Ugotovitve, ki popravljajo runbook

1. **Pregrađeni DB indeksi ne pokrijejo naših držav**: rtuszik ogledalo ima `db_available`
   SAMO za velike države (DE, FR, AT, ES, NL, PL, IN, JP …); SI in balkanske države so
   `db_available: false` (404 na `si.tar.bz2` in `photon-db-slovenia-1.0-latest.tar.bz2`).
2. **Photon 1.x nima PBF importa**: `import` sprejme Nominatim PG ali JSON dump
   (NominatimDumpFile); trditev o `photon_index_builder` iz PBF-jev NE drži več.
3. **JSONL dumpi za VSE regije** so na istem ogledalu, dnevni buildi
   (`last-modified` = dan izvoza; naš dump: data_timestamp 2026-10-10) — isti OSM vir,
   provenanca v glavi dumpa.
4. Jeziki indeksa `[de, en, it, fr]` — `sl` NI podprt (skladno z 2.64.0: `lang=sl` → 400).

## Povezave

- Runbook: `docs/SELF-HOST-RUNBOOK.md` §3 (+ nova §3.1.1)
- Isti vzorec dokazovanja: `docs/evidence/pg-live-verify/summary.md` (2.66.0)
- Verzija: 2.66.1 (docs + evidence + verzija; brez UI spremembe)
