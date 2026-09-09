"""Validate actual GLB bytes, indices, normals, core materials and model bounds."""
import argparse
import json
import struct
from pathlib import Path

import numpy as np


def check(path):
    content=Path(path).read_bytes()
    magic,version,length=struct.unpack_from('<4sII',content)
    assert magic == b'glTF' and version == 2 and length == len(content), 'Invalid GLB header'
    size,kind=struct.unpack_from('<I4s',content,12)
    assert kind == b'JSON' and size % 4 == 0
    doc=json.loads(content[20:20+size]);offset=20+size
    bin_size,kind=struct.unpack_from('<I4s',content,offset)
    assert kind == b'BIN\0' and offset+8+bin_size == len(content)
    binary=content[offset+8:]
    assert not doc.get('extensionsUsed') and not doc.get('extensionsRequired')

    def no_extensions(value):
        if isinstance(value,dict):
            assert not value.get('extensions'), 'Unsupported glTF extension'
            for v in value.values(): no_extensions(v)
        elif isinstance(value,list):
            for v in value: no_extensions(v)
    no_extensions(doc)
    for view in doc['bufferViews']:
        assert view.get('byteOffset',0) % 4 == 0
        assert view.get('byteOffset',0)+view['byteLength'] <= doc['buffers'][0]['byteLength'] <= len(binary)

    def array(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
        return np.frombuffer(binary,dtype=dtype,count=a['count']*width,
                             offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width)
    triangles=0; all_positions=[]
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            p=array(primitive['attributes']['POSITION']); n=array(primitive['attributes']['NORMAL'])
            uv=array(primitive['attributes']['TEXCOORD_0']); idx=array(primitive['indices']).reshape(-1,3)
            assert np.isfinite(p).all() and np.isfinite(n).all() and np.isfinite(uv).all()
            assert idx.max() < len(p) and len(n) == len(p) == len(uv)
            assert np.allclose(np.linalg.norm(n,axis=1),1,atol=1e-4)
            face=np.cross(p[idx[:,1]]-p[idx[:,0]],p[idx[:,2]]-p[idx[:,0]])
            assert (np.linalg.norm(face,axis=1)>1e-8).all(), 'Degenerate triangles'
            assert (np.sum(face*n[idx[:,0]],axis=1)>0).all(), 'Normal/winding mismatch'
            assert 0 <= primitive['material'] < len(doc['materials'])
            triangles+=len(idx);all_positions.extend(p)
    for image in doc.get('images',[]):
        assert image['mimeType'] in ['image/jpeg','image/png']
        assert 0 <= image['bufferView'] < len(doc['bufferViews'])
    points=np.array(all_positions);lo=points.min(0);hi=points.max(0)
    assert abs(lo[2])<.001, 'Ground anchor moved'
    assert 15 < hi[2] < 22 and 10 < hi[0]-lo[0] < 20 and 20 < hi[1]-lo[1] < 35, 'Unexpected Google Z-up bounds'
    result=dict(file=str(path),bytes=len(content),triangles=triangles,
                materials=len(doc['materials']),textures=len(doc.get('textures',[])),
                bounds_min=lo.tolist(),bounds_max=hi.tolist(),extensions=[])
    print(json.dumps(result,indent=2))
    return result


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb',type=Path)
    check(parser.parse_args().glb)
