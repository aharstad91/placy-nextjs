"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { BoardCategoryId } from "@/components/variants/report/board/board-data";

/**
 * Ephemeral, non-persisted Zustand-store for audio-tour-state. Sibling
 * til lib/stores/kompass-store.ts. Tour-state lever IKKE i BoardState
 * (per 2026-04-30 reading-phase-cleanup-disiplin) — sync til BoardContext
 * skjer i `use-audio-tour-sync.ts`.
 */

/** Kategori-nøkkel for ett spor. "home" er Hjem-pitchen som ikke har egen BoardCategory. */
export type AudioTrackCategoryId = BoardCategoryId | "home";

export interface AudioTrack {
  categoryId: AudioTrackCategoryId;
  url: string;
  manus: string;
  durationSec?: number;
}

export type AudioTourPhase =
  | "idle"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export type PauseReason = "manual" | "category-clicked" | "audio-error";

export interface AudioTourState {
  phase: AudioTourPhase;
  trackIndex: number;
  tracks: AudioTrack[];
  pauseReason?: PauseReason;
  /** Sist feilet track-index — brukes for retry. */
  errorTrackIndex?: number;

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
  "phase" | "trackIndex" | "tracks" | "pauseReason" | "errorTrackIndex"
> = {
  phase: "idle",
  trackIndex: 0,
  tracks: [],
  pauseReason: undefined,
  errorTrackIndex: undefined,
};

export const useAudioTourStore = create<AudioTourState>()((set, get) => ({
  ...INITIAL,

  start: (tracks) => {
    if (tracks.length === 0) return;
    set({
      phase: "playing",
      trackIndex: 0,
      tracks,
      pauseReason: undefined,
      errorTrackIndex: undefined,
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
    set({ phase: "playing", pauseReason: undefined, errorTrackIndex: undefined });
  },

  goToTrack: (index) => {
    const { tracks } = get();
    if (index < 0 || index >= tracks.length) return;
    set({
      phase: "playing",
      trackIndex: index,
      pauseReason: undefined,
      errorTrackIndex: undefined,
    });
  },

  next: () => {
    const { tracks, trackIndex } = get();
    if (tracks.length === 0) return;
    if (trackIndex + 1 >= tracks.length) {
      set({ phase: "ended", pauseReason: undefined, errorTrackIndex: undefined });
      return;
    }
    set({
      phase: "playing",
      trackIndex: trackIndex + 1,
      pauseReason: undefined,
      errorTrackIndex: undefined,
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
    });
  },

  close: () => set({ ...INITIAL }),

  setError: () => {
    const { trackIndex } = get();
    set({ phase: "error", errorTrackIndex: trackIndex });
  },

  retryTrack: () => {
    const { phase } = get();
    if (phase !== "error") return;
    set({ phase: "playing", errorTrackIndex: undefined });
  },
}));

// ─── Selector hooks ─────────────────────────────────────────────────────────

export function useAudioTourPhase(): AudioTourPhase {
  return useAudioTourStore((s) => s.phase);
}

export function useCurrentTrack(): AudioTrack | undefined {
  return useAudioTourStore((s) => s.tracks[s.trackIndex]);
}

export function useAudioTourMeta() {
  return useAudioTourStore(
    useShallow((s) => ({
      phase: s.phase,
      trackIndex: s.trackIndex,
      trackCount: s.tracks.length,
      pauseReason: s.pauseReason,
    })),
  );
}

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

/** Synkroniserings-API for use-audio-tour-sync.ts. */
export function useAudioTourSyncTargets() {
  return useAudioTourStore(
    useShallow((s) => ({
      phase: s.phase,
      trackIndex: s.trackIndex,
      tracks: s.tracks,
      pause: s.pause,
    })),
  );
}
