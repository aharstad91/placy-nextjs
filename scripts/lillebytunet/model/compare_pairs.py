"""Lager side-ved-side-bilder: originalrender (bygg-b, direction k) vs Google-skjermbilde.
Bruk: compare_pairs.py <renders-dir> <screens-dir> <out-dir> k:screenfile [k:screenfile ...]
Eks:  compare_pairs.py ~/klienter/placy/lillebytunet/renders/bygg-b docs/research/lillebytunet-3d/screens docs/research/lillebytunet-3d/compare 0:husB-render-dir-0.jpg
"""
import sys, os, glob
from PIL import Image, ImageDraw
rdir, sdir, odir = sys.argv[1:4]; os.makedirs(odir, exist_ok=True)
for spec in sys.argv[4:]:
    k, sf = spec.split(':', 1); k = int(k)
    rf = glob.glob(os.path.join(rdir, '%03d_*' % k))[0]
    a = Image.open(rf).convert('RGB'); b = Image.open(os.path.join(sdir, sf)).convert('RGB')
    H = 540; a = a.resize((int(a.width * H / a.height), H)); b = b.resize((int(b.width * H / b.height), H))
    out = Image.new('RGB', (a.width + b.width + 10, H + 28), 'white'); out.paste(a, (0, 28)); out.paste(b, (a.width + 10, 28))
    d = ImageDraw.Draw(out); d.text((6, 6), 'Boligvelger-render, direction %d' % k, fill='black'); d.text((a.width + 16, 6), 'Google Maps 3D: ' + sf, fill='black')
    of = os.path.join(odir, 'compare-dir-%03d.jpg' % k); out.save(of, quality=85); print(of)
