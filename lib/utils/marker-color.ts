/**
 * Delte farge-utils for POI-markør-stiling.
 *
 * Mønsteret som brukes på tvers av 2D-markører (Mapbox), 3D-markører (Google
 * Photorealistic Tiles) og POI-cards i rapport-board:
 *
 *   border = full kategori-farge
 *   bg     = lys tint av kategori-fargen (mix 85% hvit i RGB-rommet)
 *   ikon   = full kategori-farge
 *
 * Tinten gir konsistent utseende over hvite cards, satellitt-fotos og
 * 2D-kart-flater — i motsetning til ren rgba-alpha som blir uforutsigbar
 * over varierende bakgrunner.
 */

const FALLBACK_COLOR = "#94a3b8"; // stone-400
const FALLBACK_TINT = "#f5f5f4"; // stone-100

/**
 * Returnerer en lys tint av en hex-farge ved å mikse med hvitt i RGB-rommet.
 * `mixWhite=0.85` betyr 85% hvit, 15% farge — gir en pastell-tint.
 */
export function hexLightTint(
  hex: string | undefined | null,
  mixWhite = 0.85,
): string {
  const clean = (hex ?? FALLBACK_COLOR).replace("#", "");
  if (clean.length !== 6) return FALLBACK_TINT;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return FALLBACK_TINT;
  }

  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * mixWhite);

  return `#${[mix(r), mix(g), mix(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Returnerer hex med alpha (rgba). Brukes f.eks. som subtil bakgrunnstint
 * der vi ønsker at underliggende flate skal skinne gjennom.
 */
export function hexWithAlpha(
  hex: string | undefined | null,
  alpha: number,
): string {
  const clean = (hex ?? FALLBACK_COLOR).replace("#", "");
  if (clean.length !== 6) return `rgba(148, 163, 184, ${alpha})`;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Standard inline-style for en POI-marker-sirkel: border-farge + lys tint
 * som bakgrunn. Konsumenten setter selv border-bredde og evt. shadow via
 * className. Ikon-fargen settes typisk via `style={{ color }}`.
 */
export function markerCircleStyle(color: string | undefined): {
  borderColor: string;
  backgroundColor: string;
} {
  return {
    borderColor: color ?? FALLBACK_COLOR,
    backgroundColor: hexLightTint(color),
  };
}
