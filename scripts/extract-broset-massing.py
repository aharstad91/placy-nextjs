"""Trekker ut bygningsomrissene i Brøset-situasjonsplanen og skriver dem som
piksler i Wesselsløkka-planens koordinatrom.

Hvorfor to planer: `wesselslokka-situasjonsplan.png` er den vi har stadfestet
mot verden (tre holdepunkter + to uavhengige OSM-kontroller, se
docs/research/2026-09-07-wesselslokka-planregistrering.md). Den store
`broset-situasjonsplan.png` er samme tegning i et annet utsnitt, uten
logobånd. Vi registrerer den store mot den stadfestede med SIFT + RANSAC, og
arver dermed hele innpassingen i stedet for å lage en ny som må stadfestes på
nytt.

Byggene er hvite flater med tynn mørk kontur. Utfordringen er at gangstiene og
bekkedraget også er hvite. De skilles ut i to trinn: en avstandstransformasjon
fjerner alt som er smalere enn ~7 px (stiene), og en form-test kaster resten
av det som er langt, buet og uten mørk kontur rundt seg.

Kjøres sjelden — én gang per ny plantegning:

    python3 -m pip install opencv-python-headless
    python3 scripts/extract-broset-massing.py

Skriver lib/map/broset-plan-buildings.generated.ts.
"""

from __future__ import annotations

import json
import pathlib
import sys

import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC_BROSET = ROOT / "docs/kilder/wesselslokka/broset-situasjonsplan.png"
SRC_REGISTERED = ROOT / "docs/kilder/wesselslokka/wesselslokka-situasjonsplan.png"
OUT_TS = ROOT / "lib/map/broset-plan-buildings.generated.ts"

# Speiler WESSELSLOKKA_PLAN_BUILDINGS i lib/map/wesselslokka-site-plan.ts.
# A1/A2/B er håndavtegnet der og skal ikke dubleres herfra.
SALES_BUILDINGS_PX = [
    [[350, 837], [407, 842], [404, 875], [347, 870]],
    [[409, 843], [487, 850], [484, 881], [406, 875]],
    [[458, 757], [507, 761], [499, 844], [450, 840]],
]

MIN_AREA_PX = 300           # under dette er det kartsymboler, ikke bygg
MIN_HALF_WIDTH_PX = 5.0     # innskrevet sirkel: smalere = gangsti
MIN_RECT_FILL = 0.40        # andel av omskrevet rektangel
MIN_DARK_EDGE = 0.45        # andel av kanten som har mørk kontur utenfor seg
SIMPLIFY_PX = 4.0           # forenkler bort takstripene; ~1,6 m i planens målestokk


def flatten(path: pathlib.Path) -> tuple[np.ndarray, np.ndarray]:
    """Leser PNG og legger den på hvit bakgrunn. Returnerer (bgr, alfa)."""
    raw = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if raw is None:
        sys.exit(f"fant ikke {path}")
    if raw.shape[2] == 4:
        alpha = raw[:, :, 3]
        a = alpha[:, :, None].astype(np.float32) / 255.0
        bgr = (raw[:, :, :3].astype(np.float32) * a + 255 * (1 - a)).astype(np.uint8)
        return bgr, alpha
    return raw, np.full(raw.shape[:2], 255, np.uint8)


