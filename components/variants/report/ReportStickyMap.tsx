"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import type { ActivePOIState } from "./ReportPage";
import { getIcon } from "@/lib/utils/map-icons";
import { Building2 } from "lucide-react";
import { SkeletonReportMap } from "@/components/ui/SkeletonReportMap";

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

interface ReportStickyMapProps {
  themes: ReportTheme[];
  activeThemeId: string | null;
  activePOI: ActivePOIState | null;
  hotelCoordinates: Coordinates;
  onMarkerClick: (poiId: string) => void;
  mapStyle?: string;
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
  activePOI,
  hotelCoordinates,
  onMarkerClick,
  mapStyle,
}: ReportStickyMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const userInteractedRef = useRef(false);
  const prevThemeIdRef = useRef<string | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Build a flat lookup: themeId → POI[]
  const poisByTheme = useMemo(() => {
    const lookup: Record<string, POI[]> = {};
    for (const theme of themes) {
      lookup[theme.id] = [...theme.highlightPOIs, ...theme.listPOIs];
    }
    return lookup;
  }, [themes]);

  // All POIs across all themes (for pre-rendering marker pool)
  const allPOIs = useMemo(() => {
    const seen = new Set<string>();
    const result: (POI & { themeId: string })[] = [];
    for (const theme of themes) {
      for (const poi of [...theme.highlightPOIs, ...theme.listPOIs]) {
        if (!seen.has(poi.id)) {
          seen.add(poi.id);
          result.push({ ...poi, themeId: theme.id });
        }
      }
    }
    return result;
  }, [themes]);

  // Build themeId lookup per POI (a POI can appear in multiple themes via categories)
  const poiThemeMap = useMemo(() => {
    const lookup: Record<string, Set<string>> = {};
    for (const theme of themes) {
      for (const poi of [...theme.highlightPOIs, ...theme.listPOIs]) {
        if (!lookup[poi.id]) lookup[poi.id] = new Set();
        lookup[poi.id].add(theme.id);
      }
    }
    return lookup;
  }, [themes]);

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

  // Hide default POI labels on map load
  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    const layers = map.getStyle()?.layers || [];
    for (const layer of layers) {
      if (
        layer.id.includes("poi") ||
        layer.id.includes("place-label") ||
        layer.id.includes("transit")
      ) {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    }

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

  // React to theme changes — reset user interaction flag and fitBounds
  useEffect(() => {
    if (!mapLoaded || !activeThemeId) return;
    if (prevThemeIdRef.current === activeThemeId) return;

    prevThemeIdRef.current = activeThemeId;
    userInteractedRef.current = false;

    // Small delay to let markers transition, then fitBounds
    const timer = setTimeout(() => {
      if (!userInteractedRef.current) {
        fitBoundsForTheme(activeThemeId);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [activeThemeId, mapLoaded, fitBoundsForTheme]);

  // Handle marker click
  const handleMarkerClick = useCallback(
    (e: { originalEvent: MouseEvent }, poiId: string) => {
      e.originalEvent.stopPropagation();
      onMarkerClick(poiId);
    },
    [onMarkerClick]
  );

  // Check if a POI is in the active theme
  const isPoiInActiveTheme = useCallback(
    (poiId: string) => {
      if (!activeThemeId) return false;
      return poiThemeMap[poiId]?.has(activeThemeId) ?? false;
    },
    [activeThemeId, poiThemeMap]
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
        mapStyle={mapStyle || MAP_STYLE}
        onLoad={handleMapLoad}
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
          const isActive = isPoiInActiveTheme(poi.id);
          const isHighlighted = activePOI?.poiId === poi.id;
          const Icon = getIcon(poi.category.icon);

          return (
            <Marker
              key={poi.id}
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              anchor="center"
              onClick={(e) => isActive ? handleMarkerClick(e, poi.id) : undefined}
              style={{
                zIndex: isHighlighted ? 5 : isActive ? 2 : 0,
              }}
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

                {/* Icon circle */}
                <div
                  className={`relative flex items-center justify-center rounded-full border-2 border-white shadow-md cursor-pointer transition-transform ${
                    isHighlighted
                      ? "w-10 h-10 scale-110"
                      : "w-8 h-8 hover:scale-110"
                  }`}
                  style={{ backgroundColor: poi.category.color }}
                >
                  <Icon
                    className={`text-white ${
                      isHighlighted ? "w-5 h-5" : "w-4 h-4"
                    }`}
                  />
                </div>

                {/* Name label for highlighted marker */}
                {isHighlighted && (
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span
                      className="px-2 py-0.5 text-[10px] font-medium text-white rounded shadow-lg"
                      style={{ backgroundColor: poi.category.color }}
                    >
                      {poi.name}
                    </span>
                  </div>
                )}
              </div>
            </Marker>
          );
        })}
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
