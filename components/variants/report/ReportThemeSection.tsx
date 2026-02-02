import type { Coordinates } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import {
  UtensilsCrossed,
  Bus,
  ShoppingCart,
  Dumbbell,
  Star,
  Landmark,
  TreePine,
  ShoppingBag,
  Wine,
  Mountain,
  Building2,
  type LucideIcon,
} from "lucide-react";
import ReportDensityMap from "./ReportDensityMap";
import ReportHighlightCard from "./ReportHighlightCard";
import ReportCompactList from "./ReportCompactList";

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

interface ReportThemeSectionProps {
  theme: ReportTheme;
  center: Coordinates;
  explorerBaseUrl?: string | null;
  themeCategories?: string[];
  mapStyle?: string;
}

export default function ReportThemeSection({
  theme,
  center,
  explorerBaseUrl,
  themeCategories,
  mapStyle,
}: ReportThemeSectionProps) {
  const Icon = ICON_MAP[theme.icon];

  return (
    <section id={theme.id} className="py-10 md:py-14 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-6">
        {/* Section heading */}
        <div className="flex items-center gap-3 mb-3">
          {Icon && <Icon className="w-5 h-5 text-[#7a7062]" />}
          <h2 className="text-xl md:text-2xl font-semibold text-[#1a1a1a]">
            {theme.name}
          </h2>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6a6a6a] mb-6">
          <span>{theme.stats.totalPOIs} steder</span>
          {theme.stats.avgRating != null && (
            <>
              <span className="text-[#d4cfc8]">|</span>
              <span className="flex items-center gap-1">
                Snitt{" "}
                <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
                <span className="font-medium text-[#1a1a1a]">
                  {theme.stats.avgRating.toFixed(1)}
                </span>
              </span>
            </>
          )}
          {theme.stats.totalReviews > 0 && (
            <>
              <span className="text-[#d4cfc8]">|</span>
              <span>
                {theme.stats.totalReviews.toLocaleString("nb-NO")} anmeldelser
              </span>
            </>
          )}
        </div>

        {/* Theme intro */}
        {theme.intro && (
          <p className="text-base text-[#4a4a4a] leading-relaxed mb-6">
            {theme.intro}
          </p>
        )}

        {/* Density map */}
        <ReportDensityMap pois={theme.allPOIs} center={center} mapStyle={mapStyle} />

        {/* Highlight cards */}
        {theme.highlightPOIs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {theme.highlightPOIs.map((poi) => (
              <ReportHighlightCard
                key={poi.id}
                poi={poi}
                explorerBaseUrl={explorerBaseUrl}
                themeCategories={themeCategories}
              />
            ))}
          </div>
        )}

        {/* Compact list for remaining POIs */}
        <ReportCompactList
          pois={theme.listPOIs}
          explorerBaseUrl={explorerBaseUrl}
          themeCategories={themeCategories}
        />
      </div>
    </section>
  );
}
