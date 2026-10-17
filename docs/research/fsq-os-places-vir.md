# FSQ OS Places — vir najden in svež (odločitveni paket)

**Datum:** 17. 10. 2026 · **Veja:** `feat/fsq-source` · **Tip:** odločitveni paket + ažurirana iskrenost matrike (samo nizi, brez spremembe vedenja)

## 1. Kontekst

Množica FSQ POI (125.446 POI: SI 18.010 · HR 88.331 · ME 10.285 · AL 8.820, snapshot
2025-02-06) je ostala na mrtvem GitHub računu ob incidentu 2026-10-06. Koda (loader +
stroga validacija + ingest `bun run fsq:ingest`) je obnovljena v P0-C; v matriki
ponudnikov je vrata „data" — čaka vir. Ta paket dokumentira najden vir, licenco,
pot do podatkov in preostali (lahek) lastniški korak.

## 2. Vir — dejstva (raziskava 17. 10. 2026)

| vir | status |
|---|---|
| **HuggingFace `foursquare/fsq-os-places`** (uradni) | **JAVEN, AKTUALEN** — zadnja izdaja `dt=2026-10-15` (2 dni), mesečne izdaje od 2024-12-03; 100 parquet shardov izdaje ≈ **11,58 GB** (povprečje 115,8 MB); licenca `apache-2.0` + `NOTICE.txt` |
| Foursquare Places Portal (`places.foursquare.com`) | registracija + žeton + **Iceberg katalog** (portal, Snowflake, HF = tri uradne poti); podatki brezplačni z atribucijo (Apache-2.0) |
| ClickHouse sample dataset | tudi prek Places Portal računa (brez anonimnega žega) |
| „javni S3 žeg" preteklih izdaj (oznanilo 8. 10. 2025) | **MRTAV v praksi** — `fsq-os-places-us-east-1` = NoSuchBucket; PM tiles ključ iz dok. = 404 (dokumentacija zastarela) |
| source.coop / fused.io (izvirni vir iz P0-C runbooka) | **NEOBSTOJA več kot FSQ vir** (fused razdeljuje Overture; FSQ ne) |
| HF datasets-server (javni ogled/filtriranje) | blokiran za gated datasete (401 brez žetona) |

**Ključna zgodovinska dejstva (Medium oznanilo Foursquare, 8. 10. 2025):**
- OS Places prešel z anonimnega javnega S3 na portal (registracija + žeton + Iceberg);
- podatki **ostanejo brezplačni** z atribucijo pod Apache-2.0;
- pretekle izdaje naj bi ostale na javnem S3 — v praksi žeg ne obstaja več pod
  dokumentiranim imenom.

## 3. Baseline je natanko reproducibilen

Izdaja HF `dt=2025-02-06` je **ista izdaja**, iz katere je nastala izgubljena
množica (snapshot 2025-02-06; `FSQ_EXPECTED_COUNTS` = SI 18.010 · HR 88.331 ·
ME 10.285 · AL 8.820). To pomeni:
- **obnova baseline 1:1** je izvedljiva (vsBaseline = 0 — dokaz cevovoda);
- **sveža izdaja `dt=2026-10-15`** je ~1,5 leta novejša (povečana pokritost +
  27 M popravkov skupnosti; vsBaseline bo pokazal pozitiven odmik — po zasnovi
  iskrenega prikaza).

## 4. Pot do podatkov (ko žeton obstaja) — CEVOVOD ŽE E2E TESTIRAN

