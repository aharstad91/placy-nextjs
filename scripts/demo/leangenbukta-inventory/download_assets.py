#!/usr/bin/env python3
"""
Laster ned bilder/fonter/ikoner som lokale (`disposition: local`) sider
faktisk bruker, til public/demo/leangenbukta-nettside/pages/. Flat mappe,
filnavn <basename>-<6 tegn sha1 av URL>.<ext> (samme skjema som forsidens
tidligere nedlasting, slik at samme fil aldri hentes to ganger).

Velger WordPress' MELLOMSTORE srcset-variant (bredde 800-1600 px) fremfor
originalen når flere størrelser finnes for samme bilde — se
CLAUDE.md-kravet om å holde total nedlasting under 350 MB på en nesten full
disk. Video lastes ALDRI på nytt (finnes allerede fra forsiden).

Skriver docs/research/leangenbukta-nettside/asset-map.json.
"""
import hashlib
import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = "/Users/andreasharstad/Documents/placy-lb-kundedemo"
RESEARCH = f"{ROOT}/docs/research/leangenbukta-nettside"
DEST = f"{ROOT}/public/demo/leangenbukta-nettside/pages"
LEGACY_DEST = f"{ROOT}/public/demo/leangenbukta-nettside"  # forsidens tidligere flate nedlasting
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "Referer": "https://leangenbukta.no/"}
BUDGET_BYTES = 300 * 1024 * 1024  # hold god margin til 350 MB-taket
SIZE_RE = re.compile(r"^(?P<stem>.+)-(?P<w>\d{2,5})x(?P<h>\d{2,5})(?P<ext>\.[A-Za-z0-9]+)$")
SKIP_EXT = {".mov", ".mp4", ".webm"}  # video lastes aldri på nytt


def local_name(url):
    p = urllib.parse.urlparse(url)
    base = os.path.basename(p.path) or "asset"
    base = urllib.parse.unquote(base)
    base = re.sub(r"[^A-Za-z0-9._-]", "-", base)
    stem, ext = os.path.splitext(base)
    h = hashlib.sha1(url.encode()).hexdigest()[:6]
    return f"{stem[:48]}-{h}{ext}"


def already_have(url):
    name = local_name(url)
    return os.path.exists(f"{DEST}/{name}") or os.path.exists(f"{LEGACY_DEST}/{name}")


def pick_variants(urls):
    """Grupper srcset-varianter av samme bilde og velg én mellomstor variant
    per gruppe, i stedet for å laste ned alle bredder."""
    groups = {}  # base-key -> list[(width, url)]
    passthrough = []
    for u in urls:
        fname = os.path.basename(urllib.parse.urlparse(u).path)
        m = SIZE_RE.match(fname)
        if m:
            key = (os.path.dirname(u), m.group("stem"), m.group("ext").lower())
            groups.setdefault(key, []).append((int(m.group("w")), u))
        else:
            passthrough.append(u)

    covered_bases = set()  # (dirname, stem, ext) som fikk en valgt variant — originalen droppes da
    chosen = []
    for key, variants in groups.items():
        variants.sort()
        mid = [v for v in variants if 800 <= v[0] <= 1600]
        if mid:
            chosen.append(mid[-1][1])  # størst innenfor 800-1600
        else:
            below = [v for v in variants if v[0] < 800]
            chosen.append((below[-1] if below else variants[0])[1])
        covered_bases.add(key)

    # passthrough: bilder uten størrelsessuffiks (ikoner/logoer/SVG-er, eller
    # master-originaler). Dropp originalen når en sized variant av SAMME
    # basenavn allerede er valgt over — ellers laster vi ned begge.
    for u in passthrough:
        fname = os.path.basename(urllib.parse.urlparse(u).path)
        stem, ext = os.path.splitext(fname)
        key = (os.path.dirname(u), stem, ext.lower())
        if key in covered_bases:
            continue
        chosen.append(u)
    return sorted(set(chosen))


def download(url, budget):
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
    if ext in SKIP_EXT:
        return None, budget, "skip-video"
    if already_have(url):
        return local_name(url), budget, "cached"
    if budget[0] <= 0:
        return None, budget, "budget-exceeded"
    try:
        req = urllib.request.Request(url, headers=UA)
        data = urllib.request.urlopen(req, timeout=60).read()
    except Exception as e:
        return None, budget, f"error:{e}"
    if len(data) > budget[0]:
        return None, budget, "would-exceed-budget"
    name = local_name(url)
    os.makedirs(DEST, exist_ok=True)
    with open(f"{DEST}/{name}", "wb") as f:
        f.write(data)
    budget[0] -= len(data)
    return name, budget, len(data)


def main():
    manifest = json.load(open(f"{RESEARCH}/manifest.json", encoding="utf-8"))
    local_entries = [e for e in manifest["entries"] if e.get("disposition") == "local"]

    all_urls = set()
    for e in local_entries:
        for u in e.get("media", []):
            if u and u.startswith("http"):
                all_urls.add(u)

    to_fetch = pick_variants(sorted(all_urls))
    print(f"{len(all_urls)} unike bilde-URL-er på lokale sider -> {len(to_fetch)} etter valg av mellomstore varianter")

    asset_map = {}
    budget = [BUDGET_BYTES]
    total_bytes = 0
    n_downloaded = n_cached = n_skipped = n_failed = 0
    for i, url in enumerate(sorted(to_fetch), 1):
        name, budget, result = download(url, budget)
        if name:
            asset_map[url] = {"localPath": f"/demo/leangenbukta-nettside/pages/{name}"
                                if os.path.exists(f"{DEST}/{name}") else f"/demo/leangenbukta-nettside/{name}"}
            if isinstance(result, int):
                asset_map[url]["bytes"] = result
                total_bytes += result
                n_downloaded += 1
            else:
                n_cached += 1
        else:
            if result == "skip-video":
                n_skipped += 1
            else:
                n_failed += 1
                asset_map.setdefault("_failed", []).append({"url": url, "reason": result})
        if i % 25 == 0:
            print(f"  [{i}/{len(to_fetch)}] lastet={n_downloaded} cache={n_cached} feil={n_failed} MB-så-langt={total_bytes/1e6:.1f}")
        time.sleep(0.15)

    with open(f"{RESEARCH}/asset-map.json", "w", encoding="utf-8") as f:
        json.dump(asset_map, f, ensure_ascii=False, indent=2)

    print(f"Ferdig. Nedlastet {n_downloaded} nye filer ({total_bytes/1e6:.1f} MB), "
          f"{n_cached} allerede tilgjengelig fra før, {n_skipped} video hoppet over, {n_failed} feilet.")


if __name__ == "__main__":
    main()
