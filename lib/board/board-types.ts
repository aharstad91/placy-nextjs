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
