"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { POI } from "@/lib/types";

export interface OpeningHoursData {
  isOpen?: boolean;
  openingHours?: string[];
}

export function useOpeningHours(visiblePOIs: POI[]) {
  const [hoursData, setHoursData] = useState<Map<string, OpeningHoursData>>(new Map());
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const poisToFetch = visiblePOIs
      .filter((p) => p.googlePlaceId && !fetchedRef.current.has(p.id))
      .slice(0, 10);

    if (poisToFetch.length === 0) return;

    const timer = setTimeout(async () => {
      setLoading(true);

      // Mark as fetched immediately to avoid duplicate requests
      for (const poi of poisToFetch) {
        fetchedRef.current.add(poi.id);
      }

      // Fetch in batches of 5 concurrent
      const batchSize = 5;
      for (let i = 0; i < poisToFetch.length; i += batchSize) {
        const batch = poisToFetch.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (poi) => {
            const res = await fetch(`/api/places/${poi.googlePlaceId}`);
            if (!res.ok) return null;
            const data = await res.json();
            return { poiId: poi.id, data: { isOpen: data.isOpen, openingHours: data.openingHours } };
          })
        );

        setHoursData((prev) => {
          const next = new Map(prev);
          for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
              next.set(result.value.poiId, result.value.data);
            }
          }
          return next;
        });
      }

      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [visiblePOIs]);

  return { hoursData, loading };
}
