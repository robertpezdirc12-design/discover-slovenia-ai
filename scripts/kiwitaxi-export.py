#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KIWITAXI EXPORT — uradni webmaster CSV feed → kanonski CSV za `kiwitaxi:ingest`.

VIR (dokumentiran javno, preverjeno 17. 10. 2026):
  https://kiwitaxi.com/en/partner/webmaster/instructions/api
  · entiteti Route (place_from/place_to) + Transfer (price_eur per razred vozila)
  · varnostni žeton je javno dokumentiran ("same for everyone") — če ga
    KiwiTaxi v prihodnje individualizira, podaj --security-token.
  · payment_type privzeto "partial" (dokumentirana privzeta vrednost).

POT (isti kanon kot FSQ — ena definicija pravil v obstoječem ingestu):
  1) --download: prenese 4 entitetne CSV-je (countries, places, routes,
     transfers) v --data-dir (IZVEN repozitorija, ~123 MB)
  2) join entitet → rute, ki se dotikajo regije (--countries SI,HR,ME,AL)
  3) izpis kanonskega CSV (glava: from_name,from_country,to_name,to_country,
     price_eur,vehicle_class,url) → `bun run kiwitaxi:ingest --csv <ta-datoteka>`

KANON ISKRENOSTI:
  · cena = NAJNIŽJA objavljena price_eur rutе (partnerjeva „od"-cena, FROM_PRICE
    — NI živ citat); vehicle_class = razred te najcenejše ponudbe;
  · NE pretvarjamo valut (price_eur je partnerjev lasten izpis);
  · rute brez veljavnega imena/cene izpustimo (fail-closed, števec izpisov);
  · 0 rut v regiji → izhod 1 (praznina je odgovor, ne napaka).
"""
import argparse
import csv
import os
import sys
import time
import urllib.request

BASE = "https://kiwitaxi.com/services/data/csv"
DOCS_TOKEN = "24e8a1c890fb0d16ecdce4926dc4b2d6"  # javno dokumentiran (API stran)
ENTITIES = ["countries", "places", "routes", "transfers", "transfer_types"]
USER_AGENT = "i-feel-slovenia-research/1.0 (runbook DATA-PROVENANCE.md §4)"


def fetch(entity: str, token: str, out_dir: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{entity}.csv")
    url = f"{BASE}/{entity}?security_token={token}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    print(f"  prenos {entity} …", flush=True)
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=180) as resp, open(path, "wb") as f:
        n = 0
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
            n += len(chunk)
    print(f"    {path} ({n / 1e6:.1f} MB, {time.time() - t0:.1f}s)", flush=True)
    return path


def read_tsv(path: str):
    """Generator vrstic (drži datoteko odprto do izčrpanja — brez pretirane rabe pomnilnika)."""
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f, delimiter="\t")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--data-dir", default="/tmp/kiwitaxi-feed",
                    help="mapa z entitetnimi CSV-ji (ali kamor jih --download prenese)")
    ap.add_argument("--download", action="store_true",
                    help="prenesi sveže entitetne CSV-je v --data-dir pred joinom")
    ap.add_argument("--security-token", default=DOCS_TOKEN,
                    help="varnostni žeton (privzeto javno dokumentirani)")
    ap.add_argument("--countries", default="SI,HR,ME,AL",
                    help="regija: rute, ki se dotikajo teh ISO-2 (privzeto SI,HR,ME,AL)")
    ap.add_argument("--out", default="kiwitaxi-region.csv",
                    help="izhodna kanonska CSV datoteka")
    args = ap.parse_args()

    out_parent = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_parent, exist_ok=True)

    if args.download:
        for e in ENTITIES:
            fetch(e, args.security_token, args.data_dir)

    paths = {e: os.path.join(args.data_dir, f"{e}.csv") for e in ENTITIES}
    missing = [e for e, p in paths.items() if not os.path.isfile(p)]
    if missing:
        print(f"NAPAKA: manjkajo entitetni CSV-ji {missing} v {args.data_dir} "
              f"(poženi z --download)", file=sys.stderr)
        return 1

    region = {c.strip().upper() for c in args.countries.split(",") if c.strip()}

    countries = {}
    for r in read_tsv(paths["countries"]):
        countries[r["id"]] = r["iata"].strip().upper()

    places = {}
    skipped_place = 0
    for r in read_tsv(paths["places"]):
        name = (r.get("name_en") or "").strip()
        if not name:
            skipped_place += 1
            continue
        places[r["id"]] = {"iso": countries.get(r["country_id"], ""),
                           "name": name}

    types = {}
    for r in read_tsv(paths["transfer_types"]):
        types[r["id"]] = (r.get("name_en") or "").strip() or "?"

    best = {}  # route_id -> (min price_eur, type_id)
    bad_price = 0
    for r in read_tsv(paths["transfers"]):
        try:
            p = float(r["price_eur"])
        except (KeyError, ValueError):
            bad_price += 1
            continue
        if p <= 0:
            bad_price += 1
            continue
        rid = r["route_id"]
        if rid not in best or p < best[rid][0]:
            best[rid] = (p, r["type_id"])

    rows = []
    seen = set()
    routes_total = 0
    for r in read_tsv(paths["routes"]):
        routes_total += 1
        rid = r["id"]
        if rid not in best:
            continue
        fp, tp = places.get(r["place_from_id"]), places.get(r["place_to_id"])
        if not fp or not tp:
            continue
        fi, ti = fp["iso"], tp["iso"]
        if fi not in region and ti not in region:
            continue
        key = (fp["name"], fi, tp["name"], ti)
        if key in seen:
            continue
        seen.add(key)
        price, ttype = best[rid]
        rows.append({
            "from_name": fp["name"],
            "from_country": fi,
            "to_name": tp["name"],
            "to_country": ti,
            "price_eur": f"{price:.2f}",
            "vehicle_class": types.get(ttype, ""),
            "url": f"https://kiwitaxi.com/transfers/{rid}",
        })

    rows.sort(key=lambda x: (x["from_name"], x["to_name"], x["price_eur"]))

    touched = [r for r in rows if r["from_country"] in region or r["to_country"] in region]
    print(f"\nKIWITAXI EXPORT — regija {','.join(sorted(region))}")
    print("=" * 60)
    print(f"  entitetne rute:      {routes_total}")
    print(f"  rute s transferji:   {len(best)}")
    print(f"  preskočenih krajev:  {skipped_place} (brez name_en)")
    print(f"  zavrnjenih cen:      {bad_price} (≤ 0 / neštevilčne)")
    print(f"  rut v regiji:        {len(touched)} (unikatnih relacij)")
    if not touched:
        print("  0 RUT V REGIJI — nič ni zapisano (iskrena praznina).", file=sys.stderr)
        return 1

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["from_name", "from_country", "to_name",
                                          "to_country", "price_eur",
                                          "vehicle_class", "url"],
                           lineterminator="\n")
        w.writeheader()
        w.writerows(touched)

    touch_si = [r for r in touched if "SI" in (r["from_country"], r["to_country"])]
    print(f"  zapisano:            {args.out} ({len(touched)} vrstic, "
          f"{len(touch_si)} se dotika SI)")
    print("\nNASLEDNJI KORAK: bun run kiwitaxi:ingest --csv " + args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
