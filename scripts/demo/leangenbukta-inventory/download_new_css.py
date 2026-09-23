#!/usr/bin/env python3
"""
Laster ned stilark som lokale sider bruker og som IKKE allerede finnes i
app/demo/leangenbukta-nettside/original.css (forsidens tidligere nedlasting).
Skriver til docs/research/leangenbukta-nettside/css/NN-<navn>.css og et
manifest (css-manifest.json) i rekkefølge, gruppert på hvilke sider som
trenger dem.
"""
import json
import os
import re
import urllib.request
from urllib.parse import urlsplit, urlunsplit

ROOT = "/Users/andreasharstad/Documents/placy-lb-kundedemo"
RESEARCH = f"{ROOT}/docs/research/leangenbukta-nettside"
CSS_DIR = f"{RESEARCH}/css"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"}

COVERED = """https://fonts.googleapis.com/css?family=Mukta%3A200%2C300%2C400%2C800%2C500%7CZilla+Slab%3A700&subset=latin&ver=6.9.7
https://fonts.googleapis.com/css?family=Open+Sans%3A300%2C400%2C600%2C700&subset=latin%2Clatin-ext
https://leangenbukta.no/wp-content/plugins/advanced-backgrounds/assets/awb/awb.min.css
https://leangenbukta.no/wp-content/plugins/column-shortcodes//assets/css/shortcodes.css
https://leangenbukta.no/wp-content/plugins/contact-form-7/includes/css/styles.css
https://leangenbukta.no/wp-content/plugins/smooth-scroll-by-wpos/assets/css/ssbywpos-style.css
https://leangenbukta.no/wp-content/plugins/sticky-side-buttons/assets/css/ssb-ui-style.css
https://leangenbukta.no/wp-content/themes/salient/css/build/elements/element-interactive-map.css
https://leangenbukta.no/wp-content/themes/salient/css/build/elements/element-wpb-column-border.css
https://leangenbukta.no/wp-content/themes/salient/css/build/grid-system.css
https://leangenbukta.no/wp-content/themes/salient/css/build/off-canvas/core.css
https://leangenbukta.no/wp-content/themes/salient/css/build/off-canvas/slide-out-right-hover.css
https://leangenbukta.no/wp-content/themes/salient/css/build/off-canvas/slide-out-right-material.css
https://leangenbukta.no/wp-content/themes/salient/css/build/plugins/js_composer.css
https://leangenbukta.no/wp-content/themes/salient/css/build/plugins/leaflet.css
https://leangenbukta.no/wp-content/themes/salient/css/build/plugins/magnific.css
https://leangenbukta.no/wp-content/themes/salient/css/build/responsive.css
https://leangenbukta.no/wp-content/themes/salient/css/build/skin-material.css
https://leangenbukta.no/wp-content/themes/salient/css/build/style-non-critical.css
https://leangenbukta.no/wp-content/themes/salient/css/build/style.css
https://leangenbukta.no/wp-content/themes/salient/css/build/third-party/cf7.css
https://leangenbukta.no/wp-content/themes/salient/css/font-awesome-legacy.min.css
https://leangenbukta.no/wp-content/uploads/salient/menu-dynamic.css
https://leangenbukta.no/wp-content/uploads/salient/salient-dynamic-styles.css""".split()


def base(u):
    p = urlsplit(u)
    return urlunsplit((p.scheme, p.netloc, p.path, "", ""))


def main():
    os.makedirs(CSS_DIR, exist_ok=True)
    covered_base = set(base(u) for u in COVERED)
    manifest = json.load(open(f"{RESEARCH}/manifest.json", encoding="utf-8"))

    new_stylesheets = {}  # base -> {url (latest seen), pages: set}
    for e in manifest["entries"]:
        if e.get("disposition") != "local":
            continue
        for s in e.get("stylesheets", []):
            b = base(s)
            if b in covered_base:
                continue
            rec = new_stylesheets.setdefault(b, {"url": s, "pages": set()})
            rec["url"] = s  # behold siste (nyeste ver=) sett
            rec["pages"].add(e["id"])

    ordered = sorted(new_stylesheets.items(), key=lambda kv: -len(kv[1]["pages"]))
    css_manifest = []
    for i, (b, rec) in enumerate(ordered, 1):
        url = rec["url"]
        fname_src = os.path.basename(urlsplit(b).path) or f"stylesheet-{i}"
        fname_src = re.sub(r"[^A-Za-z0-9._-]", "-", fname_src)
        out_name = f"{i:02d}-{fname_src}"
        if not out_name.endswith(".css"):
            out_name += ".css"
        try:
            req = urllib.request.Request(url, headers=UA)
            data = urllib.request.urlopen(req, timeout=30).read()
            with open(f"{CSS_DIR}/{out_name}", "wb") as f:
                f.write(data)
            status = "downloaded"
            size = len(data)
        except Exception as e:
            status = f"error:{e}"
            size = 0
        css_manifest.append({
            "order": i,
            "sourceUrl": url,
            "file": f"css/{out_name}",
            "status": status,
            "bytes": size,
            "usedByPages": sorted(rec["pages"]),
            "usedByPageCount": len(rec["pages"]),
        })
        print(f"[{i}/{len(ordered)}] {status} {url} ({size} bytes, {len(rec['pages'])} sider)")

    with open(f"{RESEARCH}/css-manifest.json", "w", encoding="utf-8") as f:
        json.dump({"checkedAt": "2026-09-23", "note": "Stilark brukt av lokale sider utover forsidens original.css", "stylesheets": css_manifest}, f, ensure_ascii=False, indent=2)

    ok = sum(1 for c in css_manifest if c["status"] == "downloaded")
    print(f"Ferdig. {ok}/{len(css_manifest)} nye stilark lastet ned til {CSS_DIR}")


if __name__ == "__main__":
    main()
