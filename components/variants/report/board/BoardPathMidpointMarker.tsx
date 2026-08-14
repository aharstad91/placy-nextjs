"use client";

import { Clock } from "lucide-react";
import { Marker } from "react-map-gl/mapbox";
import { useBoardRoute } from "./board-route";
import { useBoard } from "./board-state";
import { pathMidpoint } from "./path-midpoint";

/**
 * 2D path-midpoint tids-chip. Plassert som react-map-gl `<Marker>` på midten
 * av walking-ruten — slik at chip-en sitter på selve path-en, ikke i sentrum
 * av viewporten (som var BoardTravelChip's plassering) og ikke på POI-markøren
 * (som er det som dekkes hvis chip-en plasseres ved endepunktet).
 *
 * Mapbox `<Marker>` projiserer lat/lng → screen automatisk, så chip-en følger
 * med kartet ved pan/zoom uten ekstra kode. `pointer-events-none` så vi ikke
 * blokkerer marker-klikk på POI-er som ligger nær path-midten.
 *
 * Render-gating:
 * - phase === "poi" (kun når en POI er aktiv)
 * - routeData er klar (ikke fetching/error)
 * - pathMidpoint returnerer ikke-null (path har ≥3 koordinater)
 *
 * Rutedata kommer fra `BoardRouteProvider` — samme svar som rutelinja og
 * 3D-ruten leser. Chipen fyrer altså ingen egen Directions-forespørsel.
 */
export function BoardPathMidpointMarker() {
  const { state } = useBoard();
  const { data: routeData } = useBoardRoute();

  if (state.phase !== "poi" || !routeData) return null;
  const midpoint = pathMidpoint(routeData.coordinates);
  if (!midpoint) return null;

  const minutes = Math.max(1, Math.round(routeData.travelMinutes));

  return (
    <Marker
      longitude={midpoint.lng}
      latitude={midpoint.lat}
      anchor="center"
      style={{ pointerEvents: "none", zIndex: 4 }}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 px-3 py-1.5 text-sm font-semibold text-stone-900 shadow-md backdrop-blur">
        <Clock className="h-4 w-4 text-stone-600" />
        <span>{minutes} min</span>
      </div>
    </Marker>
  );
}
