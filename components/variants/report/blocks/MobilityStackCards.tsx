"use client";

/**
 * MobilityStackCards — scroll-driven "deck reveal".
 *
 * Kortene starter stablet (alle på samme posisjon med små visuelle peek-
 * offsets). På scroll gjennom seksjonen "fyres" det aktive kortet av
 * (fader opp og ut), og neste kort i bunken blir aktivt. Sekvensiell
 * reveal — ikke en permanent stack.
 *
 * Teknikk: 100vh scroll-budsjett pr kort. Scroll-listener mapper
 * scroll-progress [0..1] til aktivt kort-index. CSS transforms håndterer
 * visuell overgang.
 *
 * Inspirert av cards-stack-slider.uiinitiative.com, men scroll-trigger
 * i stedet for manuell swipe.
 */

import { useEffect, useRef, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export interface StackCardItem {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  metric: string;
  metricUnit?: string;
  detail?: string;
  bgColor?: string;
  popoverContent?: React.ReactNode;
  loading?: boolean;
}

interface MobilityStackCardsProps {
  sectionKicker?: string;
  items: StackCardItem[];
}

const DEFAULT_PALETTE = [
  "#e8dcc8", // warm cream
  "#dde5d6", // sage
  "#e6d4c7", // peach-cream
  "#d9d6cc", // warm grey
];

/** Scroll-budsjett pr kort — bestemmer hvor mye brukeren må scrolle
    før neste kort fyres. 100vh gir komfortabel rytme. */
const SCROLL_PER_CARD_VH = 100;

export default function MobilityStackCards({
  sectionKicker,
  items,
}: MobilityStackCardsProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = stackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const stackHeight = rect.height;
      const viewportH = window.innerHeight;
      const scrollable = stackHeight - viewportH;
      if (scrollable <= 0) {
        setProgress(0);
        return;
      }
      // rect.top is negative when user has scrolled past top of stack
      const scrolled = -rect.top;
      const p = Math.max(0, Math.min(1, scrolled / scrollable));
      setProgress(p);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Hvilket kort er aktivt basert på progress. progress [0..1] mappes til
  // [0..items.length). Floor gir aktivt kort, fraction gir overgangs-"smak".
  const activeF = progress * items.length;
  const activeIndex = Math.min(items.length - 1, Math.floor(activeF));
  const activeFraction = activeF - activeIndex; // 0..1 innen aktivt kort

  return (
    <div className="mb-6">
      {sectionKicker && (
        <div className="text-xs uppercase tracking-[0.15em] text-[#a0937d] font-medium mb-3">
          {sectionKicker}
        </div>
      )}

      {/* Tall scroll-container. Høyde = items.length × SCROLL_PER_CARD_VH.
          Sticky-wrapperen er det ene elementet som fester seg — kortene
          inni ligger absolutt posisjonert på samme sted og overlapper. */}
      <div
        ref={stackRef}
        className="relative"
        style={{ height: `${items.length * SCROLL_PER_CARD_VH}vh` }}
      >
        <div className="sticky top-24 h-56 md:h-64">
        {items.map((item, i) => {
          const bg = item.bgColor ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

          // Per-card stage:
          //   fired  = i < activeIndex                    → gått opp, fadet ut
          //   active = i === activeIndex                  → full focus
          //   waiting = i > activeIndex                    → i bunken under
          const isFired = i < activeIndex;
          const isActive = i === activeIndex;
          const stackDepth = Math.max(0, i - activeIndex); // 0 for active, 1/2/3 for waiting

          // Active card extra-tweak: når activeFraction → 1 (nesten fyrt av),
          // gi en liten "liftoff"-forsmak (scale + translate opp)
          const liftoff = isActive ? activeFraction : 0;

          // Transform:
          //   fired   → translateY(-140%) scale(0.9) opacity(0)
          //   active  → translateY(-liftoff*10%) scale(1 - liftoff*0.05) opacity(1 - liftoff*0.7)
          //   waiting → translateY(stackDepth * 10px) scale(1 - stackDepth*0.02) opacity(1)
          let transform = "translateY(0) scale(1)";
          let opacity = 1;
          if (isFired) {
            transform = "translateY(-140%) scale(0.9)";
            opacity = 0;
          } else if (isActive) {
            transform = `translateY(-${liftoff * 10}%) scale(${1 - liftoff * 0.05})`;
            opacity = 1 - liftoff * 0.7;
          } else {
            // waiting — peek under aktivt kort
            transform = `translateY(${stackDepth * 12}px) scale(${1 - stackDepth * 0.025})`;
            opacity = 1;
          }

          const card = (
            <div
              className="rounded-2xl p-6 md:p-10 shadow-xl h-56 md:h-64 overflow-hidden"
              style={{ backgroundColor: bg }}
            >
              {item.loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-10 w-10 bg-white/40 rounded-full" />
                  <div className="h-3 w-32 bg-white/40 rounded" />
                  <div className="h-16 w-48 bg-white/40 rounded" />
                  <div className="h-4 w-64 bg-white/40 rounded" />
                </div>
              ) : (
                <div className="flex flex-col gap-4 md:gap-6">
                  <div className="flex items-center gap-3">
                    {item.icon && (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: item.iconBg ?? "rgba(255,255,255,0.6)" }}
                      >
                        {item.icon}
                      </div>
                    )}
                    <div className="text-[11px] md:text-xs uppercase tracking-[0.2em] text-[#6a6a6a] font-medium">
                      {item.label}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 md:gap-3">
                    <div className="text-4xl md:text-5xl font-bold text-[#1a1a1a] tracking-tight">
                      {item.metric}
                    </div>
                    {item.metricUnit && (
                      <div className="text-base md:text-lg text-[#4a4a4a]">
                        {item.metricUnit}
                      </div>
                    )}
                  </div>

                  {item.detail && (
                    <div className="text-sm md:text-base text-[#4a4a4a] leading-relaxed">
                      {item.detail}
                    </div>
                  )}
                </div>
              )}
            </div>
          );

          const withPopover = item.popoverContent && isActive ? (
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-full text-left cursor-pointer">{card}</button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-72 p-0 gap-0">
                {item.popoverContent}
              </PopoverContent>
            </Popover>
          ) : (
            card
          );

          return (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                transform,
                opacity,
                zIndex: items.length - i, // tidligere kort på topp (fyres først)
                transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              {withPopover}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
