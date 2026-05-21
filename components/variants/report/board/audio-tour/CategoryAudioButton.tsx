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

/**
 * Per-kategori "Spill av denne seksjonen"-CTA i CategorySection. Trigger som
 * lar bruker hoppe direkte til ett spor uten å gå via BottomPlayer. Når denne
 * kategorien er aktivt spor: knappen viser pause/play synkronisert med global
 * playback-state — selve player-UI-en (progress, skip, lukk) lever i den
 * globale BottomPlayer.
 *
 * Gating: audioTourEnabled + Hjem-audio + alle kategorier har audio (samme
 * kontrakt som BottomPlayer).
 */
export function CategoryAudioButton({ category }: { category: BoardCategory }) {
  const { data } = useBoard();
  const { start, goToTrack, pause, resume } = useAudioTourActions();
  const phase = useAudioTourStore((s) => s.phase);
  const trackIndex = useAudioTourStore((s) => s.trackIndex);
  const tracks = useAudioTourStore((s) => s.tracks);

  const homeAudio = data.home.audio;
  const allCategoriesHaveAudio = data.categories.every((c) => c.audio);

  if (
    !data.audioTourEnabled ||
    !homeAudio ||
    !allCategoriesHaveAudio ||
    !category.audio
  ) {
    return null;
  }

  const currentTrack = tracks[trackIndex];
  const isThisCategoryActive = currentTrack?.categoryId === category.id;
  const isPlayingThis = isThisCategoryActive && phase === "playing";
  const isPausedOnThis = isThisCategoryActive && phase === "paused";

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
    const targetIndex = newTracks.findIndex((t) => t.categoryId === category.id);
    if (targetIndex === -1) return;
    // Start kun hvis turen er fersk — start() resetter playedCategoryIds, og
    // re-spill av en seksjon under pågående tour skal IKKE viske progresjon.
    if (phase === "idle" || tracks.length === 0) {
      start(newTracks);
    }
    goToTrack(targetIndex);
  };

  const showPause = isPlayingThis;
  const label = showPause
    ? "Spiller nå — pause"
    : isPausedOnThis
      ? "Pauset — fortsett"
      : "Spill av denne seksjonen";
  const ariaLabel = showPause
    ? `Pause megler-pitch: ${category.label}`
    : `Spill av megler-pitch: ${category.label}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      data-active-during-tour={isThisCategoryActive ? "true" : undefined}
      className={
        isThisCategoryActive
          ? "mt-3 inline-flex items-center gap-2 self-start rounded-full bg-stone-900 px-3 py-2 text-xs font-semibold text-white shadow-sm"
          : "mt-3 inline-flex items-center gap-2 self-start rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-stone-900 hover:text-stone-900"
      }
    >
      <span
        className={
          isThisCategoryActive
            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-stone-900"
            : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white"
        }
      >
        {showPause ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5" />
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}
