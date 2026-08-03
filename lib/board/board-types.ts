/**
 * Kanonisk type-hjem for de delte board-typene (PRD 5 / r05.1).
 *
 * BoardCategoryId / BoardPOIId / BoardAudioTrack DEFINERES her (flyttet fra den
 * inline-definisjonen i board-data.ts) og re-eksporteres fra board-data.ts for en
 * bakover-kompatibel import-flate. PRD 14 importerer fra dette type-hjemmet (eller
 * board-data-re-eksporten); denne PRD-en flytter dem IKKE til PRD 14.
 *
 * Branded ID-typene forhindrer ID-blanding mellom theme-IDer og POI-IDer i
 * state-reduceren og dispatch-calls (arkitektur-invariant).
 */

import type { ReportThemeAudioTimings } from "@/lib/types";

/** Re-eksport av character-level alignment for forbruk i board-laget
 *  (KaraokePitchText). Holder import-graphen flat: komponenter importerer fra
 *  board-data (som re-eksporterer dette), ikke fra @/lib/types direkte. */
export type BoardAudioTimings = ReportThemeAudioTimings;

/** Subset av ReportThemeAudio som er garantert komplett på runtime — kun audio
 *  med url+manus eksponeres til board-laget. adaptCategory/adaptBoardData
 *  filtrerer bort partial-audio (kun manus). `timings` er optional fordi spor
 *  generert før audioVersion 5 mangler det. */
export interface BoardAudioTrack {
  url: string;
  manus: string;
  timings?: BoardAudioTimings;
}

export type BoardCategoryId = string & { readonly __brand: "BoardCategoryId" };
export type BoardPOIId = string & { readonly __brand: "BoardPOIId" };

/**
 * HVORFOR `visiblePoiIds` er satt. Diskriminatoren finnes fordi de to kildene
 * har motsatt kamera-kontrakt:
 *
 * - `"event-filter"` — settet er en BRUKERVALGT delmengde (tema/dag/tid på
 *   event-board). Kameraet SKAL ramme det inn; det er hele poenget med filteret.
 * - `"viewport-scope"` — settet er AVLEDET av kartutsnittet (mobil
 *   nabolagsflate). Fitter kameraet på det, får vi en løkke: panorer → nytt
 *   sett → refit → nytt utsnitt → nytt sett → … Kameraet skal ALDRI fitte på
 *   denne kilden.
 *
 * Gaten håndheves av `shouldFitToFilter` i `board-camera-fit.ts`.
 */
export type VisibleIdsSource = "event-filter" | "viewport-scope";

/**
 * Det IKKE-OKKLUDERTE kart-rektangelet i geo-koordinater: kartets synlige flate
 * minus området en bottom-sheet dekker.
 *
 * Rene primitiver, ikke et Mapbox-`LngLatBounds`-objekt, av to grunner:
 * konsumenter kan bruke feltene direkte i dep-arrays uten objekt-identitets-
 * løkker (`useeffect-object-dependency-infinite-loop-20260410`), og modellen er
 * motor-uavhengig — 3D avleder samme form fra kamerasenter + radius.
 */
export interface ViewportRect {
  west: number;
  south: number;
  east: number;
  north: number;
}
