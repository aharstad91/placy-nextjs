"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import type { ActivePOIState } from "./ReportPage";
import { getIcon } from "@/lib/utils/map-icons";
import { Building2 } from "lucide-react";
import { SkeletonReportMap } from "@/components/ui/SkeletonReportMap";
import { MarkerTooltip } from "@/components/map/marker-tooltip";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";
import MapPopupCard from "./MapPopupCard";

interface ReportStickyMapProps {
  themes: ReportTheme[];
  activeThemeId: string | null;
  /** Active sub-section category ID within the active theme (null = show all theme markers) */
  activeSubSectionCategoryId?: string | null;
  activePOI: ActivePOIState | null;
  hotelCoordinates: Coordinates;
  onMarkerClick: (poiId: string) => void;
  /** Called when user clicks empty map area (deselects active POI) */
  onMapClick?: () => void;
  mapStyle?: string;
  /** Themes/sub-sections expanded via "Vis meg mer" — keys: "themeId" or "themeId:categoryId" */
  expandedThemes?: Set<string>;
}

/**
 * Page-level sticky map for the Report product.
 *
 * Architecture:
 * - Single Mapbox GL instance (vs 5 per-section maps previously)
 * - Marker pooling: ALL theme markers pre-rendered at mount with opacity 0
 * - Active theme's markers toggled to opacity 1 (GPU-composited, zero DOM mutations)
 * - Hotel marker always visible (independent, higher z-index)
 * - fitBounds on theme change with map.stop() to prevent animation pile-up
 */
