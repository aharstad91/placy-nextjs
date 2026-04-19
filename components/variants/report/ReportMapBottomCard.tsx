"use client";

import { useState, forwardRef } from "react";
import type { POI } from "@/lib/types";
import { Star, MapPin, Navigation, ExternalLink, BookOpen } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { slugify } from "@/lib/utils/slugify";

interface ReportMapBottomCardProps {
  poi: POI;
  /** Whether this card is the currently selected one. Drives morph + action-row visibility. */
  isActive: boolean;
  /** Zero-based index — used for aria-label, roving tabindex, and image priority. */
  index: number;
  /** Total count in the carousel — used for aria-label "n of N". */
  total: number;
  /** Click handler — triggers flyTo + activation. */
  onClick: () => void;
  /** Pointer-enter pre-loads the featured image (Safari morph-FOUC mitigation). */
  onPointerEnter?: () => void;
  /** Slug for the area, used to build the "Les mer"-link. Null disables. */
  areaSlug?: string | null;
  /** Priority loading hint — applied to the first ~3 cards. */
  priority?: boolean;
}

/**
 * One card in the map-modal bottom carousel. Single component, `isActive`-prop
 * drives morph and action-row visibility (matches the `ReportPOICard`/
 * `ReportHighlightCard` pattern).
 */
const ReportMapBottomCard = forwardRef<HTMLButtonElement, ReportMapBottomCardProps>(
  function ReportMapBottomCard(
    { poi, isActive, index, total, onClick, onPointerEnter, areaSlug, priority },
    ref,
  ) {
    const [imageError, setImageError] = useState(false);
    const CategoryIcon = getIcon(poi.category.icon);
    const walkMinutes = poi.travelTime?.walk
      ? Math.round(poi.travelTime.walk / 60)
      : null;

    const imageUrl = poi.featuredImage
      ? poi.featuredImage.includes("mymaps.usercontent.google.com")
        ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
        : poi.featuredImage
      : null;
    const showImage = Boolean(imageUrl) && !imageError;

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
        onPointerEnter={onPointerEnter}
        className={`
          map-modal-card
          ${isActive ? "map-modal-card--active" : ""}
          relative shrink-0 snap-start w-[220px] md:w-[240px] rounded-xl overflow-hidden
          bg-white border text-left cursor-pointer
          transition-[border-color,background-color] duration-150
          ${isActive ? "border-[#b45309] border-2" : "border-[#eae6e1] hover:border-[#d4cfc8]"}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b45309] focus-visible:ring-offset-2
        `}
      >
        {/* Image / fallback */}
        <div className="relative aspect-[16/10] bg-[#f5f1ec] overflow-hidden">
          {showImage ? (
            // Using <img> by design: next/image mid-carousel creates CLS issues
            // with horizontal scrolling + morph. Pre-loading via pointer-enter
            // + aspect-ratio stability covers the FOUC concern.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl!}
              alt=""
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: `${poi.category.color}18` }}
            >
              <CategoryIcon className="w-8 h-8" style={{ color: poi.category.color }} />
            </div>
          )}

          {walkMinutes != null && (
            <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-sm text-[11px] font-medium text-[#1a1a1a] shadow-sm">
              <MapPin className="w-2.5 h-2.5 text-[#7a7062]" />
              {walkMinutes} min
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-2.5 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] uppercase tracking-[0.18em] font-medium text-[#a0937d] truncate">
              {poi.category.name}
            </p>
            {poi.googleRating != null && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#3a3530] shrink-0">
                <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                {poi.googleRating.toFixed(1)}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-[13px] leading-snug text-[#1a1a1a] tracking-tight line-clamp-2">
            {poi.name}
          </h4>

          {/* Action row — only on active card */}
          {isActive && (
            <div
              className="flex items-center gap-1.5 pt-1.5 mt-0.5 border-t border-[#eae6e1]"
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
