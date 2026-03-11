import { useMemo } from "react";
import type { POI } from "@/lib/types";
import type { TimeSlot } from "@/lib/kompass-store";

interface KompassResult {
  /** Events matching all criteria, sorted chronologically */
  recommended: POI[];
  /** Recommended POI IDs as a Set (for map highlighting) */
  recommendedIds: Set<string>;
}

/**
 * Filter and sort events based on Kompass preferences.
 * Returns recommended (matching) events sorted chronologically.
 */
export function useKompassFilter(
  pois: POI[],
  selectedThemes: string[],
  selectedDay: string | null,
  selectedTimeSlots: TimeSlot[]
): KompassResult {
  return useMemo(() => {
    // Only consider POIs with event dates
    const events = pois.filter(
      (poi) => poi.eventDates && poi.eventDates.length > 0
    );

    // If no filters set, return all events as recommended
    if (selectedThemes.length === 0 && !selectedDay && selectedTimeSlots.length === 0) {
      const sorted = [...events].sort((a, b) => {
        const timeA = a.eventTimeStart ?? "99:99";
        const timeB = b.eventTimeStart ?? "99:99";
        return timeA.localeCompare(timeB);
      });
      return {
        recommended: sorted,
        recommendedIds: new Set(sorted.map((p) => p.id)),
      };
    }

    const recommended = events.filter((poi) => {
      // Theme filter (category ID match)
      if (selectedThemes.length > 0 && !selectedThemes.includes(poi.category.id)) {
        return false;
      }

      // Day filter
      if (selectedDay && poi.eventDates) {
        if (!poi.eventDates.includes(selectedDay)) {
          return false;
        }
      }

      // Time of day filter
      if (selectedTimeSlots.length > 0) {
        const startTime = poi.eventTimeStart;
        if (!startTime) return true; // Include events without time info

        const hour = parseInt(startTime.split(":")[0], 10);
        if (isNaN(hour)) return true;

        const matchesTime = selectedTimeSlots.some((slot) => {
          switch (slot) {
            case "morning":
              return hour < 12;
            case "afternoon":
              return hour >= 12 && hour < 17;
            case "evening":
              return hour >= 17;
          }
        });
        if (!matchesTime) return false;
      }

      return true;
    });

    // Sort chronologically by start time
    recommended.sort((a, b) => {
      const timeA = a.eventTimeStart ?? "99:99";
      const timeB = b.eventTimeStart ?? "99:99";
      return timeA.localeCompare(timeB);
    });

    return {
      recommended,
      recommendedIds: new Set(recommended.map((p) => p.id)),
    };
  }, [pois, selectedThemes, selectedDay, selectedTimeSlots]);
}
