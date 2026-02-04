"use client";

import {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import Map, {
  NavigationControl,
  Marker,
  type MapRef,
} from "react-map-gl/mapbox";
import type { Coordinates, POI, TravelMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RouteLayer } from "@/components/map/route-layer";
import { MapPin, Sparkles } from "lucide-react";
import GeoLocationWidget from "./GeoLocationWidget";
import * as LucideIcons from "lucide-react";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

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
}: ExplorerMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const hasFittedBoundsRef = useRef(false);
  const lastFittedPOIRef = useRef<string | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  // Get Lucide icon component by name
  const getIcon = useCallback((iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  }, []);

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

  // Fit map to show full route when a NEW POI is selected (not on route updates)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !routeData?.coordinates.length || !activePOI) return;

    // Only fit bounds when selecting a different POI, not when route updates (e.g. GPS change)
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
  }, [routeData, mapLoaded, mapPadding, activePOI]);

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

  // Handle map load
  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      // Hide default POI labels for cleaner look
      const layers = map.getStyle()?.layers || [];
      layers.forEach((layer) => {
        if (
          layer.id.includes("poi") ||
          layer.id.includes("place-label") ||
          layer.id.includes("transit")
        ) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      });

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
    <div className="w-full h-full relative">
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
        mapStyle={MAP_STYLE}
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
              <div className="w-10 h-10 bg-sky-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-medium text-gray-500 mt-1 bg-white/80 px-1.5 py-0.5 rounded">
                Sentrum
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

        {/* All POI markers — no clustering */}
        {pois.map((poi) => {
          const Icon = getIcon(poi.category.icon);
          const isThisActive = activePOI === poi.id;

          return (
            <Marker
              key={poi.id}
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onPOIClick(poi.id);
              }}
            >
              <div className="relative cursor-pointer">
                {/* Pulsing ring for active marker */}
                {isThisActive && (
                  <div
                    className="absolute inset-0 rounded-full marker-pulse-ring"
                    style={{ backgroundColor: poi.category.color }}
                  />
                )}

                {/* Icon circle */}
                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-full border-2 border-white shadow-md transition-all",
                    isThisActive ? "w-10 h-10" : "w-8 h-8 hover:scale-110"
                  )}
                  style={{ backgroundColor: poi.category.color }}
                >
                  <Icon className={cn("text-white", isThisActive ? "w-5 h-5" : "w-4 h-4")} />
                </div>

                {/* Editorial sparkle badge */}
                {poi.editorialHook && !isThisActive && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border border-white flex items-center justify-center">
                    <Sparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                )}

                {/* Active marker name label */}
                {isThisActive && (
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
