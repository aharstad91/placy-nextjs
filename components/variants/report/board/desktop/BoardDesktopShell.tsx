"use client";

import { BoardRail } from "./BoardRail";
import { BoardScrollPanel } from "./BoardScrollPanel";

/**
 * Desktop venstre-strip: rail (80px) + panel (400px) side ved side.
 * Total bredde 480px. Mountes absolutt-posisjonert på venstre side i
 * ReportBoardPage, mens BoardMap fyller resten av viewporten.
 *
 * Skjules på mobile (<lg) — der overtar bottom-anchored sheets.
 *
 * NB: `lg:left-[480px]` på kart-containeren i ReportBoardPage MÅ matche
 * denne bredden — endre begge i synk hvis bredden justeres.
 *
 * POI-detaljer på desktop håndteres av BoardPOIMiniPopup (forankret over
 * markøren i Mapbox 2D og Google 3D). Sidebar viser kun scroll-narrativet
 * og rail — ingen overlay-card lenger.
 */
export function BoardDesktopShell() {
  return (
    <div className="hidden lg:flex absolute inset-y-0 left-0 z-10 h-full w-[480px] shadow-[2px_0_24px_rgba(15,29,68,0.06)]">
      <BoardRail />
      <div className="relative h-full w-[400px]">
        <BoardScrollPanel />
      </div>
    </div>
  );
}
