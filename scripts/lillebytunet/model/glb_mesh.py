"""Small deterministic core-glTF writer; geometry is already Google Z-up."""
import json
import struct
from pathlib import Path

import numpy as np


class Mesh:
    def __init__(self, name='Hus B', cladding_tile=(1.36, .99)):
        self.groups = {}
        self.materials = {}
        # The cladding material is tiled by real size, so the tile is per building.
        self.name = name
        self.cladding_tile = cladding_tile

    def material(self, name, color=(1, 1, 1), texture=None):
        self.materials[name] = dict(color=color, texture=texture)

    def quad(self, points, material, uv=None):
        p = np.asarray(points, dtype=float)
        normal = np.cross(p[1]-p[0], p[3]-p[0])
        length = np.linalg.norm(normal)
        if length < 1e-10:
            raise ValueError(f'Degenerate face: {material}')
        normal /= length
        uv = uv if uv is not None else [(0, 1), (1, 1), (1, 0), (0, 0)]
        group = self.groups.setdefault(material, dict(positions=[], normals=[], uvs=[], indices=[]))
        base = len(group['positions'])
        group['positions'].extend(p.tolist())
        group['normals'].extend([normal.tolist()]*4)
        group['uvs'].extend(uv)
        group['indices'].extend([base, base+1, base+2, base, base+2, base+3])

    def box(self, lo, hi, material):
        x, y, z = lo; X, Y, Z = hi
        if min(X-x, Y-y, Z-z) <= 0:
            raise ValueError('Box dimensions must be positive')
        for face in [
            [(x,Y,z),(x,y,z),(x,y,Z),(x,Y,Z)],
            [(X,y,z),(X,Y,z),(X,Y,Z),(X,y,Z)],
            [(x,y,z),(X,y,z),(X,y,Z),(x,y,Z)],
            [(X,Y,z),(x,Y,z),(x,Y,Z),(X,Y,Z)],
            [(x,y,z),(x,Y,z),(X,Y,z),(X,y,z)],
            [(x,y,Z),(X,y,Z),(X,Y,Z),(x,Y,Z)],
        ]:
            if material == 'cladding':
                p=np.array(face)
                u=np.linalg.norm(p[1]-p[0])/self.cladding_tile[0]
                v=np.linalg.norm(p[3]-p[0])/self.cladding_tile[1]
                self.quad(face,material,[(0,v),(u,v),(u,0),(0,0)])
            else:
                self.quad(face, material)

    def write(self, path, lighting='hybrid'):
        path = Path(path)
        document = dict(asset=dict(version='2.0',
                                   generator=f'Placy {self.name} source-based reconstruction'),
                        scene=0, scenes=[dict(nodes=[0])], nodes=[dict(mesh=0, name=self.name)],
                        meshes=[dict(primitives=[])], buffers=[], bufferViews=[], accessors=[],
                        materials=[], textures=[], images=[], samplers=[dict(magFilter=9729, minFilter=9987)])
        binary = bytearray()

        def view(data, target=None):
            binary.extend(b'\0'*((-len(binary)) % 4))
            result = dict(buffer=0, byteOffset=len(binary), byteLength=len(data))
            if target:
                result['target'] = target
            document['bufferViews'].append(result)
            binary.extend(data)
            return len(document['bufferViews'])-1

        def accessor(values, kind, indices=False):
            a = np.asarray(values, dtype='<u4' if indices else '<f4')
            item = dict(bufferView=view(a.tobytes(), 34963 if indices else 34962),
                        componentType=5125 if indices else 5126, count=len(a), type=kind)
            if kind == 'VEC3':
                item.update(min=a.min(0).tolist(), max=a.max(0).tolist())
            document['accessors'].append(item)
            return len(document['accessors'])-1

        for name, group in self.groups.items():
            source = self.materials[name]
            # Keep texture RGB in sRGB; color factors and emission are linear.
            emission = {'emissive': 1.0, 'hybrid': .38, 'pbr': 0.0}[lighting]
            if lighting == 'hybrid' and not source['texture']:
                emission = .7
            diffuse = 1-emission
            linear = [((v+.055)/1.055)**2.4 if v > .04045 else v/12.92 for v in source['color']]
            material = dict(name=name, pbrMetallicRoughness=dict(
                baseColorFactor=[v*diffuse for v in linear]+[1], metallicFactor=0, roughnessFactor=.9),
                emissiveFactor=[v*emission for v in linear])
            if source['texture']:
                texture_path = Path(source['texture'])
                index = len(document['textures'])
                document['images'].append(dict(bufferView=view(texture_path.read_bytes()), mimeType='image/jpeg', name=texture_path.stem))
                document['textures'].append(dict(source=index, sampler=0))
                material['pbrMetallicRoughness']['baseColorTexture'] = dict(index=index)
                if emission:
                    material['emissiveTexture'] = dict(index=index)
            material_id = len(document['materials'])
            document['materials'].append(material)
            primitive = dict(attributes=dict(POSITION=accessor(group['positions'], 'VEC3'),
                                              NORMAL=accessor(group['normals'], 'VEC3'),
                                              TEXCOORD_0=accessor(group['uvs'], 'VEC2')),
                             indices=accessor(group['indices'], 'SCALAR', True), material=material_id)
            document['meshes'][0]['primitives'].append(primitive)
        document['buffers'].append(dict(byteLength=len(binary)))
        json_bytes = json.dumps(document, separators=(',', ':')).encode()
        json_bytes += b' '*((-len(json_bytes)) % 4)
        binary.extend(b'\0'*((-len(binary)) % 4))
        total = 12+8+len(json_bytes)+8+len(binary)
        path.write_bytes(struct.pack('<4sII', b'glTF', 2, total)+struct.pack('<I4s', len(json_bytes), b'JSON')+
                         json_bytes+struct.pack('<I4s', len(binary), b'BIN\0')+binary)
        return dict(bytes=total, triangles=sum(len(g['indices'])//3 for g in self.groups.values()),
                    materials=len(document['materials']), textures=len(document['textures']), lighting=lighting)
