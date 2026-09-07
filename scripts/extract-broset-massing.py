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

Etasjetallene kommer ikke fra markedsplanen, men fra takplanen i
detaljreguleringen (`broset-takplan-2022.pdf`, Dyrvik arkitekter / ATSITE
07.04.2022). Den er en målestokkriktig karttegning med «N etg» påskrevet hvert
bygg. Teksten hentes ut av PDF-en med posisjon, tegningen stadfestes mot tre
veikryss vi kjenner koordinatene til, og hvert omriss arver etasjetallet som
står der bygget ligger.

Kjøres sjelden — én gang per ny plantegning:

    python3 -m pip install opencv-python-headless   # og poppler for pdftotext
    python3 scripts/extract-broset-massing.py

Skriver lib/map/broset-plan-buildings.generated.ts.
"""

from __future__ import annotations

import html
import json
import math
import pathlib
import re
import subprocess
import sys
import tempfile

import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC_BROSET = ROOT / "docs/kilder/wesselslokka/broset-situasjonsplan.png"
SRC_REGISTERED = ROOT / "docs/kilder/wesselslokka/wesselslokka-situasjonsplan.png"
SRC_TAKPLAN = ROOT / "docs/kilder/wesselslokka/broset-takplan-2022.pdf"
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
SITE_BRIDGE_PX = 55         # binder planens grønne flater sammen over gatetun og bygg
SITE_SMOOTH_PX = 75         # glatter bort hakkene der tverrveiene møter kanten
SITE_SIMPLIFY_PX = 14.0     # ~6 m; grunnflaten trenger ikke skarpere kant enn det
STOREY_SEARCH_M = 35.0      # hvor langt vi leter etter etasjetall utenfor omrisset
DEFAULT_STOREYS = 4         # brukes bare hvis takplanen ikke sier noe i nærheten

# Takplanen er nord-opp og i målestokk, men uten koordinatnett. Tre kryss vi
# kjenner posisjonen til fra OSM binder den til verden. Pikselverdiene er lest
# av i PDF-ens eget enhetsrom (y peker ned).
TAKPLAN_ANCHORS = [
    ("Rundkjøring Tungasletta", (939.6, 490.0), (10.4607323, 63.4215661)),
    ("Brøsetvegen x Sigurd Munns veg", (161.6, 483.7), (10.449732, 63.421765)),
    ("Brøsetvegen x Brøsetflata", (466.6, 231.7), (10.454243, 63.423268)),
]
TAKPLAN_MAX_RESIDUAL_M = 5.0


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


def site_outline(bgr: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Planområdets grunnflate: alt tegningen har farget grønt, sydd sammen.

    Vi tar det grønne og ikke det grå, slik at flaten stopper på innsiden av
    Brøsetvegen, Kollektivgata og Tungasletta. De veiene finnes i dag og skal
    fortsatt være synlige i fotoflisene; det er bare innmaten planen bygger om.
    Gatetun, torg og bygg inni feltet er hull som lukkes igjen, ikke kanter.
    """
    b, g, r = (bgr[:, :, i].astype(int) for i in range(3))
    green = (g > r + 5) & (g > b + 4) & (bgr.max(axis=2) > 95) & (alpha > 200)
    mask = (green * 255).astype(np.uint8)

    def ellipse(size: int) -> np.ndarray:
        return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))

    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, ellipse(SITE_BRIDGE_PX))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if count < 2:
        sys.exit("fant ingen grønn flate i planen — sjekk fargeterskelen")
    mask = ((labels == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))) * 255).astype(
        np.uint8
    )

    outside = mask.copy()
    height, width = mask.shape
    cv2.floodFill(outside, np.zeros((height + 2, width + 2), np.uint8), (0, 0), 255)
    mask |= cv2.bitwise_not(outside)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, ellipse(SITE_SMOOTH_PX))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, ellipse(SITE_BRIDGE_PX // 2))

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contour = max(contours, key=cv2.contourArea)
    return cv2.approxPolyDP(contour, SITE_SIMPLIFY_PX, True).reshape(-1, 2)


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


# --- etasjetall fra takplanen -------------------------------------------

# Speiler WESSELSLOKKA_CONTROL_POINTS i lib/map/wesselslokka-site-plan.ts, så
# omrissene kan regnes om til lengde-/breddegrad her og møte takplanen der.
PLAN_CONTROL_POINTS = [
    ((111, 768), (10.4496894971, 63.4218342068)),
    ((858, 54), (10.4567706734, 63.4244368447)),
    ((1350, 770), (10.4607323086, 63.4215660552)),
]
LAT0 = 63.4220
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LON = M_PER_DEG_LAT * math.cos(math.radians(LAT0))


def plan_pixel_to_meters(point: np.ndarray) -> np.ndarray:
    """Omriss-piksel i den stadfestede planen -> lokale meter (øst, nord)."""
    (ap, a), (bp, b), (cp, c) = PLAN_CONTROL_POINTS
    bx, by = bp[0] - ap[0], bp[1] - ap[1]
    cx, cy = cp[0] - ap[0], cp[1] - ap[1]
    determinant = bx * cy - by * cx
    u = ((point[0] - ap[0]) * cy - (point[1] - ap[1]) * cx) / determinant
    v = (bx * (point[1] - ap[1]) - by * (point[0] - ap[0])) / determinant
    lon = a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0])
    lat = a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1])
    return np.array([lon * M_PER_DEG_LON, lat * M_PER_DEG_LAT])


