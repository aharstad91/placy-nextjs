/**
 * Hvilket punkt på hver rekkevidde-kontur etiketten skal stå på — valgt mot det
 * kameraet FAKTISK ser.
 *
 * Delt av begge motorene, og ren: den tar en projeksjonsfunksjon og et
 * rektangel, ikke et kart. Mapbox har `map.project` og `moveend`, Google har
 * `projectLatLngToScreen` og en ro-debounce — men svaret må være det samme, ellers
 * står «10 min» nord for konturen i «Kart» og øst for den i «Satelitt».
 *
 * Regelen: første kandidat (nordligst først, se `contourLabelCandidates`) som
 * ligger innenfor det synlige rektangelet og ikke kolliderer med en etikett som
 * alt har fått plass. Ingen kandidat på skjermen → ingen etikett; konturlinja
 * står fortsatt, og en etikett klemt mot kanten ville påstått at linja ligger
 * der kanten er.
 */

import type { IsochroneMinutes } from "@/lib/types";

export interface ContourLabelSlot {
  minutes: IsochroneMinutes;
  lng: number;
  lat: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Halv bredde/høyde etiketten reserverer. Chipen er ~64 × 20 px. */
const HALF_W = 34;
const HALF_H = 11;

/**
 * Minste avstand mellom to etiketter, i piksler.
 *
 * Erstatter breddegrad-forskyvningen `contourLabels` brukte: den skjøv en
 * etikett nordover i GRADER, som er en gjetning om piksler så snart zoomen
 * varierer. Her måles kollisjonen der den skjer — på skjermen.
 */
const MIN_GAP_PX = 26;

export function chooseContourLabels(
  candidates: readonly { minutes: IsochroneMinutes; points: readonly [number, number][] }[],
  project: (lng: number, lat: number) => { x: number; y: number } | null,
  rect: ScreenRect,
): ContourLabelSlot[] {
  const slots: ContourLabelSlot[] = [];
  const taken: { x: number; y: number }[] = [];
  for (const contour of candidates) {
    for (const [lng, lat] of contour.points) {
      const p = project(lng, lat);
      if (!p) continue;
      if (
        p.x - HALF_W < rect.left ||
        p.x + HALF_W > rect.right ||
        p.y - HALF_H < rect.top ||
        p.y + HALF_H > rect.bottom
      ) {
        continue;
      }
      const clashes = taken.some(
        (t) =>
          Math.abs(t.y - p.y) < MIN_GAP_PX &&
          Math.abs(t.x - p.x) < HALF_W * 2 + MIN_GAP_PX,
      );
      if (clashes) continue;
      taken.push(p);
      slots.push({ minutes: contour.minutes, lng, lat });
      break;
    }
  }
  return slots;
}
