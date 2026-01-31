"use client";

import { useRef, useEffect, useCallback } from "react";
import type { POI, Category, TravelMode, TimeBudget } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn, isWithinTimeBudget } from "@/lib/utils";
import { EXPLORER_PACKAGES } from "./explorer-packages";
import ExplorerPOICard from "./ExplorerPOICard";
import * as LucideIcons from "lucide-react";
import { Compass, Sparkles, Search, X, Footprints, Bike, Car } from "lucide-react";

// Travel mode options matching theme story modal
const travelModes: { mode: TravelMode; label: string; icon: React.ReactNode }[] = [
  { mode: "walk", label: "Til fots", icon: <Footprints className="w-4 h-4" /> },
  { mode: "bike", label: "Sykkel", icon: <Bike className="w-4 h-4" /> },
  { mode: "car", label: "Bil", icon: <Car className="w-4 h-4" /> },
];

const timeBudgets: TimeBudget[] = [5, 10, 15];

interface ExplorerPanelProps {
  pois: POI[];
  allPOIs: POI[];
  categories: Category[];
  activeCategories: Set<string>;
  activePOI: string | null;
  highlightedPOI?: string | null;
  contextHint: string | null;
  onPOIClick: (poiId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  onToggleAll: () => void;
  visibleCount: number;
  totalCount: number;
  travelTimesLoading?: boolean;
  projectName?: string;
  openingHoursData?: Map<string, OpeningHoursData>;
  activePackage?: string | null;
  onSelectPackage?: (packageId: string) => void;
  travelMode?: TravelMode;
  timeBudget?: TimeBudget;
  onSetTravelMode?: (mode: TravelMode) => void;
  onSetTimeBudget?: (budget: TimeBudget) => void;
  poisWithinBudgetCount?: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function ExplorerPanel({
  pois,
  allPOIs,
  categories,
  activeCategories,
  activePOI,
  highlightedPOI,
  contextHint,
  onPOIClick,
  onToggleCategory,
  onToggleAll,
  visibleCount,
  totalCount,
  travelTimesLoading,
  projectName,
  openingHoursData,
  activePackage,
  onSelectPackage,
  travelMode = "walk",
  timeBudget = 15,
  onSetTravelMode,
  onSetTimeBudget,
  poisWithinBudgetCount,
  searchQuery = "",
  onSearchChange,
}: ExplorerPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // Get Lucide icon component
  const getIcon = (iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  };

  // Count POIs per category (from all POIs, not just visible)
  const categoryCounts = new Map<string, number>();
  for (const poi of allPOIs) {
    const count = categoryCounts.get(poi.category.id) || 0;
    categoryCounts.set(poi.category.id, count + 1);
  }

  // Count POIs per package
  const packageCounts = EXPLORER_PACKAGES.map((pkg) => {
    if (pkg.id === "all") return allPOIs.length;
    const ids = new Set(pkg.categoryIds);
    return allPOIs.filter((poi) => ids.has(poi.category.id)).length;
  });

  // Only show categories that exist in data
  const availableCategories = categories.filter(
    (c) => (categoryCounts.get(c.id) || 0) > 0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-100">
        {/* Dark header — matches theme story modal */}
        <div className="p-4 pb-3 bg-gray-900 text-white">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Neighborhood Story
          </h2>
          <h1 className="text-xl font-bold mb-1">
            {projectName ? `Utforsk ${projectName}` : "Utforsk nabolaget"}
          </h1>
          <p className="text-sm text-gray-400">
            {totalCount} steder funnet
            {poisWithinBudgetCount != null && (
              <>
                <br />
                <span className="text-sky-400">
                  {poisWithinBudgetCount} highlighted within ≤{timeBudget} min
                </span>
              </>
            )}
          </p>
        </div>

        {/* Travel mode + Time budget controls */}
        {onSetTravelMode && onSetTimeBudget && (
          <div className="px-4 py-3 border-b border-gray-100 bg-white">
            <div className="flex flex-wrap gap-4">
              {/* Travel Mode */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Travel Mode</label>
                <div className="flex gap-1">
                  {travelModes.map(({ mode, label, icon }) => (
                    <button
                      key={mode}
                      onClick={() => onSetTravelMode(mode)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                        travelMode === mode
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Budget */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Time Budget</label>
                <div className="flex gap-1">
                  {timeBudgets.map((budget) => (
                    <button
                      key={budget}
                      onClick={() => onSetTimeBudget(budget)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        timeBudget === budget
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {budget} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search field */}
        {onSearchChange && (
          <div className="px-4 py-2 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Søk etter steder..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Package buttons */}
        {onSelectPackage && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {EXPLORER_PACKAGES.map((pkg, idx) => {
                const Icon = getIcon(pkg.icon);
                const isActive = activePackage === pkg.id;
                const count = packageCounts[idx];

                if (count === 0 && pkg.id !== "all") return null;

                return (
                  <button
                    key={pkg.id}
                    onClick={() => onSelectPackage(pkg.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                      isActive
                        ? "bg-gray-900 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{pkg.name}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isActive ? "bg-white/20" : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Category filters — horizontal scroll */}
        <div className="px-4 py-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {availableCategories.map((category) => {
              const Icon = getIcon(category.icon);
              const isActive = activeCategories.has(category.id);
              const count = categoryCounts.get(category.id) || 0;

              return (
                <button
                  key={category.id}
                  onClick={() => onToggleCategory(category.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 min-h-[36px] ${
                    isActive
                      ? "text-white shadow-sm"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  }`}
                  style={{
                    backgroundColor: isActive ? category.color : undefined,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{category.name}</span>
                  <span
                    className={`ml-0.5 px-1.5 rounded-full text-[10px] ${
                      isActive ? "bg-white/20" : "bg-gray-200"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Count indicator + context hint */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {visibleCount} av {totalCount} steder synlige
          </span>
          {travelTimesLoading && (
            <span className="text-xs text-sky-500 animate-pulse">
              Beregner gangtider…
            </span>
          )}
          {contextHint && !travelTimesLoading && (
            <span className="text-xs text-gray-400">
              — {contextHint}
            </span>
          )}
        </div>
      </div>

      {/* POI list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {pois.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
            <Compass className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">
              Panorer eller zoom kartet for å se steder her
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
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
                  isOutsideBudget={!travelTimesLoading && poi.travelTime?.[travelMode] != null && !isWithinTimeBudget(poi.travelTime?.[travelMode], timeBudget)}
                  travelMode={travelMode}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
