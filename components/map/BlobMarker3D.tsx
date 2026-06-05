"use client";

import { useId } from "react";

/**
 * Minimal «blob»-markør for Google Maps 3D — en ren farge-prikk uten ikon eller
 * tall, brukt under velkommen-flyover-en for å tegne inn nærområdet rundt
 * objektet med lav kognitiv last (jf. den fulle `Marker3DPin` som bærer ikon +
 * badge og hører til kategori-beatene).
 *
 * Google Maps 3D rasteriserer marker-innhold (SVG/Pin/img) til en tekstur og
 * støtter ikke CSS-animasjon på innholdet. Bouncen drives derfor utenfra ved å
 * re-rendre denne med en ny `scale` per frame (RevealLayer3D). Vi holder SVG-en så
 * billig som mulig — ÉN sirkel + tynn hvit ring + myk skygge — så hver
 * re-rasterisering er lett. `scale 0` → usynlig (radius 0).
 */
export interface BlobMarker3DProps {
  /** Kategorifarge (hex/CSS) — fyller disc-en. */
  color: string;
  /** Diameter i px ved scale 1. Default 14. */
  size?: number;
  /** Skala 0–~1.1 (bounce-overshoot). Multipliseres med `size`. Default 1. */
  scale?: number;
  /** Opacity 0–1. Default 1. */
  opacity?: number;
}

/** Basis-diameter (px) for blob-disc-en ved full skala. */
export const BLOB_BASE_SIZE = 14;

export function BlobMarker3D({
  color,
  size = BLOB_BASE_SIZE,
  scale = 1,
  opacity = 1,
}: BlobMarker3DProps) {
  const shadowId = useId();
  // Fast viewBox; vi skalerer disc-radiusen, ikke SVG-rammen, så ring-bredden
  // holder seg konstant og bouncen ser ut som en sprett (ikke en zoom).
  const box = size;
  const half = box / 2;
  const r = Math.max(0, (half - 2) * Math.min(scale, 1.3));

  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      xmlns="http://www.w3.org/2000/svg"
      opacity={opacity}
    >
      <defs>
        <filter id={shadowId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.35" />
        </filter>
      </defs>
      <circle
        cx={half}
        cy={half}
        r={r}
        fill={color}
        stroke="#ffffff"
        strokeWidth="1.5"
        filter={`url(#${shadowId})`}
      />
    </svg>
  );
}
