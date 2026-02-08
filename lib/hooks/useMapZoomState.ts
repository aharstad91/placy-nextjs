"use client";

import { useEffect, useRef } from "react";
import type { MapRef } from "react-map-gl/mapbox";

export type ZoomState = "dot" | "icon" | "icon-rating" | "full-label";

function computeZoomState(zoom: number): ZoomState {
  if (zoom < 11) return "dot";
  if (zoom < 13) return "icon";
  if (zoom < 15) return "icon-rating";
  return "full-label";
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
  options?: { labelBudget?: number }
): void {
  const lastStateRef = useRef<string>("full-label");
  const labelBudget = options?.labelBudget ?? 15;

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !containerRef.current) return;

    // Set initial state
    const initialState = computeZoomState(map.getZoom());
    lastStateRef.current = initialState;
    containerRef.current.dataset.zoomState = initialState;

    const onZoom = () => {
      const state = computeZoomState(map.getZoom());
      if (state !== lastStateRef.current) {
        lastStateRef.current = state;
        if (containerRef.current) {
          containerRef.current.dataset.zoomState = state;
        }
      }
    };

    map.on("zoom", onZoom);
    return () => {
      map.off("zoom", onZoom);
    };
  }, [mapRef, containerRef, labelBudget]);
}
