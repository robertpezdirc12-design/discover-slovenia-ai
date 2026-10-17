#!/usr/bin/env python3
"""SINTETIČNI E2E TEST za fsq-export.py + fsq-ingest.ts (brez omrežja).

Ustvari mini parquet datoteke v resnični shemi OS Places (podmnožica polj,
ki jih export SELECT referencira) z znanimi robovi, nato pričakovani izhod:

  vrstica                              | usoda
  -------------------------------------|------------------------------------
  1 Ljubljana restaurant (SI)          | veljavna → places.jsonl
  2 Zagreb hotel (HR)                  | veljavna → places.jsonl
  3 Kotor beach (ME)                   | veljavna → places.jsonl
  4 Tirana museum (AL)                 | veljavna → places.jsonl
  5 zaprt Zagreb cafe (date_closed)    | IZKLJUČEN že pri exportu
  6 HR lat 46.75 (izven HR bbox 46.6,  | preide export (unija ≤46.9),
    znotraj unije)                     |   ZAVRŽEN pri ingestu (bbox države)
  7 SI office (nepotovalna kategorija) | preide export → nonTravel pri ingestu
  8 duplikat vrstice 1                 | dedupe pri ingestu
  9 hotel brez imena (name NULL)       | preide export → zavrnjen pri ingestu

Pričakovano: raw 8 vrstic · ingest: 4 veljavne (SI/HR/ME/AL po 1),
2 neveljavne, 1 nepotovalna, 1 duplikat · manifest total=4.

UPORABA:
  python3 scripts/fsq-export-sinteticni-test.py          # generira + poroča
  bun run fsq:ingest --raw-dir docs/evidence/fsq-vir/test-parquet \
      --out-dir /tmp/fsq-e2e --snapshot-date 2026-10-15   # (ročni 2. korak)
"""

from pathlib import Path

import duckdb

OUT = Path("docs/evidence/fsq-vir/test-parquet")

ROWS = [
    # fsq_place_id, name, lat, lng, country, labels, address, locality, date_closed
    ("5a1e000000000001", "Restavracija Test Ljubljana", 46.0569, 14.5058, "SI",
     ["Dining and Drinking > Restaurant"], "Trg prebujenja 1", "Ljubljana", None),
    ("5a1e000000000002", "Hotel Test Zagreb", 45.8150, 15.9819, "HR",
     ["Travel > Hotel"], "Ilica 1", "Zagreb", None),
    ("5a1e000000000003", "Plaža Test Kotor", 42.4247, 18.7712, "ME",
     ["Outdoors > Beach"], "Obala 2", "Kotor", None),
    ("5a1e000000000004", "Muzej Test Tirana", 41.3275, 19.8187, "AL",
     ["Arts and Entertainment > Museum"], "Bulevardi 3", "Tiranë", None),
    ("5a1e000000000005", "Zaprt cafe Zagreb", 45.8150, 15.9819, "HR",
     ["Dining and Drinking > Cafe"], "Ilica 5", "Zagreb", "2026-01-01"),
    ("5a1e000000000006", "Hotel presežek HR", 46.7500, 15.5000, "HR",
     ["Travel > Hotel"], "Cesta 6", "Međimurje", None),
    ("5a1e000000000007", "Pisarna Test SI", 46.0569, 14.5058, "SI",
     ["Business > Office"], "Dunajska 7", "Ljubljana", None),
    # duplikat vrstice 1 (isti fsq_id):
    ("5a1e000000000001", "Restavracija Test Ljubljana", 46.0569, 14.5058, "SI",
     ["Dining and Drinking > Restaurant"], "Trg prebujenja 1", "Ljubljana", None),
    ("5a1e000000000009", None, 46.0569, 14.5058, "SI",
     ["Travel > Hotel"], "Ulica 9", "Ljubljana", None),
]

SCHEMA = """
  fsq_place_id VARCHAR, name VARCHAR, latitude DOUBLE, longitude DOUBLE,
  country VARCHAR, fsq_category_labels VARCHAR[], address VARCHAR,
  locality VARCHAR, region VARCHAR, postcode VARCHAR, date_closed VARCHAR,
  date_created VARCHAR, date_refreshed VARCHAR
"""


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    # dve datoteki — dokaz determinističnega branja več shardov (sort po imenu)
    chunks = [ROWS[:5], ROWS[5:]]
    for i, rows in enumerate(chunks):
        path = OUT / f"places-test-{i:03d}.parquet"
        con = duckdb.connect(":memory:")
        con.execute("CREATE TABLE t (" + SCHEMA + ")")
        for r in rows:
            con.execute(
                "INSERT INTO t VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], None, None, r[8],
                 "2024-11-20", "2026-10-01"),
            )
        con.execute(f"COPY t TO '{path}' (FORMAT PARQUET)")
        print(f"  ustvarjeno: {path} ({len(rows)} vrstic)")
    print(f"  SKUPAJ surovo: {len(ROWS)} vrstic v {len(chunks)} datotekah")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
