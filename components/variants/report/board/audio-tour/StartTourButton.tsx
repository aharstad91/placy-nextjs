"use client";

import { Headphones } from "lucide-react";
import { useStartTour } from "./use-start-tour";

/**
 * CTA i Hjem-panel som starter audio-touren. Renderes kun hvis `useStartTour`
 * rapporterer `canStart=true` (audioTourEnabled + Hjem-audio + alle kategorier
 * har audio). Manglende audio på én kategori → skjul CTA; vi vil ikke at
 * brukeren skal starte en tour som plutselig hopper over en kategori uten
 * varsel.
 *
 * Track-rekkefølge styres av `useStartTour`: Hjem først, deretter kategorier
 * i `boardData.categories`-rekkefølgen (matcher `reportConfig.themes`).
 */
export function StartTourButton() {
  const { canStart, totalTracks, startTour } = useStartTour();

  if (!canStart) return null;

  return (
    <button
      type="button"
      onClick={startTour}
      className="group flex w-full items-center gap-3 rounded-2xl border border-stone-900/10 bg-stone-900 px-4 py-3.5 text-left text-white shadow-sm transition hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Headphones className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Megler-pitch · {totalTracks} spor
        </span>
        <span className="text-[15px] font-semibold leading-tight">
          ▶ Start tour
        </span>
      </span>
    </button>
  );
}
