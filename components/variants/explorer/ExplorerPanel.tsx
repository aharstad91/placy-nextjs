"use client";

import { useRef, useEffect, useCallback } from "react";
import type { POI, Category } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { EXPLORER_PACKAGES } from "./explorer-packages";
import ExplorerPOICard from "./ExplorerPOICard";
import * as LucideIcons from "lucide-react";
import { Compass, Sparkles } from "lucide-react";

interface ExplorerPanelProps {
  pois: POI[];
  allPOIs: POI[];
  categories: Category[];
  activeCategories: Set<string>;
  activePOI: string | null;
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
}

export default function ExplorerPanel({
  pois,
  allPOIs,
  categories,
  activeCategories,
  activePOI,
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
        {/* Onboarding header */}
        {projectName && (
          <div className="px-4 pt-4 pb-1">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-500 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700">
                Utforsk nabolaget rundt{" "}
                <span className="font-semibold text-gray-900">{projectName}</span>
              </span>
            </div>
          </div>
        )}

        {/* Context hint */}
        {contextHint && !projectName && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Compass className="w-4 h-4 text-sky-500 flex-shrink-0" />
              <span>{contextHint}</span>
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

        {/* Count indicator */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {visibleCount} av {totalCount} steder synlige
          </span>
          {travelTimesLoading && (
            <span className="text-xs text-sky-500 animate-pulse">
              Beregner gangtider…
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
          <div className="divide-y divide-gray-50">
            {pois.map((poi) => (
              <div key={poi.id} ref={setCardRef(poi.id)}>
                <ExplorerPOICard
                  poi={poi}
                  isActive={activePOI === poi.id}
                  onClick={() => onPOIClick(poi.id)}
                  openingHours={openingHoursData?.get(poi.id)}
                  travelTimesLoading={travelTimesLoading}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
