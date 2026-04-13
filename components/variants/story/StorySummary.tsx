"use client";

import { memo } from "react";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { getIcon } from "@/lib/utils/map-icons";
import { GoogleRating } from "@/components/ui/GoogleRating";
import type { SummaryTheme } from "@/lib/story/types";

interface StorySummaryProps {
  themes: readonly SummaryTheme[];
  explorerUrl: string;
  reportUrl: string;
  staggerDelay?: number;
}

export default memo(function StorySummary({
  themes,
  explorerUrl,
  reportUrl,
  staggerDelay = 0,
}: StorySummaryProps) {
  const revealRef = useScrollReveal();

  return (
    <div
      ref={revealRef}
      className="w-full"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] tracking-tight">
          Ditt nabolag oppsummert
        </h2>
      </div>

      {/* Theme highlight grid */}
      <div className="grid grid-cols-2 gap-3">
        {themes.map((theme) => {
          const ThemeIcon = getIcon(theme.themeIcon);
          return (
            <div
              key={theme.themeId}
              className="bg-white border border-[#eae6e1] rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: theme.themeColor + "18" }}
                >
                  {ThemeIcon && (
                    <ThemeIcon
                      className="w-4 h-4"
                      style={{ color: theme.themeColor }}
                      strokeWidth={2}
                    />
                  )}
                </div>
                <span className="text-sm font-semibold text-[#1a1a1a]">
                  {theme.themeName}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#a0937d]">
                  Favoritt
                </span>
                <p className="text-sm font-medium text-[#1a1a1a] mt-0.5 truncate">
                  {theme.topPOI.name}
                </p>
                {theme.topPOI.googleRating != null && (
                  <GoogleRating
                    rating={theme.topPOI.googleRating}
                    reviewCount={theme.topPOI.googleReviewCount}
                    size="xs"
                  />
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-[#6a6a6a]">
                <span className="tabular-nums">{theme.poiCount} steder</span>
                <span className="text-[#d4cfc8]">|</span>
                <span className="tabular-nums">
                  {theme.avgWalkMinutes != null
                    ? `${theme.avgWalkMinutes} min snitt`
                    : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 mt-8">
        <a
          href={explorerUrl}
          className="w-full py-3.5 rounded-xl bg-[#1a1a1a] text-white font-semibold text-sm text-center hover:bg-[#2d2d2d] transition-colors shadow-md"
        >
          Utforsk mer i Explorer
        </a>
        <a
          href={reportUrl}
          className="w-full py-3.5 rounded-xl bg-white border border-[#eae6e1] text-[#1a1a1a] font-semibold text-sm text-center hover:bg-[#faf9f7] hover:border-[#d4cfc8] transition-colors"
        >
          Se full rapport
        </a>
      </div>
    </div>
  );
});
