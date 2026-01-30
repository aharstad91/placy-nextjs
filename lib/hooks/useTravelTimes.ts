"use client";

import { useState, useEffect, useCallback } from "react";
import type { POI, Coordinates, TravelMode } from "@/lib/types";
import { useTravelSettings } from "@/lib/store";

interface TravelTimesResult {
  pois: POI[];
  loading: boolean;
  error: string | null;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  timestamp: number;
  travelTimes: Record<string, number | null>;
}

function getCacheKey(projectId: string, travelMode: TravelMode): string {
  return `placy-travel-times-${projectId}-${travelMode}`;
}

function getFromCache(
  projectId: string,
  travelMode: TravelMode
): Record<string, number | null> | null {
  if (typeof window === "undefined") return null;

  try {
    const key = getCacheKey(projectId, travelMode);
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    const now = Date.now();

    if (now - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.travelTimes;
  } catch {
    return null;
  }
}

function saveToCache(
  projectId: string,
  travelMode: TravelMode,
  travelTimes: Record<string, number | null>
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getCacheKey(projectId, travelMode);
    const entry: CacheEntry = {
      timestamp: Date.now(),
      travelTimes,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage errors
  }
}

export function useTravelTimes(
  projectId: string,
  projectCenter: Coordinates,
  pois: POI[]
): TravelTimesResult {
  const { travelMode } = useTravelSettings();
  const [result, setResult] = useState<TravelTimesResult>({
    pois: pois,
    loading: true,
    error: null,
  });

  const fetchTravelTimes = useCallback(async () => {
    if (!projectCenter || pois.length === 0) {
      setResult({
        pois: pois,
        loading: false,
        error: null,
      });
      return;
    }

    // Check cache first
    const cached = getFromCache(projectId, travelMode);
    if (cached) {
      const updatedPOIs = pois.map((poi) => ({
        ...poi,
        travelTime: {
          ...poi.travelTime,
          [travelMode]: cached[poi.id] ?? undefined,
        },
      }));

      setResult({
        pois: updatedPOIs,
        loading: false,
        error: null,
      });
      return;
    }

    // Fetch from API — batch into groups of 24 (Mapbox Matrix limit)
    setResult((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const profileMap: Record<TravelMode, string> = {
        walk: "walking",
        bike: "cycling",
        car: "driving",
      };

      const BATCH_SIZE = 24;
      const travelTimes: Record<string, number | null> = {};

      for (let i = 0; i < pois.length; i += BATCH_SIZE) {
        const batch = pois.slice(i, i + BATCH_SIZE);

        const response = await fetch("/api/travel-times", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: projectCenter,
            destinations: batch.map((poi) => poi.coordinates),
            profile: profileMap[travelMode],
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch travel times");
        }

        const data = await response.json();

        data.results.forEach(
          (
            result: { destinationIndex: number; durationMinutes: number | null },
          ) => {
            const poi = batch[result.destinationIndex];
            if (poi) {
              travelTimes[poi.id] = result.durationMinutes;
            }
          }
        );
      }

      // Save to cache
      saveToCache(projectId, travelMode, travelTimes);

      // Update POIs with travel times
      const updatedPOIs = pois.map((poi) => ({
        ...poi,
        travelTime: {
          ...poi.travelTime,
          [travelMode]: travelTimes[poi.id] ?? undefined,
        },
      }));

      setResult({
        pois: updatedPOIs,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching travel times:", error);
      setResult({
        pois: pois,
        loading: false,
        error: "Failed to calculate travel times",
      });
    }
  }, [projectId, projectCenter, pois, travelMode]);

  useEffect(() => {
    fetchTravelTimes();
  }, [fetchTravelTimes]);

  return result;
}