def register(source: np.ndarray, target: np.ndarray) -> np.ndarray:
    """Similaritetstransform fra kildeplanens piksler til målplanens."""
    sift = cv2.SIFT_create(nfeatures=20000)
    ks, ds = sift.detectAndCompute(cv2.cvtColor(source, cv2.COLOR_BGR2GRAY), None)
    kt, dt = sift.detectAndCompute(cv2.cvtColor(target, cv2.COLOR_BGR2GRAY), None)
    pairs = cv2.BFMatcher().knnMatch(ds, dt, k=2)
    good = [m for m, n in pairs if m.distance < 0.75 * n.distance]
    src = np.float32([ks[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst = np.float32([kt[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    matrix, inliers = cv2.estimateAffinePartial2D(
        src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0
    )
    residual = np.linalg.norm(
        cv2.transform(src, matrix).reshape(-1, 2) - dst.reshape(-1, 2), axis=1
    )[inliers.ravel().astype(bool)]
    print(
        f"registrering: {int(inliers.sum())}/{len(good)} treff, "
        f"skala {np.hypot(matrix[0, 0], matrix[1, 0]):.4f}, "
        f"rotasjon {np.degrees(np.arctan2(matrix[1, 0], matrix[0, 0])):.3f}°, "
        f"median avvik {np.median(residual):.2f} px"
    )
    if np.median(residual) > 1.5 or inliers.sum() < 200:
        sys.exit("registreringen er for svak — sjekk at planene viser samme tegning")
    return matrix


def reconstruct(marker: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Morfologisk rekonstruksjon: vokser markøren ut i masken."""
    se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    current = marker.copy()
    while True:
        grown = cv2.dilate(current, se) & mask
        if np.array_equal(grown, current):
            return current
        current = grown


def building_mask(bgr: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1].astype(int)
    value = hsv[:, :, 2].astype(int)
    white = ((value > 224) & (saturation < 42) & (alpha > 200)).astype(np.uint8)

    # Kjernen av hver hvite flate. Gangstiene er så smale at de ikke har noen.
    distance = cv2.distanceTransform(white, cv2.DIST_L2, 5)
    cores = (distance >= 3.4).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(cores, 8)
    seeded = np.zeros_like(cores)
    for i in range(1, count):
        if stats[i, 4] >= 25:
            seeded[labels == i] = 1

    grown = reconstruct(seeded, white) * 255
    # Rekkehusene er tegnet med delestreker; de lukkes til ett volum.
    return cv2.morphologyEx(
        grown, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    )


def is_building(component: np.ndarray, contour, area: int, value: np.ndarray) -> bool:
    if cv2.distanceTransform(component, cv2.DIST_L2, 5).max() < MIN_HALF_WIDTH_PX:
        return False
    width, height = cv2.minAreaRect(contour)[1]
    if area / max(width * height, 1) >= MIN_RECT_FILL:
        return True
    # Store L- og T-former fyller ikke rektangelet sitt, men har kontur rundt seg.
    ring = cv2.dilate(component, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    ring = ring - component
    return float((value[ring > 0] < 175).mean()) >= MIN_DARK_EDGE


def centroid(points: np.ndarray) -> np.ndarray:
    return points.mean(axis=0)


def main() -> None:
    broset, alpha = flatten(SRC_BROSET)
    registered, _ = flatten(SRC_REGISTERED)
    matrix = register(broset, registered)

    value = cv2.cvtColor(broset, cv2.COLOR_BGR2HSV)[:, :, 2].astype(int)
    mask = building_mask(broset, alpha)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)

    sales_centroids = [centroid(np.array(p, float)) for p in SALES_BUILDINGS_PX]
    polygons, skipped_sales = [], 0
    for i in range(1, count):
        area = int(stats[i, 4])
        if area < MIN_AREA_PX:
            continue
        component = (labels == i).astype(np.uint8)
        contours, _ = cv2.findContours(
            component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        contour = max(contours, key=cv2.contourArea)
        if not is_building(component, contour, area, value):
            continue

        simplified = cv2.approxPolyDP(contour, SIMPLIFY_PX, True).reshape(-1, 2)
        in_plan = cv2.transform(
            simplified.reshape(-1, 1, 2).astype(np.float32), matrix
        ).reshape(-1, 2)
        # A1/A2/B er håndavtegnet i den registrerte planen og eies der.
        here = centroid(in_plan)
        if min(np.linalg.norm(here - c) for c in sales_centroids) < 26:
            skipped_sales += 1
            continue
        polygons.append(np.round(in_plan).astype(int))

    # Nord mot sør gir stabile id-er som ikke hopper når terskler justeres.
    polygons.sort(key=lambda p: (centroid(p)[1], centroid(p)[0]))
    print(f"bygg: {len(polygons)} (hoppet over {skipped_sales} som er A1/A2/B)")

    body = ",\n".join(
        "  " + json.dumps([[int(x), int(y)] for x, y in poly], separators=(", ", ", "))
        for poly in polygons
    )
    OUT_TS.write_text(
        "// GENERERT AV scripts/extract-broset-massing.py — IKKE REDIGER FOR HÅND.\n"
        "//\n"
        "// Bygningsomriss for hele Brøset-planen, i pikselrommet til\n"
        "// wesselslokka-situasjonsplan.png. `sitePlanCoordinate` gjør dem om til\n"
        "// lengde-/breddegrad, så de arver den stadfestede innpassingen.\n"
        "// A1/A2/B ligger IKKE her — de er håndavtegnet i wesselslokka-site-plan.ts.\n"
        "//\n"
        f"// {len(polygons)} volumer, sortert nord mot sør.\n\n"
        "export const BROSET_PLAN_BUILDING_PIXELS: readonly (readonly (readonly [number, number])[])[] = [\n"
        f"{body},\n];\n",
        encoding="utf-8",
    )
    print(f"skrev {OUT_TS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
