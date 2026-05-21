"use client";

import { Marker } from "react-map-gl/mapbox";
import { useMemo } from "react";
import { useBoard } from "./board-state";
import { FEATURED_POI_COUNT, pickFeaturedPOIs } from "@/lib/board/featured-pois";
import type { BoardPOI } from "./board-data";

/**
 * Permanente navne-labels for featured POIs (samme utvalg som chip-cloud
 * i sidebar). Speil av `BoardPOILabel`-mønsteret men alltid synlig, ikke kun
 * for active POI. pointer-events: none — dekorativt, klikk går til markøren
 * under.
 *
 * Synlighet matcher `visiblePOIs` i `BoardMap.tsx`:
 *  - phase=default uten aktiv kategori: featured fra ALLE kategorier
 *  - phase=category eller aktiv POI: featured kun fra aktiv kategori
 *  - active POI er ekskludert (BoardPOILabel tar over for den)
 */
export function FeaturedPOILabels() {
  const { state, data } = useBoard();

  const featuredEntries = useMemo(() => {
    const entries: BoardPOI[] = [];
    if (state.phase === "default" && state.activeCategoryId === null) {
      for (const cat of data.categories) {
        entries.push(...pickFeaturedPOIs(cat.pois, FEATURED_POI_COUNT, cat.id));
      }
    } else if (state.activeCategoryId) {
      const cat = data.categories.find((c) => c.id === state.activeCategoryId);
      if (cat) {
        entries.push(...pickFeaturedPOIs(cat.pois, FEATURED_POI_COUNT, cat.id));
      }
    }
    return entries;
  }, [state.phase, state.activeCategoryId, data.categories]);

  return (
    <>
      {featuredEntries.map((poi) => {
        if (poi.id === state.activePOIId) return null;
        return (
          <Marker
            key={poi.id}
            longitude={poi.coordinates.lng}
            latitude={poi.coordinates.lat}
            anchor="bottom"
            offset={[0, -46]}
            style={{ zIndex: 5, pointerEvents: "none" }}
          >
            <div className="whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200/80 backdrop-blur">
              {poi.name}
            </div>
          </Marker>
        );
      })}
    </>
  );
}
