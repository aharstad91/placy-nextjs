#!/usr/bin/env python3
"""
Trekk ut én barneskolekrets fra Trondheim kommunes åpne kretsdata og skriv
boundary (WGS84) inn i en nabolags-staging-fil (data/areas/<id>.staging.json).

Polygon-kilde for Trondheim-strøk i nabolags-editorial-arven: kommunens
skolekretsdata (NLOD, rights-clean) — samme kilde som Ranheim-pilotten.
Søsterverktøy til scripts/fetch-area-boundary.ts (Kartverket kommunegrense,
brukes for hele kommuner); dette scriptet er for Trondheim-strøk der kretsen
er den naturlige markedsenheten.

Usage:
  python3 scripts/extract-skolekrets-boundary.py --krets LADE --out data/areas/lade.staging.json
  python3 scripts/extract-skolekrets-boundary.py --krets CHARLOTTENLUND --out data/areas/charlottenlund.staging.json
  python3 scripts/extract-skolekrets-boundary.py --list   # vis alle kretsnavn

Oppførsel (speiler fetch-area-boundary.ts):
  - Finnes ikke --out: opprett SKJELETT (areaId + boundary + 6 tomme
    tema-templates, ingen meta — Trondheim-strøkene er pre-seedet i
    migrasjon 050, så curate-area PATCHer eksisterende rad).
  - Finnes --out: oppdater KUN `boundary`, behold alt annet.

Datasett: data/geo/trondheim/barneskolekrets.json (EPSG:25832 / UTM 32N)
→ konverteres til WGS84 [lng, lat] med pyproj, avrundes til 6 desimaler,
ringer lukkes. Kretsen kan være Polygon eller MultiPolygon.
"""

import argparse
import json
import sys
from pathlib import Path

from pyproj import Transformer

DATASET = Path("data/geo/trondheim/barneskolekrets.json")
THEME_IDS = [
    "hverdagsliv",
    "barn-oppvekst",
    "mat-drikke",
    "natur-friluftsliv",
    "transport",
    "trening-aktivitet",
]

transformer = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)


def convert_ring(ring):
    """UTM-ring → WGS84 [lng, lat], 6 desimaler, lukket."""
    out = []
    for pos in ring:
        lng, lat = transformer.transform(pos[0], pos[1])
        out.append([round(lng, 6), round(lat, 6)])
    if out and out[0] != out[-1]:
        out.append(list(out[0]))
    return out


def convert_geometry(geom):
    if geom["type"] == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [convert_ring(r) for r in geom["coordinates"]],
        }
    if geom["type"] == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [
                [convert_ring(r) for r in poly] for poly in geom["coordinates"]
            ],
        }
    sys.exit(f"Ustøttet geometri-type: {geom['type']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--krets",
        nargs="+",
        help="Ett eller flere kretsnavn (f.eks. LADE, eller SINGSAKER BISPEHAUGEN "
        "for et strøk som straddler flere kretser — unioneres som MultiPolygon)",
    )
    ap.add_argument("--out", help="Staging-fil (data/areas/<id>.staging.json)")
    ap.add_argument("--list", action="store_true", help="List alle kretsnavn")
    args = ap.parse_args()

    if not DATASET.exists():
        sys.exit(f"Datasett mangler: {DATASET} — kjør fra repo-roten")
    data = json.loads(DATASET.read_text())
    features = data.get("features", [])

    if args.list:
        for f in features:
            print(f["properties"].get("barneskolenavn"))
        return

    if not args.krets or not args.out:
        sys.exit("Bruk: --krets <NAVN> --out <staging-fil>  (eller --list)")

    wanted = {k.upper() for k in args.krets}
    matches = [
        f
        for f in features
        if f["properties"].get("barneskolenavn", "").upper() in wanted
    ]
    if not matches:
        sys.exit(
            f"Ingen krets blant {sorted(wanted)} — kjør --list for gyldige navn"
        )
    found = {f["properties"].get("barneskolenavn", "").upper() for f in matches}
    missing = wanted - found
    if missing:
        sys.exit(f"Manglet krets(er): {sorted(missing)} — kjør --list for gyldige navn")

    krets_label = "+".join(sorted(wanted))
    if len(matches) > 1:
        if len(found) > 1:
            print(f"ℹ️  Unionerer {len(found)} kretser ({krets_label}) som MultiPolygon")
        else:
            print(f"⚠️  {len(matches)} features for '{krets_label}' — bruker alle som MultiPolygon")
        polys = []
        for m in matches:
            g = convert_geometry(m["geometry"])
            polys.extend(
                g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
            )
        boundary = {"type": "MultiPolygon", "coordinates": polys}
    else:
        boundary = convert_geometry(matches[0]["geometry"])

    n_points = (
        len(boundary["coordinates"][0])
        if boundary["type"] == "Polygon"
        else sum(len(p[0]) for p in boundary["coordinates"])
    )
    print(f"✓ {krets_label}: {boundary['type']}, {n_points} punkter i ytre ring(er)")

    out = Path(args.out)
    if out.exists():
        staging = json.loads(out.read_text())
        staging["boundary"] = boundary
        out.write_text(json.dumps(staging, ensure_ascii=False, indent=2) + "\n")
        print(f"✓ Oppdaterte boundary i eksisterende {out} (alt annet uendret)")
        return

    area_id = out.name.replace(".staging.json", "")
    skeleton = {
        "_instructions": (
            f"Skjelett fra barneskolekrets '{krets_label}' (Trondheim kommune, NLOD). "
            f"Raden '{area_id}' er pre-seedet i migrasjon 050 — curate-area PATCHer. "
            "Kuratér report_editorial (presens, ingen årstall/historikk), "
            f"kjør: npx tsx scripts/curate-area.ts --file {out}"
        ),
        "areaId": area_id,
        "boundary": boundary,
        "report_editorial": {
            t: {"body": "", "highlightCandidates": []} for t in THEME_IDS
        },
    }
    out.write_text(json.dumps(skeleton, ensure_ascii=False, indent=2) + "\n")
    print(f"✓ Skrev skjelett til {out} (areaId='{area_id}')")


if __name__ == "__main__":
    main()
