"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { POI } from "@/lib/types";
import ReportMapBottomCard from "../ReportMapBottomCard";

// @duplicated-scroll-logic: ReportMapBottomCarousel.tsx (scroll-state + arrows).
// Duplisering akseptert for nå (to consumers ≠ third-rule per CLAUDE.md anti-
// abstraction). Sync begge filer ved endringer. Vurder generalisering hvis en
// tredje consumer dukker opp.

export interface ReportThemePOICarouselProps {
  /** POI-er som skal rendres i slideren (allerede top-N av ranking). */
  pois: readonly POI[];
  /** Totalt antall POI-er i kategorien. CTA synlig iff totalCount > pois.length. */
  totalCount: number;
  /** CTA-klikk: åpner kart-modal for kategorien. Required — kontrakt er eksplisitt. */
  onOpenMap: () => void;
  /** Slug for "Les mer"-link i aktivert kort. Null → "Les mer" skjules. */
  areaSlug?: string | null;
  /** Aria-label for region-wrapper, f.eks. "Steder i Mat & Drikke". */
  ariaLabel: string;
}

/**
 * Horisontal POI-slider i ReportThemeSection mellom narrativ og dormant kart-
 * preview. Gjenbruker ReportMapBottomCard (tekst-only) — samme kort som kart-
 * modalens bunn-carousel, for visuell konsistens på tvers av tema-seksjonene.
 *
 * A11y (W3C APG 2025+ carousel): section[aria-roledescription=carousel] > ul >
 * li[aria-roledescription=slide] > button. IKKE role=listbox — listbox er for
 * selekterbare widgets, ikke for editorial POI-kort. Ingen roving tabindex —
 * native Tab-order gjennom card-buttons er tilstrekkelig og unngår race mellom
 * scrollByAmount og .focus().
 *
 * iOS: overscroll-x-contain forhindrer pull-to-refresh uten å drepe horizontal
 * swipe. IKKE touch-none (bricker swipe). Safari 16+ universell støtte.
 */
export default function ReportThemePOICarousel({
  pois,
  totalCount,
  onOpenMap,
  areaSlug,
  ariaLabel,
}: ReportThemePOICarouselProps) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activePOIId, setActivePOIId] = useState<string | null>(null);

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

  const scrollByAmount = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = 232; // ~220 card + 12 gap — speiler ReportMapBottomCarousel
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  if (pois.length === 0) return null;

  const showCTA = totalCount > pois.length;

  return (
    <section
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className="flex flex-col gap-3 w-full"
    >
      <div className="relative">
        <ul
          ref={scrollRef}
          className="flex items-end gap-3 overflow-x-auto overscroll-x-contain snap-x snap-mandatory min-h-[260px] pb-3 pt-5 px-1 list-none m-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pois.map((poi, index) => (
            <li
              key={poi.id}
              aria-roledescription="slide"
              aria-label={`${index + 1} av ${pois.length}: ${poi.name}`}
              className="shrink-0 flex"
            >
              <ReportMapBottomCard
                poi={poi}
                index={index}
                total={pois.length}
                isActive={activePOIId === poi.id}
                onClick={() =>
                  setActivePOIId((prev) => (prev === poi.id ? null : poi.id))
                }
                areaSlug={areaSlug}
              />
            </li>
          ))}
        </ul>

        {/* Nav arrows — desktop only. Mobil bruker native swipe. */}
        <button
          type="button"
          onClick={() => scrollByAmount("left")}
          disabled={!canScrollLeft}
          aria-label="Forrige"
          className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-[#e0dcd6] bg-white shadow-md items-center justify-center transition-all disabled:opacity-0 disabled:pointer-events-none hover:bg-[#f5f1ec] z-10"
        >
          <ChevronLeft className="w-4 h-4 text-[#3a3530]" />
        </button>
        <button
          type="button"
          onClick={() => scrollByAmount("right")}
          disabled={!canScrollRight}
          aria-label="Neste"
          className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-[#e0dcd6] bg-white shadow-md items-center justify-center transition-all disabled:opacity-0 disabled:pointer-events-none hover:bg-[#f5f1ec] z-10"
        >
          <ChevronRight className="w-4 h-4 text-[#3a3530]" />
        </button>
      </div>

      {showCTA && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onOpenMap}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-[#3a3530] bg-[#f5f1ec] hover:bg-[#eae6e1] transition-colors"
          >
            Se alle {totalCount} steder på kartet
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
}
