"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAudioTourActions, useAudioTourStore } from "@/lib/stores/audio-tour-store";
import { useReels } from "./reels-state";
import { buildCategoryTracks } from "./reels-data";

/**
 * Orchestrerer audio-tour-store mot ReelsContext:
 * - Bygger en pre-built tracks-array fra category-cards
 * - Når audioUnlocked og bruker har en aktiv kategori-card: start tour ÉN gang
 *   (`start(tracks)`), deretter `goToTrack(audioIndex)` på swipe
 * - Når activeIndex peker på intro-card (0): pause
 * - Når Reels-routen unmountes: close audio-tour (cleanup)
 */
export function useReelsAudioOrchestration() {
  const { state } = useReels();
  const { start, goToTrack, pause, close } = useAudioTourActions();
  const audioPhase = useAudioTourStore((s) => s.phase);
  const startedRef = useRef(false);

  const tracks = useMemo(() => buildCategoryTracks(state.cards), [state.cards]);

  useEffect(() => {
    if (!state.audioUnlocked) return;

    // activeIndex 0 = intro (ingen audio), 1+ = kategori-spor index 0+
    if (state.activeIndex === 0) {
      // intro-kortet aktivt — pause hvis vi spiller
      if (useAudioTourStore.getState().phase === "playing") pause("manual");
      return;
    }

    const audioIndex = state.activeIndex - 1;
    if (audioIndex < 0 || audioIndex >= tracks.length) return;

    if (!startedRef.current) {
      // Første gang: bygg hele tracks-arrayen og start tour
      start(tracks);
      startedRef.current = true;
      if (audioIndex !== 0) {
        goToTrack(audioIndex);
      }
      return;
    }

    // Sub­sekvente swiper: bytt spor
    goToTrack(audioIndex);
  }, [
    state.audioUnlocked,
    state.activeIndex,
    tracks,
    start,
    goToTrack,
    pause,
  ]);

  // NB: track-ended-overgang håndteres via AudioElementProvider sitt
  // `onTrackEnded`-callback i ReportReelsPage (autoAdvance=false-modus) —
  // ikke via store-phase, fordi vi ikke vil bruke audio-store sin auto-next.

  // Cleanup ved unmount
  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  // Page Visibility API: pause når tab/vindu mister fokus.
  // Ikke auto-resume — la bruker ta initiativ via swipe eller tap.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Pause audio hvis playing
        if (
          useAudioTourStore.getState().phase === "playing"
        ) {
          pause("manual");
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pause]);
}
