"use client";

import { useCallback, useRef } from "react";
import { useEngagement } from "@/lib/instrumentation/engagement-scope";
import { useBoard } from "./board-state";
import { useStoryTourOptional } from "./story/story-tour";

/**
 * Trykk på en kartmarkør — ÉN vei inn, uansett motor (2026-08-28).
 *
 * De to motorene hadde hver sin halvferdige versjon av samme handling: Google
 * 3D slo opp kategorien, dispatchet punktet og målte trykket, mens Mapbox 2D
 * bare dispatchet — så et trykk på en 2D-pinne var usynlig i målingen. Og ingen
 * av dem sa noe til flaten.
 *
 * Handlingen er nå én funksjon med tre ledd, i rekkefølge:
 *
 *   1. `OPEN_POI` — popupen over pinnen og rutelinja hjem. Umiddelbart: det er
 *      dette fingeren ba om.
 *   2. `poi_clicked` — målingen (Moat 2). Bærer kategorien punktet ble funnet i.
 *   3. `revealFromMap` — flaten følger etter, etter en pause. Se sekvens-doccen
 *      i `story/story-tour.tsx`.
 *
 * Ingen `categoryId` i actionen: et klikk på kartet er en i-kontekst-handling
 * («hva er dette stedet?») og skal ikke også bytte kategori, snevre markørsettet
 * og drille sidebaren inn (2026-08-13). Kategori-oppslaget her er til målingen —
 * og til omvisningen, som selv avgjør hvilket stopp punktet vises i.
 *
 * ## Hvorfor callbacken er referanse-stabil
 *
 * Den ligger i `Marker3DItems`' memo-props, så en fersk identitet per render
 * ville defeatet memo for HVER markør (S1). Alt den leser ligger derfor i en ref
 * som skrives hver render — inkludert omvisningen, som får ny identitet ved hver
 * tilstandsendring.
 */
export function useMapPinClick(): (poiId: string) => void {
  const { data, dispatch } = useBoard();
  const story = useStoryTourOptional();
  const engagement = useEngagement();

  const latest = useRef({ data, dispatch, engagement, story });
  latest.current = { data, dispatch, engagement, story };

  return useCallback((poiId: string) => {
    const { data, dispatch, engagement, story } = latest.current;
    const id = String(poiId);
    for (const cat of data.categories) {
      const found = cat.pois.find((p) => String(p.id) === id);
      if (!found) continue;
      dispatch({ type: "OPEN_POI", id: found.id });
      engagement.emit("poi_clicked", {
        poiId: String(found.id),
        payload: { category_id: cat.id },
      });
      story?.revealFromMap(id);
      return;
    }
  }, []);
}
