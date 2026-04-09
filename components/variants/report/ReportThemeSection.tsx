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
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import StoryPOIDialog from "@/components/variants/story/StoryPOIDialog";
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

  // POI dialog state (local to this theme section)
  const [dialogPOI, setDialogPOI] = useState<POI | null>(null);

  const handleInlinePOIClick = (poi: POI) => {
    setDialogPOI(poi);
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
      className="py-12 md:py-16 scroll-mt-[7rem]"
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
      </div>

      {/* POI dialog — 5-variant system from Story */}
      <StoryPOIDialog poi={dialogPOI} onClose={() => setDialogPOI(null)} />
    </section>
  );
}

// --- POI inline link with HoverCard preview ---

function POIInlineLink({ poi, content, onClick }: { poi: POI; content: string; onClick: () => void }) {
  const Icon = getIcon(poi.category.icon);
  const walkMin = poi.travelTime?.walk ? Math.round(poi.travelTime.walk / 60) : null;
  const [hoverOpen, setHoverOpen] = useState(false);

  const handleClick = () => {
    setHoverOpen(false);
    onClick();
  };

  return (
    <HoverCard open={hoverOpen} onOpenChange={setHoverOpen} openDelay={400} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
          aria-haspopup="dialog"
          className="font-semibold text-[#1a1a1a] underline decoration-[#d4cfc8] decoration-2 underline-offset-2 hover:decoration-[#8a8a8a] transition-colors cursor-pointer"
        >
          {content}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-64 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
            style={{ backgroundColor: poi.category.color + "18" }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: poi.category.color }} />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm leading-tight truncate">{poi.name}</div>
            <div className="text-xs text-muted-foreground">{poi.category.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {poi.googleRating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
              {poi.googleRating.toFixed(1)}
              {poi.googleReviewCount != null && <span>({poi.googleReviewCount})</span>}
            </span>
          )}
          {walkMin != null && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {walkMin} min
            </span>
          )}
        </div>
        {poi.editorialHook && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{poi.editorialHook}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
