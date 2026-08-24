"use client";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useId } from "react";

/**
 * SVG-markør for reveal-laget (`RevealLayer3D`) — ikon-disc uten navn.
 *
 * ## Hvorfor denne fortsatt er rasterisert SVG (2026-08-24)
 *
 * POI-markørene og prosjektmarkøren er flyttet til ekte DOM (`DomMarker3D` +
 * `PoiMarkerContent`), fordi labelen deres var uleselig uskarp: Google
 * rasteriserer marker-innhold til en tekstur med ~én teksel per CSS-piksel og
 * skalerer den opp med skjermens pikselforhold.
 *
 * Reveal-laget ble bevisst IKKE med. Det bærer ingen tekst — legend-pinsene her
 * er ikon-only — så uskarphets-problemet finnes ikke, og hele bounce-maskineriet
 * i `RevealLayer3D` (kvantisert `scale` + `memo` + stagger) er bygget som
 * raster-økonomi. Reveal-kaskaden er dessuten en FILM-leveranse: `?fly=1`
 * impliserer ikke `filmMode`, så kaskaden er med i fanget video, og timingen
 * (START_DELAY 900 / BOUNCE 280) er synket mot flyturens varighet.
 *
 * Label-halvdelen er derfor fjernet fra denne filen. Trenger reveal-laget navn
 * en dag, hører de i DOM — ikke i en tekstur.
 *
 * Google Maps 3D rasteriserer kun Pin/SVG/img som marker-innhold — ikke HTML,
 * og rasteriseringen støtter ikke CSS backdrop-filter. Disc-mønsteret bygges
 * med SVG-primitives: light-tint disc-bg (lys shade av kategori-fargen) +
 * kategori-farget ring + ikon i samme farge gir samme visuelle språk som
 * POI-cards i lista.
 */
export interface Marker3DPinProps {
  /** Kategorifarge — hex eller CSS-farge. Brukes som ring rundt disc og som ikon-fyll. */
  color: string;
  /** Phosphor ikon-komponent (fra @phosphor-icons/react). Rendres med weight="fill" i `color`. */
  Icon: PhosphorIcon;
  /** Disc-bakgrunnsfarge. Foretrukket bruk: pass `hexLightTint(color)` slik at bg blir
   * en lys shade av kategori-fargen (matcher 2D-markørene). Default: nøytral off-white. */
  backgroundColor?: string;
  /** Valgfritt tall-badge øverst til høyre */
  number?: number;
  /** Total størrelse i px — default 40 */
  size?: number;
  /** Opacity for hele pin-SVG-en — 0–1, default 1. Rasteriseres av Google Maps 3D. */
  opacity?: number;
  /** Skala 0–~1.1 på innholdet (bounce-inn) rundt senter. Default 1 (ingen skalering).
   *  Brukes av RevealLayer3D for å animere legend-pins inn likt blobbene. */
  scale?: number;
}

export function Marker3DPin({
  color,
  Icon,
  backgroundColor = "#fafaf9",
  number,
  size = 40,
  opacity,
  scale = 1,
}: Marker3DPinProps) {
  const shadowId = useId();

  const half = size / 2;
  const boxW = size;
  const boxH = size;
  const cx = half;
  const cy = half;

  // Skaler HELE innholdet rundt disc-senter (bounce-inn). Utelates ved scale 1
  // så det ikke ligger en identitets-transform igjen når markøren har settlet.
  const contentTransform =
    scale === 1
      ? undefined
      : `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
  const circleR = half - 3;
  // Ikon-ratio 0.50 matcher 2D-markørene og POI-cards i lista (40px sirkel
  // → 20px ikon = h-5/w-5 i Tailwind).
  const iconSize = Math.round(size * 0.5);
  const iconOffset = (size - iconSize) / 2;

  const badgeR = Math.round(size * 0.18);
  const badgeCx = size - badgeR - 1;
  const badgeCy = badgeR + 1;

  return (
    <svg
      width={boxW}
      height={boxH}
      viewBox={`0 0 ${boxW} ${boxH}`}
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

      <g transform={contentTransform}>
      {/* Light disc with category-colored ring. backgroundColor er typisk en
          lys tint av `color` (matcher 2D-markørene), men kan også være en
          nøytral off-white for legacy-konsumenter. */}
      <circle
        cx={cx}
        cy={cy}
        r={circleR}
        fill={backgroundColor}
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
      </g>
    </svg>
  );
}
