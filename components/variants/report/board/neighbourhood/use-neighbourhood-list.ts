"use client";

import { useEffect, useMemo } from "react";
import {
  buildNeighbourhoodList,
  type NeighbourhoodList,
} from "@/lib/board/neighbourhood-list";
import { useBoard } from "../board-state";
import type { BoardPOI } from "../board-data";

/**
 * Binder nabolagsmodellen (Unit 2, ren) til kartutsnittet (Unit 1) og mater
 * markør-synligheten tilbake til kartet.
 *
 * Løkken går: `BoardMap` publiserer rektangelet → denne hooken bygger lista →
 * hooken skriver de synlige POI-IDene tilbake på `BoardContext` → `BoardMap`
 * intersekter dem inn i markørene. Det er bare trygt fordi settet er merket
 * `"viewport-scope"`, som gater kamera-fitten (`shouldFitToFilter`). Uten den
 * gaten ville hvert steg utløst neste.
 */
export function useNeighbourhoodList(): NeighbourhoodList<BoardPOI> {
  const { state, data, viewportRect, setViewportPoiIds } = useBoard();
  const travelMode = state.travelMode;

  // Primitiver i dep-arrayet, aldri rektangel-OBJEKTET: et nytt objekt med
  // samme verdier ville re-kjørt memoen, gitt et nytt sett, skrevet ny
  // provider-state og re-rendret hele subtreet — per render
  // (`useeffect-object-dependency-infinite-loop-20260410`).
  const west = viewportRect?.west;
  const south = viewportRect?.south;
  const east = viewportRect?.east;
  const north = viewportRect?.north;

  const list = useMemo(() => {
    const rect =
      west !== undefined &&
      south !== undefined &&
      east !== undefined &&
      north !== undefined
        ? { west, south, east, north }
        : null;
    return buildNeighbourhoodList(data.categories, rect, { travelMode });
    // travelMode er en primitiv — trygg i dep-arrayet, i motsetning til rektangelet.
  }, [data.categories, west, south, east, north, travelMode]);

  useEffect(() => {
    // Uscopet liste → ingen markør-begrensning (vis alt), aldri et tomt sett.
    setViewportPoiIds(list.scoped ? new Set(list.visiblePoiIds) : null);
  }, [list, setViewportPoiIds]);

  // Forlater brukeren flaten skal markørene ikke bli stående filtrert etter et
  // utsnitt som ikke lenger finnes.
  useEffect(() => () => setViewportPoiIds(null), [setViewportPoiIds]);

  return list;
}
