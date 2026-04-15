"use client";

import type { LucideIcon } from "lucide-react";
import { useId } from "react";

/**
 * SVG-based 3D marker pin for use as children of <Marker3D>.
 *
 * Google Maps 3D rasteriserer kun Pin/SVG/img som marker-innhold — ikke HTML.
 * Derfor bygger vi en inline SVG med sirkel-bakgrunn + nested Lucide-ikon.
 *
 * Nested SVG er gyldig SVG og håndteres av nettleserens SVG-renderer før
 * Google konverterer marker-elementet til en tekstur.
 */
export interface Marker3DPinProps {
  /** Kategorifarge — hex eller CSS-farge */
  color: string;
  /** Lucide ikon-komponent (fra lucide-react) */
  Icon: LucideIcon;
  /** Valgfritt tall-badge øverst til høyre */
  number?: number;
  /** Total størrelse i px — default 40 */
  size?: number;
  /** Opacity for hele pin-SVG-en — 0–1, default 1. Rasteriseres av Google Maps 3D. */
  opacity?: number;
}

export function Marker3DPin({
  color,
  Icon,
  number,
  size = 40,
  opacity,
}: Marker3DPinProps) {
  const shadowId = useId();

  const half = size / 2;
  const circleR = half - 3;
  const iconSize = Math.round(size * 0.5);
  const iconOffset = (size - iconSize) / 2;

  const badgeR = Math.round(size * 0.18);
  const badgeCx = size - badgeR - 1;
  const badgeCy = badgeR + 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      opacity={opacity ?? 1}
    >
      <defs>
        <filter
          id={shadowId}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="1.5"
            floodOpacity="0.3"
          />
        </filter>
      </defs>

      {/* Background circle with white border + drop shadow */}
      <circle
        cx={half}
        cy={half}
        r={circleR}
        fill={color}
        stroke="white"
        strokeWidth="2"
        filter={`url(#${shadowId})`}
      />

      {/* Lucide icon (rendered as nested SVG, scaled to iconSize) */}
      <g transform={`translate(${iconOffset} ${iconOffset})`}>
        <Icon
          width={iconSize}
          height={iconSize}
          stroke="white"
          strokeWidth={2.2}
        />
      </g>

      {/* Optional number badge */}
      {number !== undefined && (
        <g>
          <circle
            cx={badgeCx}
            cy={badgeCy}
            r={badgeR}
            fill="white"
            stroke={color}
            strokeWidth="1.5"
          />
          <text
            x={badgeCx}
            y={badgeCy + badgeR * 0.38}
            textAnchor="middle"
            fill={color}
            fontSize={badgeR * 1.15}
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="700"
          >
            {number}
          </text>
        </g>
      )}
    </svg>
  );
}
