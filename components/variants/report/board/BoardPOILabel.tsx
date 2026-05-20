"use client";

import { Marker } from "react-map-gl/mapbox";
import { useBoard, useActivePOI } from "./board-state";
import { useBoardPopupMode } from "./use-popup-mode";

/**
 * Tekst-label som peker på aktiv POI på kartet.
 *
 * Bruker `<Marker>` fra react-map-gl/mapbox med anchor="bottom" og en
 * vertikal offset oppover så labelen sitter over POI-markøren. Marker
 * håndterer projeksjon og pan/zoom-følging selv — vi trenger ikke
 * `mapRef.project()`-roundtrip eller move-event-listener.
 *
 * z-index satt høyt slik at labelen vises over andre POI-markører.
 */
export function BoardPOILabel() {
  const { state } = useBoard();
  const activePOI = useActivePOI();
  const popupMode = useBoardPopupMode();

  if (state.phase !== "poi" || !activePOI) return null;
  // I mini-popup-mode tar BoardPOIMiniPopup over navn-visningen — skipp pillen
  // for å unngå dobbel-label rett over markøren.
  if (popupMode === "mini") return null;

  return (
    <Marker
      longitude={activePOI.coordinates.lng}
      latitude={activePOI.coordinates.lat}
      anchor="bottom"
      // Offset (i pixler): negativ Y løfter labelen oppover, over markørens topp.
      // Markøren er ~44px aktiv (h-11) — labelen skal sitte over den.
      offset={[0, -52]}
      style={{ zIndex: 10, pointerEvents: "none" }}
    >
      <div className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-stone-900 shadow-md ring-1 ring-stone-200 whitespace-nowrap backdrop-blur">
        {activePOI.name}
      </div>
    </Marker>
  );
}
