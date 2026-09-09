"""Place any Lillebytunet building in map coordinates from the overview reconstruction.

Building-agnostic form of the prototype georef chain: the same similarity transform
anchored on the two surveyed neighbouring blocks in OpenStreetMap (Staltaugen 1 and 2),
applied to the requested building's own point cluster. Reports the residual on the
second block so the anchor quality travels with the answer.

Requires colmap-ov/pts.npy, bpts.npy and frame.npy from the existing overview run.
Writes nothing into the reconstruction.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np

SITE = (63.4412384, 10.4406095)
EARTH_RADIUS = 6371000
BLOCKS = (1206556797, 1206556798)


def rect_fit(xy, low=3, high=97):
    best = None
    for degrees in np.arange(0, 180, 0.25):
        radians = np.radians(degrees)
        rotation = np.array([[np.cos(radians), -np.sin(radians)],
                             [np.sin(radians), np.cos(radians)]])
        rotated = xy@rotation.T
        lo = np.percentile(rotated, low, axis=0)
        hi = np.percentile(rotated, high, axis=0)
        area = float(np.prod(hi-lo))
        if best is None or area < best[0]:
            best = (area, rotation, lo, hi)
    _, rotation, lo, hi = best
    centre = rotation.T@((lo+hi)/2)
    size = hi-lo
    axis = 0 if size[0] >= size[1] else 1
    return centre, size, rotation.T@np.eye(2)[axis]


def to_east_north(lat, lng):
    return np.array([(lng-SITE[1])*math.cos(math.radians(SITE[0]))*math.pi/180*EARTH_RADIUS,
                     (lat-SITE[0])*math.pi/180*EARTH_RADIUS])


def to_lat_lng(east, north):
    return (SITE[0]+north/(math.pi/180*EARTH_RADIUS),
            SITE[1]+east/(math.cos(math.radians(SITE[0]))*math.pi/180*EARTH_RADIUS))


def bearing(vector):
    return math.degrees(math.atan2(vector[0], vector[1])) % 180


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--building', required=True, help='A, B, C, D or R')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()

    overview = args.data/'colmap-ov'
    points = np.load(overview/'pts.npy')
    clusters = np.load(overview/'bpts.npy', allow_pickle=True).item()
    osm = json.loads((args.data/'api/osm_buildings.json').read_text())['elements']

    ground = float(np.percentile(points[:, 2], 5))
    from scipy.spatial import cKDTree
    new_builds = np.vstack([clusters[key] for key in 'ABCD'])
    tree = cKDTree(new_builds[:, :2])

    def block(box):
        mask = ((points[:, 0] > box[0]) & (points[:, 0] < box[1]) &
                (points[:, 1] > box[2]) & (points[:, 1] < box[3]) &
                (points[:, 2] > ground+0.12) & (points[:, 2] < ground+0.55))
        candidate = points[mask]
        distance, _ = tree.query(candidate[:, :2])
        return candidate[distance > 0.04, :2]

    def osm_rect(way_id):
        way = next(item for item in osm if item['id'] == way_id)
        outline = np.array([to_east_north(p['lat'], p['lon']) for p in way['geometry']][:-1])
        return rect_fit(outline, 0, 100)

    render = [rect_fit(block(box)) for box in ((-0.7, 0.7, 1.05, 1.95), (0.7, 2.2, 0.55, 1.7))]
    surveyed = [osm_rect(way) for way in BLOCKS]

    axis_rotations = [((bearing(s[2])-bearing(r[2])+90) % 180)-90
                      for r, s in zip(render, surveyed)]
    delta_render = render[1][0]-render[0][0]
    delta_surveyed = surveyed[1][0]-surveyed[0][0]
    centre_rotation = (math.degrees(math.atan2(delta_surveyed[0], delta_surveyed[1]))
                       - math.degrees(math.atan2(delta_render[0], delta_render[1])))
    scale = float(np.linalg.norm(delta_surveyed)/np.linalg.norm(delta_render))
    rotation = math.radians(float(np.mean(axis_rotations+[centre_rotation])))

    best = None
    for sign in (1, -1):
        angle = sign*rotation
        matrix = np.array([[math.cos(angle), -math.sin(angle)],
                           [math.sin(angle), math.cos(angle)]])
        transform = lambda q, m=matrix: surveyed[0][0]+scale*(m@(q-render[0][0]))
        error = float(np.linalg.norm(transform(render[1][0])-surveyed[1][0]))
        if best is None or error < best[0]:
            best = (error, matrix)
    residual, matrix = best
    place = lambda q: surveyed[0][0]+scale*(matrix@(q-render[0][0]))

    cluster = clusters[args.building]
    low, high = np.percentile(cluster[:, 2], [1, 99])
    middle = ((cluster[:, 2] > low+0.15*(high-low)) & (cluster[:, 2] < low+0.75*(high-low)))
    centre, size, long_axis = rect_fit(cluster[middle, :2])
    top = cluster[:, 2] > low+0.85*(high-low)
    # The model's +Y points at the flush end, which is the end the top storeys sit
    # towards: the setbacks cut into the opposite end. Verified against Hus B, whose
    # +Y heading is 110 degrees.
    shift = float(np.dot(cluster[top, :2].mean(0)-centre, long_axis))
    plus_y = long_axis if shift > 0 else -long_axis
    mapped = matrix@plus_y
    heading = math.degrees(math.atan2(mapped[0], mapped[1])) % 360
    lat, lng = to_lat_lng(*place(centre))

    result = dict(building=args.building, lat=lat, lng=lng, heading_plus_y=heading,
                  balcony_bearing=(heading+90) % 360,
                  size_m=(np.sort(size)*scale).tolist(),
                  height_m=float((high-low)*scale),
                  top_storey_shift_units=shift,
                  scale_m_per_unit_overview=scale,
                  second_block_residual_m=residual,
                  rotation_from_axes_deg=axis_rotations,
                  rotation_from_centres_deg=centre_rotation,
                  anchor='OpenStreetMap ways %d and %d (Staltaugen 1 and 2)' % BLOCKS)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
