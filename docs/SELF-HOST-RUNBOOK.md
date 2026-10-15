# Self-Host Runbook: Valhalla (faza 2) + Photon (faza 3)

**Namreč:** pretvori lastniški odločitvi iz `docs/research/balkan-platform-no-ai.md` §9/§10
(»VPS **[nepotrjena cena]** — zahtevati ponudbe«) v konkreten, poglobljen izvedljiv načrt
z viri in merjenimi vrsticami. **Koda se NE spremeni** — self-host je zgolj
`VALHALLA_BASE_URL` / `PHOTON_BASE_URL` env override (kanon 2.65.0/2.64.0; testi zaklenjeni).

- Napisano: 14. 10. 2026 · viri dostopani 14. 10. 2026 (izrecno označeno) ·
  **osveženo 15. 10. 2026**: §3 Photon živo dokazan v peskovnici (§3.1.1)
- Status: odločitev ostaja LASTNIŠKA (ta dokument je priprava, ne odločitev)
- Varnostni pas: unset env → promet takoj nazaj na javna primerka (FOSSGIS / photon.komoot.io)

---

## 1. Merjene izhodiščne vrstice (prva roka, 14. 10. 2026)

Geofabrik izvozi `europe/<država>-latest.osm.pbf` (izdaja **13. 10. 2026**), velikost izmerjena
s `Content-Range` glavo (Content-Length celotne datoteke):

| država | PBF (MB) | | država | PBF (MB) |
|---|---|---|---|---|
| SI | 299 | | RS | 229 |
| HR | 191 | | MK | 28 |
| BA | 154 | | XK | 29 |
| ME | 32 | | BG | 167 |
| AL | 51 | | GR | 326 |

**SKUPAJ ≈ 1 506 MB ≈ 1,47 GB** — to NI planet (planet Valhalla build ≈ 600 GB prehodno,
planet Photon indeks ≈ 95 GB diska / ≥64 GB RAM [komoot/photon README]). Regija 10 držav je
**red velikosti manjša** → cenejši strežnik kot planet-priporočila.

---

## 2. Valhalla self-host (faza 2 — trajna rešitev R11)

### 2.1 Slika in izgradnja

- Slika: **gis-ops/docker-valhalla** ( flexible, auto-build; vir: github.com/gis-ops/docker-valhalla, 14. 10. 2026).
  `valhalla/valhalla-build-tiles` + strežnik v enem vsebniku, konfiguracija prek env.
- Vhod: PBF-ji iz §1 (vseh 10 ali podmnožica po obsegu).
- Pričakovane velikosti (pravilo palca za to regijo, NE izmerjeno — zapiši realno ob prvem buildu):
  končni grafi ≈ 2–3× PBF ≈ **3–5 GB**; prehodno med buildom ≈ 10–20 GB diska.
- RAM za build: planet-priporočila so 32–64 GB (vir: community.openstreetmap.org
  »OSM, Valhalla and Curvature server«, avg. 2024: »8 cores and 64 GB … for 1,000 users, 16
  concurrent API calls; possible to start exploring with 32 GB«). Za 1,47 GB PBF je
  **8 GB varno, 16 GB udobno** — prvi build je tudi test te ocene (zapiši izmerjeno!).

### 2.2 Posodobitve (Geofabrik izvozi so dnevni)

- docker-valhalla podpira `tile_update_cron` (periodičen re-build) — nastavi na dnevno
  (ponoči, izven prometa); ali zadrži tedensko, če obremenitev ni kritična.
- Disk: obdrži PBF + stare tile do uspešnega novega builda (≈ 2× prostora za varno zamenjavo).

### 2.3 Omejevanje (VAŽNO — lastni VPS nima FOSSGIS fair-use zaščite)

Javni primerek `valhalla1.openstreetmap.de` ima »fair-usage policy … somewhat enforced by
rate limits« (vir: valhalla.github.io/valhalla/start/introduction, 14. 10. 2026). Lastni
VPS ta zaščite NIMA — postavi jo sam (Caddy/nginx rate limit na /route, npr. 60/min/IP —
isti kanon kot aplikacijski rate limit na `/api/plan/directions`). UA etiquette ostane
(`DiscoverSlovenia-AI/…` sledi OpenStreetMap etiquette — koda ga pošlje že zdaj).

---

## 3. Photon self-host (faza 3 — geokodiranje)

### 3.1 Slika in indeks

