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

/** Fullt kamera-utsnitt — nok til å gjenopprette et utsnitt EKSAKT, ikke
 *  «omtrent samme sted» (R18). */
export interface CameraSnapshot {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

/**
 * Kamera-handlingene den monterte kart-motoren tilbyr flatene over seg.
 *
 * Registreres av `BoardMap` på `BoardContext` fordi push/tilbake-navigasjonen
 * (kategorisiden) må lagre og gjenopprette kameraet, men lever i et helt annet
 * subtre enn kart-instansen. Den persistente `gmp-map-3d`-instansen kan aldri
 * unmountes, så «eget kart per side» er utelukket som mekanisme — sidene deler
 * ett kart og bytter kun kamera-ramme.
 */
export interface MapCameraApi {
  /** Gjeldende utsnitt, eller null når kartet ikke er klart. */
  snapshot: () => CameraSnapshot | null;
  /** Gjenoppretter et lagret utsnitt eksakt og UMIDDELBART. */
  restore: (snapshot: CameraSnapshot) => void;
  /** Rammer inn de nå-synlige markørene sammen med boligen. */
  fitVisible: () => void;
  /**
   * Rammer inn et VILKÅRLIG sett koordinater sammen med boligen.
   *
   * Finnes for omvisningen (`board/story`), som rammer stoppets tre navngitte
   * steder og ikke «det som er synlig»: hele kategorien ligger fortsatt på
   * kartet som dempet tekstur, så `fitVisible` ville zoomet ut til alle
   * punktene og gjort de tre uleselige.
   */
  fitCoordinates: (
    coords: readonly { lng: number; lat: number }[],
    opts?: { maxZoom?: number; durationMs?: number },
  ) => void;
  /**
   * Flyr til ett punkt. `minZoom` er et GULV, ikke et mål — står kameraet
   * nærmere skal en flytur til et sted i nærheten ikke zoome ut.
   *
   * `holdFrame` gjør flyturen til en AVSLØRING i stedet for en ramming:
   * gjeldende zoom beholdes, og kameraet flytter seg bare hvis punktet ligger
   * utenfor den synlige (ikke-okkluderte) delen av kartet. Omvisningen bruker
   * den fordi stoppets ramme alt inneholder stedene den snakker om — en
   * sentrering med zoom-gulv oppå den leser som et rykk brukeren ikke ba om,
   * og river dessuten de to andre stedene i stoppet ut av bildet.
   */
  flyToPoint: (
    coord: { lng: number; lat: number },
    opts?: { minZoom?: number; durationMs?: number; holdFrame?: boolean },
  ) => void;
}
