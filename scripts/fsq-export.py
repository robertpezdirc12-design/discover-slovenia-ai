#!/usr/bin/env python3
"""FSQ EXPORT — Foursquare Open Places → surov .jsonl (za bun run fsq:ingest).

Prenosna plast izvoznega cevovoda (glej docs/research/fsq-os-places-vir.md):
  1. vir: HF hf://datasets/foursquare/fsq-os-places (gated auto — potreben
     žeton) ALI lokalni parquet (--local-glob, za testiranje brez omrežja);
  2. pushdown: bbox SI·HR·ME·AL + country IN + date_closed IS NULL
     (parquet row-group pruning če je na voljo; izmeriti ob prvem teku);
  3. izhod: surov .jsonl v pričakovani obliki fsq-ingest.ts
     (fsq_id, name, latitude, longitude, country, categories[], address?, locality?).
     NAMERNO brez kategorijske preslikave — kanon preslikave/validacije je
     izključno v fsq-ingest.ts (validateFsqLine + mapCategories), da obstaja
     ENA definicija pravil.

Shema OS Places (potrjena prek ClickHouse vzorčnega vodiča, 17.10.2026):
  fsq_place_id, name, latitude, longitude, address, locality, region,
  postcode, admin_region, post_town, po_box, country, date_created,
  date_refreshed, date_closed, tel, website, email, facebook_id, instagram,
  twitter, fsq_category_ids, fsq_category_labels, placemaker_url,
  unresolved_flags, geom, bbox.

UPORABA (pravi vir — lastniški HF žeton):
  python3 scripts/fsq-export.py --hf-token hf_... \
      [--dt 2026-10-15] [--out data/fsq-raw] [--memory-limit 2GB]
UPORABA (lokalni test, brez omrežja):
  python3 scripts/fsq-export.py --local-glob 'docs/evidence/fsq-vir/test-parquet/*.parquet' --out /tmp/fsq-raw-test

Izhodni status: 0 = zapisano; 1 = nič veljavnih vrstic / vir nedostopen.
"""

import argparse
import sys
from pathlib import Path

import duckdb

# Unija bbox iz dataset.ts FSQ_COUNTRY_BBOXES: [south, west, north, east]
DEFAULT_BBOX = (39.6, 13.3, 46.9, 21.1)
COUNTRIES = ("SI", "HR", "ME", "AL")
LATEST_KNOWN_DT = "2026-10-15"
HF_REPO = "foursquare/fsq-os-places"


def build_sql(source_expr: str, bbox: tuple) -> str:
    s, w, n, e = bbox
    return f"""
    SELECT
      fsq_place_id                AS fsq_id,
      name                        AS name,
      latitude                    AS latitude,
      longitude                   AS longitude,
      upper(country)              AS country,
      fsq_category_labels         AS categories,
      address                     AS address,
      locality                    AS locality
    FROM {source_expr}
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND latitude BETWEEN {s} AND {n}
      AND longitude BETWEEN {w} AND {e}
      AND upper(country) IN {COUNTRIES!r}
      AND date_closed IS NULL
    """


def main() -> int:
    ap = argparse.ArgumentParser(description="FSQ OS Places → surov .jsonl")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--hf-token", help="HuggingFace fine-grained read žeton (gated vir)")
    src.add_argument("--local-glob", help="glob lokalnih parquet datotek (test brez omrežja)")
    ap.add_argument("--dt", default=LATEST_KNOWN_DT, help=f"izdaja (dt=), privzeto {LATEST_KNOWN_DT}")
    ap.add_argument("--out", default="data/fsq-raw", help="izhodni imenik (privzeto data/fsq-raw)")
    ap.add_argument("--memory-limit", default="2GB", help="duckdb memory_limit (privzeto 2GB)")
    ap.add_argument("--bbox", default="39.6,13.3,46.9,21.1",
                    help="south,west,north,east (privzeto unija SI·HR·ME·AL)")
    args = ap.parse_args()

    bbox = tuple(float(x) for x in args.bbox.split(","))
    if len(bbox) != 4:
        print("NAPAKA: --bbox mora biti south,west,north,east", file=sys.stderr)
        return 1

    con = duckdb.connect(database=":memory:")
    con.execute(f"SET memory_limit='{args.memory_limit}'")
    con.execute("SET enable_progress_bar=false")

    if args.hf_token:
        # httpfs + HF sekret (gated dataset); pot na main vejo dataseta.
        con.execute("INSTALL httpfs; LOAD httpfs;")
        safe_token = args.hf_token.replace("'", "''")
        con.execute(f"CREATE SECRET (TYPE huggingface, TOKEN '{safe_token}')")
        source = (
            f"read_parquet('hf://datasets/{HF_REPO}/release/dt={args.dt}/"
            "places/parquet/*.parquet')"
        )
    else:
        files = sorted(str(p) for p in Path().glob(args.local_glob))
        if not files:
            print(f"NAPAKA: --local-glob '{args.local_glob}' ne ujema ničesar", file=sys.stderr)
            return 1
        lst = ", ".join("'" + f.replace("'", "''") + "'" for f in files)
        source = f"read_parquet([{lst}])"

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"fsq-raw-{args.dt}.jsonl"

    sql = build_sql(source, bbox)
    # COPY … (FORMAT JSON, ARRAY false) = newline-delimited JSON (jsonl).
    safe_out = str(out_file).replace("'", "''")
    con.execute(
        f"COPY ({sql}) TO '{safe_out}' (FORMAT JSON, ARRAY false)"
    )

    count = con.execute(f"SELECT count(*) FROM read_json_auto('{safe_out}')").fetchone()[0]
    by_c = dict(
        con.execute(
            f"SELECT country, count(*) FROM read_json_auto('{safe_out}') "
            "GROUP BY country ORDER BY country"
        ).fetchall()
    )
    print("FSQ EXPORT — Foursquare Open Places (Apache-2.0, z atribucijo)")
    print("=" * 60)
    print(f"  vir:        {args.hf_token and f'hf://{HF_REPO} dt={args.dt}' or args.local_glob}")
    print(f"  bbox:       {bbox} + country IN {COUNTRIES} + date_closed IS NULL")
    print(f"  ZAPISANO:   {out_file}")
    print(f"  vrstic:     {count}")
    for c in sorted(by_c):
        print(f"    {c}: {by_c[c]}")
    if count == 0:
        print("  0 VRSTIC — nič uporabnega (preveri dt/bbox/žeton).", file=sys.stderr)
        return 1
    print("-" * 60)
    print(f"  Naslednji korak: bun run fsq:ingest --raw-dir {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
