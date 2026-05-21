"use client";

import { BoardScrollPanel } from "./BoardScrollPanel";

/**
 * Desktop venstre-strip: scroll-panel (400px). Mountes absolutt-posisjonert
 * på venstre side i ReportBoardPage, mens BoardMap fyller resten av viewporten.
 *
 * Skjules på mobile (<lg) — der overtar bottom-anchored sheets.
 *
 * NB: `lg:left-[400px]` på kart-containeren i ReportBoardPage MÅ matche
 * denne bredden — endre begge i synk hvis bredden justeres.
 *
 * Kategori-navigasjon ligger som numerert CategoryIndex i top-hero
 * (Spotify-mønster) — rail-komponenten er slettet, indeks-liste +
 * scroll-tracking erstatter den.
 *
 * POI-detaljer på desktop håndteres av BoardPOIMiniPopup (forankret over
 * markøren i Mapbox 2D og Google 3D).
 */
export function BoardDesktopShell() {
  return (
    <div className="hidden lg:flex absolute inset-y-0 left-0 z-10 h-full w-[400px] shadow-[2px_0_24px_rgba(15,29,68,0.06)]">
      <div className="relative h-full w-[400px]">
        <BoardScrollPanel />
      </div>
    </div>
  );
}
