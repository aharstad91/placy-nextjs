/**
 * Range-avhengig skala for prosjektmarkøren.
 *
 * Google 3D-markører er skjerm-forankret (konstant px uansett zoom), så uten
 * dette dominerer chip-en både tett innpå (dekker nabo-POI-er) og uttrukket
 * (blokkerer oversikten). Vi holder en moderat størrelse fra default-range og
 * innover, og krymper jevnt mot oversikt. Alle fire tall er ment å finjusteres
 * på følelse.
 *
 * Egen modul (2026-08-23) fordi TO steder trenger den: `map-view-3d` tegner
 * chip-en, og kollisjonskullingen må vite hvor stor den ER for å bruke den som
 * hindring. En kopi hos den andre ville drevet fra denne ved første justering —
 * og modulen er dessuten ren, så den kan testes uten vis.gl/WebGL.
 */

/** ≤ dette (zoomet inn) → {@link PIN_MAX_SCALE} (flatt). */
export const PIN_NEAR_RANGE = 700;
/** ≥ dette (zoomet ut) → {@link PIN_MIN_SCALE} (flatt). */
export const PIN_FAR_RANGE = 3000;
export const PIN_MAX_SCALE = 0.85;
export const PIN_MIN_SCALE = 0.5;

export function scaleForRange(range: number): number {
  const span = PIN_FAR_RANGE - PIN_NEAR_RANGE;
  const t = Math.min(1, Math.max(0, (range - PIN_NEAR_RANGE) / span));
  return PIN_MAX_SCALE + t * (PIN_MIN_SCALE - PIN_MAX_SCALE);
}
