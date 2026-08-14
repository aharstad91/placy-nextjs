"use client";

import { useBoardRoute } from "./board-route";
import { useActivePOI, useAvailableTravelModes, useBoard } from "./board-state";
import { pathMidpoint } from "./path-midpoint";
import type { RouteData } from "@/lib/map/use-route-data";
import type { TravelMode } from "@/lib/types";

/**
 * Alt tids-chipen trenger, uavhengig av kartmotor.
 *
 * Finnes fordi chipen rendres to steder — Mapbox-`<Marker>` i 2D og et
 * HTML-overlay over Google 3D. Uten en delt kilde ville de to regnet ut tallet
 * hver for seg, og et modusbytte kunne vist 17 min i 2D og 18 i 3D på samme
 * punkt. Motorene skal skille seg i POSISJONERING, ikke i innhold.
 */

export interface TravelChip {
  /** Rutens midtpunkt, eller `null` når det ikke finnes en rute å merke. */
  midpoint: { lat: number; lng: number } | null;
  /** Minutter å vise kollapset, eller `undefined` når chipen ikke skal vises. */
  minutes?: number;
  /** Aktiv modus. */
  travelMode: TravelMode;
  /** Precomputede tider for punktet, per modus — panelets innhold. */
  travelTime?: Partial<Record<TravelMode, number>>;
  /** Modusene boardet har data for. */
  modes: TravelMode[];
  /** Flere enn én modus → chipen er utvidbar. */
  expandable: boolean;
  /** Rutedata, for kallesteder som trenger selve linja. */
  routeData: RouteData | null;
  /** Alt på plass for å rendre chipen. */
  visible: boolean;
}

export function useTravelChip(): TravelChip {
  const { state } = useBoard();
  const { data: routeData } = useBoardRoute();
  const activePOI = useActivePOI();
  const modes = useAvailableTravelModes();

  const travelTime = activePOI?.raw.travelTime;
  const midpoint = routeData ? pathMidpoint(routeData.coordinates) : null;
  const precomputed = travelTime?.[state.travelMode];

  // Precomputet verdi først; rutens egen varighet som fallback. Chipen har
  // alltid vist Directions-tallet, og precompute kan mangle på et punkt som ble
  // lagt til utenfor provisjonerings-løpet.
  const minutes =
    routeData === null
      ? undefined
      : typeof precomputed === "number" && Number.isFinite(precomputed)
        ? precomputed
        : Math.max(1, Math.round(routeData.travelMinutes));

  return {
    midpoint,
    minutes,
    travelMode: state.travelMode,
    travelTime,
    modes,
    expandable: modes.length > 1,
    routeData,
    visible: state.phase === "poi" && midpoint !== null && minutes !== undefined,
  };
}
