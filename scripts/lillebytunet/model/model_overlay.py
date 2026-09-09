"""Render a built GLB through the exact source camera and compare it with the render.

Reads the GLB that was actually exported — not the parameters that produced it — so
silhouette, setbacks, balcony depth and texture placement are checked against the
architect's own image in the same projection. Produces, per direction, a side-by-side
sheet and a silhouette overlay on the source.

This is a check, not a renderer for delivery: flat unlit texture sampling with a
depth buffer, no shadows and no anti-aliasing.
"""
import argparse
import json
import struct
from pathlib import Path

import cv2
import numpy as np

from source_geometry import BuildingFrame, read_reconstruction


def read_glb(path):
    content = Path(path).read_bytes()
    size = struct.unpack_from('<I4s', content, 12)[0]
    document = json.loads(content[20:20+size])
    binary = content[20+size+8:]

    def array(index):
        accessor = document['accessors'][index]
        view = document['bufferViews'][accessor['bufferView']]
        dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[accessor['componentType']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[accessor['type']]
        offset = view.get('byteOffset', 0)+accessor.get('byteOffset', 0)
        return np.frombuffer(binary, dtype=dtype, count=accessor['count']*width,
                             offset=offset).reshape(-1, width)

    primitives = []
    for primitive in document['meshes'][0]['primitives']:
        material = document['materials'][primitive['material']]
        texture = None
        index = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if index is not None:
            image = document['images'][document['textures'][index['index']]['source']]
            view = document['bufferViews'][image['bufferView']]
            blob = binary[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']]
            texture = cv2.imdecode(np.frombuffer(blob, np.uint8), cv2.IMREAD_COLOR)
        primitives.append(dict(name=material['name'],
                               positions=array(primitive['attributes']['POSITION']).astype(float),
                               uvs=array(primitive['attributes']['TEXCOORD_0']).astype(float),
                               indices=array(primitive['indices']).reshape(-1, 3).astype(int),
                               texture=texture))
    return primitives


def rasterize(primitives, project_fn, size):
    """Painter-free depth-buffered fill; returns the image and a coverage mask."""
    width, height = size
    image = np.zeros((height, width, 3), np.uint8)
    depth = np.full((height, width), np.inf)
    covered = np.zeros((height, width), bool)
    for primitive in primitives:
        pixels, camera_z = project_fn(primitive['positions'])
        uvs = primitive['uvs']
        texture = primitive['texture']
        if texture is None:
            texture = np.full((1, 1, 3), 200, np.uint8)
        th, tw = texture.shape[:2]
        for tri in primitive['indices']:
            p = pixels[tri]
            z = camera_z[tri]
            if (z <= 0).any():
                continue
            x0 = max(0, int(np.floor(p[:, 0].min())))
            x1 = min(width-1, int(np.ceil(p[:, 0].max())))
            y0 = max(0, int(np.floor(p[:, 1].min())))
            y1 = min(height-1, int(np.ceil(p[:, 1].max())))
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1+1), np.arange(y0, y1+1))
            v0, v1 = p[1]-p[0], p[2]-p[0]
            denominator = v0[0]*v1[1]-v1[0]*v0[1]
            if abs(denominator) < 1e-9:
                continue
            dx, dy = xs-p[0, 0], ys-p[0, 1]
            beta = (dx*v1[1]-dy*v1[0])/denominator
            gamma = (dy*v0[0]-dx*v0[1])/denominator
            alpha = 1-beta-gamma
            inside = (alpha >= -1e-6) & (beta >= -1e-6) & (gamma >= -1e-6)
            if not inside.any():
                continue
            # Perspective-correct interpolation through inverse depth.
            inverse = alpha/z[0]+beta/z[1]+gamma/z[2]
            pixel_z = np.where(inverse > 0, 1/np.maximum(inverse, 1e-12), np.inf)
            window = depth[y0:y1+1, x0:x1+1]
            nearer = inside & (pixel_z < window)
            if not nearer.any():
                continue
            u = (alpha*uvs[tri[0], 0]/z[0]+beta*uvs[tri[1], 0]/z[1]+gamma*uvs[tri[2], 0]/z[2])/inverse
            v = (alpha*uvs[tri[0], 1]/z[0]+beta*uvs[tri[1], 1]/z[1]+gamma*uvs[tri[2], 1]/z[2])/inverse
            # glTF UV origin is the top-left of the image and v grows downwards.
            tx = np.clip((np.mod(u, 1.0)*(tw-1)).astype(int), 0, tw-1)
            ty = np.clip((np.mod(v, 1.0)*(th-1)).astype(int), 0, th-1)
            patch = image[y0:y1+1, x0:x1+1]
            patch[nearer] = texture[ty[nearer], tx[nearer]]
            window[nearer] = pixel_z[nearer]
            covered[y0:y1+1, x0:x1+1] |= nearer
    return image, covered


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--glb', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--directions', default='0,12,24,36,48,60,72,84')
    parser.add_argument('--scale', type=float, default=0.5, help='output scale of 1920x1080')
    args = parser.parse_args()

    config = json.loads(args.config.read_text())
    frame = BuildingFrame(args.data/config['colmap'])
    cameras, _ = read_reconstruction(args.data/config['colmap'])
    metres = config['scale_m_per_unit']
    origin = np.array([(frame.a0+frame.a1)/2, (frame.b0+frame.b1)/2, config['origin_z']])
    primitives = read_glb(args.glb)
    args.output.mkdir(parents=True, exist_ok=True)
    report = []

    for direction in (int(v) for v in args.directions.split(',')):
        camera = cameras[direction]
        source = cv2.imread(str(camera['path']))
        scale = args.scale
        size = (int(1920*scale), int(1080*scale))

        def project_fn(model, camera=camera, scale=scale):
            local = model/metres+origin
            world = frame.world(local)
            view = world@camera['R'].T+camera['t']
            pixels = view@camera['K'].T
            return pixels[:, :2]/pixels[:, 2:]*scale, view[:, 2]

        render, covered = rasterize(primitives, project_fn, size)
        small = cv2.resize(source, size)
        overlay = small.copy()
        edges = cv2.dilate(covered.astype(np.uint8), np.ones((3, 3), np.uint8)) - covered.astype(np.uint8)
        overlay[edges > 0] = (0, 0, 255)
        blend = cv2.addWeighted(small, .45, render, .55, 0)
        blend[~covered] = small[~covered]
        sheet = np.hstack([small, render, overlay])
        for index, label in enumerate([f'source dir {direction}', 'model', 'model outline']):
            cv2.putText(sheet, label, (10+index*size[0], size[1]-12), cv2.FONT_HERSHEY_SIMPLEX,
                        .55, (0, 255, 255), 2)
        cv2.imwrite(str(args.output/f'overlay-{direction:03d}.jpg'), sheet,
                    [cv2.IMWRITE_JPEG_QUALITY, 90])
        cv2.imwrite(str(args.output/f'blend-{direction:03d}.jpg'), blend,
                    [cv2.IMWRITE_JPEG_QUALITY, 90])
        report.append(dict(direction=direction, covered_pixels=int(covered.sum()),
                           covered_fraction=float(covered.mean())))
        print(report[-1], flush=True)

    (args.output/'overlay.json').write_text(json.dumps(report, indent=2)+'\n')


if __name__ == '__main__':
    main()
