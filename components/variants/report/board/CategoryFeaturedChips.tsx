"use client";

import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import type { BoardCategory, BoardPOI } from "./board-data";

/**
 * Horisontal chip-cloud med utvalgte POIs per kategori — navn + kategori-ikon.
 * Hver chip er klikkbar og åpner POI-overlay via consumer-supplied callback.
 *
 * Visuell stil: rounded-full med stone-bakgrunn, kategori-farget ikon. Speil av
 * affordance-mønsteret fra `BoardRail` (rounded + transition + hover-ring).
 *
 * Tomt utvalg → returnerer null (ingen tomt-state-tekst, ikke vist når kategorien
 * er tom). Caller bør allerede ha filtrert POIs via `pickFeaturedPOIs`.
 */
export function CategoryFeaturedChips({
  pois,
  category,
  onChipClick,
}: {
  pois: BoardPOI[];
  category: BoardCategory;
  onChipClick: (poi: BoardPOI) => void;
}) {
  if (pois.length === 0) return null;
  const Icon = getFilledIcon(category.icon);

  return (
    <div className="flex flex-wrap gap-2">
      {pois.map((poi) => (
        <button
          key={poi.id}
          type="button"
          onClick={() => onChipClick(poi)}
          aria-label={`Åpne ${poi.name}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 shadow-sm transition hover:border-stone-400 hover:text-stone-900 hover:shadow active:translate-y-px"
        >
          <Icon
            className="h-3.5 w-3.5 shrink-0"
            weight="duotone"
            style={{ color: category.color }}
          />
          <span className="truncate max-w-[160px]">{poi.name}</span>
        </button>
      ))}
    </div>
  );
}
