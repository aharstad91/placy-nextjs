"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { ReportTheme } from "./report-data";
import type { Coordinates } from "@/lib/types";
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
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Lazy loading with triggerOnce pattern (disconnect after first intersection)
  useEffect(() => {
    if (isInView) return; // Already loaded, don't re-observe

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // Stop observing after first load
        }
      },
      { rootMargin: "100px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [isInView]);

  // Derive POIs with useMemo (from Guide Library learnings - never useEffect + setState)
  const pois = useMemo(
    () => theme.highlightPOIs.concat(theme.listPOIs),
    [theme.highlightPOIs, theme.listPOIs]
  );

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
    // On mobile, switch to list tab when marker is clicked
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
    () => Array.from(new Set(pois.map((poi) => poi.category.id))),
    [pois]
  );

  return (
    <div ref={sectionRef}>
      {/* Mobile: Tabs */}
      <div className="lg:hidden">
        <ReportMapTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "list" ? (
          <div className="space-y-3 py-4">
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

      {/* Desktop: Cards flow naturally, map is sticky */}
      <div className="hidden lg:flex gap-6">
        {/* Left: POI cards - natural flow */}
        <div className="w-1/2 space-y-3">
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
