"use client";

import { useCallback } from "react";
import { useReels } from "./reels-state";
import { cardIndexToAudioIndex, firstAudioBearingIndex } from "./reels-data";
import {
  useAudioTourActions,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";

/**
 * Delt play/pause-toggle for mobil-reels — brukt av BÅDE play-knappen i
 * transporten OG tap-på-reel-flaten, så de oppfører seg identisk:
 *  - spiller → pause (manuell).
 *  - på ikke-audio-kort (summary/megler) eller når touren er «ended»: restart
 *    fra første kapittel (i stedet for å gjenoppta et stale outro-spor).
 *  - ellers (paused/error): resume.
 */
export function useReelsTogglePlay(): () => void {
  const { state, setActiveIndex } = useReels();
  const { pause, resume, goToTrack } = useAudioTourActions();
  const phase = useAudioTourStore((s) => s.phase);

  return useCallback(() => {
    if (phase === "playing") {
      pause("manual");
      return;
    }
    const activeAudioIdx = cardIndexToAudioIndex(state.cards, state.activeIndex);
    if (activeAudioIdx < 0 || phase === "ended") {
      const first = firstAudioBearingIndex(state.cards);
      if (first >= 0) {
        setActiveIndex(first);
        goToTrack(0);
      }
      return;
    }
    resume();
  }, [
    phase,
    state.cards,
    state.activeIndex,
    pause,
    resume,
    goToTrack,
    setActiveIndex,
  ]);
}
