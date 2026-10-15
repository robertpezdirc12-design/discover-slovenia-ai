# Raziskovalna verifikacija 15. 10. 2026 (2.66.2)

> Sprožilec: „nadaljuj raziskuj poliraj nadgrajuj“. Cilj: pretvorba
> nepotrjenega → preverjeno (iskrenostni kanon #38) v treh plasteh:
> dogodki (termini), javni prevoz (GTFS), cestna kvaliteta (Valhalla).

## 1. Dogodki — verifikacija terminov (13 `dateUnconfirmed` zapisov pregledanih)

| dogodek | izid | vir (dejansko brano) |
|---|---|---|
| sofija-film-fest-2027 | ✅ POTRJEN 11.–21.3.2027 | siff.bg/en (organizator; SSL cert potekel — brano z `-k`); neodvisno Eventival (11.–21.3.2027) |
| festival-soca (Tolminator) | ✅ POTRJEN 28.7.–1.8.2027 | tolminator.com (organizator): „28 July - 1 August 2027“ + EARLY BIRD vstopnice v predprodaji (mojekarte.si) |
| vinska-vigred-maribor | ✅ POTRJEN 21.–23.5.2027 | zgodovinska-mesta.si (uradni zapis, proza); isto polje strukturirano 19.–23.5. (vključno postavitev) |
| jurjevanje-bela-krajina | ✅ POTRJEN 21.–25.6.2027 | zgodovinska-mesta.si: „Datum: 21.06.2027 - 25.06.2027“ (RIC Bela krajina) |
| exit-novi-sad-2027 | ❌ ODSTRANJEN — festival ukinjen | Wikipedia (več virov): „Years active 2000–2025“, „cancelled after the 2025 edition“; organizatorji: „no possibility … in Serbia [in 2026]“ + „global tour“ |
| pivo-in-cvetje-lasko | ⚠️ mesec 6 → 7 (julij); termin 2027 neobjavljen | 61. izdaja 10.–12.7.2026 (lasko.info + uradna FB); 60. 9.7.2025 (lasko.si); pivoincvetje.si za JS-vprašanjem |
| ohridsko-leto-2027 | ◐ ostaja nepotrjen; okno dokumentirano | ohridskoleto.com.mk brano: 66. izdaja zaprta 20.8.2026; fiksno okno 12.7.–20.8. od 1961 |
| sarajevo-film-fest-2027 | ◐ ostaja nepotrjen | sff.ba: 32. izdaja 14.–21.8.2026 (zaključena); 33. še ni objavljena |
| bled-winter-magic | ✗ ni primarnega datuma | bled.si stran brez specifičnih 2026/27 datumov; blog NI primarni vir |
| bozicni-sejmi-maribor | ✗ ni primarnega datuma | visitmaribor.si JS-rendered; sekundarni vir: „termin 2026 še ni objavljen“ |
| jamski-sejem-postojna | ✗ ni primarnega datuma | postojna.si vsebuje samo mesečne sejme (okt. 2026) |
| blejski-danovski-festival | ✗ ni zadetkov | — |
| bela-krajina-koline | ✗ ni zadetkov | — |

Iskrenostni kanon ohranjen: 5 zapisov ostaja nepotrjenih (prazen
`dateStart` + pošten napis), 4 potrjena z `source`+`verifiedAt`, 1 odstranjen.

## 2. Javni prevoz (GTFS) — [nepotrjeno] → preverjeno za 10 držav

**Vir:** katalog `MobilityData/mobility-database-catalogs` @ HEAD
(git tree API, netruncated: 3588 vnosov, **2488 GTFS schedule feedov**),
prebran v celoti 15.10.2026. Direktorij `catalogs/sources/gtfs/schedule/`.

| država | feedov | agencije |
|---|---|---|
| SI | 6 | LPP Ljubljana + 5 lokalnih (Brezice, Jesenice, Kranjska Gora, Nova Gorica, Timetables SI) |
| HR | 4 | ZET + HŽPP (nacionalne železnice) ×2 + Gradski parking |
| BA | 1 | LivnoBus |
| ME | 2 | ŽPCG (nacionalne železnice) + Podgorica Putevi |
| AL | 3 | Tirana (municipality) + Vlora urban + ShowMeBus Balkan |
| RS | 7 | Srbijavoz (nacionalne železnice) + Beograd prigradski + RS (1027) + Lasta + Niš Ekspres + Niš Direkcija + Kragujevac |
| MK | 2 | JSP Skopje + Makedonski železnici Transport |
| XK | **0** (potrjeno) | — |
| BG | 4 | Sofija ×2 + Burgas + Pleven |
| GR | 4 | OASA Atene ×3 + TrainOSE (Thessaloniki) |

Skupaj: **29 feedov / 10 držav; Kosovo edina brez vira.**

**Zaporedna posledica:** premisa izključitve OTP („brez nacionalnega
GTFS“) je za RS/HR/ME/MK/BG/GR padla — zapisana v §9 kot odprto
vprašanje za lastniško re-evaluacijo (zavrnjeno stanje ne zamenjamo
samo od sebe).

## 3. Cestna kvaliteta Albanije na Valhalla grahu — izmerjeno

**Metoda:** javni FOSSGIS primerek `valhalla1.openstreetmap.de` (isti
kanon kot `/api/plan/directions`: GET /route, costing=auto,
polyline6, units=kilometers). 6 klicev, 5 s razmik (fair-use). Dekodera
identična `decodePolyline6` iz `road-routing-server.ts`.

| ruta | status | km (ref) | odmik | čas | točk | max gap |
|---|---|---|---|---|---|---|
| AL Tirana→Shkodër | 0 | 98,4 (92) | +7,0 % | 113 min | 1736 | 0,72 km |
| AL Tirana→Vlorë | 0 | 155,8 (147) | +6,0 % | 128 min | 2481 | 1,35 km |
| AL→ME Shkodër→Podgorica | 0 | 60,6 (68) | −10,9 % | 99 min | 2595 | 0,72 km |
| HR Zagreb→Zadar (baseline) | 0 | 286,2 (287) | −0,3 % | 187 min | 3828 | 3,88 km |
| GR Athens→Patras (baseline) | 0 | 211,4 (210) | +0,7 % | 142 min | 3931 | 2,07 km |
| MK Skopje→Ohrid (baseline) | 0 | 171,2 (170) | +0,7 % | 177 min | 3489 | 0,65 km |

**Sklep:** albansko OSM cestno omrežje na Valhalla grahu je
**funkcionalno in primerljivo z baseline državami** — 6/6 rut status 0,
dolžine v pričakovanem pasu (ref = približek, ne natančen vir), oblika
kontinuiteta znotraj baseline (max gap 1,35 km AL < 3,88 km HR). Vzorec
je omejen (3 intercity + 3 reference) — kakovost minorih cest NI
merjena; zapis v §5 je „izmerjena (vzorec)“, ne „avditirana“.

Surovi rezultati: `valhalla-albania-meritve.json` (istna mapa).

## 4. CI (spremljanje, ne del tega merge-a)

GitLab pipeline 2950120750 (push 2.66.1): instant-fail, 0 jobs,
started: null → **identity verification ŠE ZDAJ ni opravljena**
(owner vrata; enak vzorec kot 2.66.0/2.65.x). GitHub Actions: billing
(spend limit) — nespremenjeno. Lokalna vrata so edini aktivni dokaz.
