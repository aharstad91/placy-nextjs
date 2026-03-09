import { useMemo } from "react";
import type { POI } from "@/lib/types";

/**
 * Filters POIs by selected event day.
 * POIs without eventDates are treated as "available all days" (permanent venues).
 *
 * Placed in the pipeline between basePOIs and poisWithTravelTimes to reduce
 * travel time API calls for filtered-out POIs.
 */
export function useEventDayFilter(
  pois: POI[],
  selectedDay: string | null
): POI[] {
  return useMemo(() => {
    if (!selectedDay) return pois;
    return pois.filter((poi) => {
      // POIs without eventDates are always visible (permanent venues)
      if (!poi.eventDates || poi.eventDates.length === 0) return true;
      return poi.eventDates.includes(selectedDay);
    });
  }, [pois, selectedDay]);
}

/**
 * Extract unique event days from POIs, sorted chronologically.
 */
export function useEventDays(pois: POI[]): string[] {
  return useMemo(() => {
    const days = new Set<string>();
    for (const poi of pois) {
      if (poi.eventDates) {
        for (const d of poi.eventDates) {
          days.add(d);
        }
      }
    }
    return Array.from(days).sort();
  }, [pois]);
}

/**
 * Format a date string (YYYY-MM-DD) to a short Norwegian label.
 * e.g. "2026-04-18" → "Lør 18. apr"
 */
export function formatEventDay(
  dateStr: string,
  dayLabels?: Record<string, string>
): string {
  if (dayLabels?.[dateStr]) return dayLabels[dateStr];
  try {
    const date = new Date(dateStr + "T12:00:00");
    const dayName = date.toLocaleDateString("nb-NO", { weekday: "short" });
    const day = date.getDate();
    const month = date.toLocaleDateString("nb-NO", { month: "short" });
    // Capitalize first letter
    return `${dayName.charAt(0).toUpperCase()}${dayName.slice(1)} ${day}. ${month}`;
  } catch {
    return dateStr;
  }
}
