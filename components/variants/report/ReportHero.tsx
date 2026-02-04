"use client";

import type { ReportHeroMetrics, ReportTheme } from "./report-data";
import {
  UtensilsCrossed,
  Bus,
  ShoppingCart,
  Dumbbell,
  Landmark,
  TreePine,
  ShoppingBag,
  Wine,
  Mountain,
  Building2,
  Star,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Bus,
  ShoppingCart,
  Dumbbell,
  Landmark,
  TreePine,
  ShoppingBag,
  Wine,
  Mountain,
  Building2,
};

interface ReportHeroProps {
  projectName: string;
  metrics: ReportHeroMetrics;
  themes: ReportTheme[];
  label?: string;
  heroIntro?: string;
}

export default function ReportHero({ projectName, metrics, themes, label, heroIntro }: ReportHeroProps) {
  const handleThemeClick = (themeId: string) => {
    const el = document.getElementById(themeId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="col-span-12 pt-6 pb-12 md:pt-12 md:pb-16">
      {/* Text content - constrained width */}
      <div className="max-w-4xl">
        {/* Label */}
        <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-4">
          {label ?? "Nabolagsrapport"}
        </p>

        {/* Project name */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#1a1a1a] leading-tight mb-6">
          {projectName}
        </h1>

        {/* Custom intro paragraph */}
        {heroIntro && (
          <p className="text-lg md:text-xl text-[#4a4a4a] leading-relaxed mb-4">
            {heroIntro}
          </p>
        )}

        {/* Summary paragraph with inline metrics */}
        <p className="text-lg md:text-xl text-[#4a4a4a] leading-relaxed">
          I nærområdet finner du{" "}
          <span className="font-semibold text-[#1a1a1a]">
            {metrics.totalPOIs} steder
          </span>{" "}
          innen gåavstand.{" "}
          {metrics.ratedPOIs > 0 && (
            <>
              De{" "}
              <span className="font-semibold text-[#1a1a1a]">
                {metrics.ratedPOIs} vurderte
              </span>{" "}
              har et snitt på{" "}
              <span className="font-semibold text-[#b45309]">
                {metrics.avgRating.toFixed(1)} ★
              </span>
              {metrics.totalReviews > 0 && (
                <>
                  {" "}
                  basert på{" "}
                  <span className="font-semibold text-[#1a1a1a]">
                    {metrics.totalReviews.toLocaleString("nb-NO")} anmeldelser
                  </span>
                </>
              )}
              .{" "}
            </>
          )}
          {metrics.transportCount > 0 && (
            <>
              <span className="font-semibold text-[#1a1a1a]">
                {metrics.transportCount} transportpunkter
              </span>{" "}
              gjør det enkelt å komme seg rundt.
            </>
          )}
        </p>
      </div>

      {/* Theme navigation - larger cards with stats */}
      {themes.length > 0 && (
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {themes.map((theme) => {
            const Icon = ICON_MAP[theme.icon];
            return (
              <button
                key={theme.id}
                onClick={() => handleThemeClick(theme.id)}
                className="group flex flex-col items-start p-4 bg-white border border-[#eae6e1] rounded-xl hover:border-[#c0b9ad] hover:shadow-sm transition-all text-left"
              >
                {/* Icon */}
                {Icon && (
                  <Icon className="w-6 h-6 text-[#7a7062] group-hover:text-[#5a5042] mb-2 transition-colors" />
                )}

                {/* Theme name */}
                <span className="font-semibold text-[#1a1a1a] text-sm leading-tight mb-1">
                  {theme.name}
                </span>

                {/* Stats row */}
                <div className="flex items-center gap-2 text-xs text-[#6a6a6a]">
                  <span>{theme.stats.totalPOIs} steder</span>
                  {theme.stats.avgRating != null && (
                    <>
                      <span className="text-[#d4cfc8]">·</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-[#b45309] fill-[#b45309]" />
                        {theme.stats.avgRating.toFixed(1)}
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Divider */}
      <div className="mt-10 h-px bg-[#e8e4df]" />
    </section>
  );
}
