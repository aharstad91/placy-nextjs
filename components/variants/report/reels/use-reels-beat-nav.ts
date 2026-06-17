"use client";

import { useCallback } from "react";
import { useReels } from "./reels-state";
import { nextAudioBearingIndex, prevAudioBearingIndex } from "./reels-data";
import { useAudioTourActions } from "@/lib/stores/audio-tour-store";

/**
 * Kapittel-navigasjon for mobil-reels — brukt av vertikal swipe på reel-flaten
 * (opp = neste, ned = forrige). Erstatter den fjernede transport-triadens
 * advance/prev-logikk:
 *  - `advanceBeat`: neste audio-bærende kapittel, med +1-fallback forbi outro
 *    til finale-kortet (megler/summary) så ingen kort blir uoppnåelig. Når det
 *    ikke er mer å gå til kalles `audioNext()` → terminal "ended".
 *  - `prevBeat`: forrige audio-bærende kapittel (som triadens ⏮). No-op når det
 *    ikke finnes et tidligere audio-kapittel (lander ikke på intro).
 * Begge avvæpner kart-teaseren så manuell navigasjon ikke kolliderer med en
 * ventende auto-advance.
 */
export function useReelsBeatNav() {
  const { state, setActiveIndex, setTeaserArmed } = useReels();
  const { next: audioNext } = useAudioTourActions();

  const advanceBeat = useCallback(() => {
    setTeaserArmed(false);
    const nextAudio = nextAudioBearingIndex(state.cards, state.activeIndex);
    const next = nextAudio !== -1 ? nextAudio : state.activeIndex + 1;
    if (next < state.cards.length) setActiveIndex(next);
    else audioNext();
  }, [state.cards, state.activeIndex, setActiveIndex, setTeaserArmed, audioNext]);

  const prevBeat = useCallback(() => {
    const prev = prevAudioBearingIndex(state.cards, state.activeIndex);
    if (prev === -1) return;
    setTeaserArmed(false);
    setActiveIndex(prev);
  }, [state.cards, state.activeIndex, setActiveIndex, setTeaserArmed]);

  return { advanceBeat, prevBeat };
}
