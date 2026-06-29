/**
 * Motor-lagets kamera-defaults og carry-over-typer (Unit 06.7 re-home).
 *
 * Samler de to motor-eide kamera-konseptene som tidligere lå spredt i board-/
 * scroll-laget, slik at board-porten ikke drar inn den døde scroll-modalen
 * (`UnifiedMapModal`):
 *  • `DEFAULT_CAMERA_LOCK` — flyttet hit fra `report-3d-config.ts` (deles
 *    board↔scroll-blocks); `MAP3D_TAB_IDS`/`filterPoisByTab` blir IGJEN i
 *    `report-3d-config.ts` (de er IKKE motor-konsepter).
 *  • `PendingCamera` — flyttet hit fra `UnifiedMapModal.tsx`; `BoardMap3D`/
 *    `BoardMap` importerer den nå herfra (ikke fra scroll-modalen).
 *
 * Begge er motor-eide per PRD 6 §9 Beslutning #8.
 */

/**
 * Kameraprofil. Bounds beregnes dynamisk rundt faktisk center i MapView3D.
 *
 * Pan-låsen implementeres IKKE via bounds (det fightet brukerens drag og ga
 * hakking). Isteden hijackes pointer-events i MapView3D slik at drag alltid
 * tolkes som ROTATE — se `forceOrbitGesture` der. Bounds holdes som
 * kvalitets-safety-net hvis Google en gang i fremtiden slipper gjennom
 * pan-momentum.
 */
export const DEFAULT_CAMERA_LOCK = {
  range: 900,
  tilt: 45,
  minTilt: 15,
  maxTilt: 75,
  // Altitude-grenser balansert med utvidet pan-bounds (4.5km) og fri native
  // touch-gesture-handling: ankring sikres via bounds + altitude-clamp, ikke
  // via gesture-blokking.
  // - minAltitude 150: kan zoome tett inn, men ikke helt ned i bakken
  // - maxAltitude 2000: gir nok høyde til at brukeren får oversikt over
  //   nabolaget. 1200 stoppet pinch-out for tidlig på mobil.
  minAltitude: 150,
  maxAltitude: 2000,
  panHalfSideKm: 4.5,
} as const;

/**
 * Camera state carried over between mode switches.
 * Stores enough info to initialize either engine at the position
 * where the other engine left off.
 */
export type PendingCamera = {
  lat: number;
  lng: number;
  /** Mapbox zoom level (set when coming from Mapbox, or converted from range) */
  zoom?: number;
  /** Google 3D range in meters (set when coming from 3D, or converted from zoom) */
  range?: number;
  /** Compass heading in degrees (0=north, clockwise) */
  heading?: number;
  /** Tilt from nadir in degrees (Mapbox pitch / Google tilt) */
  tilt?: number;
};
