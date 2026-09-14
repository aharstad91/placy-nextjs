"use client";

import { useEffect, useState } from "react";
import { useBoard } from "./board-state";

export type BoardPopupMode = "sheet" | "mini";

/**
 * Returnerer "mini" på desktop (lg+, ≥1024px) og "sheet" på mobil.
 *
 * - Desktop: BoardPOIMiniPopup forankret over markøren i både Mapbox 2D og
 *   Google 3D. BoardPOILabel-navne-pillen skjules så vi unngår dobbel-label.
 * - Mobil: BoardMobileSheet håndterer POI-detaljene som bottom-sheet — popup
 *   ville krasjet med sheet-mønsteret.
 */
export function useBoardPopupMode(): BoardPopupMode {
  const isDesktop = useIsDesktop();
  return isDesktop ? "mini" : "sheet";
}

/**
 * Stedene åpner i ETT felles detaljpanel over kolonnen (2026-09-15).
 *
 * Sant bare når boardet har bedt om det (`placePanel` på BoardProvider) OG
 * flaten er desktop (samme 1024-grense som popup-modusen). Mobil får aldri
 * panelet, uansett policy — der er modalen stedsflaten.
 */
export function useDesktopPlacePanel(): boolean {
  const { placePanel } = useBoard();
  const isDesktop = useIsDesktop();
  return placePanel && isDesktop;
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
