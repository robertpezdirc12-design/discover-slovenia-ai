# GTFS javni prevozi — PoC in odločitveni paket

*(merjeno 17. 10. 2026 v peskovniku; skripta `scripts/gtfs-poc-meritve.ts`; dokazila `docs/evidence/gtfs-poc/`; avtor: agentska seja — brez spremembe aplikacijskega runtime-a)*

## 1. Cilj

Izmeriti, ali in kako lahko platforma pokaže **javni prevoz do kanonskih destinacij** (najbližje postaje + naslednji odhodi), po hišnih kanonih: iskrenost (nič ne-prijavljenega), brez novih odvisnosti v runtime, brez partnerjev (faza 5 je še odobritvena).

To NI uvedba OTP (ta ostaja zavrnjena do lastniške sodbe, glej §5 `balkan-platform-no-ai.md`) — to je meritev **statičnega GTFS** podatka.

## 2. Viri (stanje 17. 10. 2026)

| vir | status |
|---|---|
| MobilityData katalog (`mobility-database-catalogs`) | **6 SI feedov** (LPP + 5 lokalnih) — potrjeno enako kot §5 raziskave |
| **LPP** (`avl.lpp.si/transit/api/gtfs`; stari `data.lpp.si/api/gtfs/feed.zip` zdaj 302 sem — *posodobljeno isti dan, pozno dop.*) | **JAVNO dostopen, SVEŽ** (okno 2026-10-16 → 11-15, ~30-dnevna rotacija). **POZOR:** preusmerjena pot (`curl -L`) vrača ODREZAN zip (19 MB, manjka centralni imenik) — prenašati NEPOSREDNO z nove domene (42,5 MB cel, `unzip -t` brez napak; GET edino, HEAD=405). Produkcija naj črpa direktno z `avl.lpp.si` |
| **DUJPP nacionalni** (`b2b.nap.si/data/b2b.gtfs`) | **HTTP 401 — B2B registracija** (nacionalni prevoznik JPP; največji potencial pokritosti) |
| NOMAGO Brežice / Nova Gorica, Ariva Jesenice, Turizem Kranjska Gora | HTTP 401 — B2B registracija |
| zrcalo `mdb-latest` (GCS) | za LPP **zastarelo** (jun–jul 2026) — katalogova svežina je nezanesljiva za SI |
| podatki.gov.si CKAN | iskanje "gtfs": 1 zadetek, ni GTFS → **nacionalni CKAN še vedno 0** (re-check 17. 10.) |
| NAP.si portal | stari ASP.NET + captcha, brez javnega API — registracija edina pot |
| Slovenske železnice (SŽ) | v MobilityData katalogu **niso**; javni GTFS po dostopnih virih ni najden — preveriti ob NAP registraciji |

## 3. Izmerjeno (LPP, svež feed — polni izpis v dokazilih)

| meritev | vrednost |
|---|---|
| feed | 40,5 MB zip → 725 postaj · 31 linij · 60 446 voženj · **1 545 193 odhodov** |
| model koledarja | brez calendar.txt; **ena storitev na dan** (31 vrstic calendar_dates) |
| dan meritve 2026-10-17 | 1 aktivna storitev, **30 964 odhodov** |
| pokritost kanona 74 | **1/74 ≤1 km — samo Ljubljana** (Bavarski dvor 0,05 km od kanonske koordinate; 44 postaj ≤1 km, 131 ≤2 km) |
| prototip odhodov (Bavarski dvor @ 08:32) | 8 realnih naslednjih odhodov (linije 14, 27, 08, 20Z, 02, 09, 06, 13) — glave voženj + kratka imena linij pravilni |
| pretakanje stop_times (250 MB) | 5 576 ms |
| SQLite prototip | uvoz 1,55 M vrstic **6 469 ms** + indeks 1 121 ms → baza **314,5 MB**; odhodna poizvedba **1 ms** |
| **re-validacija 2026-10-17 (pozno dop.)** | meritve **reproducirane 1:1** na svežem prenosu z nove domene (725 postaj · 31 linij · 60 446 voženj · 1 545 193 odhodov · isto okno; živih 8 odhodov Bavarski dvor @ 08:50; pretakanje 6 163 ms) — paket še veljaven, vir zdaj `avl.lpp.si` (§2) |

## 4. Iskrene ugotovitve

1. **LPP sam ni rešitev za platformo** — pokriva 1/74 destinacij (Ljubljana). Vrednost je dokaz cevovoda, ne pokritost.
2. **Nacionalna pokritost = DUJPP feed = B2B registracija** na NAP.si. Registracija je upraviteljski korak (račun + pogoji), ki ga mora odobriti/vesti lastnik — agentska seja NIMA pooblastil za ustvarjanje računov pri tretjih.
3. **Katalogova zrcala (mdb-latest) so za SI nezanesljiva** — produkcija bi morala črpati iz neposrednih virov (ali voditi lastni dnevni sync), drugače tvega zastarele urnike (kanon iskrenosti).
4. **Licence: NI verificirano.** LPP odprti podatki in NAP.si B2B imata svoje pogoje — pred produkcijo je OBVEZEN pravni pregled + vnos v `ATTRIBUTIONS.md` (kanon pogl. 4 raziskave). Ta PoC teh korakov ne opravi.
5. **Serverless omejitev:** 314,5 MB SQLite-baze NE sme potovati v Vercel bundle. Izvedljive arhitekture: (a) dnevni import v obstoječo Postgres fazo (Neon) + poizvedbe po indeksu — uvoz je izmerjeno v redu minut; (b) pripravljen izvoz "postaja → odhodi po dnevu" (predračun); (c) server-side fetch+pretočitev je izmerjeno 5,6 s — preveč za Vercel funkcijo brez predpomnilnika.

## 5. Opcije za odločitev lastnika

| opcija | vsebina | pokritost | strošek | ovire |
|---|---|---|---|---|
| **A** | LPP layer za Ljubljano (odhodi na strani destinacije Ljubljana) | 1/74 | 0 EUR | licenca LPP (pregled), dneven sync |
| **B (priporočeno za evalvacijo)** | NAP.si B2B registracija → meritve DUJPP feeda (isti merilni skripti) → šele potem odločitev o produkciji | potencialno večina 74 (avtobusno omrežje JPP) | 0 EUR (registracija) | lastniški račun; licenca NAP |
| **C** | OTP re-evaliacija (načrtovalnik potovanj z javnim prevozom) | — | self-host VPS (16,40 EUR/mes, glej faza 2) | lastniška sodba obsega (raziskava §5) |
| **D** | brez dejanja — javni prevoz ostane izven obsega | — | 0 | — |

Priporočilo agentske seje: **B** kot naslednji korak (izmeriti nacionalni feed z ISTO skripto, ki je zdaj v repozitoriju in dokazano deluje), produkcijo odložiti do licenčnega pregleda in dobro izmerjene pokritosti. Opcija A je možna kot vaja, ampak sama po sebi ne prinese vrednosti obiskovalcem izven Ljubljane.

## 6. Kaj ta PoC NI

- NI produkcijške spremembe (0 vrstic v `src/`, 0 vrstic v Prisma shemi, verzija nespremenjena).
- NI uvedba OTP niti kakršnegakoli načrtovalnika.
- NI licenčna ocena (samo evidentirane odprta vprašanja).
- NI registracija pri NAP.si (to je lastniški korak).
