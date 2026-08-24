/**
 * Drift-observasjon for Satelitt-modus (R8c): drag er native pan i Google-
 * motoren (freeMode, ingen hijack), så pan i Satelitt bevarer nord-opp av seg
 * selv. Men to-finger-tilt / ctrl-drag KAN bryte ovenfra-posituren — og pillen
 * skal aldri lyve om hva som er på skjermen. Etter et pointer-grab observeres
 * derfor faktisk tilt-/heading-avvik; brytes posituren over terskelen flipper
 * segmentet til «3D» i det bruddet faktisk skjer (ikke på grab, og ALDRI med
 * snap-back mot WebGL-pipelinen — lærings-regel).
 */

/** Terskel (grader) for «posituren er brutt». Bevisst romslig nok til at
 *  pan-jitter aldri flipper, lav nok til at pillen ikke lyver lenge. Tunes i
 *  akseptansen (Unit 6). */
export const OVERHEAD_BREAK_DEG = 5;

/** Polle-intervall (ms) for drift-vakten mens et grab pågår. */
export const DRIFT_POLL_MS = 100;

/** Korteste vinkelavstand mellom to headinger — 0/360-wraparound (359°→4° er
 *  5° drift, ikke 355°). */
export function headingDelta(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

export interface CameraAngles {
  tilt: number;
  heading: number;
}

/** Ren predikat: har kameraet driftet ut av posituren grabbet startet i? */
export function hasBrokenOverhead(
  start: CameraAngles,
  current: CameraAngles,
  thresholdDeg = OVERHEAD_BREAK_DEG,
): boolean {
  return (
    Math.abs(current.tilt - start.tilt) > thresholdDeg ||
    headingDelta(current.heading, start.heading) > thresholdDeg
  );
}

/** Den lesbare kamera-flaten vakten poller (rå Map3DElement-props). */
export interface DriftReadableMap {
  tilt?: number;
  heading?: number;
}

/**
 * Start drift-vakten: poller kameraets tilt/heading mot grab-øyeblikkets
 * positur og kaller `onBreak` ÉN gang ved brudd (vakten stopper seg selv).
 * Returnerer en stopp-funksjon (kall ved pointerup/unmount).
 */
export function watchOverheadDrift(
  map: DriftReadableMap,
  onBreak: () => void,
  opts?: { thresholdDeg?: number; intervalMs?: number },
): () => void {
  const start: CameraAngles = { tilt: map.tilt ?? 0, heading: map.heading ?? 0 };
  const id = setInterval(() => {
    const current: CameraAngles = { tilt: map.tilt ?? 0, heading: map.heading ?? 0 };
    if (hasBrokenOverhead(start, current, opts?.thresholdDeg)) {
      clearInterval(id);
      onBreak();
    }
  }, opts?.intervalMs ?? DRIFT_POLL_MS);
  return () => clearInterval(id);
}
