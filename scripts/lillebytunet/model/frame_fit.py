"""Derive a building's local frame and footprint rectangle from its own COLMAP model.

Building-agnostic replacement for the Hus B prototype pair analyze.py/fit2.py:
every path is explicit, the height band used for the footprint is derived from the
building's own point distribution instead of hard-coded, and all measurements are
written to JSON so the next step never re-derives them by eye.

Writes frame.npy and rect.npy next to the reconstruction, plus reprojection checks.
Never modifies the COLMAP model or the source images.
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
from matplotlib.path import Path as Polygon

from source_geometry import read_reconstruction


def orbit_frame(images):
    """Turntable frame: plane through the camera centres gives the up vector."""
    order = sorted(images)
    centers = np.array([-images[d]['R'].T@images[d]['t'] for d in order])
    views = np.array([images[d]['R'].T@np.array([0, 0, 1.0]) for d in order])
    center = centers.mean(0)
    _, singular, basis = np.linalg.svd(centers-center)
    up = basis[2]
    if np.dot(views.mean(0), up) > 0:
        up = -up
    e1 = basis[0]
    e2 = np.cross(up, e1)
    radius = np.linalg.norm(centers-center, axis=1)
    angles = np.unwrap(np.arctan2((centers-center)@e2, (centers-center)@e1))
    return dict(e1=e1, e2=e2, up=up, center=center), dict(
        plane_residual_units=float(singular[2]/np.sqrt(len(centers))),
        orbit_radius_units=[float(radius.mean()), float(radius.std())],
        pitch_down_deg=[float(np.degrees(np.arcsin(-views@up)).mean()),
                        float(np.degrees(np.arcsin(-views@up)).std())],
        angular_step_deg=float(np.degrees(np.diff(angles)).mean()),
        camera_height_above_center_units=float(((centers-center)@up).mean()))


def building_points(images, points, scenes, min_views, min_fraction):
    """Keep 3D points whose observations fall inside the sales-unit polygons."""
    polygons = defaultdict(list)
    for scene in scenes:
        for reference in scene.get('references', []):
            target = reference.get('target') or {}
            if target.get('type') != 'unit':
                continue
            pixels = [(p['x'], p['y']) for p in reference.get('points', [])]
            if len(pixels) >= 3:
                polygons[scene['direction']].append(Polygon(pixels))
    hits, seen = defaultdict(int), defaultdict(int)
    for direction, image in images.items():
        observed = image['observations']
        observed = observed[observed[:, 2] >= 0]
        for identifier in observed[:, 2].astype(int):
            seen[identifier] += 1
        shapes = polygons.get(direction, [])
        if not shapes:
            continue
        inside = np.zeros(len(observed), bool)
        for shape in shapes:
            inside |= shape.contains_points(observed[:, :2])
        for identifier in observed[inside, 2].astype(int):
            hits[identifier] += 1
    selected = [i for i, count in hits.items()
                if count >= min_views and count/seen[i] >= min_fraction]
    return selected, np.array([points[i] for i in selected])


def min_area_rectangle(xy, low=3, high=97):
    best = None
    for degrees in np.arange(0, 90, 0.25):
        radians = np.radians(degrees)
        rotation = np.array([[np.cos(radians), -np.sin(radians)],
                             [np.sin(radians), np.cos(radians)]])
        rotated = xy@rotation.T
        lo = np.percentile(rotated, low, axis=0)
        hi = np.percentile(rotated, high, axis=0)
        area = float(np.prod(hi-lo))
        if best is None or area < best[0]:
            best = (area, float(degrees), lo, hi)
    return best


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--colmap', required=True, help='e.g. colmap-c')
    parser.add_argument('--scenes', required=True, help='series slug, e.g. bygg-c')
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--checks', type=Path, help='directory for reprojection images')
    parser.add_argument('--band', type=float, nargs=2, default=(0.06, 0.55),
                        help='height band as a fraction of the point-cloud height range')
    parser.add_argument('--min-views', type=int, default=2)
    parser.add_argument('--min-fraction', type=float, default=0.5)
    parser.add_argument('--write', action='store_true',
                        help='write frame.npy/rect.npy/points.npy into the reconstruction directory')
    parser.add_argument('--write-points', action='store_true',
                        help='write only points.npy, expressed in the EXISTING frame.npy. Use this '
                             'on a delivered building: --write would refit frame.npy/rect.npy and '
                             'move its model. points.npy is what massing.py and facade_grid.py need.')
    args = parser.parse_args()

    directory = args.data/args.colmap
    images, points = read_reconstruction(directory)
    frame, orbit = orbit_frame(images)
    e1, e2, up, center = frame['e1'], frame['e2'], frame['up'], frame['center']

    scenes = json.loads((args.data/f'api/scenes_per_level_{args.scenes}.json').read_text())['scenes']
    selected, world = building_points(images, points, scenes, args.min_views, args.min_fraction)
    local = np.stack([(world-center)@e1, (world-center)@e2, (world-center)@up], axis=1)

    zlo, zhi = np.percentile(local[:, 2], [1, 99])
    height = zhi-zlo
    band = (local[:, 2] > zlo+args.band[0]*height) & (local[:, 2] < zlo+args.band[1]*height)
    area, theta, lo, hi = min_area_rectangle(local[band, :2])

    # Height histogram peaks are the floor-slab signature; report them rather than
    # assuming a storey height.
    counts, edges = np.histogram(local[:, 2], bins=90)
    centres = (edges[:-1]+edges[1:])/2
    peaks = [float(centres[i]) for i in range(1, len(counts)-1)
             if counts[i] >= counts[i-1] and counts[i] >= counts[i+1] and counts[i] > counts.max()*0.35]

    report = dict(colmap=args.colmap, series=args.scenes, images=len(images),
                  points_total=len(points), points_building=len(selected),
                  orbit=orbit, footprint=dict(theta_deg=theta, area_units=area,
                                              lo=lo.tolist(), hi=hi.tolist(),
                                              size_units=(hi-lo).tolist()),
                  height_units=dict(p1=float(zlo), p50=float(np.median(local[:, 2])),
                                    p99=float(zhi), range=float(height)),
                  band_fraction=list(args.band), z_peaks_units=peaks)

    if args.write and args.write_points:
        raise SystemExit('Pass either --write or --write-points, not both')
    if args.write:
        np.save(directory/'frame.npy', np.stack([e1, e2, up, center]))
        np.save(directory/'rect.npy', np.array([theta, *lo, *hi]))
        np.save(directory/'points.npy', local)
        report['written'] = [str(directory/name) for name in ('frame.npy', 'rect.npy', 'points.npy')]
    elif args.write_points:
        # Express the points in the frame the delivered model actually uses, so the
        # measurements downstream agree with the geometry that was exported.
        existing = np.load(directory/'frame.npy')
        de1, de2, dup, dcenter = existing
        delivered = np.stack([(world-dcenter)@de1, (world-dcenter)@de2, (world-dcenter)@dup], axis=1)
        drift = float(np.linalg.norm(np.stack([e1, e2, up, center])-existing))
        np.save(directory/'points.npy', delivered)
        report['written'] = [str(directory/'points.npy')]
        report['existing_frame_drift'] = drift
        report['note'] = ('points.npy is in the existing frame.npy, not the freshly fitted one; '
                          'existing_frame_drift is how far the two frames differ')

    if args.checks:
        args.checks.mkdir(parents=True, exist_ok=True)
        radians = np.radians(theta)
        rotation = np.array([[np.cos(radians), -np.sin(radians)],
                             [np.sin(radians), np.cos(radians)]])
        corners = []
        for z in (zlo, zhi):
            for x, y in [(lo[0], lo[1]), (hi[0], lo[1]), (hi[0], hi[1]), (lo[0], hi[1])]:
                xy = rotation.T@np.array([x, y])
                corners.append(center+xy[0]*e1+xy[1]*e2+z*up)
        corners = np.array(corners)
        edges_index = [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4),
                       (0, 4), (1, 5), (2, 6), (3, 7)]
        written = []
        for direction in (0, 12, 24, 36, 48, 60, 72, 84):
            camera = images[direction]
            image = cv2.imread(str(camera['path']))
            local_points = corners@camera['R'].T+camera['t']
            pixels = local_points@camera['K'].T
            pixels = pixels[:, :2]/pixels[:, 2:]
            for a, b in edges_index:
                cv2.line(image, tuple(pixels[a].astype(int)), tuple(pixels[b].astype(int)),
                         (0, 0, 255), 3)
            path = args.checks/f'box-{direction:03d}.jpg'
            cv2.imwrite(str(path), image, [cv2.IMWRITE_JPEG_QUALITY, 88])
            written.append(str(path))
        report['checks'] = written

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
