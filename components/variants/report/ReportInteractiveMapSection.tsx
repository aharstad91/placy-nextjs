"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { ReportTheme } from "./report-data";
import type { Coordinates, Category } from "@/lib/types";
import type { MapRef } from "react-map-gl/mapbox";
import ReportHighlightCard from "./ReportHighlightCard";
import ReportInteractiveMap from "./ReportInteractiveMap";
import ReportMapTabs from "./ReportMapTabs";
import { SkeletonReportMap } from "@/components/ui/SkeletonReportMap";
import { ReportFactCards, computeFactCards } from "./ReportFactCards";

interface ReportInteractiveMapSectionProps {
  theme: ReportTheme;
  center: Coordinates;
  sectionId: string;
  explorerBaseUrl?: string | null;
  onMapMount?: (sectionId: string, mapRef: MapRef) => void;
  onMapUnmount?: (sectionId: string) => void;
}

export default function ReportInteractiveMapSection({
  theme,
  center,
  sectionId,
  explorerBaseUrl,
  onMapMount,
  onMapUnmount,
}: ReportInteractiveMapSectionProps) {
  const [activePOI, setActivePOI] = useState<string | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "map">("list");
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Lazy loading with ref-based observer (race condition safe)
  useEffect(() => {
    // Skip if already in view or no element
    if (isInView || !sectionRef.current) return;

    // Don't create duplicate observers
    if (observerRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
          observerRef.current = null;
        }
      },
      { rootMargin: "100px" }
    );

    observerRef.current.observe(sectionRef.current);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [isInView]);

  // All POIs in this theme
  const allPois = useMemo(
    () => theme.highlightPOIs.concat(theme.listPOIs),
    [theme.highlightPOIs, theme.listPOIs]
  );

  // Extract unique categories with counts
  const categories = useMemo(() => {
    const categoryMap = new Map<string, { category: Category; count: number }>();
    for (const poi of allPois) {
      const existing = categoryMap.get(poi.category.id);
      if (existing) {
        existing.count++;
      } else {
        categoryMap.set(poi.category.id, { category: poi.category, count: 1 });
      }
    }
    return Array.from(categoryMap.values());
  }, [allPois]);

  // Filtered POIs based on hidden categories
  const pois = useMemo(
    () => allPois.filter((poi) => !hiddenCategories.has(poi.category.id)),
    [allPois, hiddenCategories]
  );

  // Toggle category visibility
  const toggleCategory = useCallback((categoryId: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Map lifecycle callbacks
  const handleMapMount = useCallback(
    (mapRef: MapRef) => {
      onMapMount?.(sectionId, mapRef);
    },
    [sectionId, onMapMount]
  );

  const handleMapUnmount = useCallback(() => {
    onMapUnmount?.(sectionId);
  }, [sectionId, onMapUnmount]);

  // Handle POI click from card
  const handleCardClick = useCallback((poiId: string) => {
    setActivePOI((prev) => (prev === poiId ? null : poiId));
  }, []);

  // Handle POI click from map marker
  const handleMarkerClick = useCallback((poiId: string) => {
    setActivePOI((prev) => (prev === poiId ? null : poiId));
    setActiveTab("list");
  }, []);

  // Register card ref
  const registerCardRef = useCallback(
    (poiId: string) => (el: HTMLDivElement | null) => {
      if (el) {
        cardRefs.current.set(poiId, el);
      } else {
        cardRefs.current.delete(poiId);
      }
    },
    []
  );

  // Get theme categories for explorer URL
  const themeCategories = useMemo(
    () => Array.from(new Set(allPois.map((poi) => poi.category.id))),
    [allPois]
  );

  // Compute fact cards for this theme
  const factCards = useMemo(() => computeFactCards(theme), [theme]);

  // Category filter pills component
  const CategoryFilters = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      {categories.map(({ category, count }) => {
        const isHidden = hiddenCategories.has(category.id);
        return (
          <button
            key={category.id}
            onClick={() => toggleCategory(category.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
              isHidden
                ? "bg-[#f5f3f0] text-[#a0a0a0] line-through"
                : "text-white"
            }`}
            style={!isHidden ? { backgroundColor: category.color } : undefined}
          >
            {category.name}
            <span className={isHidden ? "text-[#c0c0c0]" : "opacity-70"}>
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={sectionRef}>
      {/* Mobile: Fact cards (horizontal scroll) + Tabs */}
      <div className="lg:hidden">
        {/* Fact cards horizontal scroll */}
        {factCards.length > 0 && (
          <div className="relative mb-4">
            {/* Fade edges for scroll affordance */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#faf9f7] to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#faf9f7] to-transparent z-10" />

            {/* Snap-scroll container */}
            <div
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <ReportFactCards cards={factCards} variant="horizontal" />
            </div>
          </div>
        )}

        <ReportMapTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "list" ? (
          <div className="py-4">
            <CategoryFilters />
            <div className="space-y-3">
              {pois.map((poi) => (
                <div key={poi.id} ref={registerCardRef(poi.id)}>
                  <ReportHighlightCard
                    poi={poi}
                    explorerBaseUrl={explorerBaseUrl}
                    themeCategories={themeCategories}
                    isActive={activePOI === poi.id}
                    onClick={() => handleCardClick(poi.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[400px]">
            {isInView ? (
              <ReportInteractiveMap
                pois={pois}
                center={center}
                activePOI={activePOI}
                onPOIClick={handleMarkerClick}
                onMapMount={handleMapMount}
                onMapUnmount={handleMapUnmount}
              />
            ) : (
              <SkeletonReportMap />
            )}
          </div>
        )}
      </div>

      {/* Desktop: POI cards + sticky map, fact cards below */}
      <div className="hidden lg:block">
        <div className="flex gap-8">
          {/* Left: Category filters + POI cards */}
          <div className="flex-1">
            <CategoryFilters />
            <div className="grid grid-cols-2 gap-4 content-start">
              {pois.map((poi) => (
                <div key={poi.id} ref={registerCardRef(poi.id)}>
                  <ReportHighlightCard
                    poi={poi}
                    explorerBaseUrl={explorerBaseUrl}
                    themeCategories={themeCategories}
                    isActive={activePOI === poi.id}
                    onClick={() => handleCardClick(poi.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right: Sticky map */}
          <div className="w-[400px] flex-shrink-0">
            <div className="sticky top-20 h-[500px] rounded-xl overflow-hidden border border-[#eae6e1]">
              {isInView ? (
                <ReportInteractiveMap
                  pois={pois}
                  center={center}
                  activePOI={activePOI}
                  onPOIClick={handleMarkerClick}
                  onMapMount={handleMapMount}
                  onMapUnmount={handleMapUnmount}
                />
              ) : (
                <SkeletonReportMap />
              )}
            </div>
          </div>
        </div>

        {/* Fact cards below POI cards */}
        {factCards.length > 0 && (
          <div className="mt-6">
            <ReportFactCards cards={factCards} variant="horizontal-desktop" />
          </div>
        )}
      </div>
    </div>
  );
}
