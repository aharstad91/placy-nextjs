"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouteData, type RouteData } from "@/lib/map/use-route-data";
import { useBoard, useActivePOI } from "./board-state";

/**
 * Én rutekilde for alle kart-lag som tegner eller merker ruta.
 *
 * Rutelinja (`BoardPathLayer`), tids-chipen (`BoardPathMidpointMarker`) og
 * 3D-ruten (`BoardMap3D`) kalte tidligere `useRouteData` hver for seg — tre
 * identiske Directions-kall per POI-klikk. Det var akseptert prototype-gjeld
 * fram til reisemodus-veksleren: med modusbytte ville hvert bytte multiplisert
 * kallene på samme måte, og Directions faktureres per request.
 *
 * Provideren sitter i `BoardMap`, ikke i `BoardProvider`. Alle tre konsumentene
 * lever i det subtreet, og et rutesvar skal ikke re-rendre nabolagslista og
 * sidebaren som ikke bruker det.
 */

type BoardRoute = { data: RouteData | null; error: Error | null };

const BoardRouteContext = createContext<BoardRoute | null>(null);

export function BoardRouteProvider({ children }: { children: ReactNode }) {
  const { state, data } = useBoard();
  const activePOI = useActivePOI();

  // useRouteData forventer en POI (lib/types) — bruk BoardPOI.raw.
  const poiForRoute = state.phase === "poi" && activePOI ? activePOI.raw : null;
  const route = useRouteData(poiForRoute, data.home.coordinates, state.travelMode);

  return <BoardRouteContext.Provider value={route}>{children}</BoardRouteContext.Provider>;
}

/**
 * Rutedata for aktivt punkt i aktiv modus.
 *
 * Returnerer en tom rute utenfor provideren i stedet for å kaste: kart-lagene
 * rendres også i tester og i flater som ikke monterer provideren, og en manglende
 * rute er en gyldig tilstand (ingen aktiv POI) — ikke en programmeringsfeil.
 */
export function useBoardRoute(): BoardRoute {
  return useContext(BoardRouteContext) ?? { data: null, error: null };
}
