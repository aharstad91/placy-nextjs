"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { POI, TravelMode } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import {
  Compass,
  ChevronDown,
  Check,
  Footprints,
  Bike,
  Car,
} from "lucide-react";
import type { ThemeDefinition } from "@/lib/themes";
import ExplorerPOICard from "./ExplorerPOICard";
import ExplorerThemeChips from "./ExplorerThemeChips";
import ExplorerDayFilter from "./ExplorerDayFilter";
import KompassTabs from "./KompassTabs";
import KompassTimeline from "./KompassTimeline";
import { SkeletonPOIList } from "@/components/ui/SkeletonPOIList";

interface ExplorerPanelProps {
  pois: POI[];
  allPOIs: POI[];
  disabledCategories: Set<string>;
  activePOI: string | null;
  highlightedPOI?: string | null;
  contextHint: string | null;
  onPOIClick: (poiId: string) => void;
  onToggleAllInTheme: (themeId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  visibleCount: number;
  totalCount: number;
  travelTimesLoading?: boolean;
  projectName?: string;
  openingHoursData?: Map<string, OpeningHoursData>;
  travelMode?: TravelMode;
  onSetTravelMode?: (mode: TravelMode) => void;
  collectionPOIs?: string[];
  onToggleCollection?: (poiId: string) => void;
  showBookmarkHeartOnly?: boolean;
  areaSlug?: string | null;
  themes: ThemeDefinition[];
  isCollectionView?: boolean;
  collectionPoiCount?: number;
  collectionCreatedAt?: string;
  collectionEmail?: string | null;
  explorerUrl?: string;
  // Event day filter
  showDayFilter?: boolean;
  eventDays?: string[];
  selectedDay?: string | null;
  onSelectDay?: (day: string | null) => void;
  dayLabels?: Record<string, string>;
  // Skeleton loading state
  showSkeleton?: boolean;
  showContent?: boolean;
  isRefreshing?: boolean;
  // Kompass
  showKompass?: boolean;
  kompassActiveTab?: "kompass" | "all";
  onKompassTabChange?: (tab: "kompass" | "all") => void;
  kompassRecommended?: POI[];
  kompassRecommendedCount?: number;
  onEditKompassFilter?: () => void;
}

const travelModeConfig: { mode: TravelMode; label: string; Icon: typeof Footprints }[] = [
  { mode: "walk", label: "Til fots", Icon: Footprints },
  { mode: "bike", label: "Sykkel", Icon: Bike },
  { mode: "car", label: "Bil", Icon: Car },
];

export default function ExplorerPanel({
  pois,
  allPOIs,
  disabledCategories,
  activePOI,
  highlightedPOI,
  contextHint,
  onPOIClick,
  onToggleAllInTheme,
  onToggleCategory,
  visibleCount,
  totalCount,
  travelTimesLoading,
  projectName,
  openingHoursData,
  travelMode = "walk",
  onSetTravelMode,
  collectionPOIs = [],
  onToggleCollection,
  showBookmarkHeartOnly,
  areaSlug,
  themes,
  isCollectionView,
  collectionPoiCount,
  collectionCreatedAt,
  collectionEmail,
  explorerUrl,
  showDayFilter,
  eventDays = [],
  selectedDay = null,
  onSelectDay,
  dayLabels,
  showSkeleton = false,
  showContent = true,
  isRefreshing = false,
  showKompass = false,
  kompassActiveTab = "all",
  onKompassTabChange,
  kompassRecommended = [],
  kompassRecommendedCount = 0,
  onEditKompassFilter,
}: ExplorerPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeDropdown, setActiveDropdown] = useState<"travel" | null>(null);

  // Scroll to active POI in list
  useEffect(() => {
    if (!activePOI || !listRef.current) return;
    const cardEl = cardRefs.current.get(activePOI);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activePOI]);

  const setCardRef = useCallback(
    (poiId: string) => (el: HTMLDivElement | null) => {
      if (el) {
        cardRefs.current.set(poiId, el);
      } else {
        cardRefs.current.delete(poiId);
      }
    },
    []
  );

  const activeTravelConfig = travelModeConfig.find((t) => t.mode === travelMode) || travelModeConfig[0];

  const closeDropdown = useCallback(() => setActiveDropdown(null), []);

