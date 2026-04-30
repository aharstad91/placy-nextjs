"use client";

import { BoardRail } from "./BoardRail";
import { BoardDetailPanel } from "./BoardDetailPanel";

/**
 * Desktop venstre-strip: rail (64px) + detalj-panel (400px) side ved side.
 * Total bredde 464px. Mountes absolutt-posisjonert på venstre side i ReportBoardPage,
 * mens BoardMap fyller resten av viewporten.
 *
 * Skjules på mobile (<lg) — der overtar bottom-anchored sheets.
 *
 * NB: `lg:left-[464px]` på kart-containeren i ReportBoardPage MÅ matche
 * denne bredden — endre begge i synk hvis bredden justeres.
 */
export function BoardDesktopShell() {
  return (
    <div className="hidden lg:flex absolute inset-y-0 left-0 z-10 h-full w-[464px] shadow-[2px_0_24px_rgba(15,29,68,0.06)]">
      <BoardRail />
      <BoardDetailPanel />
    </div>
  );
}