- Uradno: **komoot/photon** (Java 21+; planet ≈ 95 GB disk, ≥64 GB RAM [README, 14. 10. 2026]).
- Enostavneje: **rtuszik/photon-docker** (neuradna slika; sam prenese pregrađen indeks po
  državi/world; vir: github.com/rtuszik/photon-docker, 14. 10. 2026). ⚠️ Neuradna = ista
  lekcija kot OpenFreeMap en-vzdrževalec (R3): oceni vzdrževalca pred odvisnostjo.
- ⚠️ **POPRAVEK žive preverbe (15. 10. 2026)**: pregrađeni **DB** indeksi (rtuszik ogledalo
  `r2.koalasec.org/public`) pokrivajo SAMO velike države (DE, FR, AT, ES, NL, PL, IN, JP …) —
  **SI + balkanske države NISO med njimi** (`db_available: false` v regions.py; `si.tar.bz2`
  in `photon-db-slovenia-1.0-latest.tar.bz2` = 404). Za našo regijo 10 držav je zato pot:
  **uradni photon `import` iz JSONL dump-a** — ogledalo gosti dnevne dump-e za VSE regije
  (`europe/slovenia/photon-dump-slovenia-master-latest.jsonl.zst`; last-modified = dnevni build).
- ⚠️ Photon 1.x NIMA direktnega PBF importa (odstranjena nominatim-PBF pot): `import` sprejme
  Nominatim PG bazo ALI JSON dump (NominatimDumpFile). Stara trditev »`photon_index_builder`
  iz PBF-jev iz §1« NE drži več za photon ≥ 1.0 — enak vir podatkov dosežemo z dnevnim
  JSONL dump-om ( isti OSM izvoz, data_timestamp v glavi dumpa).

### 3.1.1 ŽIVO DOKAZANO v peskovnici (15. 10. 2026 — celoten uradni potek, brez dockera)

- Viri: `photon-1.3.0.jar` (98 MB, komoot/photon releases, Java 21 ✓) +
  `photon-dump-slovenia-master-latest.jsonl.zst` (**52 MB**, MD5 ujema, data_timestamp
  2026-10-10). Dekompresija: 52 MB → **680 MB** JSONL (0,8 s, python zstandard).
- Import: `java -Xmx1400m -jar photon-1.3.0.jar import -import-file slovenia.jsonl` →
  **593 956 dokumentov v 141 s** (peskovnica, ~1 vCPU, 2,7 GB RAM — heap 1400 m je zadostoval).
- Indeks `photon_data/` = **202 MB** (stara ocena »1–3 GB za 10 držav« je za SI realno
  višja za red velikosti; za celotno regijo pričakuj ≈ 1,5–2,5 GB — meri ob buildu).
- Serve: `java -jar photon-1.3.0.jar serve` (port 2322) → žive poizvedbe:
  `/api?q=Bled` → Bled, Slovenija, 4260 @ 14.110, 46.368 ✓ ·
  `/api?q=Ljubljanski grad` → Ljubljanski grad, Ljubljana ✓ ·
  `/reverse?lon=14.5060&lat=46.0624` → Pleteršnikova ulica, Ljubljana ✓.
- Jeziki indeksa: `[de, en, it, fr]` (sl NE — skladno z 2.64.0 ugotovitvijo »lang=sl 400«).
- Dokazilna datoteka: `docs/evidence/photon-live-verify/summary.md`.
- VPS implikacija: import SI je **2,5 min na 1 vCPU** — celotna regija (1 506 MB PBF-nivo)
  realno ≈ 20–40 min enkratni import; heap 2–4 GB iz §3.2 ostane priporočen.

### 3.2 RAM/disk

Regionalni vodnik (vir: tonsnoei.nl, mar. 2023): »at least 4 cores with at least 16 GB of
RAM« — to je za evropski obseg; za 10 držav je **4 GB minimum, 8 GB udobno** (Elasticsearch
heap + OS). Prvi build zapiši izmerjeno.

---

## 4. VPS ponudba (viri z datumi; cene se spreminjajo — PREVERI pred naročilom)

| vir | postavka | podatek (dostopano 14. 10. 2026) |
|---|---|---|
| hetzner.com/news/new-cx-plans (jun. 2024) | **CX42** | 8 vCPU · 16 GB RAM · 160 GB disk = **16,40 EUR/mes** (0,0273 EUR/h) |
| hetzner.com/cloud/cost-optimized | deljeni vCPU | **od 5,99 EUR/mes** |
| hetzner.com/cloud/regular-performance | dedicated linija | od 6,49 EUR/mes · **20 TB prometa vključen** |
| sparecores.com/server/hcloud/cx32 (3. opazovalec) | **CX32** | 4 vCPU · 8 GiB · 80 GB disk |

