"""Measure a building's massing from its own point cloud in the fitted local frame.

Produces the numbers the geometry config needs — storey heights, setback positions
along the long axis, wall planes, ground level — as measurements with plots to check
them against, instead of values read off a render by eye.

Reads frame.npy/rect.npy/points.npy written by frame_fit.py. Writes nothing into the
reconstruction; plots and JSON go to --output.
"""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

from source_geometry import BuildingFrame


def edges(values, low, high, bins=160):
    """Locate a wall plane as the steep flank of the point histogram."""
    counts, boundary = np.histogram(values, bins=bins)
    centres = (boundary[:-1]+boundary[1:])/2
    cumulative = np.cumsum(counts)/counts.sum()
    return [float(np.interp(q, cumulative, centres)) for q in (low, high)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--colmap', required=True)
    parser.add_argument('--scale', type=float, required=True, help='metres per COLMAP unit')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--slices', type=int, default=8, help='height slices for the plan plots')
    args = parser.parse_args()

    directory = args.data/args.colmap
    frame = BuildingFrame(directory)
    world = np.load(directory/'points.npy')
    local = frame.local(frame.center+world[:, :1]*frame.e1+world[:, 1:2]*frame.e2
                        + world[:, 2:3]*frame.up)
    args.output.mkdir(parents=True, exist_ok=True)

    a, b, z = local[:, 0], local[:, 1], local[:, 2]
    zlo, zhi = np.percentile(z, [0.5, 99.5])

    counts, boundary = np.histogram(z, bins=200)
    centres = (boundary[:-1]+boundary[1:])/2
    report = dict(colmap=args.colmap, scale_m_per_unit=args.scale, points=len(local),
                  rect=dict(theta_deg=float(np.degrees(np.arctan2(frame.R2[1, 0], frame.R2[0, 0]))),
                            a=[float(frame.a0), float(frame.a1)],
                            b=[float(frame.b0), float(frame.b1)]),
                  z=dict(p05=float(zlo), p995=float(zhi),
                         range_m=float((zhi-zlo)*args.scale)),
                  a_wall_units=edges(a, 0.02, 0.98), b_wall_units=edges(b, 0.02, 0.98))

    # Storey signature: autocorrelation of the height histogram gives the spacing
    # without assuming a storey height.
    signal = counts-counts.mean()
    correlation = np.correlate(signal, signal, mode='full')[len(signal)-1:]
    step = float(boundary[1]-boundary[0])
    window = correlation[3:int(0.6/step)] if int(0.6/step) > 4 else correlation[3:]
    lag = int(np.argmax(window))+3
    report['storey_units'] = lag*step
    report['storey_m'] = lag*step*args.scale

    # Where does the mass end at each height? Slices along the long axis show the
    # setbacks and which end they are on.
    long_axis = 1 if (frame.b1-frame.b0) > (frame.a1-frame.a0) else 0
    report['long_axis'] = 'b' if long_axis else 'a'
    slices = []
    bounds = np.linspace(zlo, zhi, args.slices+1)
    for lower, upper in zip(bounds[:-1], bounds[1:]):
        mask = (z >= lower) & (z < upper)
        if mask.sum() < 30:
            slices.append(dict(z=[float(lower), float(upper)], points=int(mask.sum())))
            continue
        slices.append(dict(z=[float(lower), float(upper)], points=int(mask.sum()),
                           z_mid_m=float((lower+upper)/2*args.scale),
                           a=edges(a[mask], 0.03, 0.97), b=edges(b[mask], 0.03, 0.97)))
    report['slices'] = slices

    figure, axes = plt.subplots(2, 2, figsize=(16, 13))
    axes[0, 0].scatter(a, b, s=0.4, c=z, cmap='viridis')
    axes[0, 0].set_title('plan, colour = height')
    axes[0, 0].set_xlabel('a (across)'); axes[0, 0].set_ylabel('b (along)')
    axes[0, 0].set_aspect('equal')
    axes[0, 1].scatter(b, z, s=0.4, c=a, cmap='coolwarm')
    axes[0, 1].set_title('long section, colour = across')
    axes[0, 1].set_xlabel('b (along)'); axes[0, 1].set_ylabel('z')
    axes[1, 0].scatter(a, z, s=0.4, c=b, cmap='coolwarm')
    axes[1, 0].set_title('cross section, colour = along')
    axes[1, 0].set_xlabel('a (across)'); axes[1, 0].set_ylabel('z')
    axes[1, 1].plot(counts, centres)
    axes[1, 1].set_title(f'height histogram; storey {report["storey_m"]:.2f} m')
    axes[1, 1].set_ylabel('z')
    for axis in axes.flat:
        axis.grid(True, lw=0.3)
    for axis in (axes[0, 1], axes[1, 0], axes[1, 1]):
        axis.set_yticks(np.arange(np.floor(zlo*20)/20, zhi+0.05, 0.05))
        axis.tick_params(labelsize=6)
    for axis in (axes[0, 0], axes[0, 1]):
        axis.set_xticks(np.arange(np.floor(min(b)*20)/20, max(b)+0.05, 0.05))
        axis.tick_params(axis='x', labelsize=6, rotation=90)
    plt.tight_layout()
    plt.savefig(args.output/'massing.png', dpi=95)

    (args.output/'massing.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
