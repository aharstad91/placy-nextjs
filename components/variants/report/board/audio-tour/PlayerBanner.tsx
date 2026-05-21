"use client";

import Image from "next/image";
import { AlertCircle, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useBoard } from "../board-state";
import {
  useAudioTourActions,
  useAudioTourMeta,
  useCurrentTrack,
} from "@/lib/stores/audio-tour-store";
import { useAudioElement } from "./use-audio-element";
import { useQueueOverlayStore } from "@/lib/stores/queue-overlay-store";

/**
 * Player-banner som rendres sticky-top i panel/sheet når audio-tour er
 * aktiv. ~64px høyde. Lukker seg automatisk via parent når
 * `phase === "idle" || phase === "ended"` — da overtar enten Hjem-panel
 * eller TourEndScreen (Unit 6).
 *
 * Layout: thumbnail | teller + label + segmentert progressbar | prev/play/next/lukk
 *
 * Pauseårsak-styring (per plan):
 *  - `pauseReason === "category-clicked"` → vis "Fortsett tour"-knapp som
 *    primary-action istedenfor play-pause (bruker har klikket bort, gjør
 *    intensjons-bytte synlig).
 *  - `phase === "error"` → vis "Prøv igjen"-knapp + advarsels-ikon.
 *  - Ellers: standard play/pause.
 */
export function PlayerBanner() {
  const { phase, trackIndex, trackCount, pauseReason } = useAudioTourMeta();
  const { pause, resume, next, prev, close, retryTrack } = useAudioTourActions();
  const currentTrack = useCurrentTrack();
  const { currentTime, duration } = useAudioElement();
  const { data } = useBoard();
  const toggleQueue = useQueueOverlayStore((s) => s.toggle);

  if (phase === "idle" || phase === "ended" || !currentTrack) {
    return null;
  }

  const isHome = currentTrack.categoryId === "home";
  const category = isHome
    ? undefined
    : data.categories.find((c) => c.id === currentTrack.categoryId);
  const displayLabel = isHome ? "Hjem" : (category?.label ?? "");
  const thumbnail = isHome ? data.home.heroImage : category?.illustration?.src;

  const isPlaying = phase === "playing";
  const isPaused = phase === "paused";
  const isError = phase === "error";
  const showResumeTour = isPaused && pauseReason === "category-clicked";

  // Segmentert progressbar — ett segment per track. Aktivt segment fylles
  // proporsjonalt med `currentTime/duration`; tidligere = full, senere = tom.
  const segments = Array.from({ length: trackCount }, (_, i) => {
    if (i < trackIndex) return 1;
    if (i > trackIndex) return 0;
    return duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  });

  return (
    <div
      role="region"
      aria-label="Audio-tour player"
      data-slot="audio-player-banner"
      className="flex items-center gap-3 border-b border-stone-200/80 bg-white/95 px-3 py-2.5 backdrop-blur"
    >
      <button
        type="button"
        onClick={toggleQueue}
        aria-label="Vis spilleliste"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:bg-stone-50"
      >
        {thumbnail && (
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stone-100">
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              {trackIndex + 1}/{trackCount}
            </span>
            <span className="truncate text-sm font-semibold text-stone-900">
              {displayLabel}
            </span>
            {isError && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600">
                <AlertCircle className="h-3 w-3" />
                Lyd-feil
              </span>
            )}
          </div>
          <div
            className="mt-1.5 flex gap-1"
            aria-label={`Spor ${trackIndex + 1} av ${trackCount}`}
          >
            {segments.map((fill, i) => (
              <div
                key={i}
                className="h-1 flex-1 overflow-hidden rounded-full bg-stone-200"
              >
                <div
                  className="h-full bg-stone-800 transition-[width] duration-150 ease-linear"
                  style={{ width: `${fill * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label="Forrige spor"
          disabled={trackIndex === 0}
          onClick={prev}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        {isError ? (
          <button
            type="button"
            onClick={retryTrack}
            className="mx-0.5 flex h-9 items-center gap-1.5 rounded-full bg-stone-900 px-3 text-xs font-semibold text-white transition hover:bg-stone-800"
          >
            <Play className="h-3.5 w-3.5" />
            Prøv igjen
          </button>
        ) : showResumeTour ? (
          <button
            type="button"
            onClick={resume}
            className="mx-0.5 flex h-9 items-center gap-1.5 rounded-full bg-stone-900 px-3 text-xs font-semibold text-white transition hover:bg-stone-800"
          >
            <Play className="h-3.5 w-3.5" />
            Fortsett tour
          </button>
        ) : (
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Spill av"}
            onClick={() => (isPlaying ? pause("manual") : resume())}
            className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-800"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
        )}

        <button
          type="button"
          aria-label="Neste spor"
          disabled={trackIndex >= trackCount - 1}
          onClick={next}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <button
          type="button"
          aria-label="Avslutt tour"
          onClick={close}
          className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
