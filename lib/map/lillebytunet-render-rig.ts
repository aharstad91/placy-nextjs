/**
 * Kamerarigen bak boligvelgerens Hus B-serie på Lillebytunet.
 *
 * Rekonstruert med COLMAP av oversiktsserien og lagt over i kartkoordinater med
 * en likhetstransform mot OpenStreetMap-fotavtrykkene til Ståltaugen 1 og 2.
 * Tallene ligger i `~/klienter/placy/lillebytunet/colmap-ov/georef.json`.
 *
 * Rigen er oppgitt som fysiske mål — avstand, kamerahøyde, siktehøyde. Googles
 * kamera oppgis i stedet som `range` og `tilt` om siktepunktet, så de to regnes
 * ut av målene under istedenfor å skrives inn som ferdige tall. Da er det
 * synlig hvor de kommer fra, og en korrigert måling forplanter seg av seg selv.
 *
 * Modulen er bevisst ikke en klientkomponent: både demo-siden (server) og
 * kartflaten (klient) leser fra den, og en `"use client"`-modul gir serveren en
 * klientreferanse i stedet for verdien.
 */

/** Antall scener i 360°-serien. 96 × 3,75° = 360°. */
export const RENDER_SCENE_COUNT = 96;

const RIG = {
  /** Vannrett avstand fra byggsenter til kamera. */
  horizontalMeters: 46.6,
  /** Kamerahøyde over bakken. */
  cameraHeightMeters: 25,
  /** Siktepunktets høyde over bakken, midt på fasaden. */
  aimHeightMeters: 8,
} as const;

/**
 * Kameraets bearing fra bygget ved scene 0; hvert steg dreier −3,75°.
 *
 * Nullpunktet er per serie, ikke per prosjekt: boligvelgeren gir hver bygningsserie
 * sin egen `direction 0`. Hus B måler 222°. Hus C måler 218° av samme regnestykke
 * — kameraets asimut i byggets eget COLMAP-rammeverk, lagt på fasadens målte
 * bearing — og den utledningen gjenskaper Hus Bs 222° innen 3°.
 */
export const RENDER_BEARING_AT_DIR_ZERO = { husB: 222, husC: 218.4 } as const;

export const RENDER_DEGREES_PER_STEP = 360 / RENDER_SCENE_COUNT;

/**
 * Terrenghøyde ved Hus B, meter over havet.
 *
 * `Map3DElement.center.altitude` tolkes som meter over havet — ikke over
 * bakken — så et siktepunkt «8 m over bakken» må legges til denne. Verdien er
 * målt to steder som er enige: Googles egen ElevationService svarer 16,17 m i
 * dette punktet (oppløsning 19 m), og Kartverkets DTM1 svarer 16,53 m
 * (`ws.geonorge.no/hoydedata/v1/punkt`). Googles tall er valgt fordi det er
 * samme kilde som terrenget kameraet står på.
 */
export const HUS_B_GROUND_MASL = 16.2;

export interface RenderRigCamera {
  /** Kameraets siktretning i grader. */
  heading: number;
  /** Googles tilt: 0 er rett ned, 90 er mot horisonten. */
  tilt: number;
  /** Avstand fra kamera til siktepunkt i meter. */
  range: number;
  /** Siktepunktets høyde over bakken i meter. */
  aimHeightMeters: number;
  /** Der kameraet står, sett fra bygget. */
  cameraBearing: number;
}

/** Kameraet for én scene i serien. `dir` er 0–95. */
export function renderRigCamera(
  dir: number,
  bearingAtDirZero: number = RENDER_BEARING_AT_DIR_ZERO.husB,
): RenderRigCamera {
  const rise = RIG.cameraHeightMeters - RIG.aimHeightMeters;
  const cameraBearing =
    (bearingAtDirZero - RENDER_DEGREES_PER_STEP * dir + 360) % 360;
  return {
    // Kameraet ser mot bygget, altså motsatt vei av der det står.
    heading: (cameraBearing + 180) % 360,
    tilt: 90 - Math.atan2(rise, RIG.horizontalMeters) * (180 / Math.PI),
    range: Math.hypot(RIG.horizontalMeters, rise),
    aimHeightMeters: RIG.aimHeightMeters,
    cameraBearing,
  };
}

/** `?dir=` velger scene. Utenfor 0–95 finnes ingen scene. */
export function parseRenderDir(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed >= 0 && parsed < RENDER_SCENE_COUNT ? parsed : null;
}

export interface CameraPreset {
  id: string;
  label: string;
  /** Kameraets siktretning i grader. Kameraet står på motsatt side. */
  heading: number;
  tilt: number;
  range: number;
  /**
   * Siktepunktets høyde over bakken i meter.
   *
   * `range` er avstanden til siktepunktet, ikke til modellen. Ligger punktet på
   * bakken samtidig som tilt er høy og range kort, havner kameraet under
   * fotoflisene og modellen forsvinner. Nærvisningen og render-riggen løfter
   * derfor punktet opp på fasaden.
   */
  aimHeightMeters: number;
}

/**
 * Fire skrå luftvinkler, én mellomvinkel og én nærvisning.
 *
 * Google-kameraets `heading` er siktretningen, ikke der kameraet står. Skal
 * modellen ses fra nord, må kameraet se mot sør — derfor 180 på «fra nord».
 */
export const CAMERA_PRESETS: CameraPreset[] = [
  { id: "n", label: "Fra nord", heading: 180, tilt: 45, range: 150, aimHeightMeters: 8 },
  { id: "e", label: "Fra øst", heading: 270, tilt: 45, range: 150, aimHeightMeters: 8 },
  { id: "s", label: "Fra sør", heading: 0, tilt: 45, range: 150, aimHeightMeters: 8 },
  { id: "w", label: "Fra vest", heading: 90, tilt: 45, range: 150, aimHeightMeters: 8 },
  { id: "mid", label: "Mellomvinkel", heading: 70, tilt: 58, range: 100, aimHeightMeters: 8 },
  { id: "near", label: "Nærvisning", heading: 25, tilt: 60, range: 65, aimHeightMeters: 12 },
];
