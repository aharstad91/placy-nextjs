"use client";

import {
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import Map, {
  NavigationControl,
  Marker,
  type MapRef,
} from "react-map-gl/mapbox";
import type { Coordinates, POI, TravelMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RouteLayer } from "@/components/map/route-layer";
import { MapPin, Footprints, Bike, Car, Navigation } from "lucide-react";
import GeoLocationWidget from "./GeoLocationWidget";
import { SkeletonMapOverlay } from "@/components/ui/SkeletonMapOverlay";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";
import { AdaptiveMarker } from "@/components/map/adaptive-marker";
import { useMapZoomState } from "@/lib/hooks/useMapZoomState";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";

interface ExplorerMapProps {
  center: Coordinates;
  pois: POI[];
  allPOIs: POI[];
  activePOI: string | null;
  activeCategories: Set<string>;
  onPOIClick: (poiId: string) => void;
  onDismissActive?: () => void;
  onViewportPOIs: (poiIds: Set<string>, clusterCount: number) => void;
  onZoomChange: (zoom: number) => void;
  projectName: string;
  routeData?: {
    coordinates: [number, number][];
    travelTime: number;
  } | null;
  travelMode?: TravelMode;
  initialBounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  mapPadding?: { left: number; top: number; right: number; bottom: number };
  // Geolocation
  userPosition?: Coordinates | null;
  userAccuracy?: number | null;
  geoMode?: GeolocationMode;
  distanceToProject?: number | null;
  // Geolocation widget (for deferred geolocation mode)
  showGeoWidget?: boolean;
  geoIsEnabled?: boolean;
  onEnableGeolocation?: () => void;
  // Skeleton loading state
  showSkeleton?: boolean;
  // Whether to fit map bounds to show the full route
  fitRoute?: boolean;
}

export default function ExplorerMap({
  center,
  pois,
  allPOIs,
  activePOI,
  activeCategories,
  onPOIClick,
  onDismissActive,
  onViewportPOIs,
  onZoomChange,
  projectName,
  routeData,
  travelMode = "walk",
  initialBounds,
  mapPadding,
  userPosition,
  userAccuracy,
  geoMode = "loading",
  distanceToProject,
  showGeoWidget,
  geoIsEnabled,
  onEnableGeolocation,
  showSkeleton = false,
  fitRoute = false,
}: ExplorerMapProps) {
  const mapRef = useRef<MapRef>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const hasFittedBoundsRef = useRef(false);
  const lastFittedPOIRef = useRef<string | null>(null);
  const [hoveredPOI, setHoveredPOI] = useState<string | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  // CSS-driven zoom state (writes data-zoom-state to container, no React re-renders)
  useMapZoomState(mapRef, mapContainerRef, { mapLoaded });

  const TravelIcon = travelMode === "walk" ? Footprints : travelMode === "bike" ? Bike : Car;

  // Fit to initial bounds on first load
  const hasInitialFitRef = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !initialBounds || hasInitialFitRef.current) return;
    hasInitialFitRef.current = true;
    mapRef.current.fitBounds(
      [
        [initialBounds.minLng, initialBounds.minLat],
        [initialBounds.maxLng, initialBounds.maxLat],
      ],
      { padding: mapPadding || 60, duration: 0 }
    );
  }, [mapLoaded, initialBounds, mapPadding]);

  // Fit map to show full route (only when triggered by list click, not map marker click)
  useEffect(() => {
    if (!fitRoute || !mapRef.current || !mapLoaded || !routeData?.coordinates.length || !activePOI) return;

    if (lastFittedPOIRef.current === activePOI) return;
    lastFittedPOIRef.current = activePOI;

    const coords = routeData.coordinates;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    mapRef.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: mapPadding || 60, duration: 400, maxZoom: mapRef.current.getZoom() }
    );
  }, [fitRoute, routeData, mapLoaded, mapPadding, activePOI]);

  // Reset fitted POI ref when route is dismissed
  useEffect(() => {
    if (!activePOI) {
      lastFittedPOIRef.current = null;
    }
  }, [activePOI]);

  // Update visible POIs when map moves
  const updateVisiblePOIs = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const visibleIds = new Set<string>();

    for (const poi of pois) {
      if (bounds.contains([poi.coordinates.lng, poi.coordinates.lat])) {
        visibleIds.add(poi.id);
      }
    }

    onViewportPOIs(visibleIds, 0);
    onZoomChange(map.getZoom());
  }, [pois, mapLoaded, onViewportPOIs, onZoomChange]);

  // Handle map load — apply illustrated theme for warm, soft look
  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      applyIllustratedTheme(map);
    }
    setMapLoaded(true);
  }, []);

  // Fit bounds to show both user and project when in hybrid mode (first time only)
  useEffect(() => {
    if (
      !mapRef.current ||
      !mapLoaded ||
      !userPosition ||
      geoMode !== "gps-far" ||
      hasFittedBoundsRef.current
    )
      return;

    hasFittedBoundsRef.current = true;

    const sw: [number, number] = [
      Math.min(center.lng, userPosition.lng),
      Math.min(center.lat, userPosition.lat),
    ];
    const ne: [number, number] = [
      Math.max(center.lng, userPosition.lng),
      Math.max(center.lat, userPosition.lat),
    ];

    mapRef.current.fitBounds([sw, ne], {
      padding: mapPadding || 80,
      maxZoom: 14,
      duration: 1200,
    });
  }, [mapLoaded, userPosition, geoMode, center, mapPadding]);

  // Update visible POIs after load
  useEffect(() => {
    if (mapLoaded) {
      const timer = setTimeout(updateVisiblePOIs, 200);
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, updateVisiblePOIs]);

  return (
    <div ref={mapContainerRef} className="w-full h-full relative">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 15,
          pitch: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE_STANDARD}
        onLoad={onLoad}
        onMoveEnd={updateVisiblePOIs}
        onZoomEnd={updateVisiblePOIs}
        onMouseDown={(e) => {
          // Track mouse position to distinguish click from drag
          mouseDownPosRef.current = { x: e.point.x, y: e.point.y };
        }}
        onClick={(e) => {
          // Only dismiss if this was a true click (not a drag)
          // Check if mouse moved more than 5px from mousedown position
          if (mouseDownPosRef.current) {
            const dx = Math.abs(e.point.x - mouseDownPosRef.current.x);
            const dy = Math.abs(e.point.y - mouseDownPosRef.current.y);
            if (dx > 5 || dy > 5) {
              // This was a drag, not a click
              mouseDownPosRef.current = null;
              return;
            }
          }
          mouseDownPosRef.current = null;
          // Dismiss active POI when clicking on map background
          // (marker clicks call e.originalEvent.stopPropagation())
          onDismissActive?.();
        }}
      >
        <NavigationControl position="top-right" />

        {/* Route overlay */}
        {routeData && (
          <RouteLayer
            coordinates={routeData.coordinates}
            travelTime={routeData.travelTime}
            travelMode={travelMode}
          />
        )}

        {/* Project center marker — only show when GPS is not active */}
        {(geoMode === "disabled" || geoMode === "loading" || geoMode === "fallback") && (
          <Marker
            longitude={center.lng}
            latitude={center.lat}
            anchor="center"
          >
            <div className="flex flex-col items-center">
              <div className="relative w-10 h-10 flex items-center justify-center">
                {/* Pulse ring behind marker */}
                <div className="absolute inset-0 rounded-full bg-sky-500/30 animate-pulse-ring motion-reduce:animate-none motion-reduce:opacity-30" />
                <div className="w-10 h-10 bg-sky-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center relative z-10">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-[10px] font-medium text-gray-600 mt-1 bg-white/90 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap max-w-[120px] truncate">
                {projectName.length > 20 ? `${projectName.slice(0, 20)}…` : projectName}
              </span>
            </div>
          </Marker>
        )}

        {/* GPS user position dot */}
        {userPosition && (geoMode === "gps-near" || geoMode === "gps-far") && (
          <Marker
            longitude={userPosition.lng}
            latitude={userPosition.lat}
            anchor="center"
          >
            <div className="relative w-8 h-8 flex items-center justify-center">
              {/* Accuracy circle */}
              {userAccuracy && userAccuracy < 200 && (
                <div
                  className="absolute rounded-full bg-blue-500/10 border border-blue-500/20"
                  style={{
                    width: Math.max(24, Math.min(userAccuracy / 2, 80)),
                    height: Math.max(24, Math.min(userAccuracy / 2, 80)),
                  }}
                />
              )}
              {/* Pulsing ring — fills parent, stays centered */}
              <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
              {/* Solid dot — centered in parent */}
              <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg z-10" />
            </div>
          </Marker>
        )}

        {/* All POI markers — adaptive zoom states driven by CSS */}
        {pois.map((poi) => {
          const isThisActive = activePOI === poi.id;
          const isHovered = hoveredPOI === poi.id && !isThisActive;
          const poiTravelTime = poi.travelTime?.[travelMode];

          return (
            <AdaptiveMarker
              key={poi.id}
              poi={poi}
              isActive={isThisActive}
              isHovered={isHovered}
              zIndex={isThisActive ? 10 : isHovered ? 5 : 1}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onPOIClick(poi.id);
              }}
              onMouseEnter={() => setHoveredPOI(poi.id)}
              onMouseLeave={() => setHoveredPOI(null)}
            >
              {/* Hover tooltip — name + category + travel time */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap pointer-events-none z-20 animate-fade-in">
                  <div className="bg-gray-900/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg shadow-xl text-xs">
                    <div className="font-semibold">{poi.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-gray-300">
                      <span>{poi.category.name}</span>
                      {shouldShowRating(poi.category.id) && poi.googleRating != null && poi.googleRating > 0 && (
                        <>
                          <span className="text-gray-500">·</span>
                          <GoogleRating rating={poi.googleRating} reviewCount={poi.googleReviewCount} size="xs" variant="dark" />
                        </>
                      )}
                      {poiTravelTime != null && (
                        <>
                          <span className="text-gray-500">·</span>
                          <TravelIcon className="w-3 h-3" />
                          <span>{Math.round(poiTravelTime)} min</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Tooltip arrow */}
                  <div className="w-2 h-2 bg-gray-900/90 rotate-45 mx-auto -mt-1" />
                </div>
              )}

              {/* Active state: info pill with name + travel time + directions */}
              {isThisActive && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap z-20">
                  <div className="bg-white rounded-xl shadow-xl border border-gray-200 px-3 py-2 flex items-center gap-2">
                    <span
                      className="text-xs font-semibold truncate max-w-[140px]"
                      style={{ color: poi.category.color }}
                    >
                      {poi.name}
                    </span>
                    {poiTravelTime != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <TravelIcon className="w-3 h-3" />
                        {Math.round(poiTravelTime)} min
                      </span>
                    )}
                    <a
                      href={poi.googlePlaceId
                        ? `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&destination_place_id=${poi.googlePlaceId}&travelmode=walking`
                        : `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&travelmode=walking`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors text-xs font-medium"
                    >
                      <Navigation className="w-3 h-3" />
                      Rute
                    </a>
                  </div>
                </div>
              )}
            </AdaptiveMarker>
          );
        })}
      </Map>

      {/* Skeleton loading overlay */}
      {showSkeleton && <SkeletonMapOverlay />}

      {/* Geolocation widget (for geolocation-with-fallback mode) */}
      {showGeoWidget && onEnableGeolocation && (
        <GeoLocationWidget
          geoMode={geoMode}
          isEnabled={geoIsEnabled ?? false}
          distanceToProject={distanceToProject ?? null}
          accuracy={userAccuracy ?? null}
          projectName={projectName}
          onEnable={onEnableGeolocation}
        />
      )}
    </div>
  );
}
