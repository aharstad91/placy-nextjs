"""Build source-based building geometry, textures and three core-PBR GLB variants.

Requires existing COLMAP text models and a validated overview registration. Every
building-specific measurement lives in the config file, so a new building is a new
config plus its own reconstruction — not a new script. All outputs are isolated
under --output; original source images remain untouched.
"""
import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np

from glb_mesh import Mesh
from source_geometry import BuildingFrame, project, read_reconstruction

# Hus B values, kept as defaults so its config stays as first written and its
# export stays byte-identical while the code became building-agnostic.
DEFAULT_MATERIAL_COLORS = dict(concrete=(.60, .58, .54), rail=(.30, .29, .265),
                               coping=(.43, .44, .44), roof_upstand=(.51, .50, .46),
                               terrace_deck=(.53, .49, .41), soffit=(.43, .42, .39))
DEFAULT_MATERIAL_SAMPLES = dict(
    cladding=dict(source='front', a='a_front', b=[-.31, -.20], z=[-.54, -.46]),
    window_single=dict(source='front', a='a_front', b=[-.166, -.079], z=[-.706, -.578]),
    window_double=dict(source='front', a='a_front', b=[-.352, -.227], z=[-.706, -.578]),
)
DEFAULT_ROOF_SAMPLE = dict(a=[-.44, -.21], b=[-.16, .12], z=-.512)
DEFAULT_ROOF_UPSTANDS = [[.06, -.37, .16, -.27, -.458], [-.45, .16, -.28, .33, -.458],
                         [-.02, .71, .09, .91, -.458]]
DEFAULT_PERGOLA = dict(a_inset=[.07, -.32], b_inset=[-.19, -.025], height=.20, rafters=7)
# End-wall openings use absolute local a and z relative to that level's floor.
DEFAULT_LEVEL_END = [
    dict(mode='source', split_a=-.05, repair='end_balconies', openings='end_balconies'),
    dict(mode='clad', openings=[dict(a=[-.562, .06], z=[.009, .18], double=True),
                                dict(a=[.16, .25], z=[.009, .18], double=False)]),
]


