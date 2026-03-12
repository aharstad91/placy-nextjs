"use client";

import { useMemo, useRef, useEffect, useCallback } from "react";
import type { POI, TravelMode } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import { Clock, Compass, SlidersHorizontal } from "lucide-react";
import ExplorerPOICard from "./ExplorerPOICard";

interface KompassTimelineProps {
  events: POI[];
  activePOI: string | null;
  onPOIClick: (poiId: string) => void;
  onEditFilter: () => void;
  // Card props (same as ExplorerPOICard needs)
  openingHoursData?: Map<string, OpeningHoursData>;
  travelTimesLoading?: boolean;
  travelMode?: TravelMode;
  collectionPOIs?: string[];
  onToggleCollection?: (poiId: string) => void;
  showBookmarkHeartOnly?: boolean;
  areaSlug?: string | null;
}

/**
 * Group events by start time for the timeline display.
 */
function groupByTime(events: POI[]): Map<string, POI[]> {
  const groups = new Map<string, POI[]>();
  for (const event of events) {
    const time = event.eventTimeStart ?? "Ukjent tid";
    const existing = groups.get(time) ?? [];
    existing.push(event);
    groups.set(time, existing);
  }
  return groups;
}

export default function KompassTimeline({
  events,
  activePOI,
  onPOIClick,
  onEditFilter,
  openingHoursData,
  travelTimesLoading,
  travelMode = "walk",
  collectionPOIs = [],
  onToggleCollection,
  showBookmarkHeartOnly,
  areaSlug,
}: KompassTimelineProps) {
  const timeGroups = useMemo(() => groupByTime(events), [events]);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to active POI when it changes
  useEffect(() => {
    if (!activePOI) return;
    const cardEl = cardRefs.current.get(activePOI);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activePOI]);

  const setCardRef = useCallback(
    (poiId: string) => (el: HTMLDivElement | null) => {
      if (el) {
        cardRefs.current.set(poiId, el);
      } else {
        cardRefs.current.delete(poiId);
      }
    },
    []
  );

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
        <Compass className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-base font-semibold text-gray-700 mb-1">
          Ingen events matcher
        </h3>
        <p className="text-sm text-gray-400 mb-5 max-w-[260px]">
          Prøv å velge flere temaer, en annen dag, eller et annet tidspunkt.
        </p>
        <button
          onClick={onEditFilter}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Endre filter
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Edit filter link */}
      <button
        onClick={onEditFilter}
        className="flex items-center gap-1.5 mb-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Endre filter
      </button>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />

        <div className="space-y-1">
          {Array.from(timeGroups.entries()).map(([time, groupEvents]) => (
            <div key={time} className="relative">
              {/* Time node */}
              <div className="flex items-center gap-3 mb-2">
                <div className="relative z-10 w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
                  {time === "Ukjent tid" ? time : time.replace(".", ":")}
                </span>
              </div>

              {/* Events at this time */}
              <div className="ml-3 pl-6 border-l border-transparent space-y-2 pb-4">
                {groupEvents.map((event) => {
                  const isActive = activePOI === event.id;

                  return (
                    <div
                      key={event.id}
                      ref={setCardRef(event.id)}
                      className={cn(
                        "rounded-xl border overflow-hidden transition-all duration-300",
                        isActive
                          ? "border-sky-200 ring-2 ring-sky-500 ring-offset-1 shadow-md"
                          : "border-gray-200"
                      )}
                    >
                      <ExplorerPOICard
                        poi={event}
                        isActive={isActive}
                        onClick={() => onPOIClick(event.id)}
                        openingHours={openingHoursData?.get(event.id)}
                        travelTimesLoading={travelTimesLoading}
                        travelMode={travelMode}
                        isInCollection={collectionPOIs.includes(event.id)}
                        onToggleCollection={onToggleCollection}
                        showBookmarkHeartOnly={showBookmarkHeartOnly}
                        areaSlug={areaSlug}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
