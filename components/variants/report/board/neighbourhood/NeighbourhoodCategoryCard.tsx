"use client";

import { ChevronRight } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { categorySubline as formatSubline } from "@/lib/board/neighbourhood-list";
import type { NeighbourhoodCategory } from "@/lib/board/neighbourhood-list";
import type { BoardPOI } from "../board-data";

/**
 * Ett kategorikort i nabolagslista (Unit 3b).
 *
 * Formen er hentet fra Citymappers linje-identiteter: kategorien er
 * «linja» (ikon + navn + en tett, prosafri statuslinje), punktene er radene
 * under. Headeren er bevisst uten brødtekst — dekning og tidsspenn forteller
 * alt brukeren trenger for å avgjøre om kategorien er verdt å åpne.
 *
 * A11y: vanlige lister og knapper, IKKE `role="listbox"`/`role="option"` —
 * det var en bug de fikset i POI-karusellen
 * (`unified-poi-carousel-report-20260420`). Radene er ikke-interaktive i
 * Fase 1; utvidbar rad kommer i Unit 6.
 */

// `categorySubline` bor i den rene modellen (lib/board/neighbourhood-list) siden
// desktop-panelets viewport-liste bruker samme formatering. Re-eksporteres her
// så eksisterende importstier står.
export { categorySubline } from "@/lib/board/neighbourhood-list";

export function NeighbourhoodCategoryCard({
  category,
  onOpen,
}: {
  category: NeighbourhoodCategory<BoardPOI>;
  /** R15: header og «se alle»-raden fører begge til kategorisiden. */
  onOpen: (categoryId: string) => void;
}) {
  const Icon = getIcon(category.icon);
  const subline = formatSubline(category);

  return (
    <section
      data-testid="neighbourhood-card"
      data-category={category.id}
      className="mb-2 overflow-hidden rounded-2xl bg-white/80 ring-1 ring-black/5"
    >
      <button
        type="button"
        onClick={() => onOpen(category.id)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-black/[0.04]"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${category.color}1f`, color: category.color }}
        >
          <Icon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold tracking-tight text-stone-900">
            {category.label}
          </span>
          <span className="block truncate text-[12.5px] tabular-nums text-stone-500">
            {subline}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden />
      </button>

      <ul className="px-3 pb-2">
        {category.rows.map((row) => (
          <li
            key={row.poi.id}
            className="flex items-baseline gap-3 border-t border-black/5 py-1.5 first:border-t-0"
          >
            <span className="min-w-0 flex-1 truncate text-[14px] text-stone-700">
              {row.poi.name}
            </span>
            {/* R26: uten precomputet gangtid vises ingen tall — aldri et
                estimat, aldri en tom «– min». */}
            {row.walkMinutes !== undefined && (
              <span className="shrink-0 text-[13px] tabular-nums text-stone-500">
                {row.walkMinutes} min
              </span>
            )}
          </li>
        ))}
      </ul>

      {category.hasMore && (
        <button
          type="button"
          onClick={() => onOpen(category.id)}
          className="flex w-full items-center justify-between border-t border-black/5 px-3 py-2 text-left text-[13px] font-medium text-stone-600 active:bg-black/[0.04]"
        >
          <span>Se alle {category.totalCount}</span>
          <ChevronRight size={15} className="text-stone-400" aria-hidden />
        </button>
      )}
    </section>
  );
}
