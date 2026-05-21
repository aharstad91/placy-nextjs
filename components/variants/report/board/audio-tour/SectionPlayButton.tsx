"use client";

import { Pause, Play } from "lucide-react";
import { useBoard } from "../board-state";
import type { BoardCategory } from "../board-data";
import {
  useAudioTourActions,
  useAudioTourStore,
  type AudioTrack,
  type AudioTrackCategoryId,
} from "@/lib/stores/audio-tour-store";

/** Hvilket spor knappen kontrollerer — Hjem-sporet (track 0) eller en navngitt
 *  kategori (track-indeks slås opp via id-matching mot `tracks`-array). */
export type PlayTarget =
  | { kind: "home" }
  | { kind: "category"; category: BoardCategory };

/**
 * Kompakt rund play/pause-knapp som sitter til høyre i en seksjons-header
 * (Hjem eller kategori). Speiler chevron-posisjonen i `CategoryIndex`-radene,
 * så affordansen "trykk her for å spille av denne seksjonen" gjenkjennes på
 * tvers av spilleliste og seksjon.
 *
 * Når seksjonens spor er aktivt: knappen viser pause/play synkronisert med
 * global playback-state. Player-UI-en (progress, skip, lukk) lever i
 * BottomPlayer/QueueOverlay.
 *
 * Gating: audioTourEnabled + Hjem-audio + alle kategorier har audio (samme
 * kontrakt som BottomPlayer). For category-target sjekkes også at den gitte
 * kategorien har audio.
 */
export function SectionPlayButton({ target }: { target: PlayTarget }) {
  const { data } = useBoard();
  const { start, goToTrack, pause, resume } = useAudioTourActions();
  const phase = useAudioTourStore((s) => s.phase);
  const trackIndex = useAudioTourStore((s) => s.trackIndex);
  const tracks = useAudioTourStore((s) => s.tracks);

  const homeAudio = data.home.audio;
  const allCategoriesHaveAudio = data.categories.every((c) => c.audio);

  if (!data.audioTourEnabled || !homeAudio || !allCategoriesHaveAudio) {
    return null;
  }
  if (target.kind === "category" && !target.category.audio) {
    return null;
  }

  const targetId: AudioTrackCategoryId =
    target.kind === "home" ? "home" : target.category.id;
  const targetLabel = target.kind === "home" ? "Hjem" : target.category.label;

  const currentTrack = tracks[trackIndex];
  const isThisActive = currentTrack?.categoryId === targetId;
  const isPlayingThis = isThisActive && phase === "playing";
  const isPausedOnThis = isThisActive && phase === "paused";

  const handleClick = () => {
    if (isPlayingThis) {
      pause("manual");
      return;
    }
    if (isPausedOnThis) {
      resume();
      return;
    }
    const newTracks: AudioTrack[] = [
      {
        categoryId: "home" as AudioTrackCategoryId,
        url: homeAudio.url,
        manus: homeAudio.manus,
      },
      ...data.categories.map((c) => ({
        categoryId: c.id,
        url: c.audio!.url,
        manus: c.audio!.manus,
      })),
    ];
    const newIndex = newTracks.findIndex((t) => t.categoryId === targetId);
    if (newIndex === -1) return;
    // Start kun hvis turen er fersk — start() resetter playedCategoryIds, og
    // re-spill av en seksjon under pågående tour skal IKKE viske progresjon.
    if (phase === "idle" || tracks.length === 0) {
      start(newTracks);
    }
    goToTrack(newIndex);
  };

  const showPause = isPlayingThis;
  const ariaLabel = showPause
    ? `Pause: ${targetLabel}`
    : `Spill av: ${targetLabel}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      data-active-during-tour={isThisActive ? "true" : undefined}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white shadow-sm transition hover:scale-105 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
    >
      {showPause ? (
        <Pause className="h-4 w-4" />
      ) : (
        <Play className="ml-0.5 h-4 w-4" />
      )}
    </button>
  );
}
