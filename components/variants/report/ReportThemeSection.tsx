"use client";

import { useState } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { TRANSPORT_CATEGORIES } from "./report-data";
import { useLocale } from "@/lib/i18n/locale-context";
import { Star, MapPin } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { linkPOIsInText } from "@/lib/utils/story-text-linker";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import ReportAddressInput from "./ReportAddressInput";

interface ReportThemeSectionProps {
  theme: ReportTheme;
  center: Coordinates;
  projectName?: string;
  /** Callback ref to register this section for IntersectionObserver tracking */
  registerRef?: (el: HTMLElement | null) => void;
  /** When true, uses narrative layout optimized for sticky map (desktop) */
  useStickyMap?: boolean;
  /** Callback when a POI is clicked (for sticky map sync — fly-to) */
  onPOIClick?: (poiId: string) => void;
  /** Visual variant — "secondary" uses smaller header */
  variant?: "primary" | "secondary";
}

export default function ReportThemeSection({
  theme,
  center,
  projectName,
  registerRef,
  useStickyMap,
  onPOIClick,
  variant = "primary",
}: ReportThemeSectionProps) {
  const { locale } = useLocale();
  const Icon = getIcon(theme.icon);
  const isTransport = theme.allPOIs.some((poi) =>
    TRANSPORT_CATEGORIES.has(poi.category.id)
  );

  const handleInlinePOIClick = (poi: POI) => {
    // Sync with map — fly to marker
    onPOIClick?.(poi.id);
  };

  // Parse extended bridge text into segments with inline POI links
  const segments = theme.extendedBridgeText
    ? linkPOIsInText(theme.extendedBridgeText, theme.allPOIs)
    : [];

  return (
    <section
      id={theme.id}
      ref={registerRef}
      className="min-h-[80vh] py-16 md:py-24 scroll-mt-[7rem]"
    >
      <div className="max-w-4xl">
        {/* Section heading */}
        <div className="flex items-center gap-3 mb-4">
          <Icon className={variant === "secondary" ? "w-5 h-5 text-[#a0937d]" : "w-6 h-6 text-[#7a7062]"} />
          <h2 className={variant === "secondary"
            ? "text-xl md:text-2xl font-semibold text-[#6a6a6a]"
            : "text-2xl md:text-3xl font-semibold text-[#1a1a1a]"
          }>
            {theme.name}
          </h2>
        </div>

        {/* Category quote — editorial pitch */}
        {variant !== "secondary" && theme.quote && (
          <p className="text-xl md:text-2xl text-[#4a4a4a] leading-relaxed mb-5">
            {theme.quote}
          </p>
        )}

        {/* Bridge text — short narrative intro */}
        {theme.bridgeText && (
          <p className="text-lg italic text-[#5a5a5a] leading-relaxed mb-6">
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

        {/* Extended narrative text with inline POI links */}
        {segments.length > 0 && (
          <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
            {segments.map((seg, i) =>
              seg.type === "poi" && seg.poi ? (
                <POIInlineLink
                  key={i}
                  poi={seg.poi}
                  content={seg.content}
                  onClick={() => handleInlinePOIClick(seg.poi!)}
                />
              ) : (
                <span key={i}>{seg.content}</span>
              ),
            )}
          </div>
        )}

        {/* Fallback: show intro if no extended text */}
        {segments.length === 0 && theme.intro && (
          <p className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
            {theme.intro}
          </p>
        )}

        {/* Data-driven category insight */}
        <ThemeInsight theme={theme} />
      </div>
    </section>
  );
}

// --- Data-driven category insight ---

function ThemeInsight({ theme }: { theme: ReportTheme }) {
  const insights = generateThemeInsights(theme);
  if (insights.length === 0) return null;

  return (
    <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#4a4a4a]">
      {insights.map((insight, i) => (
        <div key={i} className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-[#1a1a1a]">{insight.value}</span>
          <span className="text-[#6a6a6a]">{insight.label}</span>
        </div>
      ))}
    </div>
  );
}

interface InsightItem {
  value: string;
  label: string;
}

function generateThemeInsights(theme: ReportTheme): InsightItem[] {
  const pois = theme.allPOIs;
  if (pois.length === 0) return [];

  const nearestWalkMin = pois[0]?.travelTime?.walk
    ? Math.round(pois[0].travelTime.walk / 60)
    : null;

  const within5 = pois.filter((p) => p.travelTime?.walk && p.travelTime.walk <= 300).length;
  const within10 = pois.filter((p) => p.travelTime?.walk && p.travelTime.walk <= 600).length;

  const items: InsightItem[] = [];
  const id = theme.id;

  if (id === "barn-oppvekst") {
    const schools = pois.filter((p) => p.category.id === "skole");
    const kindergartens = pois.filter((p) => p.category.id === "barnehage");
    if (schools.length > 0) items.push({ value: String(schools.length), label: schools.length === 1 ? "skole" : "skoler" });
    if (kindergartens.length > 0) items.push({ value: String(kindergartens.length), label: "barnehager" });
    if (nearestWalkMin != null) items.push({ value: `${nearestWalkMin} min`, label: "til nærmeste" });
  } else if (id === "hverdagsliv" || id === "hverdagstjenester") {
    const grocery = pois.filter((p) => ["supermarket", "convenience"].includes(p.category.id));
    if (grocery.length > 0) items.push({ value: String(grocery.length), label: grocery.length === 1 ? "dagligvare" : "dagligvarer" });
    if (within5 > 0) items.push({ value: String(within5), label: "innen 5 min" });
    items.push({ value: String(pois.length), label: "steder totalt" });
  } else if (id === "transport") {
    const bus = pois.filter((p) => p.category.id === "bus");
    if (bus.length > 0) items.push({ value: String(bus.length), label: "holdeplasser" });
    if (within5 > 0) items.push({ value: String(within5), label: "innen 5 min gange" });
    if (nearestWalkMin != null) items.push({ value: `${nearestWalkMin} min`, label: "til nærmeste stopp" });
  } else {
    // Generic fallback
    items.push({ value: String(pois.length), label: "steder" });
    if (within10 > 0) items.push({ value: String(within10), label: "innen 10 min" });
    if (theme.stats.avgRating != null) items.push({ value: theme.stats.avgRating.toFixed(1), label: "snittrating" });
  }

  return items;
}

// --- POI inline link with Popover ---

function POIInlineLink({ poi, content, onClick }: { poi: POI; content: string; onClick: () => void }) {
  const Icon = getIcon(poi.category.icon);
  const walkMin = poi.travelTime?.walk ? Math.round(poi.travelTime.walk / 60) : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
          className="font-semibold text-[#1a1a1a] underline decoration-[#d4cfc8] decoration-2 underline-offset-2 hover:decoration-[#8a8a8a] transition-colors cursor-pointer"
        >
          {content}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-4 gap-0">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
            style={{ backgroundColor: poi.category.color + "18" }}
          >
            <Icon className="w-4 h-4" style={{ color: poi.category.color }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm leading-tight truncate">{poi.name}</div>
            <div className="text-xs text-muted-foreground">{poi.category.name}</div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground mb-2">
          {poi.googleRating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
              <span className="font-medium text-foreground">{poi.googleRating.toFixed(1)}</span>
              {poi.googleReviewCount != null && <span>({poi.googleReviewCount})</span>}
            </span>
          )}
          {walkMin != null && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {walkMin} min gange
            </span>
          )}
        </div>

        {/* Editorial content */}
        {poi.editorialHook && (
          <p className="text-[13px] text-[#3a3a3a] leading-relaxed">{poi.editorialHook}</p>
        )}
        {poi.localInsight && (
          <p className="text-xs text-muted-foreground italic leading-relaxed mt-1.5">{poi.localInsight}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
