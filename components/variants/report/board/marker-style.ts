/**
 * Delt marker-stil-helper for POI-sirkler i rapport-board.
 *
 * Tre overflater bruker samme visuelle språk:
 * - `BoardMarker` (kart-markører)
 * - `BoardPOIAccordion` (desktop POI-cards)
 * - `BoardRelatedPOICard` (mobil POI-cards)
 *
 * Mønsteret: kategori-fargen brukes som border + ikon-farge, og en lys
 * tint av samme farge som bakgrunn. Skaper visuell sammenheng på tvers av
 * lyse cards og varierende kart-bakgrunner uten å være avhengig av alpha
 * (som blir uforutsigbart over 3D-kart eller mørke flater).
 */

const FALLBACK_COLOR = "#94a3b8"; // stone-400
const FALLBACK_TINT = "#f5f5f4"; // stone-100

/**
 * Returnerer en lys tint av en hex-farge ved å mikse med hvitt i RGB-rommet.
 * `mixWhite=0.85` betyr 85% hvit, 15% farge — gir en pastell-tint som er
 * konsistent på tvers av bakgrunner.
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
 * på aktive rail-knapper der vi ønsker at underliggende stone-50 skal skinne
 * gjennom.
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
