#!/usr/bin/env python3
"""
Leangenbukta.no — full inventory-crawl for U1 (inventar, snapshot, dekningsregnskap).

Henter sitemaps, følger deretter alle interne lenker rekursivt (BFS) fra
forsiden og hver oppdaget side, klassifiserer hver URL, og lagrer rå HTML
for hver 200-side i docs/research/leangenbukta-nettside/snapshot/<id>.html.

Kun GET, ett kall om gangen med pause — høflig mot kundens server.
Skriver docs/research/leangenbukta-nettside/crawl-raw.json som inndata til
build-manifest.py.

Kjør: python3 scripts/demo/leangenbukta-inventory/crawl.py
"""
import json
import re
import time
import hashlib
import urllib.request
import urllib.error
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode

ROOT = "/Users/andreasharstad/Documents/placy-lb-kundedemo"
BASE_HOST_CANDIDATES = {"leangenbukta.no", "www.leangenbukta.no"}
UA = "PlacyLeangenbuktaInventory/1.0 (+andreas.harstad@initialforce.com; read-only research crawl)"
SNAP_DIR = f"{ROOT}/docs/research/leangenbukta-nettside/snapshot"
OUT_RAW = f"{ROOT}/docs/research/leangenbukta-nettside/crawl-raw.json"
PAUSE = 0.4
TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "gclsrc", "mc_cid", "mc_eid", "_ga", "ref", "share",
}

SITEMAPS = [
    "https://leangenbukta.no/wp-sitemap-posts-post-1.xml",
    "https://leangenbukta.no/wp-sitemap-posts-page-1.xml",
    "https://leangenbukta.no/wp-sitemap-posts-portfolio-1.xml",
    "https://leangenbukta.no/wp-sitemap-taxonomies-category-1.xml",
    "https://leangenbukta.no/wp-sitemap-taxonomies-project-type-1.xml",
]


def normalize(url, base=None):
    if base:
        url = urljoin(base, url)
    parts = urlsplit(url)
    if not parts.scheme:
        return None
    scheme = "https"
    netloc = parts.netloc.lower()
    if netloc.startswith("www.") and netloc[4:] in BASE_HOST_CANDIDATES:
        netloc = netloc[4:]
    path = parts.path
    if path == "":
        path = "/"
    # strip trailing slash except root, WP canonical uses trailing slash for
    # pretty permalinks so keep it EXCEPT for root which stays "/"
    if len(path) > 1 and not path.endswith("/") and "." not in path.rsplit("/", 1)[-1]:
        path = path + "/"
    q = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k.lower() not in TRACKING_PARAMS]
    q.sort()
    query = urlencode(q)
    return urlunsplit((scheme, netloc, path, query, ""))  # fragment dropped


