"use client";

import { useState } from "react";
import type { Coordinates } from "@/lib/types";
import type { StoryTheme } from "./story-data";
import { getIcon } from "@/lib/utils/map-icons";
import dynamic from "next/dynamic";
import { Star, MapPin } from "lucide-react";
import { linkPOIsInText } from "./story-text-linker";
import StoryPOIDialog from "./StoryPOIDialog";
import type { POI } from "@/lib/types";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

const StoryMap = dynamic(() => import("./StoryMap"), { ssr: false });

interface StoryThemeChapterProps {
  theme: StoryTheme;
  center: Coordinates;
}

export default function StoryThemeChapter({ theme, center }: StoryThemeChapterProps) {
  const Icon = getIcon(theme.icon);
  const [activePOI, setActivePOI] = useState<POI | null>(null);
  const [mapActivated, setMapActivated] = useState(false);

  // Link POI names in extended text
  const segments = theme.extendedBridgeText
    ? linkPOIsInText(theme.extendedBridgeText, theme.allPOIs)
    : [];

  return (
    <section id={theme.id} className="py-12 md:py-20 scroll-mt-16">
      {/* Theme separator */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-px flex-1 bg-[#e0dcd6]" />
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ backgroundColor: theme.color + "18" }}
        >
          <Icon className="w-5 h-5" style={{ color: theme.color }} />
        </div>
        <div className="h-px flex-1 bg-[#e0dcd6]" />
      </div>

      {/* Theme name */}
      <h2
        className="text-2xl md:text-3xl font-semibold text-[#1a1a1a] text-center mb-6"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {theme.name}
      </h2>

      {/* Bridge text — the "placard at the entrance" */}
      <p className="text-xl md:text-2xl text-[#3a3a3a] leading-relaxed text-center mb-8 max-w-lg mx-auto italic">
        {theme.bridgeText}
      </p>

      {/* Extended bridge text with inline POI links + HoverCard previews */}
      {segments.length > 0 && (
        <div className="mb-10 max-w-xl mx-auto text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
          {segments.map((seg, i) =>
            seg.type === "poi" && seg.poi ? (
              <POIInlineLink
                key={i}
                poi={seg.poi}
                content={seg.content}
                onClick={() => setActivePOI(seg.poi!)}
              />
            ) : (
              <span key={i}>{seg.content}</span>
            ),
          )}
        </div>
      )}

      {/* Fallback: plain text if no extended bridge text */}
      {!theme.extendedBridgeText && (
        <div className="mb-10 max-w-xl mx-auto">
          <p className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
            {theme.bridgeText}
          </p>
        </div>
      )}

      {/* Stats + map */}
      <div className="text-center text-sm text-[#8a8a8a] mb-4">
        {theme.stats.totalPOIs} steder
        {theme.stats.avgRating != null && (
          <> · snitt ★ {theme.stats.avgRating.toFixed(1)}</>
        )}
      </div>

      <StoryMap
        pois={theme.allPOIs}
        center={center}
        themeColor={theme.color}
        activated={mapActivated}
        onActivate={() => setMapActivated(true)}
        onPOIClick={(poi) => setActivePOI(poi)}
      />

      {/* POI dialog */}
      <StoryPOIDialog poi={activePOI} onClose={() => setActivePOI(null)} />
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
