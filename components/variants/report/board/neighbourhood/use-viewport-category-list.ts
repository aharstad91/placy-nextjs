"use client";

import { useMemo } from "react";
import { buildNeighbourhoodList } from "@/lib/board/neighbourhood-list";
import type { NeighbourhoodRow } from "@/lib/board/neighbourhood-list";
import type { BoardCategory, BoardPOI } from "../board-data";
import { useBoard } from "../board-state";

/**
 * Én kategoris punkter i kartutsnittet — LESE-variant (2026-08-13).
 *
 * ## Hvorfor ikke `useNeighbourhoodList`
 *
 * Mobilens hook skriver `setViewportPoiIds` tilbake på BoardContext, som både
 * begrenser markørsettet og gater kamera-fitten. Desktop-sidebaren skal bare
 * LESE utsnittet: markørene styres av kategori-valget, og kameraet av brukeren.
 * Skrev denne hooken markør-state, ville løkken bli utsnitt → liste → markørsett
 * → `fitVisible` → nytt utsnitt. Den skriver derfor ingenting.
 *
 * ## Hvorfor den aktive POI-en rapporteres separat
 *
 * Explorer shippet en utsnitts-scopet sidebar-liste i februar og fikk en
 * high-severity bug: raden brukeren leste forsvant i det punktet gled ut av
 * utsnittet (`active-poi-card-pinned-sidebar-20260208`). Fiksen har to halvdeler
 * — data-halvdelen ligger her (`activeRow` beholdes selv utenfor utsnittet, og
 * filtreres ut av `rows` så den ikke står to steder), UI-halvdelen er å rendre
 * den utenfor scroll-containeren.
 */
export interface ViewportCategoryList {
  /** Kategoriens punkter i utsnittet, sortert på reisetid i aktiv modus. Den
   *  aktive POI-en er filtrert ut — den rendres pinnet, over scroll-området. */
  rows: NeighbourhoodRow<BoardPOI>[];
  /** Den åpne POI-en, uansett om den er i utsnittet. `null` når ingen er åpen,
   *  eller når den åpne POI-en tilhører en annen kategori. */
  activeRow: NeighbourhoodRow<BoardPOI> | null;
  /** Antall punkter i utsnittet (inkludert den aktive). Nevner-teller for
   *  «9 av 17 synlig». */
  visibleCount: number;
  /** Kategoriens totale antall punkter på boardet. */
  totalCount: number;
  /** Hvor mange som ligger UTENFOR utsnittet — grunnlaget for «ramm inn»-raden. */
  hiddenCount: number;
  /** Laveste/høyeste reisetid i aktiv modus blant de synlige som har en. */
  minMinutes?: number;
  maxMinutes?: number;
  /** false når utsnittet manglet og lista viser ALT (degraderingsvei — aldri en
   *  tom liste av den grunn). */
  scoped: boolean;
}

export function useViewportCategoryList(
  category: BoardCategory | null,
): ViewportCategoryList {
  const { state, viewportRect } = useBoard();
  const activePOIId = state.activePOIId;
  const travelMode = state.travelMode;

  // Primitiver i dep-arrayet, aldri rektangel-OBJEKTET: et nytt objekt med
  // samme verdier ville re-kjørt memoen ved hver render
  // (`useeffect-object-dependency-infinite-loop-20260410`).
  const west = viewportRect?.west;
  const south = viewportRect?.south;
  const east = viewportRect?.east;
  const north = viewportRect?.north;

  return useMemo(() => {
    if (!category) {
      return {
        rows: [],
        activeRow: null,
        visibleCount: 0,
        totalCount: 0,
        hiddenCount: 0,
        scoped: false,
      };
    }

    const rect =
      west !== undefined &&
      south !== undefined &&
      east !== undefined &&
      north !== undefined
        ? { west, south, east, north }
        : null;

    // Hele kategorien, ikke bare tre rader: panelet er en sidekolonne i full
    // høyde, ikke et kort med tak (R11 gjelder mobilsheetens kortformat).
    const built = buildNeighbourhoodList([category], rect, {
      rowsPerCategory: Number.POSITIVE_INFINITY,
      travelMode,
    }).categories[0];

    const visibleRows = built?.rows ?? [];
    const activeInViewport =
      visibleRows.find((r) => r.poi.id === activePOIId) ?? null;

    // Er den åpne POI-en panorert ut av utsnittet, hentes den fra kategorien
    // slik at raden fortsatt kan stå pinnet.
    const activeOutside =
      !activeInViewport && activePOIId
        ? category.pois.find((p) => p.id === activePOIId)
        : undefined;
    // Samme siling som lesemodellens `minutesOf`: en korrupt verdi skal ikke
    // lekke inn i den pinnede raden bare fordi den hentes utenom utsnittet.
    const activeOutsideMinutes = activeOutside?.raw.travelTime?.[travelMode];
    const activeRow: NeighbourhoodRow<BoardPOI> | null =
      activeInViewport ??
      (activeOutside
        ? {
            poi: activeOutside,
            minutes:
              typeof activeOutsideMinutes === "number" &&
              Number.isFinite(activeOutsideMinutes)
                ? activeOutsideMinutes
                : undefined,
          }
        : null);

    const visibleCount = built?.visibleCount ?? 0;
    const totalCount = category.pois.length;
    return {
      rows: activeRow
        ? visibleRows.filter((r) => r.poi.id !== activeRow.poi.id)
        : visibleRows,
      activeRow,
      visibleCount,
      totalCount,
      hiddenCount: Math.max(0, totalCount - visibleCount),
      minMinutes: built?.minMinutes,
      maxMinutes: built?.maxMinutes,
      scoped: rect !== null,
    };
  }, [category, west, south, east, north, activePOIId, travelMode]);
}
