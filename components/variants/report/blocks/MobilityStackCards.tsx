"use client";

/**
 * MobilityStackCards — scroll-driven sticky card-stack.
 *
 * Erstatter det generiske 4-kort-grid'et med en "stablet slideshow"-
 * opplevelse: hvert kort er full bredde, holder seg sticky mens du
 * scroller, og neste kort sklir opp over det. Inspirert av
 * cards-stack-slider.uiinitiative.com, men kun CSS (ingen JS-deps).
 *
 * Typografi-retning fra image 18: clean warm-beige bakgrunn, liten
 * uppercase-label, tydelig metric-tall, liten detaljlinje. Ikke så
 * stort som demo-bildet — moderat skala passer bedre med resten
 * av rapporten.
 */

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export interface StackCardItem {
  /** Small icon element (Lucide, etc.) */
  icon?: React.ReactNode;
  /** Background for the icon chip */
  iconBg?: string;
  /** Small uppercase label (e.g. "BYSYKKEL") */
  label: string;
  /** Large metric (e.g. "15", "22", "4") — tall or kort streng */
  metric: string;
  /** Small unit next to metric (e.g. "ledige sykler", "biler") */
  metricUnit?: string;
  /** Additional context line below metric */
  detail?: string;
  /** Card background — rotates through palette if omitted */
  bgColor?: string;
  /** Optional popover with drilldown details */
  popoverContent?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
}

interface MobilityStackCardsProps {
  /** Small section header above the stack */
  sectionKicker?: string;
  items: StackCardItem[];
}

/** Default palette — warm/muted, matcher Placy-stilen */
const DEFAULT_PALETTE = [
  "#e8dcc8", // warm cream
  "#dde5d6", // sage
  "#e6d4c7", // peach-cream
  "#d9d6cc", // warm grey
];

export default function MobilityStackCards({
  sectionKicker,
  items,
}: MobilityStackCardsProps) {
  return (
    <div className="mb-6">
      {sectionKicker && (
        <div className="text-xs uppercase tracking-[0.15em] text-[#a0937d] font-medium mb-3">
          {sectionKicker}
        </div>
      )}

      {/* Stack container — hver slot gir scroll-budsjett for sitt kort.
          Sticky-posisjon sørger for at kortene overlapper under overgang. */}
      <div className="relative">
        {items.map((item, i) => {
          const bg = item.bgColor ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
          const card = (
            <div
              className="rounded-2xl p-6 md:p-10 shadow-sm transition-shadow hover:shadow-md"
              style={{ backgroundColor: bg }}
            >
              {item.loading ? (
                <div className="animate-pulse space-y-4 min-h-[12rem]">
                  <div className="h-10 w-10 bg-white/40 rounded-full" />
                  <div className="h-3 w-32 bg-white/40 rounded" />
                  <div className="h-16 w-48 bg-white/40 rounded" />
                  <div className="h-4 w-64 bg-white/40 rounded" />
                </div>
              ) : (
                <div className="flex flex-col gap-4 md:gap-6">
                  {/* Header: icon + label */}
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

                  {/* Metric — stort men ikke overdrevet */}
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

                  {/* Detail */}
                  {item.detail && (
                    <div className="text-sm md:text-base text-[#4a4a4a] leading-relaxed">
                      {item.detail}
                    </div>
                  )}
                </div>
              )}
            </div>
          );

          const withPopover = item.popoverContent ? (
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
            /* Slot som gir scroll-budsjett for dette kortet.
               h-[50vh] på mobil (kortere for raskere flyt), h-[60vh] på desktop. */
            <div
              key={i}
              className="h-[50vh] md:h-[60vh]"
              style={{ zIndex: i + 1 }}
            >
              <div className="sticky top-24">{withPopover}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
