/**
 * Hvilke reisemåter boardet har rekkevidde-konturer for.
 *
 * Avledningen hører i lesemodellen og ikke i UI-et, av samme grunn som
 * `availableTravelModes`: både av/på-knappen i kartkontrollen og de to
 * tegnelagene må lese samme svar, ellers kan knappen vises for en profil
 * kartet ikke kan tegne.
 *
 * Konsekvensen av et delvis sett er bevisst: tomt sett = ingen knapp, og en
 * profil som mangler mens andre finnes = knappen står, men kartet er tomt for
 * nettopp den reisemåten.
 */

import type { IsochroneSet, TravelMode } from "@/lib/types";

/** Kanonisk rekkefølge (gå, sykkel, bil) — samme som reisemåte-velgeren. */
const MODES: TravelMode[] = ["walk", "bike", "car"];

export function contourTravelModes(isochrones: IsochroneSet | undefined): TravelMode[] {
  if (!isochrones) return [];
  return MODES.filter((mode) => isochrones.byMode[mode] !== undefined);
}

/** Sant når minst én profil har konturer — gaten for om knappen finnes. */
export function hasAnyContours(isochrones: IsochroneSet | undefined): boolean {
  return contourTravelModes(isochrones).length > 0;
}
