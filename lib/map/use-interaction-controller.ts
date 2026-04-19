"use client";

import { useCallback, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

/**
 * Controls map↔carousel interactions in UnifiedMapModal.
 *
 * Matches the `camera-map.ts` pure-function style: closures over refs, no class.
 *
 * Token pattern: each call increments a ref-counter before the next animation
 * frame and checks it is still current before executing. Any subsequent call
 * bumps the counter so the superseded call silently aborts. This fixes flyTo-
 * storm races when users rapid-click markers or cards.
 *
 * Why handler-driven (not useEffect): React batches state updates, and an
 * effect that reads `activePOI.source` after rapid clicks may see the wrong
 * source for a prior activation. Side-effects therefore run directly in the
 * click handler before the paint that renders the new active state.
 */
export function useInteractionController(
  getMap: () => MapboxMap | null,
  getCardElement: (id: string) => HTMLElement | null,
  getPOI: (id: string) => { lat: number; lng: number } | null,
) {
  const flyToken = useRef(0);
  const scrollToken = useRef(0);

  const flyTo = useCallback(
    (poiId: string, opts?: { animate?: boolean }) => {
      const myToken = ++flyToken.current;
      // Stop any pan/zoom in flight so a superseded animation cannot continue
      // in the background while the new one starts.
      getMap()?.stop();
      requestAnimationFrame(() => {
        if (myToken !== flyToken.current) return;
        const map = getMap();
        const poi = getPOI(poiId);
        if (!map || !poi) return;
        map.flyTo({
          center: [poi.lng, poi.lat],
          duration: opts?.animate === false ? 0 : 400,
          essential: true,
        });
      });
    },
    [getMap, getPOI],
  );

  const scrollCardIntoView = useCallback(
    (poiId: string, opts: { behavior: "smooth" | "instant" }) => {
      const myToken = ++scrollToken.current;
      requestAnimationFrame(() => {
        if (myToken !== scrollToken.current) return;
        const el = getCardElement(poiId);
        if (!el) return;
        // block: nearest keeps the modal from jumping vertically; inline: center
        // puts the active card horizontally centered in the carousel viewport.
        el.scrollIntoView({
          behavior: opts.behavior as ScrollBehavior,
          block: "nearest",
          inline: "center",
        });
      });
    },
    [getCardElement],
  );

  const cancelAll = useCallback(() => {
    flyToken.current++;
    scrollToken.current++;
    getMap()?.stop();
  }, [getMap]);

  return { flyTo, scrollCardIntoView, cancelAll };
}
