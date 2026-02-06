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
import ReportInteractiveMapSection from "./ReportInteractiveMapSection";
import ReportAddressInput from "./ReportAddressInput";

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
  projectName?: string;
}

// Categories that indicate a transport-related theme
const TRANSPORT_CATEGORIES = new Set(["bus", "train", "tram", "bike", "parking", "carshare", "taxi", "airport"]);

export default function ReportThemeSection({
  theme,
  center,
  explorerBaseUrl,
  projectName,
}: ReportThemeSectionProps) {
  const Icon = ICON_MAP[theme.icon];

  // Check if this is a transport theme by looking at POI categories
  const isTransport = theme.allPOIs.some(poi => TRANSPORT_CATEGORIES.has(poi.category.id));

  return (
    <section id={theme.id} className="py-10 md:py-14 scroll-mt-20">
      {/* Section header - constrained width for vertical reading flow */}
      <div className="max-w-4xl">
        {/* Section heading */}
        <div className="flex items-center gap-3 mb-3">
          {Icon && <Icon className="w-5 h-5 text-[#7a7062]" />}
          <h2 className="text-xl md:text-2xl font-semibold text-[#1a1a1a]">
            {theme.name}
          </h2>
        </div>

        {/* Category quote - generated based on score */}
        <p className="text-lg md:text-xl text-[#4a4a4a] leading-relaxed mb-4">
          {theme.quote}
        </p>

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

        {/* Theme intro - additional context if provided */}
        {theme.intro && (
          <p className="text-base text-[#4a4a4a] leading-relaxed mb-6">
            {theme.intro}
          </p>
        )}

        {/* Bridge text - editorial, locally-anchored context */}
        {theme.bridgeText && (
          <p className="text-base italic text-[#5a5a5a] leading-relaxed mb-6">
            {theme.bridgeText}
          </p>
        )}

        {/* Address input for transport theme */}
        {isTransport && projectName && (
          <div className="mb-6">
            <ReportAddressInput
              propertyCoordinates={[center.lng, center.lat]}
              propertyName={projectName}
            />
          </div>
        )}
      </div>

      {/* Interactive map section - full width */}
      <ReportInteractiveMapSection
        theme={theme}
        center={center}
        sectionId={theme.id}
        explorerBaseUrl={explorerBaseUrl}
      />
    </section>
  );
}
