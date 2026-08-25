#!/usr/bin/env bash
#
# Henter taxiholdeplassene i Trondheim fra Trondheim parkering og skriver dem
# til data/geo/trondheim/taxiholdeplasser.json.
#
# Kilden er KMZ-en som ligger bak kartet på
# https://www.trondheim.kommune.no/parkering/innhold/parkere/taxi/ — siden selv
# lister ingenting i tekst, den laster
# /parkering/kart/?maps=Taxiholdeplasser i en iframe, som igjen peker på
# Taxiholdeplasser.kmz. En KMZ er en zippet KML, derfor `unzip` og ikke ren
# fetch: Node har ingen innebygd zip-leser, og vi vil ikke dra inn en
# avhengighet for en fil som endrer seg et par ganger i året.
#
# Datasettet er BAKT INN i repoet med vilje. Importen i
# lib/pipeline/import-public-pois.ts leser den lokale filen og gjør ingen
# nettverkskall — 35 punkter som flytter seg sjelden skal ikke kunne feile en
# provisjonering fordi kommunens CDN er nede.
#
# Kjør på nytt når holdeplassene er endret:  ./scripts/fetch-taxi-holdeplasser.sh

set -euo pipefail

KMZ_URL="https://www.trondheim.kommune.no/globalassets/10-bilder-og-filer-eksternt/parkering/system/kart/Taxiholdeplasser.kmz"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/data/geo/trondheim/taxiholdeplasser.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Henter $KMZ_URL"
curl -sSfL "$KMZ_URL" -o "$TMP/taxi.kmz"
unzip -oq "$TMP/taxi.kmz" -d "$TMP/kmz"

python3 - "$TMP/kmz/doc.kml" "$OUT" "$KMZ_URL" <<'PY'
import json, re, sys, datetime
import xml.etree.ElementTree as ET

kml_path, out_path, source_url = sys.argv[1], sys.argv[2], sys.argv[3]
ns = {"k": "http://www.opengis.net/kml/2.2"}
root = ET.parse(kml_path).getroot()

holdeplasser = []
for pm in root.findall(".//k:Placemark", ns):
    name_el = pm.find("k:name", ns)
    coords_el = pm.find(".//k:coordinates", ns)
    if name_el is None or coords_el is None:
        continue
    lng, lat, *_ = coords_el.text.strip().split(",")
    entry = {"navn": " ".join(name_el.text.split()), "lat": float(lat), "lng": float(lng)}
    desc = pm.find("k:description", ns)
    if desc is not None and desc.text:
        m = re.search(r"(\d+)\s*plass", desc.text)
        if m:
            entry["plasser"] = int(m.group(1))
    holdeplasser.append(entry)

# Deterministisk rekkefølge: filen skal ikke gi diff når kilden bare stokket om.
holdeplasser.sort(key=lambda h: h["navn"])

payload = {
    "kilde": "Trondheim parkering (Trondheim kommune)",
    "kildeUrl": source_url,
    "sideUrl": "https://www.trondheim.kommune.no/parkering/innhold/parkere/taxi/",
    "hentet": datetime.date.today().isoformat(),
    "holdeplasser": holdeplasser,
}
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"✓ {len(holdeplasser)} taxiholdeplasser skrevet til {out_path}")
PY
