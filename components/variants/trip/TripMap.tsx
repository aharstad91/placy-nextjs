"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import Map, { NavigationControl, Marker, type MapRef } from "react-map-gl/mapbox";
import type { Coordinates, POI } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RouteLayer } from "@/components/map/route-layer";
import { Check } from "lucide-react";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";
import { AdaptiveMarker } from "@/components/map/adaptive-marker";
import { useMapZoomState } from "@/lib/hooks/useMapZoomState";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";

interface TripMapProps {
  center: Coordinates;
  stops: POI[];
  currentStopIndex: number;
  completedStops: Set<number>;
  onStopClick: (index: number) => void;
  routeCoordinates?: [number, number][];
  // Geolocation
  userPosition?: Coordinates | null;
  userAccuracy?: number | null;
  geoMode?: GeolocationMode;
}

export default function TripMap({
  center,
  stops,
  currentStopIndex,
  completedStops,
  onStopClick,
  routeCoordinates,
  userPosition,
  userAccuracy,
  geoMode = "loading",
}: TripMapProps) {
  const mapRef = useRef<MapRef>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const hasFittedInitialRef = useRef(false);
  const [hoveredStop, setHoveredStop] = useState<number | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  // Skip flyTo when stop change originated from a map marker click
  // (the marker is already visible — flying to it is disorienting)
  const skipNextFlyRef = useRef(false);

  // Animation debouncing: track if we're currently animating
  const animatingRef = useRef(false);
  const pendingTargetRef = useRef<Coordinates | null>(null);

  // CSS-driven zoom state (writes data-zoom-state to container, no React re-renders)
  useMapZoomState(mapRef, mapContainerRef, { mapLoaded });

  // Compute bounds from all stops
  const bounds = useMemo(() => {
    if (stops.length === 0) return null;
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    for (const stop of stops) {
      if (stop.coordinates.lat < minLat) minLat = stop.coordinates.lat;
      if (stop.coordinates.lat > maxLat) maxLat = stop.coordinates.lat;
      if (stop.coordinates.lng < minLng) minLng = stop.coordinates.lng;
      if (stop.coordinates.lng > maxLng) maxLng = stop.coordinates.lng;
    }
    // Add some padding
    const latPad = (maxLat - minLat) * 0.1;
    const lngPad = (maxLng - minLng) * 0.1;
    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLng: minLng - lngPad,
      maxLng: maxLng + lngPad,
    };
  }, [stops]);

  // Fit to bounds on first load
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !bounds || hasFittedInitialRef.current) return;
    hasFittedInitialRef.current = true;
    mapRef.current.fitBounds(
      [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
      { padding: { top: 60, bottom: 200, left: 40, right: 40 }, duration: 0 }
    );
  }, [mapLoaded, bounds]);

  // Handle map load — apply illustrated theme and wait for style imports
  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const finalize = () => {
      applyIllustratedTheme(map);
      setMapLoaded(true);
    };

    // Standard style uses imports that may still be loading after onLoad
    if (map.isStyleLoaded()) {
      finalize();
    } else {
      map.once("style.load", finalize);
    }
  }, []);

  // Debounced flyTo function with reduced motion support
  const flyToStop = useCallback((coordinates: Coordinates) => {
    if (!mapRef.current) return;

    // If already animating, queue this target for later
    if (animatingRef.current) {
      pendingTargetRef.current = coordinates;
      return;
    }

    animatingRef.current = true;

    // Check reduced motion preference
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      mapRef.current.jumpTo({
        center: [coordinates.lng, coordinates.lat],
        zoom: 16,
      });
      animatingRef.current = false;
    } else {
      mapRef.current.flyTo({
        center: [coordinates.lng, coordinates.lat],
        zoom: 16,
        duration: 1000,
      });

      // Wait for animation to complete
      setTimeout(() => {
        animatingRef.current = false;
        if (pendingTargetRef.current) {
          const target = pendingTargetRef.current;
          pendingTargetRef.current = null;
          flyToStop(target);
        }
      }, 1000);
    }
  }, []);

  // Fly to current stop when it changes (unless change came from map click
  // or this is the initial load — fitBounds already handles the initial view)
  const hasInitiallyLoadedRef = useRef(false);
  useEffect(() => {
    if (!mapLoaded) return;
    if (!hasInitiallyLoadedRef.current) {
      hasInitiallyLoadedRef.current = true;
      return;
    }
    if (skipNextFlyRef.current) {
      skipNextFlyRef.current = false;
      return;
    }
    const currentStop = stops[currentStopIndex];
    if (!currentStop) return;

    flyToStop(currentStop.coordinates);
  }, [currentStopIndex, mapLoaded, stops, flyToStop]);

  return (
    <div ref={mapContainerRef} className="w-full h-full relative">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 14,
          pitch: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE_STANDARD}
        onLoad={onLoad}
        onMouseDown={(e) => {
          mouseDownPosRef.current = { x: e.point.x, y: e.point.y };
        }}
        onClick={(e) => {
          // Only dismiss if this was a true click (not a drag)
          if (mouseDownPosRef.current) {
            const dx = Math.abs(e.point.x - mouseDownPosRef.current.x);
            const dy = Math.abs(e.point.y - mouseDownPosRef.current.y);
            if (dx > 5 || dy > 5) {
              mouseDownPosRef.current = null;
              return;
            }
          }
          mouseDownPosRef.current = null;
        }}
      >
        <NavigationControl position="top-right" />

        {/* Route overlay */}
        {mapLoaded && routeCoordinates && routeCoordinates.length >= 2 && (
          <RouteLayer coordinates={routeCoordinates} />
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
              {/* Pulsing ring */}
              <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
              {/* Solid dot */}
              <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg z-10" />
            </div>
          </Marker>
        )}

        {/* Stop markers — AdaptiveMarker with stop number badge */}
        {stops.map((stop, index) => {
          const isActive = index === currentStopIndex;
          const isCompleted = completedStops.has(index);
          const isHovered = hoveredStop === index && !isActive;
          const isStartPoint = index === 0;

          return (
            <AdaptiveMarker
              key={stop.id}
              poi={stop}
              isActive={isActive}
              isHovered={isHovered}
              zIndex={isActive ? 10 : isHovered ? 5 : 1}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                skipNextFlyRef.current = true;
                onStopClick(index);
              }}
              onMouseEnter={() => setHoveredStop(index)}
              onMouseLeave={() => setHoveredStop(null)}
            >
              {/* Stop number badge — top-left corner of marker (not on start point) */}
              {!isStartPoint && (
                <div
                  className={cn(
                    "absolute -top-1.5 -left-1.5 min-w-[20px] h-[20px] rounded-full border-2 border-white flex items-center justify-center z-10 shadow-sm",
                    isCompleted
                      ? "bg-green-600"
                      : "bg-white"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-2.5 h-2.5 text-white" />
                  ) : (
                    <span
                      className="text-[10px] font-bold leading-none px-0.5"
                      style={{ color: stop.category.color }}
                    >
                      {index}
                    </span>
                  )}
                </div>
              )}

              {/* Hover tooltip — name + category */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap pointer-events-none z-20 animate-fade-in">
                  <div className="bg-gray-900/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg shadow-xl text-xs">
                    <div className="font-semibold">{stop.name}</div>
                    <div className="text-gray-300 mt-0.5">
                      {isStartPoint ? "Start" : stop.category.name}
                    </div>
                  </div>
                  {/* Tooltip arrow */}
                  <div className="w-2 h-2 bg-gray-900/90 rotate-45 mx-auto -mt-1" />
                </div>
              )}

              {/* Active state: info pill below marker */}
              {isActive && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap z-20">
                  <div className="bg-white rounded-xl shadow-xl border border-gray-200 px-3 py-2 flex items-center gap-2">
                    <span
                      className="text-xs font-semibold truncate max-w-[140px]"
                      style={{ color: stop.category.color }}
                    >
                      {stop.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isStartPoint ? "Start" : stop.category.name}
                    </span>
                  </div>
                </div>
              )}
            </AdaptiveMarker>
          );
        })}
      </Map>
    </div>
  );
}
