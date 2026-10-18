# ARSO LiDAR — meritve virov (18. 10. 2026, peskovnik)

Naloga (uporabnik): »in arso lidar naredi« — integracija ARSO/GURS LiDAR visokoločljivostnih
terenih podatkov. Vsi podatki spodaj so **izmerjeni z realnimi klici** (curl/HEAD/dokončan
prenos), ni ugibanj.

## 1. Storitve (gis.arso.gov.si, ArcGIS REST 10.91)

| Storitev | Tip | Preverjeno |
|---|---|---|
| `Lidar_hillshade_D96TM/MapServer` | cached + dynamic | `f=json` 200; `singleFusedMapCache=true`, tileInfo: 256×256 JPEG, origin (-5122600, 5001100), 15 LOD (res 1322.9 → ~1.6 m) |
| `Lidar_fishnet_D96/MapServer` | Query | `1=1` query 200; polja `NAME` (npr. `393_73`), `BLOK`, `DATUM_SNEM` (snemanje 2014); 1 km × 1 km ploščice, EPSG:3794 |
| WMS (`/WmsServer`) | — | **HTTP 400** — cached storitev ne izpostavlja WMS (izmerjeno) |
| Dinamični izvoz `/export` | ✅ | HTTP 200, PNG 512×512 (bbox 490000,100000–510000,120000, D96TM) in **PNG 256×256 z `bboxSR=3857&imageSR=3857`** (Bled) — vizualno potrjeno pravo LiDAR hladčenje |

Ključni ugotovitvi: (a) cached ploščice `/tile/{z}/{y}/{x}` vračajo 404 za računane kombinacije
(vrsta po meri, ne Web Mercator) — uporaben je **dinamični `/export`**, ki sprejme Web Mercator
bbox in sam reprojektira; (b) fishnet omogoča precizno lociranje surovih snemalnih blokov.

## 2. Surovi/izpeljani izdelki — JGP portal (ipi.eprostor.gov.si)

API odkrit prek browser-network sledenja (SPA kliče `jgp-service-api`):

- `GET /jgp-service-api/display-views/groups` → drevo; pot: *Državni topografski sistem (23) → Digitalni model višin (43) → produkt (113)*
- `GET /jgp-service-api/display-views/groups/113/files` → 7 datotek
- `GET /jgp-service-api/display-views/groups/113/files/{id}` → `{"url": "…download/…?token=…"}` (token URL uporabiš dobesedno)

**Izmerjene velikosti (HEAD 200 + Content-Length):**

| Datoteka | id | Velikost | Format |
|---|---|---|---|
| DMV0050_JV.ZIP | 516 | 626 845 431 B | x,y,z ASCII (5 m) |
| DMV0050_JZ.ZIP | 517 | 801 862 788 B | x,y,z ASCII (5 m) |
| DMV0050_SV.ZIP | 518 | **1 257 171 528 B** | x,y,z ASCII (5 m) |
| DMV0050_SZ.ZIP | 469 | 782 750 344 B | x,y,z ASCII (5 m) |
| DMV0125.zip | 540 | 790 522 879 B | x,y,z ASCII (12,5 m) |
| DMV0250.zip | 549 | 201 061 965 B | x,y,z ASCII (25 m) |
| DMV1000.zip | 449 | 14 941 432 B | x,y,z ASCII (100 m) |

DMV0050 skupaj ≈ **3,47 GB** (4 četrtine). Oznaka »2007–2016« (LiDAR cikel + CAS posodobitve).

**Dokončan prenos + vsebinska preverba:** `DMV1000.zip` (14,9 MB, 62,7 s, ~238 kB/s) →
3258 datotek `VTA####D96.XYZ`; vzorec vrstic:

```
380427.70 97487.70  115.26
380527.70 97487.70   95.35
```
(x y z, D96/TM, 100 m mreža → format potrjen na pravih podatkih.)

## 3. Licenca

- OPSI `digitalni-model-visin` (podatki.gov.si, CKAN API): izdajatelj **MOP / Geodetska uprava RS**,
  licenca **Priznanje avtorstvo (CC BY 4.0)**, »Podatki so javno dostopni in na voljo za dostop
  in ponovno uporabo«. Splošni pogoji GP: e-prostor (acitem=1821-1822).

## 4. Integracija (implementirana v peskovniku, referenčna)

- `src/lib/arso-lidar.ts` — čista geometrija XYZ↔EPSG:3857 + `arsoLidarTileUrl(x,y,z)`
  (dinamični /export, 1 zahteva = 1 ploščica, fair-use: brez prefetcha, `updateWhenIdle`)
- `src/components/home/map-section.tsx` — preklop **LiDAR relief** (Switch); preferenca trajna
  (localStorage, `useSyncExternalStore`); atribucija GURS/ARSO (CC BY 4.0)
- Browser-verificirano: 18+ ploščic naloženih, relief Julijcev/Karavank vidno hladčen,
  preferenca preživi reload
- **Produkcija (priporočilo):** proxy + disk predpomnilnik pred ARSO (zahteve so ~1,9 s),
  ali pretvorba DMV0050 v lastne terrain/RGB-encoded ploščice (martini/terraphim vzorec)

## 5. Neizmerjeno / nerešeno (iskreno)

- Surova LiDAR točkovnaoblaka (LAS/LAZ, ~0,5 m gostota) **ni bila najdena javno brez prijave** —
  JGP nosi samo mrežne izpeljanke; fishnet kaže bloke, distribucija točkov pa zahteva
  (po prejšnjih izkušnjah) prijavo/registracijo na e-prostor. **Ni potrjeno v tej seji.**
- Zmogljivost ARSO pri večjem prometu (rate limit) — ni testirana (fair-use disciplina),
  pred proizvodnjo obvezno proxy-cache.

## Artifacts

- `hillshade-bled-512.png` — pravi izvoz LiDAR hladčenja (bbox D96TM, Bled okolica)
- lokacija peskovnika: `/home/z/my-project/research/arso-lidar/`