def takplan_words() -> list[tuple[float, float, str]]:
    """Ord med posisjon fra takplan-PDF-en.

    Fonten er innebygd med egen koding: hver bokstav ligger 29 kodepunkt for
    lavt, så «HWJ» er «etg». Vi flytter den tilbake i stedet for å OCR-e.
    """
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "takplan.html"
        subprocess.run(
            ["pdftotext", "-bbox", str(SRC_TAKPLAN), str(out)],
            check=True,
            capture_output=True,
        )
        markup = out.read_text(encoding="utf-8")
    words = []
    for x0, y0, x1, y1, raw in re.findall(
        r'<word xMin="([\d.]+)" yMin="([\d.]+)" '
        r'xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>',
        markup,
    ):
        text = "".join(
            chr(ord(ch) + 29) if 32 <= ord(ch) + 29 < 127 else ch
            for ch in html.unescape(raw)
        )
        words.append(((float(x0) + float(x1)) / 2, (float(y0) + float(y1)) / 2, text))
    return words


def takplan_transform() -> tuple[float, np.ndarray, np.ndarray]:
    """Similaritet fra takplanens enheter til lokale meter, fra tre kryss."""
    source = np.array([[x, -y] for _, (x, y), _ in TAKPLAN_ANCHORS])
    target = np.array(
        [[lon * M_PER_DEG_LON, lat * M_PER_DEG_LAT] for _, _, (lon, lat) in TAKPLAN_ANCHORS]
    )
    sm, tm = source.mean(axis=0), target.mean(axis=0)
    a, b = source - sm, target - tm
    dot = float((a[:, 0] * b[:, 0] + a[:, 1] * b[:, 1]).sum())
    cross = float((a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]).sum())
    scale = math.hypot(dot, cross) / float((a**2).sum())
    angle = math.atan2(cross, dot)
    rotation = np.array(
        [[math.cos(angle), -math.sin(angle)], [math.sin(angle), math.cos(angle)]]
    )
    offset = tm - scale * (rotation @ sm)
    residuals = [
        float(np.linalg.norm(scale * (rotation @ np.array([x, -y])) + offset - t))
        for (_, (x, y), _), t in zip(TAKPLAN_ANCHORS, target)
    ]
    print(
        f"takplan: skala {scale:.4f} m/enhet, "
        f"rotasjon {math.degrees(angle):+.2f}°, "
        f"avvik {[round(r, 1) for r in residuals]} m"
    )
    if max(residuals) > TAKPLAN_MAX_RESIDUAL_M:
        sys.exit("takplanen sitter ikke godt nok — sjekk holdepunktene i TAKPLAN_ANCHORS")
    return scale, rotation, offset


