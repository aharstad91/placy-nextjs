"use client";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useId } from "react";
import {
  LABEL_CHAR_W,
  LABEL_FONT_SIZE,
  LABEL_GAP_X,
  LABEL_LINE_H,
  LABEL_MAX_W,
  wrapLabelLines,
  type LabelSide,
} from "@/lib/board/label-collision";

/**
 * SVG-based 3D marker pin for use as children of <Marker3D>.
 *
 * Google Maps 3D rasteriserer kun Pin/SVG/img som marker-innhold — ikke HTML,
 * og rasteriseringen støtter ikke CSS backdrop-filter. Disc-mønsteret bygges
 * med SVG-primitives: light-tint disc-bg (lys shade av kategori-fargen) +
 * kategori-farget ring + ikon i samme farge gir samme visuelle språk som 2D-
 * markørene og POI-cards i lista.
 *
 * Default-bakgrunn (`backgroundColor` ikke satt) er den nøytrale `#fafaf9`
 * som beholder bakoverkompatibilitet for konsumenter som ikke har migrert.
 *
 * ## Label (2026-08-23)
 *
 * 2D lar CSS gjøre labelen (absolutt posisjonert `<span>` ved siden av
 * markøren). Det finnes ikke her: innholdet blir en tekstur, så teksten må inn
 * i SVG-en. Konsekvensen er at label-siden er en DEL AV markøren og aldri kan
 * drive fra pinnen — i motsetning til et HTML-overlay, som ikke klarer å synke
 * med Googles GPU-render og gir posisjons-jitter (samme avveining som er
 * dokumentert for prosjekt-pinnens skala i `map-view-3d`).
 *
 * SVG-rammen vokser SYMMETRISK når en label settes: `width` blir
 * `2 × (halv disc + luft + tekstbredde)` mens `height` står stille, og disc-en
 * blir liggende i midten. Da flytter ikke selve markøren seg uansett om Google
 * forankrer innholdet i bunn-midten eller i senter — bare tomrommet rundt
 * vokser. En asymmetrisk ramme ville forskjøvet pinnen fra punktet sitt idet
 * labelen kom på.
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
  /**
   * POI-navn tegnet ved siden av disc-en. Utelates når kollisjonskullingen
   * (`computeLabelPlacements`) ikke fant plass, eller når kamera-avstanden er
   * under label-tieren — pinnen står, teksten forsvinner.
   */
  label?: string;
  /** Hvilken side labelen ankres på. Default `"right"` (som 2D). */
  labelSide?: LabelSide;
}

/** Nær-svart, samme som 2D-labelen. */
const LABEL_FILL = "#1c1917";
/** Hvit kontur bak teksten — 2D bruker `text-shadow`, som ikke finnes i SVG.
 *  Nødvendig her: 3D-underlaget er satellittfoto, ikke et lyst kart-tema. */
const LABEL_HALO = "#ffffff";
const LABEL_HALO_W = 3;
const LABEL_FONT = "system-ui,-apple-system,Helvetica Neue,sans-serif";

export function Marker3DPin({
  color,
  Icon,
  backgroundColor = "#fafaf9",
  number,
  size = 40,
  opacity,
  scale = 1,
  label,
  labelSide = "right",
}: Marker3DPinProps) {
  const shadowId = useId();

  const half = size / 2;
  const lines = label ? wrapLabelLines(label) : [];
  const textW = lines.length
    ? Math.min(
        LABEL_MAX_W,
        Math.max(...lines.map((l) => l.length)) * LABEL_CHAR_W,
      )
    : 0;
  // Halv ramme-bredde: disc-radius + luft + tekst. Speiles på begge sider (se
  // doc-blokken) så disc-en alltid ligger i rammens midte.
  const halfBox = lines.length ? half + LABEL_GAP_X + textW : half;
  const boxW = halfBox * 2;
  const boxH = size;
  // Disc-ens venstre kant inne i rammen. 0 uten label, ellers innrykket.
  const discX = halfBox - half;
  const cx = halfBox;
  const cy = half;

  // Skaler HELE innholdet rundt disc-senter (bounce-inn). Utelates ved scale 1
  // så det ikke ligger en identitets-transform igjen når markøren har settlet.
  const contentTransform =
    scale === 1
      ? undefined
      : `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
  const circleR = half - 3;
  // Ikon-ratio 0.50 matcher 2D-markørene og POI-cards i lista (40px sirkel
  // → 20px ikon = h-5/w-5 i Tailwind). Tidligere 0.55 ga 22px ikon som så
  // 2-3px større ut enn i lista.
  const iconSize = Math.round(size * 0.5);
  const iconOffset = (size - iconSize) / 2;

  const badgeR = Math.round(size * 0.18);
  const badgeCx = discX + size - badgeR - 1;
  const badgeCy = badgeR + 1;

  // Tekstblokken sentreres vertikalt på disc-en; første linje løftes en halv
  // blokkhøyde opp så to linjer havner symmetrisk rundt senter.
  const labelX =
    labelSide === "right" ? cx + half + LABEL_GAP_X : cx - half - LABEL_GAP_X;
  const labelAnchor = labelSide === "right" ? "start" : "end";
  const firstLineY = cy - ((lines.length - 1) * LABEL_LINE_H) / 2;

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
      <g transform={`translate(${discX + iconOffset} ${iconOffset})`}>
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

      {/* Label. Tegnes TO ganger: først en hvit kontur, så fyllet oppå. En
          enkelt <text> med `paint-order="stroke"` ville vært kortere, men
          faller den attributten bort i rasteriseringen legger konturen seg
          OVER glyfene og teksten blir hvit-i-hvitt. To noder kan ikke feile. */}
      {lines.map((line, i) => (
        <g key={i}>
          <text
            x={labelX}
            y={firstLineY + i * LABEL_LINE_H}
            textAnchor={labelAnchor}
            dominantBaseline="middle"
            fill="none"
            stroke={LABEL_HALO}
            strokeWidth={LABEL_HALO_W}
            strokeLinejoin="round"
            strokeOpacity={0.95}
            fontSize={LABEL_FONT_SIZE}
            fontFamily={LABEL_FONT}
            fontWeight="600"
          >
            {line}
          </text>
          <text
            x={labelX}
            y={firstLineY + i * LABEL_LINE_H}
            textAnchor={labelAnchor}
            dominantBaseline="middle"
            fill={LABEL_FILL}
            fontSize={LABEL_FONT_SIZE}
            fontFamily={LABEL_FONT}
            fontWeight="600"
          >
            {line}
          </text>
        </g>
      ))}
      </g>
    </svg>
  );
}
