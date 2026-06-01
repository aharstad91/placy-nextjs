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

/** Kategori-nøkkel for ett spor. "welcome" er tour-host-prat (kun ved
 *  tour-start), "home" er Hjem-pitchen og "outro" er avslutnings-sporet —
 *  ingen av dem er BoardCategory-er. */
export type AudioTrackCategoryId =
  | BoardCategoryId
  | "welcome"
  | "home"
  | "outro";

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

/** Per-seksjon progress-state for scroll-panel-cinematic.
 *
 * - "played":   denne kategoriens spor er ferdigspilt (trackIndex har passert)
 *               eller hele turen er ferdig — vises i full opacity som karaoke-
 *               sluttilstand. Brukeren ser visuelt hvor langt han har kommet.
 * - "active":   dette sporet spilles eller er pauset akkurat nå — karaoke
 *               kjører på teksten.
 * - "unplayed": sporet ligger lengre fram i køen — fader til 0.3.
 *
 * Returns null når phase === "idle" (tour ikke startet) eller når kategorien
 * ikke er i tracks-arrayet. Da skal seksjonen ikke dimmes. */
export type AudioTourSectionProgress = "played" | "active" | "unplayed";

export function useAudioTourSectionProgress(
  categoryId: AudioTrackCategoryId,
): AudioTourSectionProgress | null {
  return useAudioTourStore((s) => {
    if (s.phase === "idle") return null;
    const idx = s.tracks.findIndex((t) => t.categoryId === categoryId);
    if (idx === -1) return null;
    // Active vinner over played — re-spill av en allerede-played seksjon
    // gjør den active igjen, men endrer ikke de andre.
    if (
      idx === s.trackIndex &&
      (s.phase === "playing" || s.phase === "paused" || s.phase === "error")
    ) {
      return "active";
    }
    // Played er sticky: én gang i playedCategoryIds, alltid played innenfor
    // denne turen. Ved phase=ended er alle som ble nådd ferdig — men set-en
    // dekker dette allerede via next()/markCurrentAsPlayed-kjeden.
    if (s.playedCategoryIds.has(categoryId)) return "played";
    return "unplayed";
  });
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
