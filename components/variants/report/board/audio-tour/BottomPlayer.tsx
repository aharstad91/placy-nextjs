"use client";

import Image from "next/image";
import {
  AlertCircle,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useBoard } from "../board-state";
import {
  useAudioTourActions,
  useAudioTourMeta,
  useAudioTourStore,
  useCurrentTrack,
} from "@/lib/stores/audio-tour-store";
import { useQueueOverlayStore } from "@/lib/stores/queue-overlay-store";

/**
 * Global bottom-sticky audio-player for board-narrativ. Kun synlig under aktiv
 * tour (playing/paused/error). Idle/ended → returnerer null.
 *
 * Start-tour-CTA er flyttet til `SidebarHero.action-row` (stor play-knapp,
 * Spotify-mønster). Bottom-player er kun controller-flate under aktiv tour —
 * ingen dobbel CTA mellom topp og bunn.
 *
 * Mountes som søsken til scroll-container i BoardScrollPanel — alltid
 * synlig på bunnen av panelet når tour kjører.
 */
export function BottomPlayer() {
  const phase = useAudioTourStore((s) => s.phase);

  if (phase === "idle" || phase === "ended") {
    return null;
  }

  return (
    <div className="border-t border-stone-200/80 bg-white text-stone-900 shadow-[0_-2px_12px_rgba(15,29,68,0.06)]">
      <ActiveState />
    </div>
  );
}

function ActiveState() {
  const { data } = useBoard();
  const { phase, trackIndex, trackCount, pauseReason } = useAudioTourMeta();
  const { pause, resume, next, prev, close, retryTrack } =
    useAudioTourActions();
  const currentTrack = useCurrentTrack();
  const toggleQueue = useQueueOverlayStore((s) => s.toggle);

  if (!currentTrack) return null;

  const isWelcome = currentTrack.categoryId === "welcome";
  const isHome = currentTrack.categoryId === "home";
  const isOutro = currentTrack.categoryId === "outro";
  const category =
    isWelcome || isHome || isOutro
      ? undefined
      : data.categories.find((c) => c.id === currentTrack.categoryId);
  const displayLabel = isWelcome
    ? "Velkomst"
    : isHome
      ? "Nabolaget"
      : isOutro
        ? "Oppsummert"
        : (category?.label ?? "");
  const thumbnail = isHome
    ? data.home.heroImage
    : isWelcome || isOutro
      ? undefined
      : category?.illustration?.src;

  const isPlaying = phase === "playing";
  const isPaused = phase === "paused";
  const isError = phase === "error";
  const showResumeTour = isPaused && pauseReason === "category-clicked";

  return (
    <div className="flex items-center gap-3 px-3 py-3">
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
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            <span>
              Spor {trackIndex + 1}/{trackCount}
            </span>
            {isError && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                Lyd-feil
              </span>
            )}
          </div>
          <div className="truncate text-[14px] font-semibold leading-tight text-stone-900">
            {displayLabel}
          </div>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label="Forrige spor"
          disabled={trackIndex === 0}
          onClick={prev}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        {isError ? (
          <button
            type="button"
            onClick={retryTrack}
            className="mx-0.5 flex h-9 items-center gap-1.5 rounded-full bg-stone-900 px-3 text-xs font-semibold text-white transition hover:bg-stone-700"
          >
            <Play className="h-3.5 w-3.5" />
            Prøv igjen
          </button>
        ) : showResumeTour ? (
          <button
            type="button"
            onClick={resume}
            className="mx-0.5 flex h-9 items-center gap-1.5 rounded-full bg-stone-900 px-3 text-xs font-semibold text-white transition hover:bg-stone-700"
          >
            <Play className="h-3.5 w-3.5" />
            Fortsett tour
          </button>
        ) : (
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Spill av"}
            onClick={() => (isPlaying ? pause("manual") : resume())}
            className="mx-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-700"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" />
            )}
          </button>
        )}
        <button
          type="button"
          aria-label="Neste spor"
          disabled={trackIndex >= trackCount - 1}
          onClick={next}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Avslutt tour"
          onClick={close}
          className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
