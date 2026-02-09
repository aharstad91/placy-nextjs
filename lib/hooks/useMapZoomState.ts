"use client";

import { useEffect, useRef } from "react";
import type { MapRef } from "react-map-gl/mapbox";

export type ZoomState = "dot" | "icon" | "icon-rating" | "full-label";

function computeZoomState(zoom: number): ZoomState {
  console.log(`[zoom] ${zoom.toFixed(2)}`);
  if (zoom < 13) return "dot";
  return "icon";
}

/**
 * Writes `data-zoom-state` to a container element based on the map's current zoom.
 *
 * Uses a DOM attribute instead of React state so that zoom boundary crossings
 * don't trigger React re-renders for all markers. CSS descendant selectors
 * in globals.css handle visibility toggling.
 *
 * Also writes `data-label-budget-exceeded` when more than `labelBudget` markers
 * are visible at full-label zoom, suppressing labels for non-active/hovered markers.
 */
export function useMapZoomState(
  mapRef: React.RefObject<MapRef | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  options?: {
    /** Max markers before suppressing labels (default: Infinity = disabled) */
    labelBudget?: number;
    /** Pass true after map onLoad to trigger hook activation */
    mapLoaded?: boolean;
    /** Total marker count — used for label budget check without DOM queries */
    markerCount?: number;
  }
): void {
  const lastStateRef = useRef<string>("full-label");
  const lastBudgetRef = useRef<boolean>(false);
  const labelBudget = options?.labelBudget ?? Infinity;
  const mapLoaded = options?.mapLoaded ?? true;
  const markerCount = options?.markerCount ?? 0;

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !containerRef.current) return;

    const updateState = () => {
      const state = computeZoomState(map.getZoom());
      if (state !== lastStateRef.current) {
        lastStateRef.current = state;
        if (containerRef.current) {
          containerRef.current.dataset.zoomState = state;
        }
      }

      // Label budget: when at full-label zoom with many markers, suppress labels
      // CSS rules for [data-label-budget-exceeded="true"] hide labels
      // except for active/hovered markers (see globals.css)
      if (labelBudget < Infinity) {
        const exceeded = state === "full-label" && markerCount > labelBudget;
        if (exceeded !== lastBudgetRef.current) {
          lastBudgetRef.current = exceeded;
          if (containerRef.current) {
            containerRef.current.dataset.labelBudgetExceeded = String(exceeded);
          }
        }
      }
    };

    // Set initial state
    updateState();

    map.on("zoom", updateState);
    return () => {
      map.off("zoom", updateState);
    };
  }, [mapRef, containerRef, labelBudget, mapLoaded, markerCount]);
}
