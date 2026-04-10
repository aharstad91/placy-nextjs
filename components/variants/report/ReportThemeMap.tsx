"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import type { Coordinates, POI, TrailCollection } from "@/lib/types";
import { getIcon } from "@/lib/utils/map-icons";
import { Building2 } from "lucide-react";
import { MarkerTooltip } from "@/components/map/marker-tooltip";
import { TrailLayer } from "@/components/map/trail-layer";
import { RouteLayer } from "@/components/map/route-layer";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";

interface ReportThemeMapProps {
  pois: POI[];
  center: Coordinates;
  highlightedPOIId: string | null;
  /** POI IDs mentioned in the narrative text — show permanent labels when activated */
  featuredPOIIds?: Set<string>;
  onMarkerClick: (poiId: string) => void;
  onMapClick?: () => void;
  mapStyle?: string;
  /** When false, map uses cooperativeGestures and markers are non-interactive */
  activated?: boolean;
  /** Project name — shown as permanent label on center marker */
  projectName?: string;
  /** Trail/route overlay GeoJSON for Natur & Friluftsliv */
  trails?: TrailCollection;
  /** Live info per POI — shown in marker tooltip (e.g. "6 ledige sykler") */
  poiLiveInfo?: Record<string, string>;
  /** Floating info chips on the map (e.g. scooter count) */
  mapChips?: Array<{ icon: React.ReactNode; label: string }>;
  /** Live vehicle positions to render as dots */
  vehiclePositions?: Array<{ lat: number; lng: number; color: string }>;
}

