"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { ReportTheme } from "./report-data";
import type { Coordinates, Category } from "@/lib/types";
import type { MapRef } from "react-map-gl/mapbox";
import ReportHighlightCard from "./ReportHighlightCard";
import ReportInteractiveMap from "./ReportInteractiveMap";
import ReportMapTabs from "./ReportMapTabs";

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

  // Lazy loading with triggerOnce pattern (disconnect after first intersection)
  useEffect(() => {
    if (isInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
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
      {/* Mobile: Tabs */}
      <div className="lg:hidden">
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
              <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
                <span className="text-[#8a8a8a] text-sm">Laster kart...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop: Cards in 2-col grid, map is sticky */}
      <div className="hidden lg:flex gap-16">
        {/* Left: Category filters + POI cards */}
        <div className="w-1/2">
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
        <div className="w-1/2">
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
              <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
                <span className="text-[#8a8a8a] text-sm">Laster kart...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
