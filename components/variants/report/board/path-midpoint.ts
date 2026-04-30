/**
 * Beregner midpoint-koordinaten i en path. Brukes til å plassere
 * tids-info-chip på midten av ruten i stedet for endepunktet (POI), slik at
 * chip-en ikke dekker selve POI-markøren.
 *
 * Strategi: middel-element av coordinates-arrayen. For walking-routes (typisk
 * 50-300 koordinater) er dette visuelt godt nok — cumulative-distance-midpoint
 * er mer presist men over-engineering for dette brukstilfellet.
 *
 * Returnerer null når path-en er for kort (<3 koordinater) til at "midt" har
 * mening — en path med 0-2 punkter er bare en linje fra start til slutt.
 */
export interface PathCoordinate {
  lat: number;
  lng: number;
}

export function pathMidpoint(
  coordinates: readonly PathCoordinate[],
): PathCoordinate | null {
  if (coordinates.length < 3) return null;
  const midIndex = Math.floor(coordinates.length / 2);
  return coordinates[midIndex];
}
