"use client";

import { NowPlayingCard } from "./NowPlayingCard";
import { ChapterProgressBar } from "./ChapterProgressBar";
import { ReelsMenu } from "./ReelsMenu";

/**
 * Vedvarende avspiller-transport (mobil) — slank bunn-bar til stede på BEGGE
 * flater for kontinuitet. Rad: [spiller-nå-kort] … [meny], med en tynn
 * 0–100 %-fremdriftslinje langs bunnkanten.
 *  - «Spiller nå»-kort (`NowPlayingCard`, fyller raden): poster + kapittel-navn
 *    + meta. Tappbart → kapittelvelger-popover; ruller ett hakk ved kapittel-
 *    skifte (odometer). Erstatter den tidligere spiller-triaden (⏮ ▶/⏸ ⏭).
 *  - Meny (`ReelsMenu`, høyre): ⋯-popover med demp/del/lenker.
 *  - Fremdriftslinje (`ChapterProgressBar`): tynn lys strek nederst, 0→100 % per
 *    aktivt kapittel (kategori = sang).
 *
 * Navigasjon (erstatter triaden): vertikal swipe på reel-flaten — opp = neste,
 * ned = forrige kapittel — og tapp-på-reel = play/pause (begge wiret i
 * ReportReelsPage). Kapittel-hopp via spiller-nå-kortets velger.
 *
 * Monteres kun når lyd er låst opp (R18) og rapporten har spillbar lyd (R17);
 * den gatingen ligger i ReportReelsPage.
 */
export function ReelsTransport() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 bg-stone-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-3">
          <NowPlayingCard />
          <ReelsMenu />
        </div>

        <ChapterProgressBar />
      </div>
    </div>
  );
}