1. **Lastniški korak (5–10 min):** brezplačen HF račun → stran dataseta →
   soglasje gated („auto" = samodejna potrditev brez ročnega pregleda) →
   fine-grained žeton (read). Naloga sicer ni izvedljiva (401).
2. `python3 scripts/fsq-export.py --hf-token hf_... --dt 2026-10-15 --out data/fsq-raw`
   — duckdb pushdown (bbox SI·HR·ME·AL + `country IN` + `date_closed IS NULL`)
   → surov `.jsonl` v obliki za ingest. (**E2E testirano na sintetičnem parquetu
   z resnično shemo — dokazilo `docs/evidence/fsq-vir/e2e-cevovod.txt`; omrežni
   del + učinkovitost pushdown se izmeri ob prvem živem teku.**)
3. `bun run fsq:ingest --raw-dir data/fsq-raw --snapshot-date 2026-10-15`
   (obstoječa, stroga validacija + dedupe + manifest) → `data/fsq-places/places.jsonl`
   — loader ga pobere **samodejno, brez spremembe kode**.
4. Deltas (`deltas/parquet`) omogočajo prihodnje inkrementalne osvežitve brez
   polnega prenosa.

## 5. Opcije

| opcija | vsebina | strošek | ovira |
|---|---|---|---|
| **1 — sveža izdaja (PRIPOROČENO)** | `dt=2026-10-15` → ingest → množica ~1,5 leta novejša od baseline | 0 EUR | HF žeton (lastniški, 5–10 min, samodejna potrditev) |
| 2 — obnova baseline 1:1 | `dt=2025-02-06` → točno 125.446 POI, vsBaseline = 0 | 0 EUR | isti žeton; slabša svežina |
| 3 — brez dejanja | vrata ostanejo „data" | — | POI sloj ostane prazen |

## 6. Iskrene omejitve

- **Žeton je lastniški korak** (račun = osebni podatek; agent ne ustvarja računov).
  Vrsta žetona: HF fine-grained read; po ingestu ga rotirati/umakniti.
- Efektivnost parquet pushdown (prenos GB) NI izmerjena brez žetona — izmeriti ob
  prvem teku; izdaja 2025-02-06 kot varnejša merilna izdaja.
- Licence: Apache-2.0 potrjena (HF README + NOTICE.txt); atribucija že kodirana
  (`FSQ_ATTRIBUTION`) in v `docs/DATA-PROVENANCE.md` — pri ingestu NI potreben
  nov pravni pregled (isti licenčni okvir kot izvirna množica).
- Ta paket NE spreminja vedenja: v matriki se posodobita samo iskrena prozna
  besedila (vir: fused.io → HF/portal; gate ostane „data" do žetona).

## 7. Spremembe v tem PR

- `docs/research/fsq-os-places-vir.md` — ta paket.
- `docs/evidence/fsq-vir/raziskava.txt` — surova raziskovalna sled (URL-ji, HTTP
  statusi, metapodatki HF, seznam izdaj, velikosti).
- `src/lib/supply/providers/fsq/dataset.ts` — runbook glava: vir posodobljen
  (HF/portal; fused.io omenjen kot zgodovinski), baseline-reproducibilnost.
- `src/lib/supply/production-matrix.ts` — iskren niz vrata „data": dejanski vir +
  preostali korak (HF žeton) namesto zastarele omembe source.coop/fused.io.
- `docs/research/balkan-platform-no-ai.md` — aditivna posodobitev §5/§7.

## 8. Dodatek (isti dan, naslednji korak) — izvozna skripta E2E testirana

- `scripts/fsq-export.py` — prenosna plast (duckdb 1.5.6 python; **brez dotikanja
  package.json** — brez vpliva na Vercel build): `--hf-token` (hf:// vir) ali
  `--local-glob` (test brez omrežja), pushdown bbox+country+date_closed, izhod
  surov `.jsonl` za ingest. Preslikava kategorij NAMERNO ostane v fsq-ingest.ts
  (ENA definicija kanona).
- `scripts/fsq-export-sinteticni-test.py` — deterministična generacija
  sintetičnega parquet z resnično shemo + robovi.
- `scripts/fsq-ingest.ts` — manifest `source` ažuriran na uradni vir (HF;
  source.coop/fused.io mrtav).
- `docs/evidence/fsq-vir/e2e-cevovod.txt` + `docs/evidence/fsq-vir/test-parquet/`
  — E2E dokazilo: 9 surovih → export 8 (zaprti izključen) → ingest 4 veljavne
  (SI/HR/ME/AL po 1), 2 zavrnjeni, 1 nepotovalna, 1 duplikat — vse napredi 1:1.
