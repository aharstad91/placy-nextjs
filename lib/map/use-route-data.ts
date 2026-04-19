"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import type { POI } from "@/lib/types";

/**
 * Delt walking-rute-hook for UnifiedMapModal.
 *
 * - AbortController: cancel forrige fetch ved rask POI-switch (AC-19)
 * - Zod-validering: maks 500 coords, finite numbers (AC-20, DoS-guard)
 * - 200ms debounce: forhindrer API-spam ved rask klikking (AC-21)
 * - Silent på feil (AC-11): caller beslutter UI, ingen toast
 *
 * Cache-strategi V1: single-slot (useState nullstilles ved ny activePOI).
 * Post-V1: LRU keyed på `${poi.id}|${project.lat},${project.lng}` hvis behov.
 */

const DirectionsResponseSchema = z.object({
  geometry: z.object({
    coordinates: z
      .array(z.tuple([z.number().finite(), z.number().finite()]))
      .min(2)
      .max(500),
    type: z.literal("LineString"),
  }),
  duration: z.number().nonnegative(),
});

export type RouteData = {
  /** Koordinater i `{lat, lng}`-form — defensivt mot lat/lng-bytte. */
  coordinates: ReadonlyArray<{ lat: number; lng: number }>;
  /** Reisetid i minutter (Mapbox-responsen er allerede konvertert til min). */
  travelMinutes: number;
};

const DEBOUNCE_MS = 200;

export function useRouteData(
  activePOI: POI | null,
  projectCenter: { lat: number; lng: number },
): { data: RouteData | null; error: Error | null } {
  const [data, setData] = useState<RouteData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Ingen aktiv POI → clear state, ingen fetch.
    if (!activePOI) {
      setData(null);
      setError(null);
      return;
    }

    // Capture verdier lokalt så closure ikke leker over re-render.
    const origin = `${projectCenter.lng},${projectCenter.lat}`;
    const destination = `${activePOI.coordinates.lng},${activePOI.coordinates.lat}`;
    const controller = new AbortController();

    const debounceTimer = setTimeout(() => {
      fetch(
        `/api/directions?origin=${origin}&destination=${destination}&profile=walking`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (!res.ok) throw new Error(`directions ${res.status}`);
          return res.json();
        })
        .then((raw) => {
          const parsed = DirectionsResponseSchema.safeParse(raw);
          if (!parsed.success) {
            // Logg uten koordinater for å unngå PII-lekkasje
            console.warn(
              "[useRouteData] Invalid directions response shape",
              parsed.error.issues.length,
              "issues",
            );
            setData(null);
            setError(new Error("Invalid directions response"));
            return;
          }
          // Konverter [lng, lat] → {lat, lng}
          const coords = parsed.data.geometry.coordinates.map(
            ([lng, lat]) => ({ lat, lng }),
          );
          setData({
            coordinates: coords,
            travelMinutes: parsed.data.duration,
          });
          setError(null);
        })
        .catch((err: Error) => {
          // AbortError → silent (forventet ved rask switch)
          if (err.name === "AbortError") return;
          console.warn("[useRouteData] Route fetch failed:", err.message);
          setError(err);
          setData(null);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [
    activePOI,
    projectCenter.lat,
    projectCenter.lng,
  ]);

  return { data, error };
}
