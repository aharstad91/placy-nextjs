"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { POI, TravelMode } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import { Compass, ChevronDown, Check, Footprints, Bike, Car } from "lucide-react";
import { DEFAULT_THEMES } from "@/lib/themes";
import ExplorerPOICard from "./ExplorerPOICard";
import ExplorerThemeChips from "./ExplorerThemeChips";
import { SkeletonPOIList } from "@/components/ui/SkeletonPOIList";

interface ExplorerPOIListProps {
  pois: POI[];
  activePOI: string | null;
  highlightedPOI?: string | null;
  contextHint: string | null;
  onPOIClick: (poiId: string) => void;
  visibleCount: number;
  totalCount: number;
  travelTimesLoading?: boolean;
  projectName?: string;
  openingHoursData?: Map<string, OpeningHoursData>;
  travelMode?: TravelMode;
  collectionPOIs?: string[];
  onToggleCollection?: (poiId: string) => void;
  // Theme filtering
  allPOIs: POI[];
  activeThemes: Set<string>;
  disabledCategories: Set<string>;
  onToggleTheme: (themeId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  // Travel mode
  onSetTravelMode?: (mode: TravelMode) => void;
  // Skeleton loading state
  showSkeleton?: boolean;
  showContent?: boolean;
  isRefreshing?: boolean;
}

const travelModeConfig: { mode: TravelMode; label: string; Icon: typeof Footprints }[] = [
  { mode: "walk", label: "Til fots", Icon: Footprints },
  { mode: "bike", label: "Sykkel", Icon: Bike },
  { mode: "car", label: "Bil", Icon: Car },
];

export default function ExplorerPOIList({
  pois,
  activePOI,
  highlightedPOI,
  contextHint,
  onPOIClick,
  visibleCount,
  totalCount,
  travelTimesLoading,
  projectName,
  openingHoursData,
  travelMode = "walk",
  collectionPOIs = [],
  onToggleCollection,
  allPOIs,
  activeThemes,
  disabledCategories,
  onToggleTheme,
  onToggleCategory,
  onSetTravelMode,
  showSkeleton = false,
  showContent = true,
  isRefreshing = false,
}: ExplorerPOIListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const travelDropdownRef = useRef<HTMLDivElement>(null);
  const [travelDropdownOpen, setTravelDropdownOpen] = useState(false);

  // Close travel dropdown on click outside
  useEffect(() => {
    if (!travelDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (travelDropdownRef.current && !travelDropdownRef.current.contains(e.target as Node)) {
        setTravelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [travelDropdownOpen]);

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

  const travelChipClass = "h-9 flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 shadow-sm transition-colors text-sm font-medium text-gray-700";

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-3">
        <h1 className="text-lg font-bold text-gray-900">
          {projectName ? `Utforsk ${projectName}` : "Utforsk nabolaget"}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {showSkeleton ? (
            <span className="text-sky-500 animate-pulse">Laster steder…</span>
          ) : (
            <>
              {visibleCount} av {totalCount} steder synlige
              {isRefreshing && (
                <span className="text-sky-500 animate-pulse ml-2">
                  Oppdaterer…
                </span>
              )}
            </>
          )}
        </p>
        {contextHint && !showSkeleton && !isRefreshing && (
          <p className="text-xs text-sky-600 mt-1">{contextHint}</p>
        )}
      </div>

      {/* Theme chips + travel mode */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-2 px-8 pb-2">
          <div className="flex-1 min-w-0">
            <ExplorerThemeChips
              themes={DEFAULT_THEMES}
              pois={allPOIs}
              activeThemes={activeThemes}
              disabledCategories={disabledCategories}
              onToggleTheme={onToggleTheme}
              onToggleCategory={onToggleCategory}
              variant="desktop"
            />
          </div>

          {/* Travel mode dropdown */}
          <div ref={travelDropdownRef} className="relative flex-shrink-0">
            <button
              onClick={() => setTravelDropdownOpen((p) => !p)}
              className={cn(travelChipClass)}
            >
              <activeTravelConfig.Icon className="w-4 h-4 text-gray-500" />
              <span>{activeTravelConfig.label}</span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", travelDropdownOpen && "rotate-180")} />
            </button>

            {travelDropdownOpen && (
              <div className="absolute top-full mt-1.5 right-0 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50">
                {travelModeConfig.map(({ mode, label, Icon }) => {
                  const isActive = travelMode === mode;

                  return (
                    <button
                      key={mode}
                      onClick={() => { onSetTravelMode?.(mode); setTravelDropdownOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                        isActive ? "bg-gray-50 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-gray-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-gray-200/50 mx-8" />

      {/* POI list + collection bar */}
      <div className="relative flex-1 overflow-hidden">
        {/* Skeleton loading state */}
        {showSkeleton && (
          <SkeletonPOIList count={6} variant="desktop" />
        )}

        {/* Actual content */}
        {showContent && (
          <div ref={listRef} className={cn(
            "h-full overflow-y-auto pb-4",
            showSkeleton ? "hidden" : "animate-content-appear"
          )}>
            {pois.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-12 py-12">
                <Compass className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">
                  Panorer eller zoom kartet for å se steder her
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 px-8 py-4">
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

        {/* Gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
          <div className="h-12 bg-gradient-to-t from-white/90 to-transparent" />
        </div>
      </div>
    </>
  );
}
