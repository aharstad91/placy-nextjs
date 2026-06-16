"use client";

import { useReels } from "./reels-state";

/**
 * Progress-gated kart-teaser CTA-lag (B1, R7–R10).
 *
 * Selve kart-glimtet er den SAMME persistente kart-instansen avslørt i en
 * bunn-stripe (geometrien styres av kart-containeren i ReportReelsPage); kartet
 * er ikke-interaktivt der (pointer-events-skjold via BoardMap `interactive={false}`).
 * Denne komponenten ligger OPPÅ glimtet (over skjoldet) og fanger tapp → åpner
 * kart-flaten. Hele stripen er tappbar; «Utforsk på kart» er det synlige signalet.
 *
 * Vises kun på kategori-beats etter VO-slutt (gating i ReportReelsPage:
 * `teaserArmed && !mapOpen`). Glir opp via en lett translate/opacity-animasjon
 * (disclosure-konvensjon: bevegelsen ER signalet, ingen auto-scroll).
 */
export function MapTeaser() {
  const { setMapOpen } = useReels();
  return (
    <button
      type="button"
      onClick={() => setMapOpen(true)}
      aria-label="Utforsk på kart"
      className="absolute inset-0 z-20 flex items-start justify-center pt-4"
    >
      <span className="pointer-events-none flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-900 shadow-2xl">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stone-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-stone-900" />
        </span>
        Utforsk på kart →
      </span>
    </button>
  );
}
