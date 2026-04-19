"use client";

import { forwardRef } from "react";
import type { POI } from "@/lib/types";
import { Star, MapPin, Navigation, ExternalLink, BookOpen } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { slugify } from "@/lib/utils/slugify";

interface ReportMapBottomCardProps {
  poi: POI;
  /** Whether this card is the currently selected one. Drives morph + action-row visibility. */
  isActive: boolean;
  /** Zero-based index — used for aria-label, roving tabindex. */
  index: number;
  /** Total count in the carousel — used for aria-label "n of N". */
  total: number;
  /** Click handler — triggers flyTo + activation. */
  onClick: () => void;
  /** Slug for the area, used to build the "Les mer"-link. Null disables. */
  areaSlug?: string | null;
}

/**
 * One card in the map-modal bottom carousel. Text-only — no image.
 * Google Places images are unreliable (wrong subject, missing, terms-of-use),
 * and editorial text gives stronger signal for "what is this place" in the
 * map-navigation context where a thumbnail adds little.
 */
const ReportMapBottomCard = forwardRef<HTMLButtonElement, ReportMapBottomCardProps>(
  function ReportMapBottomCard(
    { poi, isActive, index, total, onClick, areaSlug },
    ref,
  ) {
    const CategoryIcon = getIcon(poi.category.icon);
    const walkMinutes = poi.travelTime?.walk
      ? Math.round(poi.travelTime.walk / 60)
      : null;

    const bodyText = poi.editorialHook ?? poi.localInsight ?? poi.description;

    const googleMapsDirectionsUrl = poi.googlePlaceId
      ? `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&destination_place_id=${poi.googlePlaceId}&travelmode=walking`
      : `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&travelmode=walking`;

    const poiPageUrl = areaSlug ? `/${areaSlug}/steder/${slugify(poi.name)}` : null;

    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={isActive}
        aria-label={`${poi.name}, ${index + 1} av ${total}`}
        tabIndex={isActive ? 0 : -1}
        data-poi-id={poi.id}
        onClick={onClick}
        className={`
          map-modal-card
          ${isActive ? "map-modal-card--active" : ""}
          relative shrink-0 snap-start w-[240px] md:w-[260px] rounded-xl
          bg-white border text-left cursor-pointer
          transition-[border-color,background-color] duration-150
          ${isActive ? "border-[#b45309] border-2" : "border-[#eae6e1] hover:border-[#d4cfc8]"}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b45309] focus-visible:ring-offset-2
        `}
      >
        <div className="p-3 flex flex-col gap-1.5">
          {/* Kicker row: icon + category name + rating */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0"
                style={{ backgroundColor: `${poi.category.color}1a` }}
              >
                <CategoryIcon
                  className="w-3 h-3"
                  style={{ color: poi.category.color }}
                />
              </span>
              <span className="text-[10px] uppercase tracking-[0.16em] font-medium text-[#6a5f51] truncate">
                {poi.category.name}
              </span>
            </span>
            {poi.googleRating != null && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#3a3530] shrink-0">
                <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                {poi.googleRating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="font-semibold text-[14px] md:text-[15px] leading-snug text-[#1a1a1a] tracking-tight line-clamp-2">
            {poi.name}
          </h4>

          {/* Walk time + body text */}
          <div className="flex flex-col gap-1">
            {walkMinutes != null && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5d5348]">
                <MapPin className="w-2.5 h-2.5" />
                {walkMinutes} min gange
              </span>
            )}
            {bodyText && (
              <p
                className={`text-[11px] text-[#5a5147] leading-snug ${
                  isActive ? "" : "line-clamp-2"
                }`}
              >
                {bodyText}
              </p>
            )}
          </div>

          {/* Action row — only on active card */}
          {isActive && (
            <div
              className="flex items-center gap-1.5 pt-2 mt-1 border-t border-[#eae6e1]"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
              >
                <Navigation className="w-2.5 h-2.5" />
                Vis rute
              </a>
              {poiPageUrl && (
                <a
                  href={poiPageUrl}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <BookOpen className="w-2.5 h-2.5" />
                  Les mer
                </a>
              )}
              {poi.googleMapsUrl && (
                <a
                  href={poi.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Åpne i Google Maps"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Google
                </a>
              )}
            </div>
          )}
        </div>
      </button>
    );
  },
);

export default ReportMapBottomCard;
