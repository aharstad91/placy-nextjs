"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAudioTourActions, useAudioTourStore } from "@/lib/stores/audio-tour-store";
import { useReels } from "./reels-state";
import { buildCategoryTracks, cardIndexToAudioIndex } from "./reels-data";

/**
 * Orchestrerer audio-tour-store mot ReelsContext:
 * - Bygger pre-built tracks-array fra alle audio-bærende cards (home,
 *   kategorier, outro) i feed-rekkefølge.
 * - Når audioUnlocked og bruker er på et audio-bærende card: start tour
 *   ÉN gang (`start(tracks)`), deretter `goToTrack(audioIndex)` på swipe.
 * - Når activeIndex peker på intro eller megler (ingen audio): pause.
 * - Når Reels-routen unmountes: close audio-tour (cleanup).
 */
export function useReelsAudioOrchestration() {
  const { state } = useReels();
  const { start, goToTrack, pause, close } = useAudioTourActions();
  const startedRef = useRef(false);

  const tracks = useMemo(() => buildCategoryTracks(state.cards), [state.cards]);

  useEffect(() => {
    if (!state.audioUnlocked) return;

    const audioIndex = cardIndexToAudioIndex(state.cards, state.activeIndex);
    if (audioIndex < 0) {
      // Intro eller megler-card — ingen audio. Pause hvis vi spiller.
      if (useAudioTourStore.getState().phase === "playing") pause("manual");
      return;
    }
    if (audioIndex >= tracks.length) return;

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
    state.cards,
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
