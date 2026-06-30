"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  AudioTrack,
  AudioTourPhase,
  AudioTrackCategoryId,
  UseAudioTourPhase,
  UseCurrentTrack,
} from "@/lib/audio-tour/beat-signal-contract";

/**
 * Ephemeral, non-persisted Zustand-store for audio-tour-state. Sibling
 * til lib/stores/kompass-store.ts. Tour-state lever IKKE i BoardState
 * (per 2026-04-30 reading-phase-cleanup-disiplin). Runtime-playback
 * orkestreres mot ReelsContext i `use-reels-audio-orchestration.ts`
 * (binder store-actions til swipe-nav); ingen BoardContext-sync-hook.
 *
 * Beat-signal-typene (`AudioTrack`/`AudioTourPhase`/`AudioTrackCategoryId`) +
 * selektor-signaturene eies av den hoistede Lag-2-kontrakten
 * `@/lib/audio-tour/beat-signal-contract` (rC1) — denne store-en KONSUMERER og
 * re-eksporterer dem for bakover-kompatibel import-flate. PRD 14s owner-impl
 * (r14.6) skal honorere kontrakten verbatim.
 */

// Re-eksporter kontrakt-typene for en bakover-kompatibel import-flate
// (reels-data.ts m.fl. + testene importerer disse fra store-en).
export type { AudioTrack, AudioTourPhase, AudioTrackCategoryId };

export type PauseReason = "manual" | "category-clicked" | "audio-error";

export interface AudioTourState {
  phase: AudioTourPhase;
  trackIndex: number;
  tracks: AudioTrack[];
  pauseReason?: PauseReason;
  /** Sist feilet track-index — brukes for retry. */
  errorTrackIndex?: number;
  /** categoryIds som har vært current minst én gang i denne turen.
   *  Sticky: re-spill (goToTrack) eller skip (next/prev) av et tidligere
   *  spor endrer ikke "played"-status på allerede-spilte. Resettes ved
   *  start() og close(). */
  playedCategoryIds: Set<AudioTrackCategoryId>;

  start: (tracks: AudioTrack[]) => void;
  pause: (reason: PauseReason) => void;
  resume: () => void;
  goToTrack: (index: number) => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  setError: () => void;
  /** Prøv samme spor på nytt etter en audio-feil. */
  retryTrack: () => void;
}

const INITIAL: Pick<
  AudioTourState,
  | "phase"
  | "trackIndex"
  | "tracks"
  | "pauseReason"
  | "errorTrackIndex"
  | "playedCategoryIds"
> = {
  phase: "idle",
  trackIndex: 0,
  tracks: [],
  pauseReason: undefined,
  errorTrackIndex: undefined,
  playedCategoryIds: new Set(),
};

export const useAudioTourStore = create<AudioTourState>()((set, get) => {
  /** Marker det nåværende sporets categoryId som "played" i et nytt Set.
   *  Returnerer eksisterende Set hvis allerede markert eller hvis ingen
   *  tracks. Brukes før hver trackIndex-bytte (next/prev/goToTrack) og
   *  ved naturlig tour-slutt. */
  const markCurrentAsPlayed = (): Set<AudioTrackCategoryId> => {
    const { tracks, trackIndex, playedCategoryIds } = get();
    const current = tracks[trackIndex];
    if (!current) return playedCategoryIds;
    if (playedCategoryIds.has(current.categoryId)) return playedCategoryIds;
    return new Set(playedCategoryIds).add(current.categoryId);
  };

  return {
    ...INITIAL,

    start: (tracks) => {
      if (tracks.length === 0) return;
      set({
        phase: "playing",
        trackIndex: 0,
        tracks,
        pauseReason: undefined,
        errorTrackIndex: undefined,
        playedCategoryIds: new Set(),
      });
    },

    pause: (reason) => {
      const { phase } = get();
      if (phase !== "playing") return;
      set({ phase: "paused", pauseReason: reason });
    },

    resume: () => {
      const { phase } = get();
      if (phase !== "paused" && phase !== "error") return;
      set({
        phase: "playing",
        pauseReason: undefined,
        errorTrackIndex: undefined,
      });
    },

    goToTrack: (index) => {
      const { tracks } = get();
      if (index < 0 || index >= tracks.length) return;
      set({
        phase: "playing",
        trackIndex: index,
        pauseReason: undefined,
        errorTrackIndex: undefined,
        playedCategoryIds: markCurrentAsPlayed(),
      });
    },

    next: () => {
      const { tracks, trackIndex } = get();
      if (tracks.length === 0) return;
      const playedCategoryIds = markCurrentAsPlayed();
      if (trackIndex + 1 >= tracks.length) {
        set({
          phase: "ended",
          pauseReason: undefined,
          errorTrackIndex: undefined,
          playedCategoryIds,
        });
        return;
      }
      set({
        phase: "playing",
        trackIndex: trackIndex + 1,
        pauseReason: undefined,
        errorTrackIndex: undefined,
        playedCategoryIds,
      });
    },

    prev: () => {
      const { trackIndex } = get();
      if (trackIndex <= 0) return;
      set({
        phase: "playing",
        trackIndex: trackIndex - 1,
        pauseReason: undefined,
        errorTrackIndex: undefined,
        playedCategoryIds: markCurrentAsPlayed(),
      });
    },

    close: () => set({ ...INITIAL, playedCategoryIds: new Set() }),

    setError: () => {
      const { trackIndex } = get();
      set({ phase: "error", errorTrackIndex: trackIndex });
    },

    retryTrack: () => {
      const { phase } = get();
      if (phase !== "error") return;
      set({ phase: "playing", errorTrackIndex: undefined });
    },
  };
});

// ─── Selector hooks ─────────────────────────────────────────────────────────

// Beat-signal-selektorene (rC1-kontrakt). Type-bundet til kontrakt-signaturene
// så owner-impl (r14.6) ikke kan drifte — håndhevd av beat-signal-contract.test.
export const useAudioTourPhase: UseAudioTourPhase = () =>
  useAudioTourStore((s) => s.phase);

export const useCurrentTrack: UseCurrentTrack = () =>
  useAudioTourStore((s) => s.tracks[s.trackIndex]);

export function useAudioTourActions() {
  return useAudioTourStore(
    useShallow((s) => ({
      start: s.start,
      pause: s.pause,
      resume: s.resume,
      goToTrack: s.goToTrack,
      next: s.next,
      prev: s.prev,
      close: s.close,
      setError: s.setError,
      retryTrack: s.retryTrack,
    })),
  );
}
