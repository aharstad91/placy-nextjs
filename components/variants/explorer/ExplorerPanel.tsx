"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { POI, Category, TravelMode } from "@/lib/types";
import type { CategoryPackage } from "./explorer-packages";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import {
  Compass,
  ChevronDown,
  Check,
  SlidersHorizontal,
  Footprints,
  Bike,
  Car,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import ExplorerPOICard from "./ExplorerPOICard";

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
  travelMode?: TravelMode;
  onSetTravelMode?: (mode: TravelMode) => void;
  collectionPOIs?: string[];
  onToggleCollection?: (poiId: string) => void;
  isCollectionView?: boolean;
  collectionPoiCount?: number;
  collectionCreatedAt?: string;
  collectionEmail?: string | null;
  explorerUrl?: string;
  // Package filtering (matching desktop)
  packages?: CategoryPackage[];
  activePackage?: string | null;
  onSelectPackage?: (id: string) => void;
}

const travelModeConfig: { mode: TravelMode; label: string; Icon: typeof Footprints }[] = [
  { mode: "walk", label: "Til fots", Icon: Footprints },
  { mode: "bike", label: "Sykkel", Icon: Bike },
  { mode: "car", label: "Bil", Icon: Car },
];

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
  travelMode = "walk",
  onSetTravelMode,
  collectionPOIs = [],
  onToggleCollection,
  isCollectionView,
  collectionPoiCount,
  collectionCreatedAt,
  collectionEmail,
  explorerUrl,
  packages,
  activePackage,
  onSelectPackage,
}: ExplorerPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeDropdown, setActiveDropdown] = useState<"pkg" | "cat" | "travel" | null>(null);

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

  const getIcon = useCallback((iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  }, []);

  // Package data
  const packageData = useMemo(() => {
    if (!packages) return [];
    const catMap = new Map(categories.map((c) => [c.id, c]));
    return packages.map((pkg) => {
      const catIds = pkg.id === "all"
        ? new Set(categories.map((c) => c.id))
        : new Set(pkg.categoryIds.filter((id) => catMap.has(id)));
      const poiCount = allPOIs.filter((p) => catIds.has(p.category.id)).length;
      return { pkg, catIds, poiCount };
    }).filter((d) => d.pkg.id === "all" || d.poiCount > 0);
  }, [packages, categories, allPOIs]);

  const activePackageDef = useMemo(() => {
    return packageData.find((d) => d.pkg.id === activePackage) || packageData[0];
  }, [packageData, activePackage]);

  // Categories scoped to active package
  const dropdownCategories = useMemo(() => {
    if (!packages || !activePackage || activePackage === "all") return categories;
    const pkg = packages.find((p) => p.id === activePackage);
    if (!pkg) return categories;
    const catIds = new Set(pkg.categoryIds);
    return categories.filter((c) => catIds.has(c.id));
  }, [activePackage, packages, categories]);

  // POI count per category
  const poiCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const poi of allPOIs) {
      counts.set(poi.category.id, (counts.get(poi.category.id) || 0) + 1);
    }
    return counts;
  }, [allPOIs]);

  const activeTravelConfig = travelModeConfig.find((t) => t.mode === travelMode) || travelModeConfig[0];

  const handleSelectPackage = useCallback((pkgId: string) => {
    onSelectPackage?.(pkgId);
    setActiveDropdown(null);
  }, [onSelectPackage]);

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
          {visibleCount} av {totalCount} synlige
          {travelTimesLoading && (
            <span className="text-sky-500 animate-pulse ml-1">
              · Beregner…
            </span>
          )}
          {contextHint && !travelTimesLoading && (
            <span className="text-sky-600 ml-1">
              — {contextHint}
            </span>
          )}
        </p>
      </div>

      {/* Toolbar — matches desktop dropdowns in compact pill form */}
      {!isCollectionView && (
        <div className="flex-shrink-0 px-4 pb-2 flex items-center gap-1.5">
          {/* Package selector */}
          {packages && activePackageDef && (
            <button
              onClick={() => setActiveDropdown(activeDropdown === "pkg" ? null : "pkg")}
              className={cn(chipClass, activeDropdown === "pkg" && "border-gray-400 bg-gray-50")}
            >
              {(() => {
                const PkgIcon = getIcon(activePackageDef.pkg.icon);
                return <PkgIcon className="w-3.5 h-3.5 text-gray-500" />;
              })()}
              <span className="truncate max-w-[60px]">{activePackageDef.pkg.name}</span>
              <span className="text-[10px] text-gray-400 tabular-nums">({activePackageDef.poiCount})</span>
              <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform", activeDropdown === "pkg" && "rotate-180")} />
            </button>
          )}

          {/* Categories */}
          <button
            onClick={() => setActiveDropdown(activeDropdown === "cat" ? null : "cat")}
            className={cn(chipClass, activeDropdown === "cat" && "border-gray-400 bg-gray-50")}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
            <span>Filter</span>
            <span className="text-[10px] text-gray-400 tabular-nums">({activeCategories.size})</span>
            <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform", activeDropdown === "cat" && "rotate-180")} />
          </button>

          {/* Travel mode */}
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
      )}

      {/* Dropdown panels — slide down inline */}
      {activeDropdown && (
        <div className="flex-shrink-0 border-t border-b border-gray-100 bg-gray-50/80">
          {/* Package dropdown */}
          {activeDropdown === "pkg" && packages && (
            <div className="py-1 max-h-52 overflow-y-auto">
              {packageData.map(({ pkg, poiCount }) => {
                const Icon = getIcon(pkg.icon);
                const isActive = activePackage === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    onClick={() => handleSelectPackage(pkg.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                      isActive ? "bg-white text-gray-900 font-medium" : "text-gray-600 active:bg-white"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{pkg.name}</span>
                    <span className="text-xs text-gray-400 tabular-nums">{poiCount}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-gray-500" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Category dropdown */}
          {activeDropdown === "cat" && (
            <div className="py-1 max-h-52 overflow-y-auto">
              {dropdownCategories.map((cat) => {
                const Icon = getIcon(cat.icon);
                const isActive = activeCategories.has(cat.id);
                const count = poiCountByCategory.get(cat.id) || 0;
                if (count === 0) return null;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onToggleCategory(cat.id)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 active:bg-white transition-colors"
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors",
                        isActive ? "border-transparent text-white" : "border-gray-300 bg-white"
                      )}
                      style={isActive ? { backgroundColor: cat.color } : undefined}
                    >
                      {isActive && <Check className="w-3 h-3" />}
                    </div>
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: cat.color }} />
                    <span className="flex-1 text-left">{cat.name}</span>
                    <span className="text-xs text-gray-400 tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Travel mode dropdown */}
          {activeDropdown === "travel" && (
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
          )}
        </div>
      )}

      {/* Separator */}
      {!activeDropdown && <div className="h-px bg-gray-100 mx-4" />}

      {/* POI list */}
      <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
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
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
