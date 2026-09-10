"""Register overview to building coordinates from matched, triangulated features.

Outputs an explicit similarity transform and held-out pixel residuals. Never rewrites
either COLMAP model. Run with the dataset venv; see --help for explicit paths.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from scipy.spatial import cKDTree

from source_geometry import read_reconstruction, project


def similarity(x, y):
    xc, yc = x-x.mean(0), y-y.mean(0)
    u, _, vt = np.linalg.svd(xc.T@yc)
    sign = np.diag([1, 1, np.linalg.det(u@vt)])
    r = u@sign@vt
    scale = np.sum((xc@r)*yc)/np.sum(xc*xc)
    return scale, r, y.mean(0)-scale*x.mean(0)@r


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--colmap', default='colmap-b', help='building reconstruction directory')
    parser.add_argument('--pairs', default='10:0,34:24,58:48,82:72,0:90,24:14',
                        help='building:overview direction pairs; the offset is series-specific')
    parser.add_argument('--min-inliers', type=int, default=25)
    args = parser.parse_args()
    building, bp = read_reconstruction(args.data/args.colmap)
    overview, op = read_reconstruction(args.data/'colmap-ov')
    sift = cv2.SIFT_create(nfeatures=18000)
    pairs, audit = [], []
    for bdir, odir in [tuple(int(v) for v in item.split(':')) for item in args.pairs.split(',')]:
        b, o = building[bdir], overview[odir]
        kb, db = sift.detectAndCompute(cv2.imread(str(b['path']), 0), None)
        ko, do = sift.detectAndCompute(cv2.imread(str(o['path']), 0), None)
        matches = [a for a, c in cv2.BFMatcher().knnMatch(db, do, k=2) if a.distance < .7*c.distance]
        bo = b['observations']; bo = bo[bo[:, 2] >= 0]
        oo = o['observations']; oo = oo[oo[:, 2] >= 0]
        bt, ot = cKDTree(bo[:, :2]), cKDTree(oo[:, :2])
        count = 0
        for match in matches:
            bd, bi = bt.query(kb[match.queryIdx].pt)
            od, oi = ot.query(ko[match.trainIdx].pt)
            if bd < 2 and od < 2:
                pairs.append((bp[int(bo[bi, 2])], op[int(oo[oi, 2])], bdir, odir))
                count += 1
        audit.append(dict(building=bdir, overview=odir, correspondences=count))
        print(audit[-1], flush=True)
    x = np.array([p[0] for p in pairs]); y = np.array([p[1] for p in pairs])
    rng = np.random.default_rng(47)
    best = np.zeros(len(x), bool)
    # Threshold is in overview COLMAP units (~35.1 m/unit), ~18 cm.
    for _ in range(2500):
        subset = rng.choice(len(x), 3, replace=False)
        s, r, t = similarity(x[subset], y[subset])
        mask = np.linalg.norm(s*x@r+t-y, axis=1) < .005
        if mask.sum() > best.sum():
            best = mask
    if best.sum() < args.min_inliers:
        raise RuntimeError(f'Unstable registration: only {best.sum()} inliers')
    s, r, t = similarity(x[best], y[best])
    residual = np.linalg.norm(s*x@r+t-y, axis=1)
    # Leave one camera pair out, fit the others, and project held-out points.
    validations = []
    for item in audit:
        hold = np.array([p[2] == item['building'] for p in pairs]) & best
        if hold.sum() < 5:
            continue
        hs, hr, ht = similarity(x[best & ~hold], y[best & ~hold])
        cam = overview[item['overview']]
        errors = np.linalg.norm(project(cam, hs*x[hold]@hr+ht)-project(cam, y[hold]), axis=1)
        validations.append(dict(**item, held_out=len(errors), median_pixels=float(np.median(errors)), p95_pixels=float(np.percentile(errors, 95))))
    result = dict(convention='overview = scale * building @ rotation + translation',
                  scale=s, rotation=r.tolist(), translation=t.tolist(), pairs=audit,
                  inliers=int(best.sum()), total=len(x), median_meters=float(np.median(residual[best])*35.1),
                  held_out=validations)
    if not validations or max(v['p95_pixels'] for v in validations) > 4:
        raise RuntimeError(f'Reprojection validation failed: {validations}')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
