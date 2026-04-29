"use client";

import { Clock } from "lucide-react";
import { useRouteData } from "@/lib/map/use-route-data";
import { useBoard, useActivePOI } from "./board-state";

/**
 * HTML-overlay som viser walking-tid fra Home til aktiv POI.
 *
 * Plassering: bunn-senter, like over default-snap-point for POI-sheet (50dvh).
 * Skjules når routeData ikke er klar — spec sier "vis chip når data er truthy
 * og phase === 'poi'" som unngår behov for skeleton-state.
 *
 * NB: Hooket re-fetches inne her i tillegg til BoardPathLayer. `useRouteData`
 * er memoisert per `(activePOI, projectCenter)` så React 18 dedupliserer
 * setStates, men det betyr to fetcher. For prototype-stadium er dette OK;
 * ved behov kan dette løftes til en delt context senere.
 */
export function BoardTravelChip() {
  const { state, data } = useBoard();
  const activePOI = useActivePOI();

  const poiForRoute = state.phase === "poi" && activePOI ? activePOI.raw : null;
  const { data: routeData } = useRouteData(poiForRoute, data.home.coordinates);

  if (state.phase !== "poi" || !routeData) return null;

  const minutes = Math.max(1, Math.round(routeData.travelMinutes));

  return (
    <div
      className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
      style={{ bottom: "calc(50dvh + 16px)" }}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 px-3 py-1.5 text-sm font-semibold text-stone-900 shadow-md backdrop-blur">
        <Clock className="h-4 w-4 text-stone-600" />
        <span>{minutes} min</span>
      </div>
    </div>
  );
}
