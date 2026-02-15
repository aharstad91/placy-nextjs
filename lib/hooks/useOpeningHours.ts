"use client";

import { useMemo } from "react";
import type { POI } from "@/lib/types";

export interface OpeningHoursData {
  isOpen?: boolean;
  openingHours?: string[];
}

/**
 * Parse cached opening hours from POI data.
 *
 * Reads from poi.openingHoursJson (cached in Supabase) instead of
 * making runtime Google Places API calls. Computes isOpen client-side
 * from weekday_text to avoid stale snapshot values.
 */
export function useOpeningHours(visiblePOIs: POI[]) {
  const hoursData = useMemo(() => {
    const map = new Map<string, OpeningHoursData>();

    for (const poi of visiblePOIs) {
      const weekdayText = poi.openingHoursJson?.weekday_text;
      if (!weekdayText || weekdayText.length === 0) continue;

      map.set(poi.id, {
        openingHours: weekdayText,
        isOpen: computeIsOpen(weekdayText),
      });
    }

    return map;
  }, [visiblePOIs]);

  return { hoursData, loading: false };
}

/**
 * Compute whether a place is currently open from weekday_text.
 *
 * Google's weekday_text format: "Monday: 8:00 AM – 5:00 PM"
 * Returns undefined if hours cannot be parsed.
 */
function computeIsOpen(weekdayText: string[]): boolean | undefined {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const now = new Date();
  const todayName = days[now.getDay()];

  const todayLine = weekdayText.find((line) =>
    line.toLowerCase().startsWith(todayName.toLowerCase())
  );

  if (!todayLine) return undefined;

  // "Monday: Closed" or "Monday: Open 24 hours"
  const lower = todayLine.toLowerCase();
  if (lower.includes("closed")) return false;
  if (lower.includes("open 24 hours")) return true;

  // Parse time range: "Monday: 8:00 AM – 5:00 PM"
  // May have multiple ranges: "8:00 AM – 12:00 PM, 1:00 PM – 5:00 PM"
  const timePart = todayLine.split(": ").slice(1).join(": ");
  if (!timePart) return undefined;

  const ranges = timePart.split(",").map((r) => r.trim());
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const range of ranges) {
    const match = range.match(
      /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );
    if (!match) continue;

    const openMinutes = toMinutes(
      parseInt(match[1]),
      parseInt(match[2]),
      match[3].toUpperCase()
    );
    const closeMinutes = toMinutes(
      parseInt(match[4]),
      parseInt(match[5]),
      match[6].toUpperCase()
    );

    // Handle overnight (e.g., 6:00 PM – 2:00 AM)
    if (closeMinutes <= openMinutes) {
      if (currentMinutes >= openMinutes || currentMinutes < closeMinutes) return true;
    } else {
      if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) return true;
    }
  }

  return false;
}

function toMinutes(hours: number, minutes: number, ampm: string): number {
  let h = hours;
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + minutes;
}
