"use client";

import type { ReportHeroMetrics, ReportTheme } from "./report-data";
import { useLocale } from "@/lib/i18n/locale-context";
import { t } from "@/lib/i18n/strings";
import ReportLocaleToggle from "./ReportLocaleToggle";
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
  const { locale } = useLocale();

  const handleThemeClick = (themeId: string) => {
    const el = document.getElementById(themeId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const numLocale = locale === "en" ? "en-US" : "nb-NO";

  return (
    <section className="col-span-12 pt-8 pb-14 md:pt-14 md:pb-20">
      {/* Text content - constrained width */}
      <div className="max-w-4xl relative">
        {/* Locale toggle - top right */}
        <div className="absolute top-0 right-0">
          <ReportLocaleToggle />
        </div>

        {/* Label */}
        <p className="text-sm uppercase tracking-[0.2em] text-[#a0937d] mb-5">
          {label ?? t(locale, "label")}
        </p>

        {/* Project name */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-[#1a1a1a] leading-tight mb-8">
          {projectName}
        </h1>

        {/* Custom intro paragraph */}
        {heroIntro && (
          <p className="text-xl md:text-2xl text-[#4a4a4a] leading-relaxed mb-5">
            {heroIntro}
          </p>
        )}

        {/* Summary paragraph with inline metrics */}
        <p className="text-xl md:text-2xl text-[#4a4a4a] leading-relaxed">
          {t(locale, "inTheArea")}{" "}
          <span className="font-semibold text-[#1a1a1a]">
            {metrics.totalPOIs} {t(locale, "places")}
          </span>{" "}
          {t(locale, "withinWalking")}.{" "}
          {metrics.ratedPOIs > 0 && (
            <>
              {t(locale, "the")}{" "}
              <span className="font-semibold text-[#1a1a1a]">
                {metrics.ratedPOIs} {t(locale, "rated")}
              </span>{" "}
              {t(locale, "hasAvgOf")}{" "}
              <span className="font-semibold text-[#b45309]">
                {metrics.avgRating.toFixed(1)} ★
              </span>
              {metrics.totalReviews > 0 && (
                <>
                  {" "}
                  {t(locale, "basedOn")}{" "}
                  <span className="font-semibold text-[#1a1a1a]">
                    {metrics.totalReviews.toLocaleString(numLocale)} {t(locale, "reviews")}
                  </span>
                </>
              )}
              .{" "}
            </>
          )}
          {metrics.transportCount > 0 && (
            <>
              <span className="font-semibold text-[#1a1a1a]">
                {metrics.transportCount} {t(locale, "transportPoints")}
              </span>{" "}
              {t(locale, "easyToGetAround")}.
            </>
          )}
        </p>
      </div>

      {/* Theme navigation - larger cards with stats */}
      {themes.length > 0 && (
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                  <Icon className="w-7 h-7 text-[#7a7062] group-hover:text-[#5a5042] mb-2 transition-colors" />
                )}

                {/* Theme name */}
                <span className="font-semibold text-[#1a1a1a] text-base leading-tight mb-1">
                  {theme.name}
                </span>

                {/* Stats row */}
                <div className="flex items-center gap-2 text-sm text-[#6a6a6a]">
                  <span>{theme.stats.totalPOIs} {t(locale, "places")}</span>
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
      <div className="mt-14 h-px bg-[#e8e4df]" />
    </section>
  );
}
