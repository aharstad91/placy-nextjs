"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { POI, Category, TravelMode } from "@/lib/types";
import type { CategoryPackage } from "./explorer-packages";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import { Compass, ChevronDown, Check, SlidersHorizontal, Footprints, Bike, Car } from "lucide-react";
import * as LucideIcons from "lucide-react";
import ExplorerPOICard from "./ExplorerPOICard";
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
  // Package / category filtering
  allPOIs: POI[];
  packages?: CategoryPackage[] | null;
  activePackage: string | null;
  onSelectPackage: (id: string) => void;
  categories: Category[];
  activeCategories: Set<string>;
  onToggleCategory: (categoryId: string) => void;
  // Travel mode
  onSetTravelMode?: (mode: TravelMode) => void;
  // Skeleton loading state
  showSkeleton?: boolean;
  showContent?: boolean;
  isRefreshing?: boolean;
}

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
  packages,
  activePackage,
  onSelectPackage,
  categories,
  activeCategories,
  onToggleCategory,
  onSetTravelMode,
  showSkeleton = false,
  showContent = true,
  isRefreshing = false,
}: ExplorerPOIListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pkgDropdownRef = useRef<HTMLDivElement>(null);
  const catDropdownRef = useRef<HTMLDivElement>(null);
  const travelDropdownRef = useRef<HTMLDivElement>(null);
  const [pkgDropdownOpen, setPkgDropdownOpen] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [travelDropdownOpen, setTravelDropdownOpen] = useState(false);

  // Close dropdowns on click outside
  useEffect(() => {
    if (!pkgDropdownOpen && !catDropdownOpen && !travelDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (pkgDropdownOpen && pkgDropdownRef.current && !pkgDropdownRef.current.contains(e.target as Node)) {
        setPkgDropdownOpen(false);
      }
      if (catDropdownOpen && catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false);
      }
      if (travelDropdownOpen && travelDropdownRef.current && !travelDropdownRef.current.contains(e.target as Node)) {
        setTravelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pkgDropdownOpen, catDropdownOpen, travelDropdownOpen]);

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

  // Package data for dropdown — count POIs per package
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

  // Active package info for trigger
  const activePackageDef = useMemo(() => {
    if (packageData.length === 0) return null;
    return packageData.find((d) => d.pkg.id === activePackage) || packageData.find((d) => d.pkg.id === "all")!;
  }, [packageData, activePackage]);

  const ActivePkgIcon = activePackageDef ? getIcon(activePackageDef.pkg.icon) : null;

  // Categories for the category dropdown (scoped to active package)
  const dropdownCategories = useMemo(() => {
    if (!activePackage || activePackage === "all" || !packages) return categories;
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

  // Count POIs matching active categories (within active package scope)
  const activePOICount = useMemo(() => {
    const scopedCatIds = new Set(dropdownCategories.map((c) => c.id));
    return allPOIs.filter((p) => scopedCatIds.has(p.category.id) && activeCategories.has(p.category.id)).length;
  }, [dropdownCategories, activeCategories, allPOIs]);

  const handleSelectPackage = useCallback((pkgId: string) => {
    onSelectPackage(pkgId);
    setPkgDropdownOpen(false);
    setTimeout(() => setCatDropdownOpen(true), 500);
  }, [onSelectPackage]);

  const travelModeConfig: { mode: TravelMode; label: string; Icon: typeof Footprints }[] = [
    { mode: "walk", label: "Til fots", Icon: Footprints },
    { mode: "bike", label: "Sykkel", Icon: Bike },
    { mode: "car", label: "Bil", Icon: Car },
  ];

  const activeTravelConfig = travelModeConfig.find((t) => t.mode === travelMode) || travelModeConfig[0];

  const chipClass = "h-9 flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 shadow-sm transition-colors text-sm font-medium text-gray-700";

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

      {/* Filter toolbar — packages + categories + travel mode */}
      <div className="flex-shrink-0 px-8 pb-3 flex items-center gap-2">
        {/* Package dropdown — only shown if packages are defined */}
        {packages && activePackageDef && ActivePkgIcon && (
          <div ref={pkgDropdownRef} className="relative flex-1">
            <button
              onClick={() => { setPkgDropdownOpen((p) => !p); setCatDropdownOpen(false); setTravelDropdownOpen(false); }}
              className={cn(chipClass, "w-full justify-center")}
            >
              <ActivePkgIcon className="w-4 h-4 text-gray-500" />
              <span className="truncate">{activePackageDef.pkg.name}</span>
              <span className="text-xs text-gray-400 tabular-nums">({activePackageDef.poiCount})</span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", pkgDropdownOpen && "rotate-180")} />
            </button>

            {pkgDropdownOpen && (
              <div className="absolute top-full mt-1.5 left-0 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50">
                {packageData.map(({ pkg, poiCount }) => {
                  const Icon = getIcon(pkg.icon);
                  const isActive = activePackage === pkg.id ||
                    (pkg.id === "all" && (activePackage === "all" || activeCategories.size === categories.length));

                  return (
                    <button
                      key={pkg.id}
                      onClick={() => handleSelectPackage(pkg.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                        isActive ? "bg-gray-50 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50"
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
          </div>
        )}

        {/* Categories dropdown */}
        <div ref={catDropdownRef} className="relative flex-1">
          <button
            onClick={() => { setCatDropdownOpen((p) => !p); setPkgDropdownOpen(false); setTravelDropdownOpen(false); }}
            className={cn(chipClass, "w-full justify-center")}
          >
            <SlidersHorizontal className="w-4 h-4 text-gray-500" />
            <span>Kategorier</span>
            <span className="text-xs text-gray-400 tabular-nums">({dropdownCategories.length})</span>
            <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", catDropdownOpen && "rotate-180")} />
          </button>

          {catDropdownOpen && (
            <div className="absolute top-full mt-1.5 left-0 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 max-h-[480px] overflow-y-auto">
              {dropdownCategories.map((cat) => {
                const Icon = getIcon(cat.icon);
                const isActive = activeCategories.has(cat.id);

                return (
                  <button
                    key={cat.id}
                    onClick={() => onToggleCategory(cat.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
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
                    <span className="text-xs text-gray-400 tabular-nums">{poiCountByCategory.get(cat.id) || 0}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Travel mode dropdown */}
        <div ref={travelDropdownRef} className="relative flex-1">
          <button
            onClick={() => { setTravelDropdownOpen((p) => !p); setPkgDropdownOpen(false); setCatDropdownOpen(false); }}
            className={cn(chipClass, "w-full justify-center")}
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
