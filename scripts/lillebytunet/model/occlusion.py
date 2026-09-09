"""Answer, before any texture work, whether a surface can be sampled at all.

A surface behind an upstand is hidden for a depth of upstand_height / tan(grazing angle).
On Lillebytunet the cameras sit barely above the roofs, so a 1.17 m parapet hides 9 m of
roof from every one of the 96 directions — and every rectified patch of it is a smear of
parapet, upstand and sky. The cheapest way to learn that is arithmetic, not 56 candidate
crops: Hus C's first attempt picked the most uniform of those crops and got a light roof
where the source shows dark membrane. A uniform patch of a grazed surface is an
anti-signal, because any score that rewards uniformity selects the sample that missed.

Reports, per requested surface, the grazing angle, the hidden depth and the visible
fraction, and a verdict: sample, sample the visible strip only, or measure a colour
instead. Reads only the existing COLMAP model; writes nothing but the report.
"""
import argparse
import json
from pathlib import Path

import numpy as np

from source_geometry import BuildingFrame, read_reconstruction

# Below this visible fraction a rectified patch is mostly something else, and a measured
# flat colour is the honest answer. Hus C's roof came out at 0.37 and had to be a colour.
SAMPLE_FLOOR = 0.5


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--config', type=Path, required=True,
                        help='the building config; walls, levels and parapet are read from it')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()

    config = json.loads(args.config.read_text())
    colmap = config.get('colmap', 'colmap-b')
    frame = BuildingFrame(args.data/colmap)
    cameras, _ = read_reconstruction(args.data/colmap)
    scale = config['scale_m_per_unit']
    parapet = config['levels'][0]['rim']-config['levels'][0]['roof']

    positions = np.array([frame.local(-cameras[d]['R'].T@cameras[d]['t'])
                          for d in sorted(cameras)])
    radius = float(np.median(np.linalg.norm(positions[:, :2], axis=1)))
    camera_z = float(np.median(positions[:, 2]))

    surfaces = []
    for index, level in enumerate(config['levels']):
        top = index == len(config['levels'])-1
        b_end = config['walls']['b_end'] if top else config['levels'][index+1]['b_start']
        # Horizontal deck: the roof of this level, bounded by the next setback.
        rise = camera_z-level['roof']
        angle = np.degrees(np.arctan2(rise, radius))
        hidden = parapet/np.tan(np.radians(angle)) if angle > 0 else float('inf')
        depth = b_end-level['b_start']
        width = config['walls']['a_front']-config['walls']['a_back']
        visible = max(0.0, 1-hidden/depth)
        surfaces.append(dict(
            surface=f"{level['name']}_deck", kind='horizontal',
            grazing_deg=round(angle, 2),
            camera_above_m=round(rise*scale, 2),
            upstand_m=round(parapet*scale, 2),
            hidden_depth_m=round(hidden*scale, 2),
            extent_m=[round(width*scale, 2), round(depth*scale, 2)],
            visible_fraction=round(visible, 3),
            verdict=('sample' if visible >= SAMPLE_FLOOR
                     else 'measure a flat colour; a rectified patch here is not this surface'),
        ))

    # Vertical facades are only hidden by what projects in front of them, which for these
    # buildings is the balcony zone. Report the projection so the depth is explicit.
    balconies = config.get('balconies')
    if balconies:
        projection = balconies['front_a']-config['walls']['a_front']
        rail = balconies['rail_height_m']/scale
        storey = None
        floors = [level['floor'] for level in balconies['front']]
        if len(floors) > 1:
            storey = float(np.median(np.diff(sorted(floors))))
        # The wall strip a balcony hides from a camera looking slightly down.
        drop = float(np.degrees(np.arctan2(camera_z-np.median(floors), radius)))
        blocked = projection*np.tan(np.radians(drop))+rail
        surfaces.append(dict(
            surface='front_wall_behind_balconies', kind='vertical',
            grazing_deg=round(drop, 2),
            projection_m=round(projection*scale, 2),
            rail_m=round(rail*scale, 2),
            hidden_height_m=round(blocked*scale, 2),
            storey_m=round(storey*scale, 2) if storey else None,
            visible_fraction=round(max(0.0, 1-blocked/storey), 3) if storey else None,
            verdict=('project the source only where a storey is unoccluded; elsewhere use '
                     'clean cladding plus traced openings, never the occluded projection'),
        ))

    report = dict(colmap=colmap, config=str(args.config), scale_m_per_unit=scale,
                  orbit=dict(radius_units=radius, radius_m=round(radius*scale, 1),
                             camera_z_units=camera_z),
                  sample_floor=SAMPLE_FLOOR, surfaces=surfaces)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
