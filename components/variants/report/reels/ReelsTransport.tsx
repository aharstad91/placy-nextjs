"use client";

import { Pause, Play } from "lucide-react";
import { useReels } from "./reels-state";
import { StoryProgressBar } from "./StoryProgressBar";
import { audioIndexToCardIndex, nextAudioBearingIndex } from "./reels-data";
import {
  useAudioTourActions,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";

/**
 * Vedvarende avspiller-transport (mobil, R4–R6) — til stede på BEGGE flater for
 * kontinuitet. Innhold:
 *  - Play/pause (styrer audio-tour-store).
 *  - Sammenhengende segmentert progress (delt `StoryProgressBar`) med tappbare
 *    segmenter → hopp til kapittel (R5).
 *  - Posisjon `n/total`.
 *  - Kontekstuell flate-veksler (R6):
 *      kategori + historie-flate → «Kart →»    (åpne kart)
 *      kategori + kart-flate     → «← Tilbake» (lukk til historie)
 *      map-forward beat          → «Fortsett →» (skip til neste kapittel)
 *      summary/megler            → ingen veksler
 *
 * Monteres kun når lyd er låst opp (R18) og rapporten har spillbar lyd (R17);
 * den gatingen ligger i ReportReelsPage.
 */
export function ReelsTransport() {
  const { state, setActiveIndex, setMapOpen } = useReels();
  const { pause, resume } = useAudioTourActions();
  const phase = useAudioTourStore((s) => s.phase);
  const trackIndex = useAudioTourStore((s) => s.trackIndex);
  const trackCount = useAudioTourStore((s) => s.tracks.length);

  const activeCard = state.cards[state.activeIndex];
  const beatKind = activeCard?.kind;
  const isMapForwardBeat =
    beatKind === "welcome" || beatKind === "home" || beatKind === "outro";
  const isCategory = beatKind === "category";

  const togglePlay = () => {
    if (phase === "playing") pause("manual");
    else resume();
  };

  // R5: tapp et progress-segment → hopp til det kapittelet (audio-spor-indeks
  // → cardIndex via samme rute som desktop-thumbnailene).
  const handleSeek = (chapterIndex: number) => {
    const cardIdx = audioIndexToCardIndex(state.cards, chapterIndex);
    if (cardIdx >= 0) setActiveIndex(cardIdx);
  };

  // «Fortsett» under map-forward beats: hopp til neste audio-bærende kapittel,
  // eller neste kort (summary/megler) når outro er siste audio.
  const advanceBeat = () => {
    const nextAudio = nextAudioBearingIndex(state.cards, state.activeIndex);
    const next = nextAudio !== -1 ? nextAudio : state.activeIndex + 1;
    if (next < state.cards.length) setActiveIndex(next);
  };

  let toggle: { label: string; onClick: () => void; ariaLabel: string } | null =
    null;
  if (isMapForwardBeat) {
    toggle = { label: "Fortsett →", onClick: advanceBeat, ariaLabel: "Neste kapittel" };
  } else if (isCategory) {
    toggle = state.mapOpen
      ? { label: "← Tilbake", onClick: () => setMapOpen(false), ariaLabel: "Tilbake til historie" }
      : { label: "Kart →", onClick: () => setMapOpen(true), ariaLabel: "Åpne kart" };
  }

  const position =
    trackCount > 0 ? `${Math.min(trackIndex + 1, trackCount)}/${trackCount}` : "";

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 bg-stone-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={phase === "playing" ? "Pause" : "Spill av"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-stone-900 active:scale-95"
        >
          {phase === "playing" ? (
            <Pause size={15} fill="currentColor" />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
        </button>

        <div className="relative min-w-0 flex-1">
          <StoryProgressBar onSeekToChapter={handleSeek} />
        </div>

        {position && (
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/70">
            {position}
          </span>
        )}

        {toggle && (
          <button
            type="button"
            onClick={toggle.onClick}
            aria-label={toggle.ariaLabel}
            className="shrink-0 whitespace-nowrap rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
          >
            {toggle.label}
          </button>
        )}
      </div>
    </div>
  );
}
