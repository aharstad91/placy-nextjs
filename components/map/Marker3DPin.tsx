"use client";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useId } from "react";

/**
 * SVG-based 3D marker pin for use as children of <Marker3D>.
 *
 * Google Maps 3D rasteriserer kun Pin/SVG/img som marker-innhold — ikke HTML,
 * og rasteriseringen støtter ikke CSS backdrop-filter. "Glass"-effekten må
 * derfor bygges med SVG-primitives: semi-transparent fyll lar satellitt-
 * fotot skinne gjennom, og en subtil radial gradient gir konveks dybde-
 * feel. En tynn kategorifarget ring beholder kategori-glanceability uten
 * mettet bg-disc.
 *
 * Hvitt fylt ikon (Phosphor weight="fill") leser tydelig over den mørke,
 * tonete bakgrunnen mot fargerikt satellittbilde — der lys disc + farget
 * ikon ville drukne.
 */
export interface Marker3DPinProps {
  /** Kategorifarge — hex eller CSS-farge. Brukes som ring rundt disc og badge-aksent. */
  color: string;
  /** Phosphor ikon-komponent (fra @phosphor-icons/react). Rendres hvit med weight="fill". */
  Icon: PhosphorIcon;
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
  const iconSize = Math.round(size * 0.55);
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
            floodOpacity="0.35"
          />
        </filter>
      </defs>

      {/* Light disc with category-colored ring */}
      <circle
        cx={half}
        cy={half}
        r={circleR}
        fill="#fafaf9"
        stroke={color}
        strokeWidth="2"
        filter={`url(#${shadowId})`}
      />

      {/* Phosphor icon, weight="fill", colored by category */}
      <g transform={`translate(${iconOffset} ${iconOffset})`}>
        <Icon
          width={iconSize}
          height={iconSize}
          weight="fill"
          color={color}
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