export default function ReportThemeMap({
  pois,
  center,
  highlightedPOIId,
  featuredPOIIds,
  onMarkerClick,
  onMapClick,
  mapStyle,
  activated = false,
  projectName,
  trails,
  poiLiveInfo,
  mapChips,
  vehiclePositions,
}: ReportThemeMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredPOI, setHoveredPOI] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<{
    coordinates: [number, number][];
    travelTime: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Stable refs — avoids re-triggering route fetch when parent re-renders
  // with new object references for pois/center (same pattern as ExplorerPage)
  const poisRef = useRef(pois);
  poisRef.current = pois;
  const centerRef = useRef(center);
  centerRef.current = center;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Pre-calculate bounds so initialViewState starts at the correct viewport —
  // eliminates the fitBounds jump that would otherwise happen after onLoad.
  const initialBounds = useMemo((): [[number, number], [number, number]] | undefined => {
    if (pois.length === 0) return undefined;
    const allCoords = pois.map((p) => p.coordinates);
    const maxDeltaLng = Math.max(...allCoords.map((c) => Math.abs(c.lng - center.lng)));
    const maxDeltaLat = Math.max(...allCoords.map((c) => Math.abs(c.lat - center.lat)));
    return [
      [center.lng - maxDeltaLng, center.lat - maxDeltaLat],
      [center.lng + maxDeltaLng, center.lat + maxDeltaLat],
    ];
  }, [pois, center]);

  // onLoad — only apply illustrated theme; no fitBounds needed (handled by initialViewState)
  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    applyIllustratedTheme(map);
  }, []);

  // Resize map when activated (container changes size)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    // Small delay to let the CSS transition complete
    const timer = setTimeout(() => {
      mapRef.current?.resize();
    }, 550);
    return () => clearTimeout(timer);
  }, [activated, mapLoaded]);

  // Handle marker click
  const handleMarkerClick = useCallback(
    (e: { originalEvent: MouseEvent }, poiId: string) => {
      if (!activated) return;
      e.originalEvent.stopPropagation();
      onMarkerClick(poiId);
    },
    [onMarkerClick, activated]
  );

  // Fetch walking route when a POI is highlighted in activated map
  useEffect(() => {
    if (!activated || !highlightedPOIId) {
      setRouteData(null);
      return;
    }

    const poi = poisRef.current.find((p) => p.id === highlightedPOIId);
    if (!poi) return;

    setRouteData(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const origin = `${centerRef.current.lng},${centerRef.current.lat}`;
    const destination = `${poi.coordinates.lng},${poi.coordinates.lat}`;

    fetch(`/api/directions?origin=${origin}&destination=${destination}&profile=walking`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.geometry?.coordinates) {
          setRouteData({
            coordinates: data.geometry.coordinates,
            travelTime: data.duration,
          });
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Route fetch failed:", err);
        }
      });

    return () => controller.abort();
   
  }, [highlightedPOIId, activated]);

  if (!token) return null;

  return (
    <div className={`relative w-full h-full ${!activated ? "pointer-events-none" : ""}`} aria-hidden="true">
      {/* Skeleton shown until theme is applied — prevents style-swap flash.
          z-20 ensures it sits above both the map canvas and the preview overlay (z-10). */}
      {!mapLoaded && (
        <div className="absolute inset-0 z-20 bg-[#f0ece6] animate-pulse" />
      )}
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={
          initialBounds
            ? { bounds: initialBounds, fitBoundsOptions: { padding: 60, maxZoom: 16 } }
            : { longitude: center.lng, latitude: center.lat, zoom: 14 }
        }
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle || MAP_STYLE_STANDARD}
        onLoad={handleMapLoad}
        onClick={activated ? onMapClick : undefined}
        cooperativeGestures={!activated}
      >
        {/* Trail overlay — rendered as GL layer below DOM markers, only after style loads */}
        {mapLoaded && trails && trails.features.length > 0 && (
          <TrailLayer trails={trails} activated={activated} />
        )}

        {/* Route overlay — shown when a POI is highlighted in activated state */}
        {mapLoaded && routeData && (
          <RouteLayer
            coordinates={routeData.coordinates}
            travelTime={routeData.travelTime}
            travelMode="walk"
          />
        )}

        {/* Project/hotel marker — always visible with label */}
        <Marker
          longitude={center.lng}
          latitude={center.lat}
          anchor="bottom"
          style={{ zIndex: 10 }}
        >
          <div className="flex flex-col items-center">
            {/* Permanent label */}
            {projectName && (
              <div className="mb-1.5 px-2.5 py-1 bg-white rounded-lg shadow-md border border-[#eae6e1] whitespace-nowrap">
                <span className="text-xs font-semibold text-[#1a1a1a]">{projectName}</span>
              </div>
            )}
            {/* Marker with glow */}
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-[#b45309]/20 animate-pulse" />
              <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-[#b45309] border-[2.5px] border-white shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </Marker>

        {/* POI markers — tier-aware styling */}
        {pois.map((poi) => {
          const isHighlighted = highlightedPOIId === poi.id;
          const isFeatured = activated && featuredPOIIds?.has(poi.id);
          const isHovered = hoveredPOI === poi.id && !isHighlighted;
          const Icon = getIcon(poi.category.icon);
          const walkMinutes = poi.travelTime?.walk
            ? Math.round(poi.travelTime.walk / 60)
            : null;

          const tier = poi.poiTier ?? 2;
          const tierSize = tier === 1 ? "w-9 h-9" : tier === 3 ? "w-7 h-7" : "w-8 h-8";
          const tierBorder = tier === 1 ? "border-2 border-white shadow-lg" : tier === 3 ? "border-[1.5px] border-white/70 shadow-md" : "border-2 border-white shadow-md";
          const tierIconSize = tier === 1 ? "w-[18px] h-[18px]" : tier === 3 ? "w-3.5 h-3.5" : "w-4 h-4";
          const zIndex = isHighlighted ? 5 : isHovered ? 4 : isFeatured ? 3 : tier === 1 ? 3 : 2;

          return (
            <Marker
              key={poi.id}
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              anchor="center"
              onClick={(e) => handleMarkerClick(e, poi.id)}
              style={{ zIndex }}
            >
              <div className={`relative ${!activated ? "pointer-events-none" : ""}`}>
                {/* Pulsing ring for highlighted */}
                {isHighlighted && (
                  <div
                    className="absolute inset-0 rounded-full animate-ping opacity-75"
                    style={{ backgroundColor: poi.category.color }}
                  />
                )}

                {/* Glow ring for Tier 1 */}
                {tier === 1 && !isHighlighted && !isHovered && (
                  <div
                    className="absolute -inset-1 rounded-full"
                    style={{ backgroundColor: poi.category.color, opacity: 0.2 }}
                  />
                )}

                {/* Icon circle */}
                <div
                  className={`relative flex items-center justify-center rounded-full transition-transform ${
                    activated ? "cursor-pointer" : ""
                  } ${
                    isHighlighted
                      ? "w-10 h-10 border-2 border-white shadow-lg scale-110"
                      : isHovered
                      ? "w-8 h-8 border-2 border-white shadow-md scale-110"
                      : `${tierSize} ${tierBorder} ${activated ? "hover:scale-110" : ""}`
                  }`}
                  style={{ backgroundColor: poi.category.color }}
                  onMouseEnter={activated ? () => setHoveredPOI(poi.id) : undefined}
                  onMouseLeave={activated ? () => setHoveredPOI(null) : undefined}
                >
                  <Icon
                    className={`text-white ${
                      isHighlighted ? "w-5 h-5" : isHovered ? "w-4 h-4" : tierIconSize
                    }`}
                  />
                </div>

                {/* Tooltip — featured POIs always visible, others on hover/highlight */}
                {activated && (isHovered || isHighlighted || isFeatured) && (
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
                    liveInfo={poiLiveInfo?.[poi.id]}
                  />
                )}
              </div>
            </Marker>
          );
        })}

        {/* Live vehicle positions (scooters) — small dots, shown in both preview and activated */}
        {vehiclePositions?.map((pos, i) => (
          <Marker
            key={`vehicle-${i}`}
            longitude={pos.lng}
            latitude={pos.lat}
            anchor="center"
            style={{ zIndex: 1 }}
          >
            <div
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ backgroundColor: `${pos.color}99`, border: `1.5px solid ${pos.color}` }}
            />
          </Marker>
        ))}
      </Map>

      {/* Floating info chips — e.g. scooter count */}
      {activated && mapChips && mapChips.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
          {mapChips.map((chip, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-md border border-gray-100 text-xs"
            >
              {chip.icon}
              <span className="font-medium text-[#1a1a1a]">{chip.label}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
