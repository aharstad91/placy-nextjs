"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { POI } from "@/lib/types";
import ReportMapBottomCard from "../ReportMapBottomCard";

export interface ReportMapBottomCarouselProps {
  /** Top-N POIs (already ranked/capped). `readonly` signals the carousel does not mutate. */
  pois: readonly POI[];
  /** Currently active POI id (or null). Drives morph + scroll target. */
  activePOIId: string | null;
  /** Called when a card is clicked — parent fires flyTo + state update. */
  onCardClick: (poiId: string) => void;
  /** Registers each card element so UnifiedMapModal can scroll by id. */
  registerCardRef: (poiId: string, el: HTMLElement | null) => void;
  /** Slug for "Les mer"-links inside the active-card action row. */
  areaSlug?: string | null;
}

/**
 * Bottom carousel for the UnifiedMapModal on desktop. Horizontal scroll-snap
 * with roving tabindex (arrow keys move focus + scroll, Enter/Space activates).
 *
 * Renders nothing when the POI list is empty — parent can mount unconditionally.
 */
export default function ReportMapBottomCarousel({
  pois,
  activePOIId,
  onCardClick,
  registerCardRef,
  areaSlug,
}: ReportMapBottomCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number>(() => {
    const idx = pois.findIndex((p) => p.id === activePOIId);
    return idx >= 0 ? idx : 0;
  });

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, pois.length]);

  // Keep focus index in sync when activePOI changes via marker click.
  useEffect(() => {
    if (!activePOIId) return;
    const idx = pois.findIndex((p) => p.id === activePOIId);
    if (idx >= 0) setFocusIndex(idx);
  }, [activePOIId, pois]);

  const scrollByAmount = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = 232; // ~220 card + 12 gap
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (pois.length === 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(focusIndex + 1, pois.length - 1);
      setFocusIndex(next);
      const btn = scrollRef.current?.querySelector<HTMLButtonElement>(
        `[data-poi-id="${pois[next].id}"]`,
      );
      btn?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = Math.max(focusIndex - 1, 0);
      setFocusIndex(prev);
      const btn = scrollRef.current?.querySelector<HTMLButtonElement>(
        `[data-poi-id="${pois[prev].id}"]`,
      );
      btn?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIndex(0);
      const btn = scrollRef.current?.querySelector<HTMLButtonElement>(
        `[data-poi-id="${pois[0].id}"]`,
      );
      btn?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIndex(pois.length - 1);
      const btn = scrollRef.current?.querySelector<HTMLButtonElement>(
        `[data-poi-id="${pois[pois.length - 1].id}"]`,
      );
      btn?.focus();
    }
  };

  if (pois.length === 0) return null;

  return (
    <div className="hidden md:flex flex-col gap-1.5 w-full">
      <div className="relative">
        <div
          ref={scrollRef}
          role="listbox"
          aria-label="Steder i nabolaget"
          aria-orientation="horizontal"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          /* items-end: kortene ankret i bunn, aktivt kort vokser oppover kun.
             min-h gir plass til aktivt kort fra start (ingen layout-shift ved
             aktivering). pt gir ekstra morph-slack (scale ~8px). */
          className="flex items-end gap-3 overflow-x-auto snap-x snap-mandatory min-h-[260px] pb-3 pt-5 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pois.map((poi, index) => (
            <ReportMapBottomCard
              key={poi.id}
              ref={(el) => registerCardRef(poi.id, el)}
              poi={poi}
              index={index}
              total={pois.length}
              isActive={activePOIId === poi.id}
              onClick={() => onCardClick(poi.id)}
              areaSlug={areaSlug}
            />
          ))}
        </div>

        {/* Nav arrows — desktop only */}
        <button
          type="button"
          onClick={() => scrollByAmount("left")}
          disabled={!canScrollLeft}
          aria-label="Forrige"
          className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-[#e0dcd6] bg-white shadow-md flex items-center justify-center transition-all disabled:opacity-0 disabled:pointer-events-none hover:bg-[#f5f1ec] z-10"
        >
          <ChevronLeft className="w-4 h-4 text-[#3a3530]" />
        </button>
        <button
          type="button"
          onClick={() => scrollByAmount("right")}
          disabled={!canScrollRight}
          aria-label="Neste"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-[#e0dcd6] bg-white shadow-md flex items-center justify-center transition-all disabled:opacity-0 disabled:pointer-events-none hover:bg-[#f5f1ec] z-10"
        >
          <ChevronRight className="w-4 h-4 text-[#3a3530]" />
        </button>
      </div>
    </div>
  );
}
