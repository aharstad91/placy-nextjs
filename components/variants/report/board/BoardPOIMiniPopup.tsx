"use client";

import { Popup } from "react-map-gl/mapbox";
import { Sparkles, X } from "lucide-react";
import { useBoard, useActivePOI } from "./board-state";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { markerCircleStyle } from "./marker-style";

/**
 * Mapbox 2D mini-popup forankret til aktiv POI-markør.
 *
 * Innhold er bevisst minimalt — ikon + navn + adresse, én linje editorial-tekst,
 * og én CTA ("Utforsk"). Brukes på desktop (lg+); mobil bruker BoardMobileSheet.
 * 3D-varianten er BoardPOI3DMiniPopup med samme innholds-layout, men manuell
 * skjerm-projisering siden Google Maps 3D mangler native popup-anchor.
 */
export function BoardPOIMiniPopup() {
  const { dispatch } = useBoard();
  const poi = useActivePOI();
  if (!poi) return null;

  const Icon = getFilledIcon(poi.raw.category.icon);
  const color = poi.raw.category.color;
  const circle = markerCircleStyle(color);
  const exploreQuery = poi.address
    ? `${poi.name} ${poi.address}`
    : poi.name;
  const exploreUrl = `https://www.google.com/search?udm=50&q=${encodeURIComponent(exploreQuery)}`;

  return (
    <Popup
      longitude={poi.coordinates.lng}
      latitude={poi.coordinates.lat}
      anchor="bottom"
      offset={28}
      closeButton={false}
      closeOnClick={false}
      onClose={() => dispatch({ type: "BACK_TO_DEFAULT" })}
      className="board-mini-popup"
      maxWidth="280px"
    >
      <div className="w-[260px] bg-white">
        <div className="flex items-start gap-2.5 px-3 pt-3">
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
              <div className="truncate text-xs text-stone-500">
                {poi.address}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "BACK_TO_DEFAULT" })}
            aria-label="Lukk"
            className="-mr-1 -mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {poi.body && (
          <p className="mt-1.5 px-3 line-clamp-2 text-[13px] leading-snug text-stone-700">
            {poi.body}
          </p>
        )}

        <div className="mt-2.5 px-3 pb-3">
          <a
            href={exploreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Utforsk
          </a>
        </div>
      </div>
    </Popup>
  );
}
