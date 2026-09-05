"use client";

import { getIcon } from "@/lib/utils/map-icons";
import { cn } from "@/lib/utils";
import { SIDEBAR_SECTION_TITLE } from "../sidebar-style";
import { useStoryTour } from "./story-tour";

/**
 * Temaene som et rutenett på områdestoppet — inngangen til omvisningen.
 *
 * Raden i toppen (`StoryRail`) er transporten: den sier hvor du ER i
 * rekkefølgen, og forutsetter at du alt er inne i den. På områdestoppet er du
 * ikke det. Der sto seks små brikker i en rad ingen hadde introdusert, og
 * setningen «Velg et tema» pekte på noe som ikke så ut som et valg (Andreas,
 * 2026-09-05: «da er det ikke så gitt at de kan velge blant kategorier»).
 *
 * Rutenettet er det samme valget i en form som LESER som et valg: to kolonner,
 * store flater, ikon, navn og dekningen i tall. Det ligger over strøkets
 * spørsmål og svar, fordi det er veien videre og svarene er bakgrunnen. Raden
 * skjules så lenge området er aktivt (se `StoryRail`/`StoryCard`), og kommer
 * inn som transport først når et tema er valgt — da har den noe å transportere.
 *
 * Samme form på mobil og desktop: to kolonner er nok til å fylle en sheet og
 * en sidekolonne uten å bli enten en liste eller en frimerkevegg.
 */
export function StoryThemeGrid({ className = "" }: { className?: string }) {
  const { stops, goto } = useStoryTour();
  if (stops.length === 0) return null;

  return (
    <div data-testid="story-theme-grid" className={className}>
      <h4 className={SIDEBAR_SECTION_TITLE}>Temaer</h4>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {stops.map((c, n) => {
          const Icon = getIcon(c.icon);
          return (
            <button
              key={c.id}
              type="button"
              data-story-theme={c.id}
              onClick={() => goto(n)}
              className={cn(
                "flex flex-col items-start gap-2.5 rounded-2xl bg-white p-3.5 text-left",
                "shadow-[inset_0_0_0_1px_rgba(28,25,23,0.07),0_1px_3px_rgba(28,25,23,0.06)]",
                "transition-[box-shadow,transform] duration-150",
                "hover:shadow-[inset_0_0_0_1px_rgba(28,25,23,0.12),0_4px_14px_rgba(28,25,23,0.1)]",
                "active:scale-[0.985]",
              )}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: c.color }}
              >
                <Icon size={16} strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold leading-[1.25] tracking-[-0.01em] text-stone-900">
                  {c.label}
                </span>
                <span className="mt-0.5 block text-[12px] font-medium tabular-nums text-stone-500">
                  {c.pois.length} {c.pois.length === 1 ? "sted" : "steder"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
