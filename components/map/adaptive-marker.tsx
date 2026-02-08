"use client";

import React from "react";
import { Marker, type MarkerEvent } from "react-map-gl/mapbox";
import type { POI } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/utils/map-icons";
import { shouldShowRating } from "@/lib/themes/rating-categories";

export interface AdaptiveMarkerProps {
  poi: POI;
  isActive?: boolean;
  isHovered?: boolean;
  onClick?: (e: MarkerEvent<MouseEvent>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  zIndex?: number;
  /** Slot for product-specific overlays (tooltips, info pills) */
  children?: React.ReactNode;
}

/**
 * Zoom-adaptive map marker that renders four visual states:
 *   dot → icon → icon-rating → full-label
 *
 * Visibility is driven by a `data-zoom-state` attribute on a parent
 * container (set by useMapZoomState), not by React state. This means
 * zoom boundary crossings cause zero React re-renders.
 *
 * CSS rules in globals.css toggle opacity of each sub-element.
 */
export const AdaptiveMarker = React.memo(
  function AdaptiveMarker({
    poi,
    isActive = false,
    isHovered = false,
    onClick,
    onMouseEnter,
    onMouseLeave,
    zIndex = 1,
    children,
  }: AdaptiveMarkerProps) {
    const Icon = getIcon(poi.category.icon);
    const showRating =
      shouldShowRating(poi.category.id) &&
      poi.googleRating != null &&
      poi.googleRating > 0;

    const truncatedName =
      poi.name.length > 18 ? poi.name.slice(0, 16) + "…" : poi.name;

    return (
      <Marker
        longitude={poi.coordinates.lng}
        latitude={poi.coordinates.lat}
        anchor="center"
        style={{ zIndex }}
        onClick={onClick}
      >
        <button
          type="button"
          className={cn(
            "adaptive-marker relative flex items-center gap-1.5 cursor-pointer",
            "transition-transform duration-150 ease-out",
            isActive && "adaptive-marker--active",
            isHovered && "adaptive-marker--hover"
          )}
          aria-label={`${poi.name}, ${poi.category.name}`}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {/* ── Dot layer (visible at dot state) ── */}
          <div
            className="adaptive-marker__dot rounded-full transition-opacity duration-150 ease-out"
            style={{ backgroundColor: poi.category.color }}
          />

          {/* ── Icon circle (visible at icon+ states) ── */}
          <div
            className={cn(
              "adaptive-marker__icon relative flex items-center justify-center rounded-full border-2 border-white shadow-md",
              "transition-opacity duration-150 ease-out"
            )}
            style={{ backgroundColor: poi.category.color }}
          >
            <Icon className="w-4 h-4 text-white" />

            {/* Pulsing ring for active marker */}
            {isActive && (
              <div
                className="absolute inset-0 rounded-full marker-pulse-ring"
                style={{ backgroundColor: poi.category.color }}
              />
            )}
          </div>

          {/* ── Rating badge (visible at icon-rating+ states) ── */}
          {showRating && (
            <div className="adaptive-marker__rating absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] bg-green-600 rounded-full border-2 border-white flex items-center justify-center transition-opacity duration-150 ease-out">
              <span className="text-[10px] font-bold text-white leading-none px-0.5">
                {poi.googleRating!.toFixed(1)}
              </span>
            </div>
          )}

          {/* ── Name + category label (visible at full-label state) ── */}
          <div className="adaptive-marker__label flex flex-col leading-tight transition-opacity duration-150 ease-out">
            <span className="text-[13px] font-semibold text-gray-900 whitespace-nowrap">
              {truncatedName}
            </span>
            <span className="text-[11px] text-gray-500 whitespace-nowrap">
              {poi.category.name}
            </span>
          </div>

          {/* ── Editorial sparkle badge ── */}
          {poi.editorialHook && !isActive && (
            <div className="adaptive-marker__sparkle absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border border-white flex items-center justify-center transition-opacity duration-150 ease-out">
              <svg
                className="w-2.5 h-2.5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16l-6.4 5.2L8 14 2 9.2h7.6z" />
              </svg>
            </div>
          )}
        </button>

        {/* Product-specific overlays (tooltips, info pills) */}
        {children}
      </Marker>
    );
  },
  (prev, next) =>
    prev.poi.id === next.poi.id &&
    prev.isActive === next.isActive &&
    prev.isHovered === next.isHovered &&
    prev.zIndex === next.zIndex
);
