"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Headphones,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useBoard, useActiveCategory, useActivePOI } from "../board-state";
import type { BoardCategory, BoardPOI } from "../board-data";
import { BoardPOIDetails } from "../BoardPOIDetails";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { markerCircleStyle } from "../marker-style";
import {
  useAudioTourActions,
  useAudioTourMeta,
  useAudioTourStore,
  useCurrentTrack,
} from "@/lib/stores/audio-tour-store";

/**
 * Desktop POI-overlay: legger seg over BoardScrollPanel når phase !== "default".
 * Sticky header øverst gir kategori-kontekst + audio-transport (hvis tour aktiv)
 * + tilbake-pil. Body viser kun den klikkede POI-en som alltid-åpen pinned
 * card — ingen reordering eller "nærliggende"-liste (det skapte hopp i UI-en
 * og dupliserte kart-funksjonen). Bytte mellom POIs skjer via kart-pin-klikk.
 *
 * Tilbake-pil dispatcher BACK_TO_DEFAULT — beholder activeCategoryId så scroll-
 * narrativet returnerer i samme posisjon, og audio-tour fortsetter uavbrutt.
 *
 * Mountes som søsken til BoardScrollPanel i BoardDesktopShell, ikke som
 * erstatning. BoardScrollPanel forblir mountet i bakgrunnen så scroll-state og
 * IO-observers bevarer kontekst når overlay lukkes.
 */
export function BoardPOIOverlay() {
  const { dispatch } = useBoard();
  const category = useActiveCategory();
  const activePOI = useActivePOI();

  if (!category) return null;

  const handleBack = () => dispatch({ type: "BACK_TO_DEFAULT" });

  return (
    <section
      aria-label={`POI-detaljer for ${category.label}`}
      className="absolute inset-0 z-20 flex w-[400px] flex-col bg-stone-50"
    >
      <OverlayHeader
        categoryLabel={category.label}
        thumbnail={category.illustration?.src}
        onBack={handleBack}
      />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activePOI ? (
          <ActivePOICard poi={activePOI} category={category} />
        ) : (
          <EmptyPOIState />
        )}
      </div>
    </section>
  );
}

function EmptyPOIState() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-200 bg-white/40 px-4 py-8 text-center">
      <p className="text-sm text-stone-600">
        Klikk på et punkt i kartet for å se detaljer.
      </p>
    </div>
  );
}

function ActivePOICard({
  poi,
  category,
}: {
  poi: BoardPOI;
  category: BoardCategory;
}) {
  const Icon = getFilledIcon(poi.raw.category.icon);
  const subColor = poi.raw.category.color || category.color;
  const circle = markerCircleStyle(subColor);
  return (
    <article
      data-poi-id={poi.id}
      className="rounded-2xl border border-stone-200/80 bg-white shadow-[0_2px_8px_rgba(15,29,68,0.06)]"
      style={{ boxShadow: `inset 3px 0 0 ${subColor}` }}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <div
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-2"
          style={{
            borderColor: circle.borderColor,
            backgroundColor: circle.backgroundColor,
            color: circle.borderColor,
          }}
        >
          <Icon className="h-4 w-4" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-stone-900">
            {poi.name}
          </div>
          {poi.address && (
            <div className="truncate text-xs font-normal text-stone-500">
              {poi.address}
            </div>
          )}
        </div>
      </div>
      <div className="px-3.5 pb-3 pt-1">
        <BoardPOIDetails poi={poi.raw} />
      </div>
    </article>
  );
}

function OverlayHeader({
  categoryLabel,
  thumbnail,
  onBack,
}: {
  categoryLabel: string;
  thumbnail?: string;
  onBack: () => void;
}) {
  const phase = useAudioTourStore((s) => s.phase);
  const tourActive = phase === "playing" || phase === "paused";

  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-200/80 bg-white px-3 py-2 shadow-[0_2px_8px_rgba(15,29,68,0.04)]">
      <button
        type="button"
        onClick={onBack}
        aria-label="Tilbake"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Headphones className="h-4 w-4 text-stone-400" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {tourActive ? <TourTrackMeta /> : null}
        <div className="truncate text-[14px] font-semibold leading-tight text-stone-900">
          {categoryLabel}
        </div>
      </div>
      {tourActive ? <TransportControls /> : null}
    </header>
  );
}

function TourTrackMeta() {
  const { trackIndex, trackCount } = useAudioTourMeta();
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
      Spor {trackIndex + 1}/{trackCount}
    </div>
  );
}

function TransportControls() {
  const { phase, trackIndex, trackCount } = useAudioTourMeta();
  const { pause, resume, next, prev, close } = useAudioTourActions();
  const currentTrack = useCurrentTrack();
  if (!currentTrack) return null;
  const isPlaying = phase === "playing";

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        aria-label="Forrige spor"
        disabled={trackIndex === 0}
        onClick={prev}
        className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <SkipBack className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={isPlaying ? "Pause" : "Spill av"}
        onClick={() => (isPlaying ? pause("manual") : resume())}
        className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-700"
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5" />
        )}
      </button>
      <button
        type="button"
        aria-label="Neste spor"
        disabled={trackIndex >= trackCount - 1}
        onClick={next}
        className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Avslutt tour"
        onClick={close}
        className="ml-0.5 flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

