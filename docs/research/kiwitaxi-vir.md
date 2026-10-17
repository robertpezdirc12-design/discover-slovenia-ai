# KiwiTaxi — vir najden in ŽIV (odločitveni paket)

*(raziskava in meritve 17. 10. 2026 v peskovniku; skripti `scripts/kiwitaxi-export.py` + obstoječi `scripts/kiwitaxi-ingest.ts` (NESPREMENJEN — ena definicija kanona); dokazila `docs/evidence/kiwitaxi-vir/`; avtor: agentska seja — 0 produkcijskih sprememb vedenja, množica + matrika + docs)*

## 1. Kontekst

Matrika (`production-matrix.ts`) je za `kiwitaxi` vrata `data` utemeljevala z
»Feed z objavljenimi realnimi cenami je ostal na mrtvem GitHub računu — čaka
partner CSV iz affiliate programa«. Ta domneva je bila **nepreverjena**. Ta
paket jo preveri z merjenjem — isti vzorec kot pri FSQ (`fsq-os-places-vir.md`):
najprej vir, šele potem množica, koda pa čim manj.

## 2. Vir — dejstva (raziskava 17. 10. 2026)

| vir | status |
|---|---|
| **Uradni webmaster CSV API** (`kiwitaxi.com/services/data/csv/{countries,places,routes,transfers,transfer_types}`) | **JAVNO dostopen, ŽIV** — dokumentiran na `kiwitaxi.com/en/partner/webmaster/instructions/api` (HTTP 200); entiteta `Transfer` vsebuje **price_eur** (poleg price_usd/price_rub) per razred vozila |
| varnostni žeton | **javno dokumentiran** (»same for everyone«); stran napoveduje individualizacijo v prihodnje → skripta sprejme `--security-token` |
| `pap=<affiliate ID>` | SAMO za provizijo — za podatek NI potreben (kanon iskrenosti: povezave delujejo javno, brez provizije) |
| javne strani poti (robots dovoljene) | objavljene „od"-cene videnе; EUR v besedilu nekonsistenten (nekje samo USD) → API je prava pot, ne praskanje strani |
| anti-bot (429/JS izziv ob curl na HTML straneh) | **ne velja za `/services/data/csv/*`** — entitetni viri se prenesejo z navadnim curl (200) |

## 3. Izmerjeno (polni izpis v dokazilih)

| meritev | vrednost |
|---|---|
| transferji v viru (svet) | **811.755** (39,3 MB, prenos 21,6 s) |
| entitetne rute | 151.785 · s ≥1 transferjem 116.108 |
| preskočeni kraji (brez `name_en`) | 12 · zavrnjene cene (≤ 0) 4.169 |
| **rute v regiji SI·HR·ME·AL** | **6.360 unikatnih relacij** (1.501 se dotika SI) |
| pogosti pari regije | HR-HR 1752 · ME-ME 1701 · IT-SI 440 · SI-SI 350 · HR-SI 348 · AT-SI 256 · AL-ME 152 … |
| **križna validacija feed ↔ splet** | LJU→Zagreb: feed **216 EUR [Economy]** = splet **€216** isti dan (1:1) |
| E2E | export (živi prenos) → ingest: 0 neveljavnih, 0 duplikatov → `data/kiwitaxi-routes.json` (6.360 rut, 1,6 MB) |

## 4. Pot do podatkov — CEVOVOD ŽE E2E TESTIRAN (2 ukaza)

```bash
# 1) prenos entitet (~123 MB, izven repozitorija) + kanonski CSV regije
python3 scripts/kiwitaxi-export.py --download --data-dir /tmp/kiwitaxi-feed \
        --out /tmp/kiwitaxi/region.csv
# 2) ingest — KANON NESPREMENJEN (isti fail-closed pravila kot P0-C)
bun run kiwitaxi:ingest --csv /tmp/kiwitaxi/region.csv
#    → data/kiwitaxi-routes.json (source, license, ingestedAt, routes[])
```

