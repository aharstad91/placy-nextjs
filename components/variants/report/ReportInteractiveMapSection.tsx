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
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Scroll to card when marker clicked (with debounce to prevent rapid scroll conflicts)
  useEffect(() => {
    if (activePOI) {
      // Clear any pending scroll
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      scrollTimeoutRef.current = setTimeout(() => {
        const cardEl = cardRefs.current.get(activePOI);
        cardEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50); // Small delay to let rapid clicks settle
    }
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [activePOI]);

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
    <div ref={sectionRef} className="min-h-[400px]">
      {/* Mobile: Tabs */}
      <div className="lg:hidden">
        <ReportMapTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "list" ? (
          <div className="space-y-4 p-4">
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

      {/* Desktop: 50/50 split (from Explorer layout pattern) */}
      <div className="hidden lg:flex h-[500px] rounded-xl overflow-hidden border border-[#eae6e1]">
        {/* Left: POI cards with internal scroll */}
        <div className="w-1/2 overflow-y-auto p-4 space-y-4 bg-white">
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

        {/* Right: Interactive map */}
        <div className="w-1/2 relative">
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
  );
}