class Builder:
    def __init__(self, data, output, config, registration, balconies):
        self.output = output
        self.output.mkdir(parents=True, exist_ok=True)
        self.config = config
        self.sources = config['source_cameras']
        self.colmap = config.get('colmap', 'colmap-b')
        self.series = config.get('series', 'bygg-b')
        self.frame = BuildingFrame(data/self.colmap)
        self.cameras, _ = read_reconstruction(data/self.colmap)
        self.overview, _ = read_reconstruction(data/'colmap-ov')
        self.registration = registration
        self.scale = config['scale_m_per_unit']
        self.origin = np.array([(self.frame.a0+self.frame.a1)/2,
                                (self.frame.b0+self.frame.b1)/2, config['origin_z']])
        self.mesh = Mesh(config.get('model_name', 'Hus B'),
                         tuple(config.get('cladding_tile_m', (1.36, .99))))
        self.audit = []
        self.images = {}
        self.balconies = balconies
        # Real-world size of each sampled material, so wide openings repeat panes
        # instead of stretching one window across a whole glazed wall.
        self.material_size = {}

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
        self.material_size[name] = (float(np.linalg.norm(corners[1]-corners[0])*self.scale),
                                    float(np.linalg.norm(corners[3]-corners[0])*self.scale))
        self.audit.append(dict(surface=name, series='oversikt' if overview else self.series,
                               direction=direction, resolution=[width, height],
                               repeated_fraction=float(np.count_nonzero(mask)/mask.size),
                               corners=corners.tolist()))
        self.mesh.material(name, texture=path)
        return name

    def surface(self, name, corners, direction, overview=False, repair=None):
        rules = self.config.get('surface_repairs', {}).get(name)
        if rules and repair is None:
            repair = self.strip_repair(rules)
        material = self.texture(name, corners, direction, overview, repair)
        self.mesh.quad((np.array(corners)-self.origin)*self.scale, material)

    def clad(self, corners):
        points=(np.array(corners)-self.origin)*self.scale
        tile=self.mesh.cladding_tile
        u=np.linalg.norm(points[1]-points[0])/tile[0]
        v=np.linalg.norm(points[3]-points[0])/tile[1]
        self.mesh.quad(points,'cladding',[(0,v),(u,v),(u,0),(0,0)])

    def opening(self, corners, sliding=False):
        material = 'window_double' if sliding else 'window_single'
        points = (np.array(corners)-self.origin)*self.scale
        uv = None
        if self.config.get('tile_openings'):
            # Repeat the sampled pane across a wide glazed band; one pane vertically.
            pane = self.material_size.get(material)
            if pane:
                panes = max(1, round(np.linalg.norm(points[1]-points[0])/pane[0]))
                uv = [(0, 1), (panes, 1), (panes, 0), (0, 0)]
        self.mesh.quad(points, material, uv)

    def box(self, lo, hi, material):
        self.mesh.box((np.array(lo)-self.origin)*self.scale,
                      (np.array(hi)-self.origin)*self.scale, material)

    def strip_repair(self, rules):
        """Replace occluded strips of a projected surface by repeating clean material.

        Each rule names one axis, the boundary past which the source is occluded, and a
        clean band to repeat instead. Recorded in the surface's repeated fraction, so a
        repaired strip is never presented as photographed.
        """
        axes = dict(a=0, b=1, z=2)

        def repair(points, mask):
            for rule in rules:
                axis = axes[rule['axis']]
                values = points[..., axis]
                if 'beyond' in rule:
                    hidden = values > rule['beyond']
                    offset = values-rule['beyond']
                else:
                    hidden = values < rule['below']
                    offset = rule['below']-values
                if not hidden.any():
                    continue
                period = rule.get('period', .04)
                direction = -1 if 'beyond' in rule else 1
                points[..., axis][hidden] = (rule['repeat_from']
                                             + direction*np.mod(offset[hidden], period))
                mask[hidden] = 255
        return repair

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

    def sample_corners(self, sample):
        """Sample rectangle on any facade plane: 'a' keeps the Hus B form, 'plane' generalises."""
        if 'plane' in sample:
            axis, value = sample['plane'].split('=')
            value = float(value)
            h0, h1 = sample['h']; z0, z1 = sample['z']
            if axis == 'a':
                return [(value, h0, z0), (value, h1, z0), (value, h1, z1), (value, h0, z1)]
            return [(h0, value, z0), (h1, value, z0), (h1, value, z1), (h0, value, z1)]
        plane = self.config['walls'][sample['a']] if isinstance(sample['a'], str) else sample['a']
        b0, b1 = sample['b']; z0, z1 = sample['z']
        return [(plane, b0, z0), (plane, b1, z0), (plane, b1, z1), (plane, b0, z1)]

    def materials(self):
        # Small clean patches of actual source material, repeated on new volumes.
        for name, sample in self.config.get('material_samples', DEFAULT_MATERIAL_SAMPLES).items():
            self.texture(name, self.sample_corners(sample), self.sources[sample['source']])
        roof = self.config.get('roof_sample', DEFAULT_ROOF_SAMPLE)
        if 'color' in roof:
            # A grazed roof cannot be sampled; a measured flat colour is honest where
            # a rectified patch would only repeat parapet and sky smear.
            path = self.output/'roof_membrane.jpg'
            cv2.imwrite(str(path), np.full((8, 8, 3), np.array(tuple(roof['color'])[::-1])*255,
                                           dtype=np.uint8))
            self.mesh.material('roof_membrane', texture=path)
            self.audit.append(dict(surface='roof_membrane', series='measured colour',
                                   color=list(roof['color']),
                                   treatment='flat colour; see evidence.roof'))
        else:
            a0, a1 = roof['a']; b0, b1 = roof['b']; z = roof['z']
            self.texture('roof_membrane', [(a0, b0, z), (a1, b0, z), (a1, b1, z), (a0, b1, z)],
                         self.sources['roof_overview'], roof.get('overview', True))
        for name, color in self.config.get('material_colors', DEFAULT_MATERIAL_COLORS).items():
            path=self.output/f'{name}.jpg'
            cv2.imwrite(str(path),np.full((8,8,3),np.array(tuple(color)[::-1])*255,dtype=np.uint8))
            self.mesh.material(name, texture=path)

    def level_end(self, index):
        """End-wall treatment for one level; the last entry repeats for the rest."""
        treatments = self.config.get('level_ends', DEFAULT_LEVEL_END)
        return treatments[min(index, len(treatments)-1)]

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
            # A level whose front is unoccluded by balconies can carry its own source
            # texture instead of clean cladding; below the balconies it cannot.
            front_from_source = not self.balconies or level.get('front_mode') == 'source'
            for part,(start,finish,height) in enumerate(spans):
                self.surface(f'{name}_back_{part}', [(a,finish,z),(a,start,z),(a,start,height),(a,finish,height)], self.sources['back'])
                corners=[(A,start,z),(A,finish,z),(A,finish,height),(A,start,height)]
                if front_from_source:
                    self.surface(f'{name}_front_{part}',corners,self.sources['front'])
                else:
                    self.clad(corners)
            if self.balconies:
                treatment = self.level_end(index)
                if treatment['mode'] == 'source':
                    split = treatment.get('split_a')
                    repair = self.repair_end if treatment.get('repair') == 'end_balconies' else None
                    if split is None:
                        self.surface(name+'_end', [(a,b,z),(A,b,z),(A,b,Z),(a,b,Z)],
                                     self.sources['end'], repair=repair)
                    else:
                        self.clad([(a,b,z),(split,b,z),(split,b,Z),(a,b,Z)])
                        self.surface(name+'_end', [(split,b,z),(A,b,z),(A,b,Z),(split,b,Z)],
                                     self.sources['end'], repair=repair)
                else:
                    self.clad([(a,b,z),(A,b,z),(A,b,Z),(a,b,Z)])
                if treatment.get('openings') == 'end_balconies':
                    for floor in c['balconies']['end']['floors']:
                        self.opening([(a+.09,b-.001,floor+.008),(-.11,b-.001,floor+.008),
                                      (-.11,b-.001,floor+.19),(a+.09,b-.001,floor+.19)],True)
                else:
                    for hole in treatment.get('openings') or []:
                        a0, a1 = hole['a']; z0, z1 = hole['z']
                        self.opening([(a0,b-.001,z+z0),(a1,b-.001,z+z0),
                                      (a1,b-.001,z+z1),(a0,b-.001,z+z1)], hole.get('double', False))
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
                pergola = c.get('pergola', DEFAULT_PERGOLA)
                self.pergola(a+pergola['a_inset'][0], A+pergola['a_inset'][1],
                             end+pergola['b_inset'][0], end+pergola['b_inset'][1],
                             roof, roof+pergola['height'], pergola.get('rafters', 7))
                self.audit.append(dict(surface=name+'_terrace',
                                       source=c['evidence'].get('terrace_source', 'bygg-b064-095, overview072-095'),
                                       treatment='estimated clean deck; furniture and planting omitted'))
        self.box([a,w['b_start'],c['origin_z']],[A,B,c['origin_z']+.009], 'soffit')
        # Low upstands on the main roof, observed in the source views.
        for x,y,X,Y,Z in c.get('roof_upstands', DEFAULT_ROOF_UPSTANDS):
            self.box([x,y,c['levels'][-1]['roof']],[X,Y,Z], 'roof_upstand')
            self.box([x-.003,y-.003,Z],[X+.003,Y+.003,Z+.004], 'coping')

        if self.balconies:
            # Levels textured from the source already contain their own windows.
            textured = [(l['floor'], l['rim']) for l in c['levels']
                        if l.get('front_mode') == 'source']
            for row in c['front_openings']:
                if any(low <= row['top'] <= high for low, high in textured):
                    continue
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
                                   source=c['evidence'].get('openings_source','building005 rectified using COLMAP; clean window crops from top floor'),
                                   treatment='opening positions traced; hidden portions and lower-floor repeated rhythm estimated; clean source cladding replaces occluding balconies, furniture and plants'))

    def pergola(self, a, A, b, B, z, Z, rafters=7):
        width = .01
        for x in [a,A-width]:
            for y in [b,B-width]:
                self.box([x,y,z],[x+width,y+width,Z], 'rail')
        for x in np.linspace(a,A-width,rafters):
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
        screen = balconies.get('screen', dict(depth=.075, length=.009, height=.145))
        count = 0
        fins = balconies.get('side_fins')
        for level in balconies['front']:
            z = level['floor']
            for b,B in level['spans']:
                self.box([a,b,z-thick],[A,B,z], 'concrete')
                if fins:
                    # Plaster side walls run the full balcony depth, as the source
                    # shows; they carry most of this facade's depth reading.
                    for edge in (b, B-fins['width']):
                        self.box([a,edge,z],[A,edge+fins['width'],z+fins['height']], 'cladding')
                    for start,end in [([A,b+fins['width']],[A,B-fins['width']])]:
                        self.railing(start,end,z)
                else:
                    for start,end in [([A,b],[A,B]),([a,b],[A,b]),([A,B],[a,B])]:
                        self.railing(start,end,z)
                    # Solid privacy screen next to the wall; thin, not a full balcony box.
                    self.box([a,b,z],[a+screen['depth'],b+screen['length'],z+screen['height']], 'cladding')
                count += 1
        if 'end' in balconies:
            end = balconies['end']; b,B=end['b_front'],w['b_start']; a,A=end['a_span']
            for z in end['floors']:
                self.box([a,b,z-thick],[A,B,z], 'concrete')
                for start,finish in [([a,b],[A,b]),([a,B],[a,b]),([A,b],[A,B])]:
                    self.railing(start,finish,z)
                count += 1
        self.audit.append(dict(surface='balconies', count=count,
                               source=c['evidence'].get('balcony_source','building005/012/078/084'),
                               treatment='separate decks, closed soffits, opaque rail bars, posts and privacy screens; hidden materials estimated'))

    def build(self):
        prefix = self.config.get('name', 'husB')
        self.materials()
        self.volumes_and_roofs()
        if self.balconies:
            self.balcony_geometry()
        stats = {}
        for mode in ['emissive', 'pbr', 'hybrid']:
            stats[mode] = self.mesh.write(self.output/f'{prefix}-{mode}.glb', mode)
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
        shutil.copyfile(args.output/f"{config.get('name','husB')}-hybrid.glb",args.publish)
    print(json.dumps(result,indent=2))


if __name__ == '__main__':
    main()
