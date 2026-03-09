"use client";

import React, { useRef, useEffect } from "react";
import { Marker, type MarkerEvent } from "react-map-gl/mapbox";
import type { POI } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/utils/map-icons";
import { MapPin, Clock, Calendar, X } from "lucide-react";

/** Format "2026-05-25" → "søn. 25. mai" */
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  return `${days[d.getDay()]}. ${d.getDate()}. ${months[d.getMonth()]}`;
}

/** Sort key: first event date + start time → "2026-05-25 10:00" */
function eventSortKey(poi: POI): string {
  const date = poi.eventDates?.[0] ?? "9999-99-99";
  const time = poi.eventTimeStart ?? "99:99";
  return `${date} ${time}`;
}

interface VenueClusterMarkerProps {
  /** All POIs at this venue (same coordinates) */
  pois: POI[];
  /** Whether the popup event list is expanded */
  isExpanded: boolean;
  /** Whether one of the child POIs is the active POI */
  hasActivePOI: boolean;
  /** z-index for stacking */
  zIndex?: number;
  /** Toggle popup */
  onClick: (e: MarkerEvent<MouseEvent>) => void;
  /** Select a specific event from the popup */
  onSelectEvent: (poiId: string) => void;
  /** Close popup */
  onClose: () => void;
}

/**
 * Map marker for venues with multiple events.
 * Shows a count badge and venue name. When clicked, expands a popover
 * listing all events at the venue for selection.
 */
