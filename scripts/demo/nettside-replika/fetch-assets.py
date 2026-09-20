import re, json, os, html, urllib.request, urllib.parse, hashlib, sys

DEST = "/Users/andreasharstad/Documents/placy/public/demo/leangenbukta-nettside"
UA = {'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'Referer':'https://leangenbukta.no/'}
DROP = {2,6,8,9,11,14,26,27,29,30,45}
os.makedirs(DEST, exist_ok=True)

seen = {}   # absolute url -> local path (relative to /demo/leangenbukta-nettside/)

def local_name(url):
    p = urllib.parse.urlparse(url)
    base = os.path.basename(p.path) or "asset"
    base = urllib.parse.unquote(base)
    base = re.sub(r'[^A-Za-z0-9._-]', '-', base)
    stem, ext = os.path.splitext(base)
    if not ext:
        ext = ""
    h = hashlib.sha1(url.encode()).hexdigest()[:6]
    return f"{stem[:48]}-{h}{ext}"

def download(url):
    url = url.split('#')[0]
    if url in seen:
        return seen[url]
    name = local_name(url)
    out = os.path.join(DEST, name)
    if not os.path.exists(out):
        try:
            req = urllib.request.Request(url, headers=UA)
            data = urllib.request.urlopen(req, timeout=60).read()
        except Exception as e:
            print("FAIL", url, e, file=sys.stderr)
            seen[url] = None
            return None
        open(out, 'wb').write(data)
        print(f"  {len(data):>9} {name}")
    seen[url] = name
    return name

man = json.load(open('css-manifest.json'))
h = open('index.html', encoding='utf-8').read()

print("== page assets ==")
page_urls = set()
for u in re.findall(r'background-image:\s*url\(\s*[\'"]?([^\'")]+)', h):
    page_urls.add(html.unescape(u))
for m in re.finditer(r'<img[^>]*src=["\']([^"\']+)', h):
    u = html.unescape(m.group(1))
    if 'leangenbukta.no' in u:
        page_urls.add(u)
page_urls.add('https://leangenbukta.no/wp-content/uploads/2026/03/Film-til-landingside_low.mov')
for u in sorted(page_urls):
    download(u)

print("== css assets ==")
for x in man:
    if x['i'] in DROP:
        continue
    css = open(x['file'], encoding='utf-8').read()
    base = x.get('url') or 'https://leangenbukta.no/'
    for m in re.finditer(r'url\(\s*([\'"]?)([^\'")]+)\1\s*\)', css):
        v = m.group(2).strip()
        if v.startswith('data:') or v.startswith('#'):
            continue
        absu = urllib.parse.urljoin(base, v)
        if absu.startswith('http'):
            download(absu)

json.dump({k: v for k, v in seen.items()}, open('asset-map.json', 'w'), indent=1)
ok = sum(1 for v in seen.values() if v)
print(f"\n{ok}/{len(seen)} assets downloaded to {DEST}")
