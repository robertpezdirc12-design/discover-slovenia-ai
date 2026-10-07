# E2E dokazi P0-C (2.8.0) — podatkovni sloj

**Datum:** 2026-10-07 20:33–20:40 UTC · **Stran:** /vir-podatkov + /zemljevid + API

| Posnetek | Kaj dokazuje |
|---|---|
| `01-vir-podatkov-sto-iskanje-blede.png` | STO iskanje „blede" → **1 ZADETEK: Bled (Regije in mesta)** z uradno povezavo „Odpri na slovenia.info" + atribucijo STO z datumom ingesta — VLM neodvisno potrdil |
| `02-zemljevid-poi-sloj-iskrena-degradacija.png` | POI plast VKLOPLJENA na privzetem pogledu cele SI → iskrena pasica „⚠ Pogled prevelik za POI sloj — približajte zemljevid" (varovala javnega vira) |
| `02b-zemljevid-poi-priblizano-nedosegljiv.png` | Po približanju: iskrena pasica „POI sloj trenutno nedosegljiv (javni Overpass vir)" + ODbL atribucija (peskovnik nima dostopa do Overpass — produkcija ga ima) |
| `03-vir-podatkov-mobilni-390.png` | Mobilni 390 px BREZ preliva |

API (e2e-rezultati.txt): health 2.8.0 vseh 7 kontrolnikov ok (supply:matrix 🟢3 🔵1 ⚪8 🔴7; data:feeds STO 752/7 jezikov); sto/search „blede"→Bled (sklonske oblike), „hiking"→Hiking and Mountaineering; pois 502 z razlogom + ODbL; pois prevelik viewport 400; cron 401/401 fail-closed; 0 napak strani/konzole.
