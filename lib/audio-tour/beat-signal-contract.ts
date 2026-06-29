/**
 * Beat-signal-KONTRAKT — hoisted Lag-2 stub (PRD-bead rC1).
 *
 * Type/signatur-kontrakten for audio-tour beat-signal-selektorene
 * (`useCurrentTrack` / `useAudioTourPhase`) + `categoryId`-shapen. Materialisert
 * som en delt Lag-2-node FØR både PRD 10 (Lag 3, konsument) og PRD 14 (Lag 4,
 * owner-impl r14.6) i beads-serialiseringen — løser lag-back-edgen (00-INDEX
 * note #5 / PRD 10 §10 Q7).
 *
 * PRD 10s audio-drevne welcome/home/outro-beat-choreografi (`BoardMap3D`) bygger
 * mot DENNE kontrakten, ikke mot en live runtime-store. PRD 14s runtime-store
 * (`lib/stores/audio-tour-store.ts`, Beslutning 8) MÅ honorere disse signaturene
 * VERBATIM (PRD 14 Unit 6 AC6) — håndhevd kompilerings-tid av
 * `beat-signal-contract.test.ts`.
 *
 * `categoryId`-shapen arver `BoardCategoryId` fra PRD 5s kanoniske type-hjem
 * (r05.1, `@/lib/board/board-types`) og importeres NEDOVER derfra — ikke OPPOVER
 * fra components (`board-data`). lib skal ikke avhenge av components.
 */
import type { BoardCategoryId } from "@/lib/board/board-types";

/** Kategori-nøkkel for ett audio-spor. `"welcome"` = tour-host-prat (kun ved
 *  tour-start), `"home"` = Hjem-pitchen, `"outro"` = avslutnings-sporet — ingen
 *  av de tre er BoardCategory-er. Resten er ordinære board-kategori-IDer.
 *  Beat-choreografien (PRD 10) matcher mot disse tre special-verdiene. */
export type AudioTrackCategoryId =
  | BoardCategoryId
  | "welcome"
  | "home"
  | "outro";

/** Tour-fasen beat-choreografien matcher mot (`useAudioTourPhase`). */
export type AudioTourPhase =
  | "idle"
  | "playing"
  | "paused"
  | "ended"
  | "error";

/** Spor-shapen beat-signalet eksponerer (`useCurrentTrack`). `categoryId` bærer
 *  beat-verdien (`welcome`/`home`/`outro`) choreografi-grenene matcher på;
 *  `durationSec` mater beat→tour-varighet. */
export interface AudioTrack {
  categoryId: AudioTrackCategoryId;
  url: string;
  manus: string;
  durationSec?: number;
}

/** Signatur for current-track-selektoren. Owner-impl (r14.6) honorerer
 *  VERBATIM — `lib/stores/audio-tour-store.ts` sin `useCurrentTrack` er
 *  type-bundet til denne via `beat-signal-contract.test.ts`. */
export type UseCurrentTrack = () => AudioTrack | undefined;

/** Signatur for tour-fase-selektoren. Owner-impl (r14.6) honorerer VERBATIM —
 *  jf. `UseCurrentTrack`. */
export type UseAudioTourPhase = () => AudioTourPhase;
