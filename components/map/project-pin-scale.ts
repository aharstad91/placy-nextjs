/**
 * Range-avhengig skala for prosjektmarkøren.
 *
 * Google 3D-markører er skjerm-forankret (konstant px uansett zoom). Etter at
 * markøren ble en disc på POI-markørenes størrelse (2026-08-24) er spennet
 * smalt: den skal alltid lese som «litt større enn POI-ene» (som er 40 px), så
 * den krymper bare et hakk mot oversikt i stedet for å halveres slik det store
 * kortet måtte. Alle fire tall er ment å finjusteres på følelse.
 *
 * Egen modul (2026-08-23) fordi TO steder trenger den: `map-view-3d` tegner
 * markøren, og kollisjonskullingen må vite hvor stor den ER for å bruke den som
 * hindring. En kopi hos den andre ville drevet fra denne ved første justering —
 * og modulen er dessuten ren, så den kan testes uten vis.gl/WebGL.
 */

/** ≤ dette (zoomet inn) → {@link PIN_MAX_SCALE} (flatt). */
export const PIN_NEAR_RANGE = 700;
/** ≥ dette (zoomet ut) → {@link PIN_MIN_SCALE} (flatt). */
export const PIN_FAR_RANGE = 3000;
export const PIN_MAX_SCALE = 1;
export const PIN_MIN_SCALE = 0.85;

export function scaleForRange(range: number): number {
  const span = PIN_FAR_RANGE - PIN_NEAR_RANGE;
  const t = Math.min(1, Math.max(0, (range - PIN_NEAR_RANGE) / span));
  return PIN_MAX_SCALE + t * (PIN_MIN_SCALE - PIN_MAX_SCALE);
}
