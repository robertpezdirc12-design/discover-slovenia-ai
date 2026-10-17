# ATTRIBUTIONS — atribucije zunanjih virov (obveznost #35 §9 faza 1)

Vsi zunanji podatkovni/vizualni viri platforme, z licenco in datumom
verifikacije. Posodablja se ob VSAKI menjavi vira (kanon dokumenta
`docs/research/balkan-platform-no-ai.md`, §9 faza 1: „ATTRIBUTIONS.md
ostaja obveznost pred vsako menjavo“).

| plast / vir | uporaba | ponudnik / host | podatkovna licenca | koda / stil | verifikirano |
|---|---|---|---|---|---|
| **Zemljevid — standardni** (privzeti, Leaflet 1.9.4) | `/zemljevid`, `/nacrtuj` | OSMF — `tile.openstreetmap.org` | © OpenStreetMap contributors, **ODbL 1.0** | Leaflet BSD-2 | 14. 10. 2026 (produkcija) |
| **Zemljevid — vektorski PoC** (`?zemljevid=vektorji`, 2.63.0) | `/zemljevid` samo v PoC | OpenFreeMap javni primerek — `tiles.openfreemap.org` (slog Liberty: openmaptiles vektor + Natural Earth raster) | © OpenStreetMap contributors, **ODbL 1.0** (podatki); Natural Earth = javna domena | MapLibre GL JS 6.14.0, **BSD-3** (preverjeno 13. 10. 2026); slog Liberty OpenFreeMap | 14. 10. 2026 (curl slog + TileJSON) |
| **Routing** (vozne poti, 2.65.0 — faza 2) | `/api/journey/route`, `/api/plan/directions` | Valhalla javni primerek FOSSGIS — `valhalla1.openstreetmap.de` (BJS za lahkotno uporabo; self-host: `VALHALLA_BASE_URL`, koda ista) | © OpenStreetMap contributors, **ODbL 1.0** (OSM graf) | Valhalla, **MIT** (verificirano prek GitHub valhalla/valhalla LICENSE) | 14. 10. 2026 (curl `/route?json=…`: trip.status 0, summary length/time, shape polyline6) |
| **POI (živo)** | `/api/pois` | Overpass javni primerek | ODbL 1.0 | — | 14. 10. 2026 |
| **Geokodiranje / krajevno iskanje** (`/api/geocode`, 2.64.0 — faza 3) | prijavnica ponudnika (`/za-ponudnike`), strežniško | Photon javni primerek — `photon.komoot.io` (BJS, fair-use; self-host: `PHOTON_BASE_URL`, koda ista) | © OpenStreetMap contributors, **ODbL 1.0** (podatki) | Photon, **Apache-2.0** (potrjeno prek LICENSE, raw 13. 10. 2026) | 14. 10. 2026 (curl `/api/`: GeoJSON, `lang` samo default/de/en/fr — `lang=en`) |
| **Transferji — KiwiTaxi** (objavljene „od"-cene, množica `data/kiwitaxi-routes.json`) | transferni feed regije SI·HR·ME·AL (iskanje rut; rezervacija ZUNANJA pri partnerju) | KiwiTaxi — uradni webmaster CSV API `kiwitaxi.com/services/data/csv` (javno dokumentiran; namen API-ja = prikaz partnerjevih objavljenih cen z atribucijo) | partnerjeve objavljene cene (FROM_PRICE — ni živ citat; ni ODP licenca, namenski webmaster dostop) | — | 17. 10. 2026 (curl entitet: 200; križna validacija LJU→Zagreb 216 EUR = splet €216 isti dan; paket `docs/research/kiwitaxi-vir.md`) |

## Pravila

1. **Atribucija je VEDNO vidna v UI** — standardni zemljevid: „© OpenStreetMap
   contributors“ (TileLayer attribution); vektorski PoC: AttributionControl
   z istim besedilom + povezava na OpenFreeMap.
2. **ODbL share-alike**: izpeljane baze (kurirani kanon destinacij) so
   sprotno označene z provenance metapodatki (#38 kanon) — ne spreminjajo
   OSM podatkov, ampak jih navajajo; morebitne izpeljane baze bodo
   objavljene pod ODbL.
3. **Menjava vira** (npr. faza 2 Valhalla / self-host ploščic) MORA ta
   dokument posodobiti v ISTEM PR-ju — datum verifikacije je obvezen.
4. Viri brez komercialne licence (OSMF javne ploščice, MapTiler/Stadia free)
   so status quo / zavrnjeni po dokumentu #35 §2/R1 — vsaka produkcija na
   njih mora ostati „lahkotna uporaba“ do lastniške re-deizije.

*Ustvarjeno v 2.63.0 (#35 faza 1 PoC) — 14. 10. 2026.*
