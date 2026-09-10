"""Rectify one facade plane from a chosen source camera and draw a coordinate grid.

The grid is in the building's own local units, so balcony spans, window rows and
setback positions can be read off the source image directly instead of estimated
by eye. Used to check and refine a geometry config before any texture is baked.

Reads only the existing COLMAP model and the original renders; writes images to
--output.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np

from source_geometry import BuildingFrame, project, read_reconstruction


def rectify(frame, camera, corners, pixels_per_unit, image):
    corners = np.array(corners, dtype=float)
    width = max(16, round(np.linalg.norm(corners[1]-corners[0])*pixels_per_unit))
    height = max(16, round(np.linalg.norm(corners[3]-corners[0])*pixels_per_unit))
    u, v = np.meshgrid(np.linspace(0, 1, width), np.linspace(1, 0, height))
    points = (corners[0]+u[..., None]*(corners[1]-corners[0])
              + v[..., None]*(corners[3]-corners[0]))
    grid = project(camera, frame.world(points.reshape(-1, 3)))
    grid = grid.reshape(height, width, 2).astype(np.float32)
    return cv2.remap(image, grid[..., 0], grid[..., 1], cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--colmap', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--plane', required=True,
                        help='axis=value, e.g. a=0.63 (facade at that local coordinate)')
    parser.add_argument('--horizontal', required=True,
                        help='range of the in-plane horizontal axis as lo,hi')
    parser.add_argument('--vertical', required=True, help='vertical range as lo,hi')
    parser.add_argument('--direction', type=int, required=True, help='source camera index')
    parser.add_argument('--overview', action='store_true',
                        help='sample the overview series through --registration')
    parser.add_argument('--registration', type=Path)
    parser.add_argument('--ppu', type=float, default=900, help='pixels per local unit')
    parser.add_argument('--step', type=float, default=0.05, help='grid step in local units')
    parser.add_argument('--name', default=None)
    args = parser.parse_args()

    axis, value = args.plane.split('=')
    value = float(value)
    frame = BuildingFrame(args.data/args.colmap)
    cameras, _ = read_reconstruction(args.data/(('colmap-ov') if args.overview else args.colmap))
    camera = cameras[args.direction]
    image = cv2.imread(str(camera['path']))

    class Sampler:
        """Applies the overview registration when sampling the overview series."""

        def __init__(self, base, registration):
            self.base, self.registration = base, registration

        def world(self, points):
            world = self.base.world(points)
            if self.registration:
                reg = self.registration
                world = reg['scale']*world@np.array(reg['rotation'])+reg['translation']
            return world

    registration = json.loads(args.registration.read_text()) if args.overview else None
    sampler = Sampler(frame, registration)

    h0, h1 = (float(v) for v in args.horizontal.split(','))
    v0, v1 = (float(v) for v in args.vertical.split(','))
    if axis == 'a':
        corners = [(value, h0, v0), (value, h1, v0), (value, h1, v1), (value, h0, v1)]
        labels = ('b', 'z')
    elif axis == 'b':
        corners = [(h0, value, v0), (h1, value, v0), (h1, value, v1), (h0, value, v1)]
        labels = ('a', 'z')
    else:
        corners = [(h0, v0, value), (h1, v0, value), (h1, v1, value), (h0, v1, value)]
        labels = ('a', 'b')

    tile = rectify(sampler, camera, corners, args.ppu, image)
    height, width = tile.shape[:2]
    overlay = tile.copy()
    for x in np.arange(np.ceil(h0/args.step)*args.step, h1, args.step):
        px = int((x-h0)/(h1-h0)*(width-1))
        major = abs(round(x/(args.step*2))*args.step*2-x) < 1e-9
        cv2.line(overlay, (px, 0), (px, height-1), (0, 255, 255) if major else (0, 140, 140), 1)
        if major:
            cv2.putText(overlay, f'{x:+.2f}', (px+2, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.38,
                        (0, 255, 255), 1)
    for y in np.arange(np.ceil(v0/args.step)*args.step, v1, args.step):
        py = int((1-(y-v0)/(v1-v0))*(height-1))
        cv2.line(overlay, (0, py), (width-1, py), (255, 200, 0), 1)
        cv2.putText(overlay, f'{y:+.2f}', (4, py-3), cv2.FONT_HERSHEY_SIMPLEX, 0.38,
                    (255, 200, 0), 1)
    cv2.putText(overlay, f'{args.plane} {labels[0]} {h0}..{h1} {labels[1]} {v0}..{v1} '
                f'dir {args.direction}{" overview" if args.overview else ""}',
                (6, height-8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

    args.output.mkdir(parents=True, exist_ok=True)
    name = args.name or f'{axis}{value:+.3f}-dir{args.direction:03d}'
    clean = args.output/f'{name}.jpg'
    marked = args.output/f'{name}-grid.jpg'
    cv2.imwrite(str(clean), tile, [cv2.IMWRITE_JPEG_QUALITY, 92])
    cv2.imwrite(str(marked), overlay, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(json.dumps(dict(plane=args.plane, direction=args.direction, size=[width, height],
                          clean=str(clean), grid=str(marked)), indent=2))


if __name__ == '__main__':
    main()
