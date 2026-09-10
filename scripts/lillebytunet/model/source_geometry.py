"""Read existing PINHOLE COLMAP cameras without changing the reconstruction."""
from pathlib import Path

import numpy as np


def rotation(q):
    w, x, y, z = q
    return np.array([
        [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
        [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
    ])


def read_reconstruction(directory):
    directory = Path(directory)
    cameras = {}
    for line in (directory/'sparse/0/cameras.txt').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        fields = line.split()
        if fields[1] != 'PINHOLE':
            raise ValueError('Only calibrated PINHOLE sources are supported')
        fx, fy, cx, cy = map(float, fields[4:])
        cameras[int(fields[0])] = np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]])
    lines = [line for line in (directory/'sparse/0/images.txt').read_text().splitlines()
             if not line.startswith('#')]
    images = {}
    for index in range(0, len(lines), 2):
        fields = lines[index].split()
        observations = np.array(lines[index+1].split(), dtype=float).reshape(-1, 3)
        images[int(fields[9][:3])] = dict(
            name=fields[9], R=rotation(list(map(float, fields[1:5]))),
            t=np.array(fields[5:8], dtype=float), K=cameras[int(fields[8])],
            observations=observations, path=directory/'images'/fields[9],
        )
    points = {}
    for line in (directory/'sparse/0/points3D.txt').read_text().splitlines():
        if line and not line.startswith('#'):
            fields = line.split()
            points[int(fields[0])] = np.array(fields[1:4], dtype=float)
    return images, points


def project(camera, points):
    local = np.asarray(points) @ camera['R'].T + camera['t']
    pixels = local @ camera['K'].T
    return pixels[:, :2] / pixels[:, 2:]


class BuildingFrame:
    def __init__(self, directory):
        self.e1, self.e2, self.up, self.center = np.load(Path(directory)/'frame.npy')
        theta, self.a0, self.b0, self.a1, self.b1 = np.load(Path(directory)/'rect.npy')
        t = np.radians(theta)
        self.R2 = np.array([[np.cos(t), -np.sin(t)], [np.sin(t), np.cos(t)]])

    def world(self, points):
        points = np.asarray(points)
        xy = points[..., :2] @ self.R2
        return self.center + xy[..., :1]*self.e1 + xy[..., 1:2]*self.e2 + points[..., 2:3]*self.up

    def local(self, points):
        delta = np.asarray(points)-self.center
        xy = np.stack([delta@self.e1, delta@self.e2], axis=-1) @ self.R2.T
        return np.concatenate([xy, (delta@self.up)[..., None]], axis=-1)

    def intersect(self, camera, pixels, axis, value):
        center = self.local(-camera['R'].T@camera['t'])
        rays = np.c_[pixels, np.ones(len(pixels))] @ np.linalg.inv(camera['K']).T @ camera['R']
        directions = self.local(rays+self.center)-self.local(self.center)
        distance = (value-center[axis])/directions[:, axis]
        return center + directions*distance[:, None]