**Priporočilo:** ena instanca za OBE službi (Valhalla + Photon) —
**CX42 (16 GB)** udobno pokrije build + obratovanje obeh; **CX32 (8 GB)** je Minimalno
sprejemljivo (build 8 GB je na robu; Photon 4 GB heap znotraj 8 GB deluje). Tako se
ocena »5–20 EUR/mes [nepotrjeno]« iz §10 dokumenta pretvori v **podprto kototo 16,40 EUR/mes
(z uradnim virom)** + opozorilo, da se cene preverijo pred naročilom.

Regija: eu-central (nemško/finsko — latenca do SI ≈ 10–20 ms).

---

## 5. Izvedbeni koraki (ocena: 1 dan dela, vključno s prvim buildom)

1. **VPS**: naroči CX42 (ali CX32), Debian/Ubuntu, Docker + compose; firewall: samo 22/80/443.
2. **Prenos PBF**: `curl -O` za 10 držav iz §1 (≈ 1,5 GB, enkrat); zapiši datum izvoza v dokaz.
3. **Valhalla**: compose z gis-ops sliko, montiraj PBF, build (zapiši trajanje + RAM vrh!),
   `tile_update_cron` dnevno; rate limit Caddy/nginx 60/min/IP na /route.
4. **Photon**: rtuszik/photon-docker (ali uradni build) z istimi PBF-ji; heap 2–4 GB.
5. **Smoke testi (VPS)**: `curl /route` → `trip.status 0` (ista pogodba kot 2.65.0 curl test);
   `curl /api?q=Bled` → GeoJSON FeatureCollection; p95 < 300 ms merilo iz dokumenta §10.
6. **Preklop aplikacije**: v Vercel env nastavi `VALHALLA_BASE_URL=https://…/route?json=` pomembno:
   točno obliko glej v kodi (`buildValhallaUrl`) in `PHOTON_BASE_URL`; redeploy.
7. **Verifikacija produkcije**: `/api/plan/directions` odgovarja s `source: "valhalla"` iz
   TVOJEGA hosta (server log na VPS to potrjuje); `/api/geocode` → `source: "photon"`;
   zlata pot /nacrtuj + /za-ponudnike (agent-browser, lekcija 1); health ok.
8. **Rollback**: unset obeh env → redeploy → promet nazaj na javna primera (0 sprememb kode).
9. **Zapri zanko**: #35 komentar (dokazi + izmerjene vrstice builda), ATTRIBUTIONS.md ne
   potrebuje spremembe (isti OSM izvor), worklog vnos.

---

## 6. Kaj se NE spremeni

- Iskrenostni kanon: cache 24 h/600, circuit breaker 4→10 min, `source` oznake
  (`valhalla|heuristic`, `photon|none`) — koda ostaja, testi 2338 ostajajo zaklenjeni.
- Geofabrik kot vir (dnevni izvozi), OSM atribucija v UI, UA etiquette.
- Rollback pot (unset env) ostane za vedno — javna primera sta ohranjena kot fallback.

## 7. Viri (vsi dostopani 14. 10. 2026)

- github.com/gis-ops/docker-valhalla — flexible Valhalla Docker (build + serve + update cron)
- valhalla.github.io/valhalla/start/introduction — javni demo = fair-usage (rate limits)
- community.openstreetmap.org/t/osm-valhalla-and-curvature-server/117482 — sizing (planet)
- github.com/komoot/photon — uradni Photon (Java 21+, planet 95 GB / 64 GB RAM)
- github.com/rtuszik/photon-docker — neuradna slika z regionalnimi indeksi
- chringel.dev (jul. 2022) — prebuilt indeksi po državi (~62 GB world za primerjavo)
- tonsnoei.nl (mar. 2023) — regionalni geokodirni strežnik sizing
- download.geofabrik.de/europe/… — 10 izvozov, izdaja 13. 10. 2026 (velikosti izmerjene 14. 10.)
- hetzner.com/news/new-cx-plans (jun. 2024) · hetzner.com/cloud/cost-optimized ·
  hetzner.com/cloud/regular-performance · sparecores.com/server/hcloud/cx32 — cene/specs