def storey_labels() -> list[tuple[np.ndarray, int]]:
    """«4 etg» / «2-3 etg» som (posisjon i meter, øverste etasjetall)."""
    scale, rotation, offset = takplan_transform()
    labels = []
    for x, y, text in takplan_words():
        match = re.fullmatch(r"(\d)(?:-(\d))?\s*etg", text.strip())
        if not match:
            continue
        point = scale * (rotation @ np.array([x, -y])) + offset
        labels.append((point, int(match.group(2) or match.group(1))))
    print(f"etasjepåskrifter: {len(labels)}")
    return labels


def contains(polygon: np.ndarray, point: np.ndarray) -> bool:
    inside = False
    for i in range(len(polygon)):
        (x1, y1), (x2, y2) = polygon[i], polygon[(i + 1) % len(polygon)]
        if (y1 > point[1]) != (y2 > point[1]) and point[0] < (x2 - x1) * (
            point[1] - y1
        ) / (y2 - y1) + x1:
            inside = not inside
    return inside


def storeys_for(polygon: np.ndarray, labels: list[tuple[np.ndarray, int]]) -> int:
    """Påskriften som står oppå bygget; ellers den nærmeste innen rekkevidde.

    Et sammenslått rekkehusfelt kan ha flere påskrifter i seg — da gjelder den
    høyeste, slik «2-3 etg» også leses som 3.
    """
    ring = np.array([plan_pixel_to_meters(p) for p in polygon])
    within = [n for point, n in labels if contains(ring, point)]
    if within:
        return max(within)
    here = ring.mean(axis=0)
    point, nearest = min(labels, key=lambda item: np.linalg.norm(item[0] - here))
    if np.linalg.norm(point - here) > STOREY_SEARCH_M:
        return DEFAULT_STOREYS
    return nearest


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

    labels = storey_labels()
    storeys = [storeys_for(poly, labels) for poly in polygons]
    spread = {n: storeys.count(n) for n in sorted(set(storeys))}
    print(f"etasjer: {spread}")

    site = cv2.transform(
        site_outline(broset, alpha).reshape(-1, 1, 2).astype(np.float32), matrix
    ).reshape(-1, 2)
    site = np.round(site).astype(int)
    print(f"grunnflate: {len(site)} punkter")

    site_body = ", ".join(f"[{int(x)}, {int(y)}]" for x, y in site)
    body = ",\n".join(
        f"  {{ storeys: {n}, pixels: "
        + json.dumps([[int(x), int(y)] for x, y in poly], separators=(", ", ", "))
        + " }"
        for poly, n in zip(polygons, storeys)
    )
    OUT_TS.write_text(
        "// GENERERT AV scripts/extract-broset-massing.py — IKKE REDIGER FOR HÅND.\n"
        "//\n"
        "// Bygningsomriss for hele Brøset-planen, i pikselrommet til\n"
        "// wesselslokka-situasjonsplan.png. `sitePlanCoordinate` gjør dem om til\n"
        "// lengde-/breddegrad, så de arver den stadfestede innpassingen.\n"
        "// A1/A2/B ligger IKKE her — de er håndavtegnet i wesselslokka-site-plan.ts.\n"
        "//\n"
        "// `storeys` er maks etasjetall lest av takplanen i detaljreguleringen\n"
        "// (broset-takplan-2022.pdf) der bygget ligger.\n"
        "//\n"
        f"// {len(polygons)} volumer, sortert nord mot sør.\n\n"
        "export interface BrosetPlanBuilding {\n"
        "  readonly storeys: number;\n"
        "  readonly pixels: readonly (readonly [number, number])[];\n"
        "}\n\n"
        "export const BROSET_PLAN_BUILDINGS: readonly BrosetPlanBuilding[] = [\n"
        f"{body},\n];\n\n"
        "// Planområdets grunnflate — omrisset av alt tegningen har farget grønt,\n"
        "// med gatetun, torg og bygg lukket igjen. Den stopper på innsiden av\n"
        "// Brøsetvegen, Kollektivgata og Tungasletta, som finnes i dag og skal\n"
        "// forbli synlige. Brukes bare i 3D, der fotoflisene ellers viser gammel\n"
        "// asfalt under de planlagte byggene.\n"
        "export const BROSET_PLAN_SITE_OUTLINE: readonly (readonly [number, number])[] =\n"
        f"  [{site_body}];\n",
        encoding="utf-8",
    )
    print(f"skrev {OUT_TS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
