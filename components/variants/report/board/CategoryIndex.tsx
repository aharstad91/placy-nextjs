"use client";

import Image from "next/image";
import { Check, ChevronRight } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "./board-state";
import type { BoardCategory } from "./board-data";
import { THEME_SCENE_SRC } from "../theme-icons";
import {
  useAudioTourActions,
  useAudioTourSectionProgress,
  useAudioTourStore,
  type AudioTrack,
  type AudioTrackCategoryId,
} from "@/lib/stores/audio-tour-store";

/**
 * Numerert kategori-indeks — Spotify "Popular"-mønster, men for kategorier i
 * stedet for sanger. Erstatter `BoardRail` som primær kategori-nav siden rail
 * ble fjernet. Hjem er IKKE med i listen (Hjem er top-hero — duplisering ville
 * forvirret).
 *
 * Klikk er modus-bevisst:
 * - **Idle/ended:** dispatcher SELECT_CATEGORY{source:"index"} → scroll-panelet
 *   scroller målseksjonen i sentrum (samme mekanikk som rail-klikk).
 * - **Aktiv tour (playing/paused/error):** bygger tracks (Hjem først + alle
 *   kategorier) og kaller goToTrack(targetIndex) — speil av CategoryAudio-
 *   Button. Re-spill viser ikke playedCategoryIds (sticky-semantikk i store).
 *
 * Played-state markeres med haket-ikon ved siden av nummeret. Active-state
 * fremhever raden via bg-tint. Begge bruker `useAudioTourSectionProgress`.
 */
export function CategoryIndex() {
  const { data } = useBoard();

  if (data.categories.length === 0) return null;

  return (
    <section
      aria-label="Kategori-indeks"
      className="px-6 pb-2 pt-3"
    >
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        I rapporten · {data.categories.length} kategorier
      </h2>
      <ol className="-mx-2 flex flex-col">
        {data.categories.map((cat, i) => (
          <CategoryRow key={cat.id} number={i + 1} category={cat} />
        ))}
      </ol>
    </section>
  );
}

function CategoryRow({
  number,
  category,
}: {
  number: number;
  category: BoardCategory;
}) {
  const { data, state, dispatch } = useBoard();
  const progress = useAudioTourSectionProgress(category.id);
  const phase = useAudioTourStore((s) => s.phase);
  const tracks = useAudioTourStore((s) => s.tracks);
  const { start, goToTrack } = useAudioTourActions();

  const tourActive =
    phase === "playing" || phase === "paused" || phase === "error";
  const isActive =
    progress === "active" ||
    (!tourActive && state.activeCategoryId === category.id);
  const isPlayed = progress === "played";

  const illustrationSrc = THEME_SCENE_SRC[category.id];
  const FallbackIcon = getFilledIcon(category.icon);

  const handleClick = () => {
    if (!tourActive) {
      // Idle/ended: scroll-snarvei — samme mekanikk som tidligere rail-klikk.
      dispatch({ type: "SELECT_CATEGORY", id: category.id, source: "index" });
      return;
    }
    // Aktiv tour: jump audio til denne kategoriens spor. Hvis tracks ikke er
    // bygd ennå (defensive — burde være umulig under aktiv tour), kall start()
    // først. Speil av CategoryAudioButton-logikken.
    const homeAudio = data.home.audio;
    if (!homeAudio || !category.audio) return;
    if (tracks.length === 0) {
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
      start(newTracks);
      const idx = newTracks.findIndex((t) => t.categoryId === category.id);
      if (idx !== -1) goToTrack(idx);
      return;
    }
    const idx = tracks.findIndex((t) => t.categoryId === category.id);
    if (idx !== -1) goToTrack(idx);
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        aria-current={isActive ? "true" : undefined}
        data-index-state={
          isActive ? "active" : isPlayed ? "played" : "default"
        }
        className={`group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
          isActive
            ? "bg-stone-200/60"
            : "hover:bg-stone-100"
        }`}
      >
        <span
          className={`w-5 shrink-0 text-center text-sm font-semibold tabular-nums ${
            isPlayed ? "text-emerald-700" : "text-stone-500"
          }`}
        >
          {isPlayed ? <Check className="mx-auto h-4 w-4" /> : number}
        </span>
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
          {illustrationSrc ? (
            <Image
              src={illustrationSrc}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <FallbackIcon className="h-5 w-5 text-stone-400" weight="fill" />
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={`truncate text-[14px] font-semibold leading-tight ${
              isActive || isPlayed ? "text-stone-900" : "text-stone-800"
            }`}
          >
            {category.label}
          </span>
          <span className="text-[11px] text-stone-500">
            {category.pois.length} punkter
          </span>
        </span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 transition ${
            isActive
              ? "text-stone-700"
              : "text-stone-300 group-hover:text-stone-500"
          }`}
        />
      </button>
    </li>
  );
}
