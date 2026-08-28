"use client";

import { ChevronRight, Play } from "lucide-react";
import { useStoryTour } from "./story-tour";

/**
 * Inngangen til omvisningen.
 *
 * Tettheten møter deg først — den er beviset, og det er dekningen megleren
 * betaler for. Omvisningen er veien inn for den som IKKE selv begynner å zoome
 * og trykke, og den ligger derfor over indeksen, ikke i stedet for den.
 *
 * Undertittelen sier hvor mange stopp, ikke hvor lang tid: en omvisning uten
 * lyd tar den tiden leseren gir den.
 */
export function StoryPlayCard() {
  const { available, stops, begin } = useStoryTour();
  if (!available) return null;

  return (
    <button
      type="button"
      data-testid="story-play"
      /* Uten wrapper hadde klikk-eventet blitt sendt inn som `at` (begin tar nå
         et start-stopp — desktop-kolonnen begynner på området). */
      onClick={() => begin()}
      className="mb-2.5 flex w-full shrink-0 items-center gap-3 rounded-2xl bg-stone-900 px-3 py-[11px] text-left text-white transition-opacity duration-150 hover:opacity-95"
    >
      <span
        aria-hidden
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/[0.14]"
      >
        <Play size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold tracking-[-0.01em]">
          La nabolaget presentere seg
        </span>
        <span className="block text-[12px] text-white/60">
          {stops.length} stopp · meglerens utvalg
        </span>
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 opacity-50" />
    </button>
  );
}
