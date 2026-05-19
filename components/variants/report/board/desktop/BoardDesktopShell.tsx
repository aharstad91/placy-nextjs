"use client";

import { useBoard } from "../board-state";
import { BoardRail } from "./BoardRail";
import { BoardDetailPanel } from "./BoardDetailPanel";
import { BoardScrollPanel } from "./BoardScrollPanel";

/**
 * Desktop venstre-strip: rail (80px) + panel (400px) side ved side.
 * Total bredde 480px. Mountes absolutt-posisjonert på venstre side i ReportBoardPage,
 * mens BoardMap fyller resten av viewporten.
 *
 * Skjules på mobile (<lg) — der overtar bottom-anchored sheets.
 *
 * NB: `lg:left-[480px]` på kart-containeren i ReportBoardPage MÅ matche
 * denne bredden — endre begge i synk hvis bredden justeres.
 *
 * Unit 0 spike: BoardScrollPanel rendres i phase="default" (continuous-scroll
 * narrativ). Legacy BoardDetailPanel beholdes for phase="poi" og "active" inntil
 * Unit 5 introduserer POI-overlay og Unit 2 forenkler fase-maskinen.
 */
export function BoardDesktopShell() {
  const { state } = useBoard();
  return (
    <div className="hidden lg:flex absolute inset-y-0 left-0 z-10 h-full w-[480px] shadow-[2px_0_24px_rgba(15,29,68,0.06)]">
      <BoardRail />
      {state.phase === "default" ? <BoardScrollPanel /> : <BoardDetailPanel />}
    </div>
  );
}
