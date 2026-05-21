"use client";

import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { markerCircleStyle } from "./marker-style";
import type { BoardCategory, BoardPOI } from "./board-data";

/**
 * Horisontal chip-cloud med utvalgte POIs per kategori — navn + miniature av
 * kart-markøren (samme sub-kategori-ikon, samme tint-bg + farget ramme).
 * Brukerens visuelle gjenkjenning mellom chip og kart-markør skal være 1:1.
 *
 * Sub-kategori-data (`poi.raw.category.icon/color`) prioriteres over
 * kategori-defaultene — speilet av `BoardMarker`-logikken. F.eks. har Mat &
 * Drikke-kategorien sub-kategorier (cafe/bar/restaurant) med ulike farger.
 *
 * Klikkbar — consumer-supplied callback åpner POI-overlay.
 *
 * Tomt utvalg → returnerer null. Caller bør allerede ha filtrert POIs via
 * `pickFeaturedPOIs`.
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

  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        Utvalgte punkter
      </div>
      <div className="flex flex-wrap gap-2">
        {pois.map((poi) => {
          const color = poi.raw.category.color || category.color;
          const iconName = poi.raw.category.icon || category.icon;
          const Icon = getFilledIcon(iconName);
          const circle = markerCircleStyle(color);
          return (
            <button
              key={poi.id}
              type="button"
              onClick={() => onChipClick(poi)}
              aria-label={`Åpne ${poi.name}`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-3 text-xs font-medium text-stone-800 shadow-sm transition hover:border-stone-400 hover:text-stone-900 hover:shadow active:translate-y-px"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: circle.borderColor,
                  backgroundColor: circle.backgroundColor,
                  color: circle.borderColor,
                }}
              >
                <Icon className="h-3 w-3" weight="fill" />
              </span>
              <span className="truncate max-w-[160px]">{poi.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