  // Chip button style matching desktop
  const chipClass = "h-8 flex items-center gap-1 px-2.5 rounded-lg border border-gray-200 bg-white shadow-sm text-xs font-medium text-gray-700 active:bg-gray-100 transition-colors";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Compact header */}
      <div className="flex-shrink-0 px-4 pt-1 pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-base font-bold text-gray-900">
            {isCollectionView
              ? `Din samling — ${collectionPoiCount ?? totalCount} steder`
              : projectName ? `Utforsk ${projectName}` : "Utforsk nabolaget"}
          </h1>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {showSkeleton ? (
            <span className="text-sky-500 animate-pulse">Laster steder…</span>
          ) : (
            <>
              {visibleCount} av {totalCount} synlige
              {isRefreshing && (
                <span className="text-sky-500 animate-pulse ml-1">
                  · Oppdaterer…
                </span>
              )}
              {contextHint && !isRefreshing && (
                <span className="text-sky-600 ml-1">
                  — {contextHint}
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Theme chips + travel mode */}
      {!isCollectionView && (
        <>
          <ExplorerThemeChips
            themes={themes}
            pois={allPOIs}
            disabledCategories={disabledCategories}
            onToggleAllInTheme={onToggleAllInTheme}
            onToggleCategory={onToggleCategory}
            variant="mobile"
          />

          {/* Day filter (event projects) */}
          {showDayFilter && eventDays.length > 1 && onSelectDay && (
            <div className="flex-shrink-0">
              <ExplorerDayFilter
                days={eventDays}
                selectedDay={selectedDay}
                onSelectDay={onSelectDay}
                dayLabels={dayLabels}
                variant="mobile"
              />
            </div>
          )}

          {/* Travel mode selector */}
          <div className="flex-shrink-0 px-4 pb-2 flex items-center gap-1.5">
            {onSetTravelMode && (
              <button
                onClick={() => setActiveDropdown(activeDropdown === "travel" ? null : "travel")}
                className={cn(chipClass, activeDropdown === "travel" && "border-gray-400 bg-gray-50")}
              >
                <activeTravelConfig.Icon className="w-3.5 h-3.5 text-gray-500" />
                <span>{activeTravelConfig.label}</span>
                <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform", activeDropdown === "travel" && "rotate-180")} />
              </button>
            )}
          </div>
        </>
      )}

      {/* Travel mode dropdown panel */}
      {activeDropdown === "travel" && (
        <div className="flex-shrink-0 border-t border-b border-gray-100 bg-gray-50/80">
          <div className="py-1">
            {travelModeConfig.map(({ mode, label, Icon }) => {
              const isActive = travelMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => { onSetTravelMode?.(mode); closeDropdown(); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                    isActive ? "bg-white text-gray-900 font-medium" : "text-gray-600 active:bg-white"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {isActive && <Check className="w-3.5 h-3.5 text-gray-500" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Separator */}
      {!activeDropdown && <div className="h-px bg-gray-100 mx-4" />}

      {/* Kompass tabs */}
      {showKompass && onKompassTabChange && (
        <KompassTabs
          activeTab={kompassActiveTab}
          onTabChange={onKompassTabChange}
          kompassCount={kompassRecommendedCount}
          allCount={totalCount}
        />
      )}

      {/* Kompass timeline (when Kompass tab is active) */}
      {showKompass && kompassActiveTab === "kompass" && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <KompassTimeline
            events={kompassRecommended}
            activePOI={activePOI}
            onPOIClick={onPOIClick}
            onEditFilter={onEditKompassFilter ?? (() => {})}
          />
        </div>
      )}

      {/* POI list (when "Alle events" tab is active, or Kompass not enabled) */}
      {(!showKompass || kompassActiveTab === "all") && (
      <>
      {/* POI list */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {/* Skeleton loading state */}
        {showSkeleton && (
          <SkeletonPOIList count={5} variant="mobile" />
        )}

        {/* Actual content */}
        {showContent && (
          <div ref={listRef} className={cn(
            "h-full",
            showSkeleton ? "hidden" : "animate-content-appear"
          )}>
            {pois.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
                <Compass className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">
                  Panorer eller zoom kartet for å se steder her
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {pois.map((poi) => (
                  <div
                    key={poi.id}
                    ref={setCardRef(poi.id)}
                    className={cn(
                      "rounded-xl border overflow-hidden transition-all duration-300",
                      highlightedPOI === poi.id && "ring-2 ring-blue-500",
                      activePOI === poi.id
                        ? "border-sky-200 ring-2 ring-sky-500 ring-offset-1 shadow-md"
                        : "border-gray-200"
                    )}
                  >
                    <ExplorerPOICard
                      poi={poi}
                      isActive={activePOI === poi.id}
                      onClick={() => onPOIClick(poi.id)}
                      openingHours={openingHoursData?.get(poi.id)}
                      travelTimesLoading={travelTimesLoading}
                      travelMode={travelMode}
                      isInCollection={collectionPOIs.includes(poi.id)}
                      onToggleCollection={onToggleCollection}
                      showBookmarkHeartOnly={showBookmarkHeartOnly}
                      areaSlug={areaSlug}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Refreshing indicator overlay */}
        {isRefreshing && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-gray-200 z-10">
            <span className="text-xs text-gray-600 animate-pulse">Oppdaterer…</span>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
