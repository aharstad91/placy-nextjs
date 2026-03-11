"use client";

import { useMemo } from "react";
import type { POI } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock, MapPin, Compass, SlidersHorizontal } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface KompassTimelineProps {
  events: POI[];
  activePOI: string | null;
  onPOIClick: (poiId: string) => void;
  onEditFilter: () => void;
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

/**
 * Extract a price label from eventTags.
 * Looks for "Gratis" or price patterns like "520,-"
 */
function getPriceLabel(eventTags?: string[]): string | null {
  if (!eventTags || eventTags.length === 0) return null;
  const priceTag = eventTags.find(
    (t) => t === "Gratis" || /^\d/.test(t) || t.includes("kr")
  );
  return priceTag ?? null;
}

function getIcon(iconName: string): LucideIcons.LucideIcon {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
  return Icon || LucideIcons.MapPin;
}

export default function KompassTimeline({
  events,
  activePOI,
  onPOIClick,
  onEditFilter,
}: KompassTimelineProps) {
  const timeGroups = useMemo(() => groupByTime(events), [events]);

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
                  const priceLabel = getPriceLabel(event.eventTags);
                  const CategoryIcon = getIcon(event.category.icon);

                  return (
                    <button
                      key={event.id}
                      onClick={() => onPOIClick(event.id)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3.5 transition-all",
                        isActive
                          ? "border-sky-300 bg-sky-50/50 ring-1 ring-sky-400 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                      )}
                    >
                      <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-1.5">
                        {event.name}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {event.address ?? "Ukjent sted"}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span
                          className="flex items-center gap-1 text-xs font-medium"
                          style={{ color: event.category.color }}
                        >
                          <CategoryIcon className="w-3 h-3" />
                          {event.category.name}
                        </span>
                        {priceLabel && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className={cn(
                              "text-xs font-medium",
                              priceLabel === "Gratis" ? "text-green-600" : "text-gray-600"
                            )}>
                              {priceLabel}
                            </span>
                          </>
                        )}
                      </div>
                      {event.eventTimeEnd && (
                        <p className="text-xs text-gray-400 mt-1">
                          {event.eventTimeStart}–{event.eventTimeEnd}
                        </p>
                      )}
                    </button>
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