export default function ReportStickyMap({
  themes,
  activeThemeId,
  activeSubSectionCategoryId,
  activePOI,
  hotelCoordinates,
  onMarkerClick,
  onMapClick,
  mapStyle,
  expandedThemes = new Set(),
}: ReportStickyMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const [hoveredPOI, setHoveredPOI] = useState<string | null>(null);
  const userInteractedRef = useRef(false);
  const prevThemeIdRef = useRef<string | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Build a flat lookup: key → visible POI[]
  // Keys: "themeId" for theme-level, "themeId:categoryId" for sub-sections
  const poisByTheme = useMemo(() => {
    const lookup: Record<string, POI[]> = {};
    for (const theme of themes) {
      // Theme-level: all visible POIs
      const visible = [...theme.highlightPOIs, ...theme.listPOIs];
      if (expandedThemes.has(theme.id)) {
        visible.push(...theme.hiddenPOIs);
      }

      // Also add sub-section POIs to theme-level when their sub-section is expanded
      for (const sub of theme.subSections ?? []) {
        const subKey = `${theme.id}:${sub.categoryId}`;
        const subVisible = [...sub.highlightPOIs, ...sub.listPOIs];
        if (expandedThemes.has(subKey)) {
          subVisible.push(...sub.hiddenPOIs);
        }
        lookup[subKey] = subVisible;

        // Ensure expanded sub-section POIs are in the theme-level pool too
        if (expandedThemes.has(subKey)) {
          const themeVisibleIds = new Set(visible.map((p) => p.id));
          for (const poi of sub.hiddenPOIs) {
            if (!themeVisibleIds.has(poi.id)) visible.push(poi);
          }
        }
      }

      lookup[theme.id] = visible;
    }
    return lookup;
  }, [themes, expandedThemes]);

  // All visible POIs across all themes AND sub-sections (for pre-rendering marker pool)
  const allPOIs = useMemo(() => {
    const seen = new Set<string>();
    const result: (POI & { themeId: string })[] = [];
    for (const theme of themes) {
      // Theme-level POIs
      for (const poi of poisByTheme[theme.id] ?? []) {
        if (!seen.has(poi.id)) {
          seen.add(poi.id);
          result.push({ ...poi, themeId: theme.id });
        }
      }
      // Sub-section POIs (may not overlap with theme-level)
      for (const sub of theme.subSections ?? []) {
        const subKey = `${theme.id}:${sub.categoryId}`;
        for (const poi of poisByTheme[subKey] ?? []) {
          if (!seen.has(poi.id)) {
            seen.add(poi.id);
            result.push({ ...poi, themeId: theme.id });
          }
        }
      }
    }
    return result;
  }, [themes, poisByTheme]);

  // Pre-compute active POI IDs for O(1) visibility checks in the marker pool
  // (computed after activeSectionKey is derived below — hoisted as ref-stable memo)
  // Note: activeSectionKey defined further down, so we use the raw props here
  const activeSectionKeyForIds = activeSubSectionCategoryId
    ? `${activeThemeId}:${activeSubSectionCategoryId}`
    : activeThemeId;

  const activePoiIds = useMemo(() => {
    if (!activeSectionKeyForIds) return new Set<string>();
    return new Set((poisByTheme[activeSectionKeyForIds] ?? []).map((p) => p.id));
  }, [activeSectionKeyForIds, poisByTheme]);

  // fitBounds for a given theme — calculates bounds from theme POIs + hotel
  const fitBoundsForTheme = useCallback(
    (themeId: string | null) => {
      if (!mapRef.current || !themeId) return;

      const pois = poisByTheme[themeId];
      if (!pois || pois.length === 0) return;

      const map = mapRef.current;

      // Include hotel in bounds calculation
      const allCoords = [
        ...pois.map((p) => p.coordinates),
        hotelCoordinates,
      ];

      const bounds = allCoords.reduce(
        (acc, coord) => ({
          minLng: Math.min(acc.minLng, coord.lng),
          maxLng: Math.max(acc.maxLng, coord.lng),
          minLat: Math.min(acc.minLat, coord.lat),
          maxLat: Math.max(acc.maxLat, coord.lat),
        }),
        {
          minLng: Infinity,
          maxLng: -Infinity,
          minLat: Infinity,
          maxLat: -Infinity,
        }
      );

      // Stop any in-flight animation before starting new one
      map.getMap().stop();

      map.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        { padding: 60, duration: 300, maxZoom: 16 }
      );
    },
    [poisByTheme, hotelCoordinates]
  );

  // Apply illustrated theme + initial fitBounds on map load
  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    applyIllustratedTheme(map);

    // Initial fitBounds
    fitBoundsForTheme(activeThemeId);
  }, [activeThemeId, fitBoundsForTheme]);

  // Event listeners that need cleanup on unmount
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const map = mapRef.current.getMap();
    const canvas = map.getCanvas();

    const onContextLost = () => setWebglLost(true);
    const onContextRestored = () => setWebglLost(false);
    const onUserInteract = () => { userInteractedRef.current = true; };

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    map.on("dragend", onUserInteract);
    map.on("zoomend", onUserInteract);

    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      map.off("dragend", onUserInteract);
      map.off("zoomend", onUserInteract);
    };
  }, [mapLoaded]);

  // The active section key combines theme + optional sub-section
  const activeSectionKey = activeSubSectionCategoryId
    ? `${activeThemeId}:${activeSubSectionCategoryId}`
    : activeThemeId;

  // React to theme/sub-section changes — reset user interaction flag and fitBounds
  useEffect(() => {
    if (!mapLoaded || !activeSectionKey) return;
    if (prevThemeIdRef.current === activeSectionKey) return;

    prevThemeIdRef.current = activeSectionKey;
    userInteractedRef.current = false;

    // Small delay to let markers transition, then fitBounds
    const timer = setTimeout(() => {
      if (!userInteractedRef.current) {
        fitBoundsForTheme(activeSectionKey);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [activeSectionKey, mapLoaded, fitBoundsForTheme]);

  // Fly to POI when selected from a card click (not from marker click)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !activePOI) return;
    if (activePOI.source !== "card") return;

    const poi = allPOIs.find((p) => p.id === activePOI.poiId);
    if (!poi) return;

    const map = mapRef.current;
    map.getMap().stop();
    map.flyTo({
      center: [poi.coordinates.lng, poi.coordinates.lat],
      duration: 400,
      // Don't change zoom — keep current zoom level
    });
  }, [activePOI, mapLoaded, allPOIs]);

  // Re-fit bounds when a theme/sub-section is expanded (new markers appear)
  const prevExpandedSizeRef = useRef(0);
  useEffect(() => {
    if (!mapLoaded || !activeSectionKey) return;
    if (expandedThemes.size <= prevExpandedSizeRef.current) return;
    prevExpandedSizeRef.current = expandedThemes.size;

    // Only refit if the active section was just expanded
    if (!expandedThemes.has(activeSectionKey) && !expandedThemes.has(activeThemeId ?? "")) return;

    const timer = setTimeout(() => {
      fitBoundsForTheme(activeSectionKey);
    }, 100);

    return () => clearTimeout(timer);
  }, [expandedThemes, activeSectionKey, activeThemeId, mapLoaded, fitBoundsForTheme]);

  // Handle marker click
  const handleMarkerClick = useCallback(
    (e: { originalEvent: MouseEvent }, poiId: string) => {
      e.originalEvent.stopPropagation();
      onMarkerClick(poiId);
    },
    [onMarkerClick]
  );

  // Check if a POI should be visible — O(1) lookup via pre-computed Set
  const isPoiInActiveSection = useCallback(
    (poiId: string) => activePoiIds.has(poiId),
    [activePoiIds]
  );

  if (!token) return null;

  return (
    // aria-hidden: map is decorative — all POI data is accessible in the left panel text content
    <div className="relative w-full h-full" aria-hidden="true">
      {/* WebGL context loss overlay */}
      {webglLost && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#faf9f7]/90">
          <p className="text-sm text-[#6a6a6a]">Kart utilgjengelig</p>
        </div>
      )}

      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{
          longitude: hotelCoordinates.lng,
          latitude: hotelCoordinates.lat,
          zoom: 14,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle || MAP_STYLE_STANDARD}
        onLoad={handleMapLoad}
        onClick={onMapClick}
        scrollZoom={true}
      >
        {/* Hotel marker — always visible, higher z-index */}
        <Marker
          longitude={hotelCoordinates.lng}
          latitude={hotelCoordinates.lat}
          anchor="center"
          style={{ zIndex: 10 }}
        >
          <div className="relative">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#b45309] border-2 border-white shadow-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
          </div>
        </Marker>

        {/* Marker pool — ALL POIs pre-rendered, opacity toggled by active theme */}
        {allPOIs.map((poi) => {
          const isActive = isPoiInActiveSection(poi.id);
          const isHighlighted = activePOI?.poiId === poi.id;
          const isHovered = hoveredPOI === poi.id && !isHighlighted;
          const Icon = getIcon(poi.category.icon);
          const walkMinutes = poi.travelTime?.walk
            ? Math.round(poi.travelTime.walk / 60)
            : null;

          // Tier-aware sizing (only when not highlighted/hovered — those override)
          const tier = poi.poiTier ?? 2;
          const tierSize = tier === 1 ? "w-9 h-9" : tier === 3 ? "w-7 h-7" : "w-8 h-8";
          const tierBorder = tier === 1 ? "border-2 border-white shadow-lg" : tier === 3 ? "border-[1.5px] border-white/70 shadow-md" : "border-2 border-white shadow-md";
          const tierIconSize = tier === 1 ? "w-[18px] h-[18px]" : tier === 3 ? "w-3.5 h-3.5" : "w-4 h-4";
          const tierZIndex = isHighlighted ? 5 : isHovered ? 4 : isActive ? (tier === 1 ? 3 : 2) : 0;

          return (
            <Marker
              key={poi.id}
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              anchor="center"
              onClick={(e) => isActive ? handleMarkerClick(e, poi.id) : undefined}
              style={{ zIndex: tierZIndex }}
            >
              <div
                className="relative transition-opacity duration-200 ease-in-out"
                style={{
                  opacity: isActive ? 1 : 0,
                  pointerEvents: isActive ? "auto" : "none",
                }}
              >
                {/* Pulsing ring for highlighted marker */}
                {isHighlighted && (
                  <div
                    className="absolute inset-0 rounded-full animate-ping opacity-75"
                    style={{ backgroundColor: poi.category.color }}
                  />
                )}

                {/* Glow ring for Tier 1 (not highlighted/hovered) */}
                {tier === 1 && !isHighlighted && !isHovered && (
                  <div
                    className="absolute -inset-1 rounded-full"
                    style={{ backgroundColor: poi.category.color, opacity: 0.2 }}
                  />
                )}

                {/* Icon circle — tier-aware default sizes, overridden by highlight/hover */}
                <div
                  className={`relative flex items-center justify-center rounded-full cursor-pointer transition-transform ${
                    isHighlighted
                      ? "w-10 h-10 border-2 border-white shadow-lg scale-110"
                      : isHovered
                      ? "w-8 h-8 border-2 border-white shadow-md scale-110"
                      : `${tierSize} ${tierBorder} hover:scale-110`
                  }`}
                  style={{ backgroundColor: poi.category.color }}
                  onMouseEnter={() => setHoveredPOI(poi.id)}
                  onMouseLeave={() => setHoveredPOI(null)}
                >
                  <Icon
                    className={`text-white ${
                      isHighlighted ? "w-5 h-5" : isHovered ? "w-4 h-4" : tierIconSize
                    }`}
                  />
                </div>

                {/* Tooltip — shared for hover and highlighted state */}
                {(isHovered || isHighlighted) && (
                  <MarkerTooltip
                    name={poi.name}
                    categoryName={poi.category.name}
                    categoryId={poi.category.id}
                    googleRating={poi.googleRating}
                    googleReviewCount={poi.googleReviewCount}
                    travelTimeMinutes={walkMinutes}
                    travelMode="walk"
                    poiTier={poi.poiTier}
                    isLocalGem={poi.isLocalGem}
                  />
                )}
              </div>
            </Marker>
          );
        })}

        {/* Popup card for active POI */}
        {activePOI && (() => {
          const poi = allPOIs.find((p) => p.id === activePOI.poiId);
          if (!poi) return null;
          return (
            <Marker
              key={`popup-${poi.id}`}
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              anchor="bottom"
              style={{ zIndex: 20 }}
              offset={[0, -20]}
            >
              <MapPopupCard
                poi={poi}
                onClose={() => onMarkerClick(poi.id)}
              />
            </Marker>
          );
        })()}
      </Map>

      {/* Skeleton while map loads */}
      {!mapLoaded && (
        <div className="absolute inset-0">
          <SkeletonReportMap />
        </div>
      )}
    </div>
  );
}