def is_internal(url):
    host = urlsplit(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host in BASE_HOST_CANDIDATES


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = None
        self._in_title = False
        self.body_class = None
        self.canonical = None
        self.links = []  # (href, text-ish context) for <a>
        self.stylesheets = []  # href, in order
        self.inline_styles = []
        self.images = []  # (tag, src, srcset)
        self.scripts = []
        self.iframes = []
        self.forms = []
        self.videos = []
        self.components = set()
        self._current_form_action = None
        self._class_accum = []  # all class attrs seen, for component sniffing
        self.meta = {}

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        cls = d.get("class", "") or ""
        if cls:
            self._class_accum.append(cls)
        if tag == "title":
            self._in_title = True
        elif tag == "body" and self.body_class is None:
            self.body_class = cls
        elif tag == "link":
            rel = (d.get("rel") or "").lower()
            href = d.get("href")
            if rel == "canonical" and href:
                self.canonical = href
            elif "stylesheet" in rel and href:
                self.stylesheets.append(href)
        elif tag == "style":
            pass
        elif tag == "a":
            href = d.get("href")
            if href:
                self.links.append(href)
        elif tag == "img":
            self.images.append({
                "src": d.get("src") or d.get("data-src"),
                "srcset": d.get("srcset") or d.get("data-srcset"),
                "class": cls,
            })
        elif tag == "script":
            src = d.get("src")
            if src:
                self.scripts.append(src)
        elif tag == "iframe":
            src = d.get("src")
            if src:
                self.iframes.append(src)
                self.components.add("iframe")
        elif tag == "form":
            self.forms.append(d.get("action") or "")
        elif tag in ("video", "source"):
            src = d.get("src")
            if src:
                self.videos.append(src)
                self.components.add("video")
        elif tag == "meta":
            name = d.get("name") or d.get("property")
            if name:
                self.meta[name] = d.get("content")
        # background-image inline style
        style = d.get("style") or ""
        for m in re.finditer(r'url\((["\']?)(.*?)\1\)', style):
            self.images.append({"src": m.group(2), "srcset": None, "class": "inline-style-bg"})

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title = (self.title or "") + data


COMPONENT_CLASS_HINTS = {
    "nectar-flickity": "flickity-galleri",
    "flickity": "flickity-galleri",
    "nectar-lightbox": "lightbox",
    "lightbox": "lightbox",
    "magnific": "lightbox",
    "toggle": "accordion/toggle",
    "accordion": "accordion/toggle",
    "nectar-tabbed": "tabs",
    "tabbed-content": "tabs",
    "nectar-milestone": "telleverk/milestone",
    "countdown": "nedtelling",
    "nectar-video": "video-bakgrunn",
    "leaflet": "kart (leaflet)",
    "gmap": "kart (google maps)",
    "google-map": "kart (google maps)",
    "wpcf7": "kontaktskjema (cf7)",
    "gform": "kontaktskjema (gravity forms)",
    "nectar-slider": "slider",
    "swiper": "slider",
}


def sniff_components(html_text, class_accum):
    found = set()
    blob = html_text.lower()
    all_classes = " ".join(class_accum).lower()
    for needle, label in COMPONENT_CLASS_HINTS.items():
        if needle in all_classes or needle in blob:
            found.add(label)
    return sorted(found)


def fetch(url, max_redirects=10):
    """Manual redirect follow to capture full chain + final status."""
    chain = []
    current = url
    for _ in range(max_redirects):
        req = urllib.request.Request(current, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
        try:
            resp = urllib.request.urlopen(req, timeout=25)
            status = resp.status
            final = resp.geturl()
            content_type = resp.headers.get("Content-Type", "") or ""
            content_length = resp.headers.get("Content-Length")
            if "text/html" not in content_type.lower():
                # Dokument/media (PDF, bilde, video ...). Body leses ALDRI —
                # bare status/content-type/content-length registreres.
                resp.close()
                if final != current:
                    chain.append(current)
                return {"status": status, "finalUrl": normalize(final) or final, "redirectChain": chain,
                        "body": b"", "error": None, "contentType": content_type,
                        "contentLength": content_length, "nonHtml": True}
            body = resp.read()
            if final != current:
                chain.append(current)
            return {"status": status, "finalUrl": normalize(final) or final, "redirectChain": chain, "body": body,
                    "error": None, "contentType": content_type, "contentLength": content_length, "nonHtml": False}
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308):
                loc = e.headers.get("Location")
                if loc:
                    chain.append(current)
                    current = urljoin(current, loc)
                    continue
            return {"status": e.code, "finalUrl": normalize(current) or current, "redirectChain": chain, "body": b"",
                    "error": f"HTTP {e.code}", "contentType": None, "contentLength": None, "nonHtml": True}
        except Exception as e:
            return {"status": None, "finalUrl": normalize(current) or current, "redirectChain": chain, "body": b"",
                    "error": str(e), "contentType": None, "contentLength": None, "nonHtml": True}
    return {"status": None, "finalUrl": current, "redirectChain": chain, "body": b"", "error": "too many redirects",
            "contentType": None, "contentLength": None, "nonHtml": True}


def main():
    import os
    os.makedirs(SNAP_DIR, exist_ok=True)

    seeds = {}  # normalized url -> set of discoveredVia labels
    sitemap_counts = {}

    def add_seed(u, via):
        n = normalize(u)
        if not n:
            return
        seeds.setdefault(n, set()).add(via)

    add_seed("https://leangenbukta.no/", "seed:forside")

    for sm in SITEMAPS:
        name = sm.rsplit("/", 1)[-1]
        print(f"Henter sitemap {name}")
        r = fetch(sm)
        time.sleep(PAUSE)
        if r["status"] != 200:
            print(f"  FEIL: status {r['status']} {r['error']}")
            sitemap_counts[name] = 0
            continue
        urls = re.findall(r"<loc>(.*?)</loc>", r["body"].decode("utf-8", "replace"))
        sitemap_counts[name] = len(urls)
        for u in urls:
            add_seed(u, f"sitemap:{name}")

    print(f"Sitemap-seeds: {len(seeds)} unike URL-er fra {sum(sitemap_counts.values())} oppføringer")

    visited = {}  # normalized url -> record
    queue = list(seeds.keys())
    queue_set = set(queue)
    idx = 0

    while idx < len(queue):
        url = queue[idx]
        idx += 1
        if url in visited:
            continue
        print(f"[{idx}/{len(queue)}] {url}")
        r = fetch(url)
        time.sleep(PAUSE)
        rec = {
            "sourceUrl": url,
            "finalUrl": r["finalUrl"],
            "httpStatus": r["status"],
            "redirectChain": r["redirectChain"],
            "error": r["error"],
            "discoveredVia": sorted(seeds.get(url, [])),
            "title": None,
            "canonical": None,
            "bodyClass": None,
            "stylesheets": [],
            "inlineStyleCount": 0,
            "images": [],
            "scripts": [],
            "iframes": [],
            "forms": [],
            "videos": [],
            "components": [],
            "internalLinks": [],
            "outboundLinks": [],
            "snapshotFile": None,
            "contentType": r.get("contentType"),
            "contentLength": r.get("contentLength"),
            "nonHtml": r.get("nonHtml", False),
        }
        body = r["body"]
        if r["status"] == 200 and body and not r.get("nonHtml"):
            try:
                text = body.decode("utf-8", "replace")
            except Exception:
                text = body.decode("latin-1", "replace")
            p = PageParser()
            try:
                p.feed(text)
            except Exception as e:
                rec["error"] = f"parse-error: {e}"
            rec["title"] = (p.title or "").strip() or None
            rec["canonical"] = normalize(p.canonical, url) if p.canonical else None
            rec["bodyClass"] = p.body_class
            rec["stylesheets"] = [normalize(h, url) or h for h in p.stylesheets]
            rec["inlineStyleCount"] = len(p.inline_styles)
            rec["scripts"] = [normalize(s, url) or s for s in p.scripts]
            rec["iframes"] = [normalize(s, url) or s for s in p.iframes]
            rec["forms"] = [normalize(f, url) or f for f in p.forms if f]
            rec["videos"] = [normalize(v, url) or v for v in p.videos]
            rec["components"] = sniff_components(text, p._class_accum)

            imgs = []
            for im in p.images:
                src = im.get("src")
                if src:
                    imgs.append(normalize(src, url) or src)
                srcset = im.get("srcset")
                if srcset:
                    for cand in srcset.split(","):
                        u2 = cand.strip().split(" ")[0]
                        if u2:
                            imgs.append(normalize(u2, url) or u2)
            rec["images"] = sorted(set(imgs))

            internal_links = set()
            outbound_links = set()
            for href in p.links:
                if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:") or href.startswith("javascript:"):
                    if href.startswith("mailto:") or href.startswith("tel:"):
                        outbound_links.add(href)
                    continue
                n = normalize(href, url)
                if not n:
                    continue
                if is_internal(n):
                    internal_links.add(n)
                else:
                    outbound_links.add(n)
            rec["internalLinks"] = sorted(internal_links)
            rec["outboundLinks"] = sorted(outbound_links)

            # snapshot raw html
            slug = urlsplit(url).path.strip("/")
            page_id = slug.replace("/", "__") or "forside"
            fname = f"{page_id}.html"
            with open(f"{SNAP_DIR}/{fname}", "w", encoding="utf-8") as f:
                f.write(text)
            rec["snapshotFile"] = f"snapshot/{fname}"

            for link in internal_links:
                if "/wp-content/" in link:
                    # Dokument/media, ikke en side — HEAD-sjekkes separat av
                    # head_probe.py, aldri fulgt som en crawlbar URL.
                    continue
                if link not in queue_set:
                    queue_set.add(link)
                    queue.append(link)
                seeds.setdefault(link, set()).add(f"link:{page_id}")

        visited[url] = rec

    with open(OUT_RAW, "w", encoding="utf-8") as f:
        json.dump({
            "checkedAt": "2026-09-23",
            "source": "https://leangenbukta.no",
            "sitemapCounts": sitemap_counts,
            "entries": [visited[u] for u in visited],
        }, f, ensure_ascii=False, indent=2)

    print(f"Ferdig. {len(visited)} URL-er besøkt. Rådata: {OUT_RAW}")


if __name__ == "__main__":
    main()
