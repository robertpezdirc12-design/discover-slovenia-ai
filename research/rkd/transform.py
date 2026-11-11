#!/usr/bin/env python3
"""
RKD → kompaktni spletni nabor (public/data/rkd.json).

Vir: Register nepremične kulturne dediščine (RNPD) — CKAN paket
`register-nepremicne-kulturne-dediscine` (podatki.gov.si), vir JSON
`rnpd.json` (GeoJSON stream). Licenca: OPSI (CC BY 4.0), MOP/GURS.

Zakaj predobdelava: 31.000+ enot s polnimi opisi/fotografijami ni
smiselno pošiljati brskalniku. Ta skript naredi gost nabor samo s
polji, ki jih UI potrebuje:
  id, ime, tip (indeks v RKD_TYPE_LABELS), opis (odrezan), občina,
  lat/lng (WGS84), fotografija (ime datoteke na ised.gov.si) in EŠD
  (za povezavo https://eid.gov.si/S/{ESD}).

Uporaba: python -I research/rkd/transform.py < source.json > public/data/rkd.json
"""
import json
import sys

DESC_MAX = 96
PHOTO_BASE = "https://ised.gov.si/statika/KF_RNPD/"

# Stabilen vrstni red za UI filtre — dodajanje na konec, ne preurejanje.
TYPE_ORDER = [
    "stavbe",
    "spominski objekti in kraji",
    "arheološka najdišča",
    "naselja in njihovi deli",
    "drugi objekti in naprave",
    "kulturna krajina",
    "parki in vrtovi",
    "stavbe s parki ali z vrtovi",
    "ostalo",
]


def iter_features(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    dec = json.JSONDecoder()
    i, n = 0, len(text)
    while i < n:
        while i < n and text[i] in " \t\r\n,":
            i += 1
        if i >= n:
            break
        obj, end = dec.raw_decode(text, i)
        yield obj
        i = end


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "research/rkd/rnpd.json"
    type_index = {t: i for i, t in enumerate(TYPE_ORDER)}

    out = []
    skipped = 0
    for feat in iter_features(src):
        p = feat.get("properties") or {}
        try:
            lat = float(p.get("Y"))
            lng = float(p.get("X"))
        except (TypeError, ValueError):
            skipped += 1
            continue
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            skipped += 1
            continue

        esd = p.get("ESD")
        typ = str(p.get("ZVRST") or "").strip()
        photo = str(p.get("FOTODATOTEKA") or "").strip()
        desc = str(p.get("OPIS") or "").strip()
        if len(desc) > DESC_MAX:
            desc = desc[: DESC_MAX - 1].rstrip() + "…"
        obcina = str(p.get("OBCINA") or "").strip()
        if obcina == "None":
            obcina = ""

        out.append(
            {
                "n": str(p.get("IME") or "").strip(),
                "t": type_index.get(typ, type_index["ostalo"]),
                "d": desc,
                "m": obcina,
                "lat": round(lat, 4),
                "lng": round(lng, 4),
                "ph": photo,
                # EŠD zadostuje za javno povezavo eID — ne nosimo celotnega URL-ja.
                "e": esd if esd is not None else "",
            }
        )

    meta = {
        "format": "rkd-compact-v1",
        "source": "Register nepremične kulturne dediščine (RNPD), CKAN / podatki.gov.si",
        "license": "OPSI / CC BY 4.0 (MOP/GURS)",
        "typeLabels": TYPE_ORDER,
        "count": len(out),
        "skipped": skipped,
    }
    payload = {"meta": meta, "features": out}
    json.dump(payload, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    sys.stderr.write(f"features={len(out)} skipped={skipped} tipov={len(TYPE_ORDER)}\n")


if __name__ == "__main__":
    main()