export const VenueClusterMarker = React.memo(
  function VenueClusterMarker({
    pois,
    isExpanded,
    hasActivePOI,
    zIndex = 1,
    onClick,
    onSelectEvent,
    onClose,
  }: VenueClusterMarkerProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const popupContentRef = useRef<HTMLDivElement>(null);
    const firstPoi = pois[0];
    const venueName =
      (firstPoi.poiMetadata?.venue as string) || firstPoi.name;

    // Dominant category (most frequent)
    const dominantCategory = getDominantCategory(pois);
    const Icon = getIcon(dominantCategory.icon);

    // Close popup on outside click
    useEffect(() => {
      if (!isExpanded) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      // Delay to avoid capturing the opening click
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 50);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isExpanded, onClose]);

    // Native event delegation for popup clicks.
    // react-map-gl Marker uses native addEventListener on the marker wrapper,
    // so React's stopPropagation doesn't prevent the Marker onClick from firing.
    // We attach a native bubble-phase handler that:
    // 1. Stops propagation to the Marker wrapper
    // 2. Identifies which element was clicked via data attributes
    useEffect(() => {
      const el = popupContentRef.current;
      if (!isExpanded || !el) return;

      const handleClick = (e: Event) => {
        e.stopPropagation();
        const target = e.target as HTMLElement;
        const poiButton = target.closest("[data-poi-id]");
        if (poiButton) {
          const poiId = poiButton.getAttribute("data-poi-id");
          if (poiId) onSelectEvent(poiId);
          return;
        }
        const closeButton = target.closest("[data-close]");
        if (closeButton) onClose();
      };

      const stopWheel = (e: Event) => e.stopPropagation();

      el.addEventListener("click", handleClick);
      el.addEventListener("wheel", stopWheel);
      el.addEventListener("touchmove", stopWheel, { passive: false });
      return () => {
        el.removeEventListener("click", handleClick);
        el.removeEventListener("wheel", stopWheel);
        el.removeEventListener("touchmove", stopWheel);
      };
    }, [isExpanded, onSelectEvent, onClose]);

    const truncatedVenue =
      venueName.length > 20 ? venueName.slice(0, 18) + "…" : venueName;

    return (
      <Marker
        longitude={firstPoi.coordinates.lng}
        latitude={firstPoi.coordinates.lat}
        anchor="center"
        style={{ zIndex: isExpanded ? 100 : zIndex }}
        onClick={onClick}
      >
        <div ref={popupRef} className="relative">
          {/* ── Cluster marker button ── */}
          <button
            type="button"
            className={cn(
              "venue-cluster adaptive-marker relative flex items-center gap-1.5 cursor-pointer",
              "transition-transform duration-150 ease-out",
              hasActivePOI && "adaptive-marker--active",
            )}
            aria-label={`${venueName}, ${pois.length} arrangementer`}
          >
            {/* ── Dot layer (visible at dot state) ── */}
            <div
              className="adaptive-marker__dot rounded-full transition-opacity duration-150 ease-out"
              style={{ backgroundColor: dominantCategory.color }}
            />

            {/* ── Icon circle with count badge ── */}
            <div
              className={cn(
                "adaptive-marker__icon relative flex items-center justify-center rounded-full border-2 border-white shadow-md",
                "transition-opacity duration-150 ease-out"
              )}
              style={{ backgroundColor: dominantCategory.color }}
            >
              <Icon className="w-4 h-4 text-white" />

              {/* Pulsing ring when active */}
              {hasActivePOI && (
                <div
                  className="absolute inset-0 rounded-full marker-pulse-ring"
                  style={{ backgroundColor: dominantCategory.color }}
                />
              )}
            </div>

            {/* ── Count badge (visible whenever icon is visible) ── */}
            <div className="adaptive-marker__count absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] bg-gray-800 rounded-full border-2 border-white flex items-center justify-center transition-opacity duration-150 ease-out">

              <span className="text-[10px] font-bold text-white leading-none px-0.5">
                {pois.length}
              </span>
            </div>

            {/* ── Venue name label (visible at full-label state) ── */}
            <div className="adaptive-marker__label flex flex-col leading-tight transition-opacity duration-150 ease-out">
              <span className="text-[13px] font-semibold text-gray-900 whitespace-nowrap">
                {truncatedVenue}
              </span>
              <span className="text-[11px] text-gray-500 whitespace-nowrap">
                {pois.length} arrangementer
              </span>
            </div>
          </button>

          {/* ── Expanded popup: event list ── */}
          {isExpanded && (
            <div
              ref={popupContentRef}
              className={cn(
                "absolute left-1/2 -translate-x-1/2 bottom-full mb-3",
                "bg-white rounded-xl shadow-2xl border border-gray-200",
                "w-72 max-h-80 flex flex-col",
                "animate-in fade-in slide-in-from-bottom-2 duration-200",
                "z-[200]"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {venueName}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {pois.length} arrangementer
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-close
                  className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Event list — sorted by date then time */}
              <div className="overflow-y-auto overscroll-contain">
                {[...pois].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))).map((poi) => {
                  const dateLabel = poi.eventDates?.[0] ? formatShortDate(poi.eventDates[0]) : null;
                  return (
                    <button
                      key={poi.id}
                      type="button"
                      data-poi-id={poi.id}
                      className="w-full px-3 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 active:bg-gray-100 text-left border-b border-gray-50 last:border-b-0 transition-colors cursor-pointer"
                    >
                      {/* Category dot */}
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: poi.category.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
                          {poi.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {dateLabel && (
                            <span className="text-xs text-gray-500 flex items-center gap-0.5">
                              <Calendar className="w-3 h-3" />
                              {dateLabel}
                            </span>
                          )}
                          {(poi.eventTimeStart || poi.eventTimeEnd) && (
                            <span className="text-xs text-gray-500 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {poi.eventTimeStart}
                              {poi.eventTimeEnd && `–${poi.eventTimeEnd}`}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {poi.category.name}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Marker>
    );
  },
  (prev, next) =>
    prev.pois === next.pois &&
    prev.isExpanded === next.isExpanded &&
    prev.hasActivePOI === next.hasActivePOI &&
    prev.zIndex === next.zIndex
);

/** Get the most frequent category among a set of POIs */
function getDominantCategory(pois: POI[]) {
  const counts = new Map<string, { count: number; category: POI["category"] }>();
  for (const poi of pois) {
    const entry = counts.get(poi.category.id);
    if (entry) entry.count++;
    else counts.set(poi.category.id, { count: 1, category: poi.category });
  }
  let dominant = pois[0].category;
  let maxCount = 0;
  counts.forEach(({ count, category }) => {
    if (count > maxCount) {
      maxCount = count;
      dominant = category;
    }
  });
  return dominant;
}
