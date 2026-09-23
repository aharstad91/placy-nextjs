#!/usr/bin/env python3
"""
HEAD-sjekk av dokument/media-URL-er (wp-content/uploads o.l.) oppdaget under
crawl.py. Ingen nedlasting av body — kun status, content-type, content-length.
Skriver docs/research/leangenbukta-nettside/head-probe.json.
"""
import json
import time
import urllib.request
import urllib.error

ROOT = "/Users/andreasharstad/Documents/placy-lb-kundedemo"
UA = "PlacyLeangenbuktaInventory/1.0 (+andreas.harstad@initialforce.com; read-only research crawl)"
PAUSE = 0.35


def head(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return {
            "status": resp.status,
            "contentType": resp.headers.get("Content-Type"),
            "contentLength": resp.headers.get("Content-Length"),
            "finalUrl": resp.geturl(),
        }
    except urllib.error.HTTPError as e:
        return {"status": e.code, "contentType": e.headers.get("Content-Type") if e.headers else None,
                "contentLength": e.headers.get("Content-Length") if e.headers else None, "finalUrl": url}
    except Exception as e:
        return {"status": None, "contentType": None, "contentLength": None, "finalUrl": url, "error": str(e)}


def main():
    d = json.load(open(f"{ROOT}/docs/research/leangenbukta-nettside/crawl-raw.json", encoding="utf-8"))
    targets = sorted({e["sourceUrl"] for e in d["entries"] if "/wp-content/" in e["sourceUrl"]})
    out = {}
    for i, url in enumerate(targets, 1):
        print(f"[{i}/{len(targets)}] HEAD {url}")
        out[url] = head(url)
        time.sleep(PAUSE)
    with open(f"{ROOT}/docs/research/leangenbukta-nettside/head-probe.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Ferdig. {len(out)} URL-er HEAD-sjekket.")


if __name__ == "__main__":
    main()
