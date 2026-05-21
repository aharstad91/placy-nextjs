"use client";

import { ChevronDown } from "lucide-react";
import { useQueueOverlayStore } from "@/lib/stores/queue-overlay-store";
import { CategoryIndex } from "./CategoryIndex";

/**
 * Bottom-sheet spilleliste-overlay som åpnes ved klikk på player. Spotify-
 * mønster: meta-info i player → tap for å se hele køen → tap rad → spill +
 * lukk. Spesielt nyttig på mobil hvor sidebaren ikke er synlig hele tiden,
 * men også verdifull på desktop når brukeren har scrollet under indeksen.
 *
 * Posisjon: absolutt innen forelder-containeren — mountes inni desktop
 * scroll-panel og mobile sheet. Slide-up CSS-animasjon via `translate-y-full
 * → translate-y-0`. Trykk-utenfor-lukker via backdrop.
 *
 * Rad-klikk er smart (samme som CategoryIndex i scroll): idle → scroll til
 * seksjon; tour → goToTrack. Etter klikk: `onItemSelected={close}` lukker
 * automatisk.
 */
export function QueueOverlay() {
  const isOpen = useQueueOverlayStore((s) => s.isOpen);
  const close = useQueueOverlayStore((s) => s.close);

  return (
    <>
      {/* Backdrop — trykk utenfor for å lukke. Bare aktivt når open. */}
      <button
        type="button"
        aria-hidden={!isOpen}
        aria-label="Lukk spilleliste"
        tabIndex={isOpen ? 0 : -1}
        onClick={close}
        className={`absolute inset-0 z-30 bg-stone-900/20 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-label="Spilleliste"
        aria-hidden={!isOpen}
        className={`absolute inset-x-0 bottom-0 z-40 flex max-h-[85%] flex-col rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(15,29,68,0.12)] transition-transform duration-300 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-stone-200/80 px-6 py-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              I rapporten
            </span>
            <span className="text-sm font-semibold text-stone-900">
              Spilleliste
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Lukk spilleliste"
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto py-2">
          <CategoryIndex onItemSelected={close} hideHeader />
        </div>
      </div>
    </>
  );
}
