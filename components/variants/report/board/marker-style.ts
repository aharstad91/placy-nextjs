/**
 * Re-eksport av delte marker-color-utils fra `lib/utils/marker-color`. Eksisterer
 * som tynt board-lokalt shim slik at andre board-filer kan importere relativ
 * uten å bry seg om hvor utilen lever — og slik at vi kan flytte utilen senere
 * uten å oppdatere alle import-stier.
 */
export {
  hexLightTint,
  hexWithAlpha,
  markerCircleStyle,
} from "@/lib/utils/marker-color";
