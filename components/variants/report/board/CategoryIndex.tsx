"use client";

import Image from "next/image";
import { Check, ChevronRight } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "./board-state";
import type { BoardCategory, BoardCategoryId } from "./board-data";
import { THEME_SCENE_SRC } from "../theme-icons";
import {
  useAudioTourActions,
  useAudioTourSectionProgress,
  useAudioTourStore,
  type AudioTrack,
  type AudioTrackCategoryId,
} from "@/lib/stores/audio-tour-store";

/**
 * Numerert spilleliste over alle spor — Hjem som #1, deretter kategoriene.
 * Spotify "Popular"-mønster. Erstatter `BoardRail` som primær kategori-nav
 * siden rail ble fjernet. Hjem er behandlet på lik linje med kategoriene
 * (en av brukerens iter-A-beslutninger): samme thumbnail-format, samme klikk-
 * semantikk, samme played/active-state.
 *
 * Klikk er modus-bevisst:
 * - **Idle/ended:** dispatcher SELECT_CATEGORY/RESET_TO_DEFAULT → scroll-
 *   panelet scroller målseksjonen i sentrum.
 * - **Aktiv tour (playing/paused/error):** bygger tracks (Hjem først + alle
 *   kategorier) og kaller goToTrack(targetIndex).
 *
 * Played-state markeres med haket-ikon ved siden av nummeret. Active-state
 * fremhever raden via bg-tint.
 */
export function CategoryIndex({
  onItemSelected,
  hideHeader = false,
}: {
  /** Kalles etter en row-klikk — brukt av QueueOverlay til å lukke seg
   *  selv etter at brukeren har valgt et spor. Default no-op (indeks-i-
   *  scroll-panelet trenger ikke lukke noe). */
  onItemSelected?: () => void;
  /** Skjul eyebrow-headeren — brukt når CategoryIndex mountes inni en
   *  overlay som selv har header. */
  hideHeader?: boolean;
} = {}) {
  const { data } = useBoard();

  if (data.categories.length === 0) return null;

  const totalRows = data.categories.length + 1; // +1 for Hjem

  return (
    <section aria-label="Spor-indeks" className="px-6 pb-2 pt-2">
      {!hideHeader && (
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          I rapporten · {totalRows} spor
        </h2>
      )}
      <ol className="-mx-2 flex flex-col">
        <HomeRow number={1} onItemSelected={onItemSelected} />
        {data.categories.map((cat, i) => (
          <CategoryRow
            key={cat.id}
            number={i + 2}
            category={cat}
            onItemSelected={onItemSelected}
          />
        ))}
      </ol>
    </section>
  );
}

function HomeRow({
  number,
  onItemSelected,
}: {
  number: number;
  onItemSelected?: () => void;
}) {
  const { data, state, dispatch } = useBoard();
  const progress = useAudioTourSectionProgress("home");
  const phase = useAudioTourStore((s) => s.phase);
  const tracks = useAudioTourStore((s) => s.tracks);
  const { start, goToTrack } = useAudioTourActions();

  const tourActive =
    phase === "playing" || phase === "paused" || phase === "error";
  const isActive =
    progress === "active" ||
    (!tourActive && state.activeCategoryId === null);
  const isPlayed = progress === "played";

  const handleClick = () => {
    if (!tourActive) {
      dispatch({ type: "RESET_TO_DEFAULT" });
      onItemSelected?.();
      return;
    }
    if (!data.home.audio) return;
    if (tracks.length === 0) {
      const newTracks = buildTracks(data);
      if (!newTracks) return;
      start(newTracks);
      goToTrack(0);
      onItemSelected?.();
      return;
    }
    goToTrack(0);
    onItemSelected?.();
  };

  return (
    <IndexRow
      number={number}
      label="Nabolaget"
      subline={
        [data.home.district, data.home.city].filter(Boolean).join(", ") ||
        "Velkomst"
      }
      thumbnail={data.home.heroImage}
      fallbackIconName={undefined}
      isActive={isActive}
      isPlayed={isPlayed}
      onClick={handleClick}
    />
  );
}

function CategoryRow({
  number,
  category,
  onItemSelected,
}: {
  number: number;
  category: BoardCategory;
  onItemSelected?: () => void;
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

  const handleClick = () => {
    if (!tourActive) {
      dispatch({ type: "SELECT_CATEGORY", id: category.id, source: "index" });
      onItemSelected?.();
      return;
    }
    if (!category.audio) return;
    if (tracks.length === 0) {
      const newTracks = buildTracks(data);
      if (!newTracks) return;
      start(newTracks);
      const idx = newTracks.findIndex((t) => t.categoryId === category.id);
      if (idx !== -1) goToTrack(idx);
      onItemSelected?.();
      return;
    }
    const idx = tracks.findIndex((t) => t.categoryId === category.id);
    if (idx !== -1) goToTrack(idx);
    onItemSelected?.();
  };

  return (
    <IndexRow
      number={number}
      label={category.label}
      subline={`${category.pois.length} punkter`}
      thumbnail={THEME_SCENE_SRC[category.id]}
      fallbackIconName={category.icon}
      isActive={isActive}
      isPlayed={isPlayed}
      onClick={handleClick}
    />
  );
}

function IndexRow({
  number,
  label,
  subline,
  thumbnail,
  fallbackIconName,
  isActive,
  isPlayed,
  onClick,
}: {
  number: number;
  label: string;
  subline: string;
  thumbnail?: string;
  fallbackIconName?: string;
  isActive: boolean;
  isPlayed: boolean;
  onClick: () => void;
}) {
  const FallbackIcon = fallbackIconName
    ? getFilledIcon(fallbackIconName)
    : null;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={isActive ? "true" : undefined}
        data-index-state={
          isActive ? "active" : isPlayed ? "played" : "default"
        }
        className={`group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
          isActive ? "bg-stone-200/60" : "hover:bg-stone-100"
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
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : FallbackIcon ? (
            <span className="flex h-full w-full items-center justify-center">
              <FallbackIcon className="h-5 w-5 text-stone-400" weight="fill" />
            </span>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={`truncate text-[14px] font-semibold leading-tight ${
              isActive || isPlayed ? "text-stone-900" : "text-stone-800"
            }`}
          >
            {label}
          </span>
          <span className="text-[11px] text-stone-500">{subline}</span>
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

/** Bygger track-array fra BoardData — welcome først (hvis finnes), så Hjem,
 *  kategorier, og valgfri outro sist. Returnerer null hvis Hjem-audio eller
 *  en kategori-audio mangler — defensiv sjekk. Welcome og outro er optionale:
 *  hvis de ikke finnes, droppes de stille. Mirror av `useStartTour` men
 *  inline for å unngå hook-kall i klikk-handler. */
function buildTracks(data: ReturnType<typeof useBoard>["data"]): AudioTrack[] | null {
  if (!data.home.audio) return null;
  if (!data.categories.every((c) => c.audio)) return null;
  return [
    ...(data.welcome
      ? [
          {
            categoryId: "welcome" as AudioTrackCategoryId,
            url: data.welcome.url,
            manus: data.welcome.manus,
          },
        ]
      : []),
    {
      categoryId: "home" as AudioTrackCategoryId,
      url: data.home.audio.url,
      manus: data.home.audio.manus,
    },
    ...data.categories.map((c) => ({
      categoryId: c.id as BoardCategoryId,
      url: c.audio!.url,
      manus: c.audio!.manus,
    })),
    ...(data.outro
      ? [
          {
            categoryId: "outro" as AudioTrackCategoryId,
            url: data.outro.url,
            manus: data.outro.manus,
          },
        ]
      : []),
  ];
}
