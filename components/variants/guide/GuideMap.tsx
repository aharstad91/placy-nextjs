"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import Map, { NavigationControl, Marker, type MapRef } from "react-map-gl/mapbox";
import type { Coordinates, POI } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RouteLayer } from "@/components/map/route-layer";
import { Check } from "lucide-react";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";
import { MAP_STYLE_DEFAULT } from "@/lib/themes/map-styles";

interface GuideMapProps {
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

export default function GuideMap({
  center,
  stops,
  currentStopIndex,
  completedStops,
  onStopClick,
  routeCoordinates,
  userPosition,
  userAccuracy,
  geoMode = "loading",
}: GuideMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const hasFittedInitialRef = useRef(false);

  // Animation debouncing: track if we're currently animating
  const animatingRef = useRef(false);
  const pendingTargetRef = useRef<Coordinates | null>(null);

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

  // Fly to current stop when it changes
  useEffect(() => {
    if (!mapLoaded) return;
    const currentStop = stops[currentStopIndex];
    if (!currentStop) return;

    flyToStop(currentStop.coordinates);
  }, [currentStopIndex, mapLoaded, stops, flyToStop]);

  return (
    <div className="w-full h-full relative">
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
        mapStyle={MAP_STYLE_DEFAULT}
        onLoad={onLoad}
      >
        <NavigationControl position="top-right" />

        {/* Route overlay */}
        {routeCoordinates && routeCoordinates.length >= 2 && (
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

        {/* Stop markers with numbers */}
        {stops.map((stop, index) => {
          const isActive = index === currentStopIndex;
          const isCompleted = completedStops.has(index);

          return (
            <Marker
              key={stop.id}
              longitude={stop.coordinates.lng}
              latitude={stop.coordinates.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onStopClick(index);
              }}
            >
              <div className="relative cursor-pointer">
                {/* Pulsing ring for active marker */}
                {isActive && (
                  <div className="absolute inset-0 rounded-full bg-blue-600 marker-pulse-ring" />
                )}

                {/* Numbered circle */}
                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-full border-2 border-white shadow-md transition-all font-semibold",
                    isActive && "w-10 h-10 bg-blue-600 text-white text-lg",
                    isCompleted && "w-8 h-8 bg-stone-500 text-white hover:scale-110",
                    !isActive && !isCompleted && "w-8 h-8 bg-white text-stone-700 hover:scale-110"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className={isActive ? "text-base" : "text-sm"}>
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Active marker name label */}
                {isActive && (
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="px-2 py-0.5 text-[10px] font-medium text-white bg-blue-600 rounded shadow-lg">
                      {stop.name}
                    </span>
                  </div>
                )}
              </div>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
