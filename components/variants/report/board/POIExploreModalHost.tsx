"use client";

import { useCallback } from "react";
import { useBoard, useActivePOI } from "./board-state";
import { useBoardPopupMode } from "./use-popup-mode";
import { useEngagement } from "@/lib/instrumentation/engagement-scope";
import {
  POIExploreModal,
  hasExploreContent,
  hasGroundedNarrative,
} from "./POIExploreModal";
import type { BoardPOI } from "./board-data";

/**
 * Eier den ENE Utforsk-modal-instansen på boardet.
 *
 * HVORFOR IKKE I KART-KOMPONENTENE: ved 3D-addon er BoardMap3D permanent
 * montert SAMTIDIG som Mapbox-overlayet (`BoardMap.tsx` — `{has3dAddon && …}`
 * ved siden av `showMapbox = !has3dAddon || view === "2d"`). Hadde begge
 * kart-filene rendret modalen, ville to portal-modaler stått oppå hverandre på
 * `z-[100]` — og siden modalen emitter Moat 2-signalet, ville selve målingen
 * blitt dobbelttelt. Dagens dobbel-render av mini-popupen er skjult fordi
 * 3D-popupen ligger UNDER Mapbox-overlayet på `z-[5]`; en portal-modal har
 * ingen slik okklusjon.
 *
 * Rendres derfor som søsken av `BoardReelsSync` i `ReportReelsPage`, under både
 * BoardProvider og EngagementProvider.
 */
export function POIExploreModalHost() {
  const { state, dispatch } = useBoard();
  const poi = useActivePOI();
  const popupMode = useBoardPopupMode();
  const engagement = useEngagement();

  /**
   * Moat 2-signalet. Emittes herfra og ikke fra popupene fordi hosten er den
   * ENE instansen — emit fra kart-komponentene ville blitt dobbelttelt ved
   * 3D-addon, der begge er montert samtidig.
   *
   * ToS-grense: vi logger AT modalen ble åpnet. ALDRI klikk på enkelte
   * kildelenker eller Search Suggestions.
   */
  const handleOpened = useCallback(
    (opened: BoardPOI) => {
      engagement.emit("poi_explore_opened", {
        poiId: opened.id,
        payload: {
          category_id: opened.categoryId,
          has_grounding: hasGroundedNarrative(opened.raw.grounding),
        },
      });
    },
    [engagement]
  );

  // Mobil har i dag INGEN POI-detaljflate (BoardMobileSheet finnes ikke — kun
  // omtalt i kommentarer), så modalen ER mobilens POI-flate: POI-tap åpner den
  // direkte, uten et mellomliggende popup-lag.
  const isMobileSurface = popupMode === "sheet";

  // Gating på INNHOLD, ikke på flate. Uten dette ville en 85vh-modal dekket
  // gangveien, tids-chipen og navne-pilla på hvert eneste mobil-POI-tap — også
  // på boards uten grounded innhold, der mobilen dermed ble DÅRLIGERE enn i dag.
  const hasContent = poi ? hasExploreContent(poi) : false;

  const open = isMobileSurface
    ? state.phase === "poi" && hasContent
    : state.exploreOpen && hasContent;

  const handleClose = () => {
    // Mobil: modalen ER POI-flaten, så lukking skal forlate POI-fasen helt slik
    // at markør-labelen kommer tilbake og kartet er interaktivt igjen.
    // Desktop: mini-popupen står bak modalen og skal bli stående.
    dispatch({ type: isMobileSurface ? "BACK_TO_DEFAULT" : "CLOSE_EXPLORE" });
  };

  // Ekstern lenke i footeren KUN når vi ikke har grounded narrativ. Har vi det,
  // er kildelenkene og Google-chipsene i attribusjonsblokken utveien — en ekstra
  // «gå til Google»-knapp ville undergravd hele poenget med å beholde brukeren.
  const fallbackUrl =
    poi && !hasGroundedNarrative(poi.raw.grounding)
      ? `https://www.google.com/search?udm=50&q=${encodeURIComponent(
          poi.address ? `${poi.name} ${poi.address}` : poi.name
        )}`
      : undefined;

  return (
    <POIExploreModal
      poi={poi}
      open={open}
      onClose={handleClose}
      fallbackUrl={fallbackUrl}
      onOpened={handleOpened}
    />
  );
}

export default POIExploreModalHost;