Osvežitev: isti 2 ukaza (tedensko ob sto-reingest oknu; runbook
`DATA-PROVENANCE.md` §4). Cron `/api/cron/kiwitaxi-reingest` samodejno
preneha poročati no-op, ko je množica na repozitoriju (204 → status ok).

## 5. Opcije

| opcija | vsebina | strošek | ovire |
|---|---|---|---|
| **1 (izvedeno v tem PR-ju)** | ingesciraj javni webmaster feed regije (6.360 rut) — množica živa, gate „data" pade | 0 EUR | nobenih (žeton javno dokumentiran; če ga individualizirajo, `--security-token`) |
| 2 | čakaj individualni žeton / affiliate račun (formalnejša pot, + provizija `pap=`) | 0 EUR | lastniška prijava; feed je danes že javen — opcija 1 ne blokira ničesar |
| 3 | brez dejanja — množica ostane izven repozitorija | 0 | vrata „data" ostanejo |

Pripomba k opciji 2: provizija je neodvisna od podatkov — `pap=<ID>` je
lastniški korak, ki se doda na povezave kadarkoli (kanon drugih affiliate
plasti: brez ID-ja povezave delujejo javno, iskreno brez provizije).

## 6. Iskrene omejitve

1. **Žeton je danes javen, ni zagarantiran za vedno** — stran izrecno
   napoveduje individualizacijo. Export skripta ima `--security-token`;
   prehod na opcijo 2 je ena zastavica.
2. **Licenca**: API je dokumentiran *za webmasterje* (namen = prikaz
   partnerjevih objavljenih cen z atribucijo); formalne licenčne klavzule
   NI raziskana agentska seja. Atribucija je v množici
   (`KIWITAXI_ATTRIBUTION`) in v `ATTRIBUTIONS.md` (vnos v tem paketu).
3. **Svežina**: feed ne izpisuje časovnega žiga — osvežitev = ponovni
   prenos (izmerjeno ~2 min); `ingestedAt` v množici je iskren.
4. **payment_type**: privzeto `partial` (dokumentirano) — cene so
   „od"-cene za delno predplačilo; FROM_PRICE kanon to izrecno dovoljuje
   (NI živ citat).
5. Množica pokriva regijo SI·HR·ME·AL (kanon platforme); širše rute so v
   viru, a jih namerno ne ingesciramo (običajen obseg = 4 države).

## 7. Spremembe v tem PR

- `scripts/kiwitaxi-export.py` — NOVO: entitetni TSV → kanonski CSV
  (join + regija + fail-closed števci; `--download`/`--data-dir`/
  `--security-token`/`--countries`; 0 novih odvisnosti — python3 stdlib).
- `data/kiwitaxi-routes.json` — NOVO: 6.360 rut regije (1,6 MB; izpisano z
  obstoječim ingestom, `source` = webmaster feed, `ingestedAt` izrecen).
- `src/lib/supply/production-matrix.ts` — `kiwitaxi` gate `data` → `none`,
  iskren razlog z meritvami; koraki = osvežitev + neobvezna provizija.
- `src/lib/supply/providers/kiwitaxi/routes.ts` — `KIWITAXI_FEED_SOURCE`
  izrazito na webmaster API; glavni komentar posodobljen (vir najden).
- `src/lib/supply/activation-check.ts` — komentar 1b posodobljen
  (fsq ostaja edini `data` gate — čaka lastniški HF žeton).
- `tests/supply-activation.test.ts` — števci 4/1/14/0; fsq in kiwitaxi
  ločena testna vrata (fsq NOT_CONFIGURED/data; kiwitaxi ACTIVE/none).
- `docs/DATA-PROVENANCE.md` §4 — runbook s testiranimi ukazi.
- `docs/research/balkan-platform-no-ai.md` §7 — aditivna pripomba
  (partner API status: kiwitaxi POTRJEN javno, ostali [nepotrjeno]).
- `docs/evidence/kiwitaxi-vir/raziskava.txt` — dokazila (curl + meritve).
