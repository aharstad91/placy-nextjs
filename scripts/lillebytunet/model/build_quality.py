"""Build source-based Hus B geometry, textures and three core-PBR GLB variants.

Requires existing COLMAP text models and the validated overview registration.
All outputs are isolated under --output; original source images remain untouched.
"""
import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np

from glb_mesh import Mesh
from source_geometry import BuildingFrame, project, read_reconstruction


class Builder:
    def __init__(self, data, output, config, registration, balconies):
        self.output = output
        self.output.mkdir(parents=True, exist_ok=True)
        self.config = config
        self.sources = config['source_cameras']
        self.frame = BuildingFrame(data/'colmap-b')
        self.cameras, _ = read_reconstruction(data/'colmap-b')
        self.overview, _ = read_reconstruction(data/'colmap-ov')
        self.registration = registration
        self.scale = config['scale_m_per_unit']
        self.origin = np.array([(self.frame.a0+self.frame.a1)/2,
                                (self.frame.b0+self.frame.b1)/2, config['origin_z']])
        self.mesh = Mesh()
        self.audit = []
        self.images = {}
        self.balconies = balconies

    def image(self, camera):
        path = camera['path']
        if path not in self.images:
            self.images[path] = cv2.imread(str(path))
            if self.images[path] is None:
                raise ValueError(f'Unreadable source: {path}')
        return self.images[path]

    def pixels(self, points, camera, overview=False):
        world = self.frame.world(points)
        if overview:
            reg = self.registration
            world = reg['scale']*world@np.array(reg['rotation'])+reg['translation']
        return project(camera, world)

    def texture(self, name, corners, direction, overview=False, repair=None):
        corners = np.array(corners, dtype=float)
        ppm = self.config['texture_pixels_per_meter']
        width = max(8, round(np.linalg.norm(corners[1]-corners[0])*self.scale*ppm))
        height = max(8, round(np.linalg.norm(corners[3]-corners[0])*self.scale*ppm))
        u, v = np.meshgrid(np.linspace(0, 1, width), np.linspace(1, 0, height))
        points = (corners[0]+u[..., None]*(corners[1]-corners[0])+
                  v[..., None]*(corners[3]-corners[0]))
        mask = np.zeros((height, width), dtype=np.uint8)
        if repair:
            repair(points, mask)
        camera = (self.overview if overview else self.cameras)[direction]
        pixels = self.pixels(points.reshape(-1, 3), camera, overview).reshape(height, width, 2).astype(np.float32)
        tex = cv2.remap(self.image(camera), pixels[..., 0], pixels[..., 1], cv2.INTER_LINEAR,
                        borderMode=cv2.BORDER_REPLICATE)
        if name == 'roof_membrane':
            # Repeating a low-resolution patch otherwise repeats its large baked
            # lighting gradient. Retain the sampled mean and fine surface detail.
            values=tex.astype(np.float32)
            tex=np.clip(values-cv2.GaussianBlur(values,(0,0),8)+np.mean(values,axis=(0,1)),0,255).astype(np.uint8)
        path = self.output/f'{name}.jpg'
        cv2.imwrite(str(path), tex, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if mask.any():
            cv2.imwrite(str(self.output/f'{name}-repeated-mask.png'), mask)
        self.audit.append(dict(surface=name, series='oversikt' if overview else 'bygg-b',
                               direction=direction, resolution=[width, height],
                               repeated_fraction=float(np.count_nonzero(mask)/mask.size),
                               corners=corners.tolist()))
        self.mesh.material(name, texture=path)
        return name

    def surface(self, name, corners, direction, overview=False, repair=None):
        material = self.texture(name, corners, direction, overview, repair)
        self.mesh.quad((np.array(corners)-self.origin)*self.scale, material)

    def clad(self, corners):
        points=(np.array(corners)-self.origin)*self.scale
        u=np.linalg.norm(points[1]-points[0])/1.36
        v=np.linalg.norm(points[3]-points[0])/.99
        self.mesh.quad(points,'cladding',[(0,v),(u,v),(u,0),(0,0)])

    def opening(self, corners, sliding=False):
        self.mesh.quad((np.array(corners)-self.origin)*self.scale,
                       'window_double' if sliding else 'window_single')

    def box(self, lo, hi, material):
        self.mesh.box((np.array(lo)-self.origin)*self.scale,
                      (np.array(hi)-self.origin)*self.scale, material)

    def repair_end(self, points, mask):
        a, z = points[..., 0].copy(), points[..., 2].copy()
        camera=self.cameras[self.sources['end']]
        center=self.frame.local(-camera['R'].T@camera['t'])
        balcony = self.config['balconies']['end']
        fraction=(balcony['b_front']-points[...,1])/(center[1]-points[...,1])
        crossing=points+fraction[...,None]*(center-points)
        for floor in balcony['floors']:
            hidden = ((crossing[...,0]<=balcony['a_span'][1]+.025)&
                      (crossing[...,2]>=floor-.024)&(crossing[...,2]<=floor+.14))
            points[..., 2][hidden] = floor+.065+np.mod(z[hidden]-floor,.026)
            mask[hidden] = 255
        # The neighbour's pergola crosses the foot of this camera. Repeat clean
        # facade material above it; this is an explicitly recorded hidden strip.
        hidden = z < -1.9
        points[..., 2][hidden] = -1.85
        mask[hidden] = 255

    def materials(self):
        # Small clean patches of actual source material, repeated on new volumes.
        a = self.config['walls']['a_front']
        self.texture('cladding', [(a,-.31,-.54),(a,-.20,-.54),(a,-.20,-.46),(a,-.31,-.46)], self.sources['front'])
        self.texture('window_single', [(a,-.166,-.706),(a,-.079,-.706),(a,-.079,-.578),(a,-.166,-.578)],self.sources['front'])
        self.texture('window_double', [(a,-.352,-.706),(a,-.227,-.706),(a,-.227,-.578),(a,-.352,-.578)],self.sources['front'])
        self.texture('roof_membrane', [(-.44,-.16,-.512),(-.21,-.16,-.512),
                                       (-.21,.12,-.512),(-.44,.12,-.512)], self.sources['roof_overview'], True)
        for name, color in dict(concrete=(.60,.58,.54), rail=(.30,.29,.265),
                                coping=(.43,.44,.44), roof_upstand=(.51,.50,.46),
                                terrace_deck=(.53,.49,.41), soffit=(.43,.42,.39)).items():
            path=self.output/f'{name}.jpg'
            cv2.imwrite(str(path),np.full((8,8,3),np.array(color[::-1])*255,dtype=np.uint8))
            self.mesh.material(name, texture=path)

    def volumes_and_roofs(self):
        c = self.config
        w = c['walls']; a, A, B = w['a_back'], w['a_front'], w['b_end']
        thickness = c['parapet_thickness_m']/self.scale
        for index, level in enumerate(c['levels']):
            name = level['name']; b, z, Z = level['b_start'], level['floor'], level['rim']
            top = index == len(c['levels'])-1
            end = B if top else c['levels'][index+1]['b_start']
            roof = level['roof']
            # Split facade by height, so no rectangular polygon fills a terrace cutout.
            spans = [(b,B,Z)] if top else [(b,end,Z),(end,B,roof)]
            for part,(start,finish,height) in enumerate(spans):
                self.surface(f'{name}_back_{part}', [(a,finish,z),(a,start,z),(a,start,height),(a,finish,height)], self.sources['back'])
                corners=[(A,start,z),(A,finish,z),(A,finish,height),(A,start,height)]
                if self.balconies:
                    self.clad(corners)
                else:
                    self.surface(f'{name}_front_{part}',corners,self.sources['front'])
            if self.balconies:
                if index == 0:
                    self.clad([(a,b,z),(-.05,b,z),(-.05,b,Z),(a,b,Z)])
                    self.surface(name+'_end', [(-.05,b,z),(A,b,z),(A,b,Z),(-.05,b,Z)],self.sources['end'],repair=self.repair_end)
                    for floor in c['balconies']['end']['floors']:
                        self.opening([(a+.09,b-.001,floor+.008),(-.11,b-.001,floor+.008),
                                      (-.11,b-.001,floor+.19),(a+.09,b-.001,floor+.19)],True)
                else:
                    self.clad([(a,b,z),(A,b,z),(A,b,Z),(a,b,Z)])
                    self.opening([(a+.07,b-.001,z+.009),(.06,b-.001,z+.009),
                                  (.06,b-.001,z+.18),(a+.07,b-.001,z+.18)],True)
                    self.opening([(.16,b-.001,z+.009),(.25,b-.001,z+.009),
                                  (.25,b-.001,z+.18),(.16,b-.001,z+.18)])
            else:
                self.surface(name+'_end', [(a,b,z),(A,b,z),(A,b,Z),(a,b,Z)],self.sources['end'])
            flush_top = Z if top else roof
            self.surface(name+'_flush_end', [(A,B,z),(a,B,z),(a,B,flush_top),(A,B,flush_top)], self.sources['flush_end'])
            # Horizontal surface ends at next setback. Parapet's inner faces and
            # coping are separate, preventing walls being smeared across the deck.
            mat = 'roof_membrane' if top else 'terrace_deck'
            roof_end = end-thickness if top else end
            self.mesh.quad((np.array([(a+thickness,b+thickness,roof),(A-thickness,b+thickness,roof),
                                      (A-thickness,roof_end,roof),(a+thickness,roof_end,roof)])-self.origin)*self.scale,
                           mat, [(0,0),(4,0),(4,6),(0,6)] if top else None)
            # The outside parapet face is already part of facade texture; these
            # thin boxes close its thickness and add an inward surface.
            self.box([a+.001,b+.001,roof],[a+thickness,end,Z], 'cladding')
            self.box([A-thickness,b+.001,roof],[A-.001,end,Z], 'cladding')
            self.box([a+thickness,b+.001,roof],[A-thickness,b+thickness,Z], 'cladding')
            edges = [(a,b,a+thickness,end),(A-thickness,b,A,end),(a,b,A,b+thickness)]
            if top:
                self.box([a+thickness,B-thickness,roof],[A-thickness,B-.001,Z], 'cladding')
                edges.append((a,B-thickness,A,B))
            for x,y,X,Y in edges:
                self.box([x-.003,y-.003,Z],[X+.003,Y+.003,Z+.005], 'coping')
            if not top:
                # Source-visible pergola over one side of each stepped terrace.
                self.pergola(a+.07, A-.32, end-.19, end-.025, roof, roof+.20)
                self.audit.append(dict(surface=name+'_terrace', source='bygg-b064-095, overview072-095',
                                       treatment='estimated clean deck; furniture and planting omitted'))
        self.box([a,w['b_start'],c['origin_z']],[A,B,c['origin_z']+.009], 'soffit')
        # Three low upstands, observed in building005/024/078 and overview000/090.
        for x,y,X,Y,Z in [(.06,-.37,.16,-.27,-.458),(-.45,.16,-.28,.33,-.458),
                           (-.02,.71,.09,.91,-.458)]:
            self.box([x,y,-.512],[X,Y,Z], 'roof_upstand')
            self.box([x-.003,y-.003,Z],[X+.003,Y+.003,Z+.004], 'coping')

        if self.balconies:
            for row in c['front_openings']:
                for left,right in row['spans']:
                    bottom=row['bottom']
                    # Wide openings that serve a balcony extend to its deck.
                    if right-left>.14:
                        matching=[level['floor'] for level in c['balconies']['front']
                                  if row['top']-.23<level['floor']<row['top']-.12
                                  and any(left<end and right>start for start,end in level['spans'])]
                        if matching:
                            bottom=min(matching)+.008
                    self.opening([(A+.001,left,bottom),(A+.001,right,bottom),
                                  (A+.001,right,row['top']),(A+.001,left,row['top'])],right-left>.10)
            self.audit.append(dict(surface='front_openings',count=sum(len(r['spans']) for r in c['front_openings']),
                                   source='building005 rectified using COLMAP; clean window crops from top floor',
                                   treatment='opening positions traced; hidden portions and lower-floor repeated rhythm estimated; clean source cladding replaces occluding balconies, furniture and plants'))

    def pergola(self, a, A, b, B, z, Z):
        width = .01
        for x in [a,A-width]:
            for y in [b,B-width]:
                self.box([x,y,z],[x+width,y+width,Z], 'rail')
        for x in np.linspace(a,A-width,7):
            self.box([x,b,Z],[x+width,B,Z+.015], 'rail')
        self.box([a,b,Z-.015],[A,b+width,Z], 'rail')
        self.box([a,B-width,Z-.015],[A,B,Z], 'rail')

    def railing(self, start, end, floor):
        start, end = np.array(start, dtype=float), np.array(end, dtype=float)
        length = np.linalg.norm(end-start)
        height = self.config['balconies']['rail_height_m']/self.scale
        width = .028/self.scale
        post = .045/self.scale
        # Opaque bars are ordinary geometry, so visibility never depends on blend
        # sorting or unsupported extensions in Google Maps.
        for t in np.linspace(0,1,max(2,round(length*self.scale/.12)+1)):
            x,y = start+t*(end-start)
            self.box([x-width/2,y-width/2,floor],[x+width/2,y+width/2,floor+height], 'rail')
        for t in np.linspace(0,1,max(2,round(length*self.scale/1.5)+1)):
            x,y = start+t*(end-start)
            self.box([x-post/2,y-post/2,floor],[x+post/2,y+post/2,floor+height], 'rail')
        lo,hi=np.minimum(start,end),np.maximum(start,end)
        for z in [floor+.009,floor+height]:
            self.box([lo[0]-post/2,lo[1]-post/2,z],[hi[0]+post/2,hi[1]+post/2,z+post], 'rail')

    def balcony_geometry(self):
        c = self.config; w = c['walls']; balconies = c['balconies']
        a,A = w['a_front'],balconies['front_a']; thick=balconies['slab_thickness_m']/self.scale
        count = 0
        for level in balconies['front']:
            z = level['floor']
            for b,B in level['spans']:
                self.box([a,b,z-thick],[A,B,z], 'concrete')
                for start,end in [([A,b],[A,B]),([a,b],[A,b]),([A,B],[a,B])]:
                    self.railing(start,end,z)
                # Solid privacy screen next to the wall; thin, not a full balcony box.
                self.box([a,b,z],[a+.075,b+.009,z+.145], 'cladding')
                count += 1
        end = balconies['end']; b,B=end['b_front'],w['b_start']; a,A=end['a_span']
        for z in end['floors']:
            self.box([a,b,z-thick],[A,B,z], 'concrete')
            for start,finish in [([a,b],[A,b]),([a,B],[a,b]),([A,b],[A,B])]:
                self.railing(start,finish,z)
            count += 1
        self.audit.append(dict(surface='balconies', count=count, source='building005/012/078/084',
                               treatment='separate decks, closed soffits, opaque rail bars, posts and privacy screens; hidden materials estimated'))

    def build(self):
        self.materials()
        self.volumes_and_roofs()
        if self.balconies:
            self.balcony_geometry()
        stats = {}
        for mode in ['emissive', 'pbr', 'hybrid']:
            stats[mode] = self.mesh.write(self.output/f'husB-{mode}.glb', mode)
        (self.output/'surface-sources.json').write_text(json.dumps(self.audit, indent=2)+'\n')
        (self.output/'metrics.json').write_text(json.dumps(stats, indent=2)+'\n')
        (self.output/'parameters.json').write_text(json.dumps(self.config, indent=2)+'\n')
        (self.output/'registration.json').write_text(json.dumps(self.registration, indent=2)+'\n')
        return stats


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--registration', type=Path, required=True)
    parser.add_argument('--config', type=Path, default=Path(__file__).with_name('hus_b_quality.json'))
    parser.add_argument('--roof-only', action='store_true')
    parser.add_argument('--publish', type=Path, help='Optional explicit destination for hybrid GLB')
    args = parser.parse_args()
    config=json.loads(args.config.read_text()); registration=json.loads(args.registration.read_text())
    result=Builder(args.data,args.output,config,registration,not args.roof_only).build()
    if args.publish:
        args.publish.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(args.output/'husB-hybrid.glb',args.publish)
    print(json.dumps(result,indent=2))


if __name__ == '__main__':
    main()
