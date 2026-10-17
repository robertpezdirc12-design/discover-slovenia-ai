# DATA PROVENANCE — licences, viri in runbooki podatkovnih slojev (P0-C)

**Različica:** 2.8.0 (P0-C) · **Datum:** 2026-10-07 · **Namen:** issue #1 §4/§6/§7 —
licenčno-provenance pregled PRED obnovo podatkovnih slojev (UNTRUSTED SOURCE kanon:
GitHub račun `markec12345678` je mrtev od 2026-10-07 ~18:00 UTC; vsak vir se
oceni po svoji licenci in dostopu, ne po zaupanju v izgubljeno kopijo).

---

## 1. Foursquare Open Places (FSQ) — `fsq`

| Vidik | Dejstvo |
|---|---|
| **Licenca** | Apache-2.0 **z obvezno atribucijo** („© Foursquare Open Places") |
| **Vrsta** | odprti podatki (lokalna množica) — NI affiliate, NI provizija |
| **Stanje cen** | NOT_SUPPORTED (plast cen izrecno ni podprta) |
| **Izvirnikova množica** | 125.446 POI: SI 18.010 · HR 88.331 · ME 10.285 · AL 8.820 (snapshot 2025-02-06) |
| **Kje je izgubljena množica** | mrtvi GitHub račun (`data/fsq-places/`) — NEDOSTOPNA |
| **Svež vir** | source.coop / fused.io (Foursquare odprti dumpi) — javni, brez poverilnic |
| **Obnova (P0-C)** | ✅ koda: loader `.jsonl` + stroga validacija (geo bbox države, 12 kanonskih kategorij, dedupe) + `bun run fsq:ingest` |
| **Čakanje** | ⚪ gate „data" — množica čaka svež dump (matrika: NOT_CONFIGURED, iskreno) |

**Runbook (osvežitev):**
```bash
# 1. Pridobi dump Foursquare Open Places za bbox SI·HR·ME·AL
#    (source.coop: foursquare/open-places —GeoJSON/Parquet; fused.io)
# 2. Determinističen ingest (samo potovalno-relevantne kategorije):
bun run fsq:ingest --raw-dir ./downloads/fsq-si-hr-me-al --snapshot-date 2025-02-06
# 3. Preveri odmik od baseline (izpiše se sam — SI 18.010 · HR 88.331 · ME 10.285 · AL 8.820)
```

**2.x canonical shema** (izvirnikova natančna preslikava je izgubljena — ta je
dokumentirana kot nova resnica): `fsq_id`, `name`, `latitude`, `longitude`,
`country` (SI/HR/ME/AL), `category` (12 vrednosti: hotel, accommodation,
restaurant, cafe, bar, attraction, museum, sight, beach, fuel, park, nature),
neobvezno `address`, `locality`. Vsaka vrstica gre skozi `validateFsqLine`
(geo-okvir države preprečuje napačno prijavljene države).

**Atribucija:** `© Foursquare Open Places (Apache-2.0, z atribucijo) — foursquare.com`

---

## 2. OpenStreetMap (OSM) — `osm` + `osm-fuel`

| Vidik | Dejstvo |
|---|---|
| **Licenca** | ODbL 1.1 — „© OpenStreetMap avtorji"; obvezna atribucija |
| **Vrsta** | odprti podatki (žive poizvedbe — Overpass API) |
| **Zrcala** | overpass-api.de · overpass.kumi.systems · overpass.private.coffee |
| **Obnova (P0-C)** | ✅ adapter `queryViewportPois` + `/api/pois?bbox=` (3 zrcala, rotacija ob napaki) |
| **Namerno varovanje vira** | max viewport 0,25°² · rate limit 5 s · timeout 15 s · limit 200 POI |
| **Stanje** | 🟢 ACTIVE (odprti vir brez aktivacije) — nedosegljivost je ISKRENA napaka (nikoli izmišljeni POI) |

**Opomba (iskrenost):** v peskovniku rekonstrukcije Overpass API ni dosegljiv
(egress proxy → HTTP 500 na vseh zrcalih). V produkciji (Render/Vercel) sloj
deluje; v peskovniku API iskreno vrne 502 z razlogom in atribucijo — enak
vzorec degradacije, kot ga je imel izvirnik na Renderu („Lokalni vir
nedosegljiv"). Ploščice zemljevida (Leaflet) se naložijo v brskalniku
uporabnika in delujejo povsod.

**Atribucija:** `Podatki © OpenStreetMap avtorji, ODbL 1.1 (openstreetmap.org/copyright)`

---

## 3. Slovenska turistična organizacija (STO) — `sto`

| Vidik | Dejstvo |
|---|---|
| **Vir** | https://www.slovenia.info/llms.txt (živ, javen, objavljen ZA AI asistente) |
| **Obseg** | 7 jezikov (sl, en, de, it, fr, ru, es) + zgodbe (en, de) |
| **Licenca** | uradna vsebina STO — namensko objavljena za AI/iskalnike (llms.txt standard) |
| **Vrsta** | statična vsebina (RAG vir) — NI geo feed, NI zemljevidska plast |
| **Ingest (P0-C)** | ✅ IZVEDEN iz ŽIVEGA vira: **752 vnosov / 7 jezikov** (`data/sto-content.json`, 209 KB) |
| **Osvežitev** | `bun run sto:ingest` + cron `/api/cron/sto-reingest` (torek 7:30 UTC) |
| **Stanje** | 🟢 ACTIVE — edini sloj P0-C z REALNIMI podatki ŽE DANI |

**Format vira (preverjeno 2026-10-07):** H1 naslov → blockquote uvod → 8
odsekov (`##`) → vnosi `- [naslov](url): opis` (opis po llms.txt standardu
neobvezen; vgnezđeni zamaknjeni vnosi = destinacije znotraj regij).
Parser je determinističen in fail-closed: nedovoljeni URL (ne-https ali tuji
gostitelj) NE vstopi v množico (zaščita pred zastrupitvijo vira).

**Atribucija:** `Vir: Slovenska turistična organizacija — slovenia.info (llms.txt, uradna vsebina)`

---

## 4. KiwiTaxi — `kiwitaxi`

| Vidik | Dejstvo |
|---|---|
| **Licenca** | partnerjev objavljeni feed (webmaster API za prikaz objavljenih cen z atribucijo) — cene so partnerjeve |
| **Vrsta** | partner-feed (TSV/CSV) + zunanja rezervacija |
| **Stanje cen** | FROM_PRICE (objavljena „od"-cena — NI živ citat; payment_type privzeto `partial`) |
| **Izvirnikov feed** | IZGUBLJEN na mrtvem računu — **nasledil: uradni webmaster CSV API** (kiwitaxi.com/services/data/csv, javno dokumentiran security_token; preverjeno 17. 10. 2026) |
| **Obnova (P0-C)** | ✅ koda: shema + validacija (ISO-2, cena > 0) + `routeTouchesSlovenia` + iskanje + `bun run kiwitaxi:ingest --csv` |
| **Množica (2.x)** | ✅ `data/kiwitaxi-routes.json` — 6.360 rut regije SI·HR·ME·AL (1.501 se dotika SI); preverba LJU→Zagreb 216 EUR = splet €216 isti dan; paket `docs/research/kiwitaxi-vir.md` |
| **Rezervacija** | ZUNANJA pri partnerju (iskrene povezave; provizija = neobvezna `pap=<ID>` po affiliate prijavi — lastniški korak) |

**Runbook (E2E testirano 17. 10. 2026):**
```bash
# 1) entitetni TSV (~123 MB, izven repozitorija) + kanonski CSV regije
python3 scripts/kiwitaxi-export.py --download --data-dir /tmp/kiwitaxi-feed \
        --out /tmp/kiwitaxi/region.csv          # --security-token ob individualizaciji
# 2) ingest — kanon nespremenjen (fail-closed: 0 veljavnih rut → nič ni prepisano)
bun run kiwitaxi:ingest --csv /tmp/kiwitaxi/region.csv
```
Kanon iskrenosti: kjer feed nima rut → „ni transfernih rut" (praznina je
odgovor, ne napaka). Tedensko osveževanje = ista 2 ukaza (prej ali skupaj
z `/api/cron/sto-reingest` oknom, sreda zjutraj UTC).

**Atribucija:** `Transferji in cene: KiwiTaxi (objavljeni partner feed) — rezervacija pri partnerju`

---

## 5. Cron (vercel.json) — P0-C dela

| Urnik (UTC) | Endpoint | Opis |
|---|---|---|
| `30 7 * * 2` | `/api/cron/sto-reingest` | osvežitev STO vira (tedensko) |
| `30 7 * * 3` | `/api/cron/kiwitaxi-reingest` | osvežitev KT feeda (poroča stanje množice; osvežitev = 2 ukaza iz runbooka §4) |

Preostalih 6 cron opravil izvirnika (daily-trip-push, recalculate-status,
commission-invoices, weekly-alerts, renewal-reminders, draft-reminders) se
obnovi SKUPAJ s svojimi funkcionalnostmi (P0-E+) — namerno ne dodajemo
ur nikomur, ki bi klical še neobstoječe poti.

**Varnostni kanon cron poti:** Bearer `CRON_SECRET` obvezen (brez njega
401 — fail-closed, izvirnikov kanon); poročila brez skrivnosti (samo števci);
idempotentnost (ponovni klic = isti zapis istega vira).

---

## 6. Neposredne izjeme in skrivnosti

- Noben od štirih virov NE zahteva poverilnic za READ (vsi javni/odprti).
- `FSQ_PLACES_DIR` (pot mape, ne skrivnost) je edina env spremenljivka slojev;
  lib je NE bere (kanon: env samo v strežniškem sloju, pot se vbrizga).
- `CRON_SECRET` je edina skrivnost cron poti — nikoli se ne izpiše.
- data/sto-content.json in data/kiwitaxi-routes.json sta v repozitoriju
  (javnost vira = javnost množice); data/fsq-places/ se doda, ko pride
  lastniški HF žeton (paket docs/research/fsq-os-places-vir.md).

## 7. Kaj je RECOVERY_CLAIM_ONLY (issue §32)

- Trditev izvirnika „125.446 POI" je BASELINE (pričakovanje), ne dejstvo 2.x —
  dokler množica ni nameščena, health izpisuje „množica čaka vir".
- Izvirnikova natančna FSQ preslikava in KT CSV razpored stolpcev sta izgubljena
  (mrtvi račun) — 2.x shemi v tem dokumentu sta nova kanonska resnica.
