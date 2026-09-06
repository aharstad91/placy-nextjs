"use client";

import { useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/mapbox";

export type BoardZoomTier = "dot" | "icon" | "icon+label";

/**
 * Eksporteres for testbarhet og fremtidig kalibrering. Justeres i Unit 4 (jf.
 * plan-fila) basert på live-feedback.
 */
export const DOT_BREAKPOINT = 13;
export const LABEL_BREAKPOINT = 16;

/**
 * Egen terskel for rekkevidde-konturenes etiketter («5 min»).
 *
 * `LABEL_BREAKPOINT` (16) kan IKKE gjenbrukes: ved zoom 16 er synsfeltet
 * smalere enn diameteren på 10- og 15-minutt-gangkonturene, så etikettene
 * ville vært skjult i nøyaktig den zoomen konturene leses i. Boardet åpner på
 * 13,5, og terskelen ligger under den så etikettene er synlige fra start og
 * forsvinner først når leseren zoomer ut forbi der de kolliderer.
 */
export const CONTOUR_LABEL_BREAKPOINT = 12.5;

export function contourLabelsVisible(zoom: number): boolean {
  return zoom >= CONTOUR_LABEL_BREAKPOINT;
}

/**
 * Mens vi kalibrerer logges hver tier-overgang. Settes false når terskler er
 * låst (jf. plan Unit 4 verification).
 */
const DEBUG_ZOOM = false;

export function computeZoomTier(zoom: number): BoardZoomTier {
  if (zoom < DOT_BREAKPOINT) return "dot";
  if (zoom < LABEL_BREAKPOINT) return "icon";
  return "icon+label";
}

/**
 * Lytt på Mapbox `zoom`-event og returner gjeldende tier som React-state.
 *
 * - Lazy useState-init prøver å lese `map.getZoom()` ved første render. Hvis
 *   map-ref er klar — ingen tier-flash. Hvis ikke, default `"icon"` returneres
 *   og hooken oppdaterer via useEffect når `mapLoaded` settes true (max én
 *   render-cycle flash).
 * - useRef-guard hindrer duplicate setState når Mapbox fyrer zoom-event 60fps
 *   under gestures.
 * - Cleanup fjerner event-listener ved unmount og ved hver re-mount (2D→3D-
 *   toggle re-mounter Mapbox og må trigge hook re-init via mapLoaded).
 *
 * Inspirasjon: `lib/hooks/useMapZoomState.ts` — vi gjenbruker ikke fordi den
 * hooken returnerer void og skriver DOM-attribute. Vår per-prop-tilnærming
 * krever React-state-return.
 */
export function useBoardZoomTier(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
): BoardZoomTier {
  const [tier, setTier] = useState<BoardZoomTier>(() => {
    const z = mapRef.current?.getMap?.().getZoom();
    return z != null ? computeZoomTier(z) : "icon";
  });

  const lastTierRef = useRef<BoardZoomTier>(tier);
  lastTierRef.current = tier;

  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const updateTier = () => {
      const next = computeZoomTier(map.getZoom());
      if (next !== lastTierRef.current) {
        if (DEBUG_ZOOM) {
          // eslint-disable-next-line no-console
          console.log(
            "[BoardZoomTier]",
            map.getZoom().toFixed(2),
            "→",
            next,
          );
        }
        lastTierRef.current = next;
        setTier(next);
      }
    };

    // Initial-evaluering: dekker tilfellet der lazy-init returnerte default
    // fordi map-ref ikke var klar ved første render.
    updateTier();

    map.on("zoom", updateTier);
    return () => {
      map.off("zoom", updateTier);
    };
  }, [mapLoaded, mapRef]);

  return tier;
}

/**
 * Er konturenes etiketter synlige ved gjeldende zoom? Samme lytter-mønster som
 * `useBoardZoomTier` — egen hook fordi terskelen er en annen, og fordi et
 * board uten konturer ikke skal betale for en tier-beregning det ikke bruker.
 */
export function useContourLabelsVisible(
  mapRef: React.RefObject<MapRef | null>,
  mapLoaded: boolean,
): boolean {
  const [visible, setVisible] = useState<boolean>(() => {
    const z = mapRef.current?.getMap?.().getZoom();
    return z != null ? contourLabelsVisible(z) : true;
  });

  const lastRef = useRef(visible);
  lastRef.current = visible;

  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const update = () => {
      const next = contourLabelsVisible(map.getZoom());
      if (next !== lastRef.current) {
        lastRef.current = next;
        setVisible(next);
      }
    };

    update();
    map.on("zoom", update);
    return () => {
      map.off("zoom", update);
    };
  }, [mapLoaded, mapRef]);

  return visible;
}
