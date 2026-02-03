"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";
import MapView3D, { useMap3DCamera } from "@/components/map/map-view-3d";
import { RouteLayer3D, UserLocationMarker3D } from "@/components/map/route-layer-3d";

interface GuideMap3DProps {
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

export default function GuideMap3D({
  center,
  stops,
  currentStopIndex,
  completedStops,
  onStopClick,
  routeCoordinates,
  userPosition,
  userAccuracy,
  geoMode = "loading",
}: GuideMap3DProps) {
  const cameraRef = useRef<ReturnType<typeof useMap3DCamera> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const hasFittedInitialRef = useRef(false);
  const markersRef = useRef<google.maps.maps3d.Marker3DInteractiveElement[]>([]);

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
    const latPad = (maxLat - minLat) * 0.15;
    const lngPad = (maxLng - minLng) * 0.15;
    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLng: minLng - lngPad,
      maxLng: maxLng + lngPad,
    };
  }, [stops]);

  // Handle map ready
  const handleMapReady = useCallback((map: google.maps.maps3d.Map3DElement) => {
    setMapReady(true);

    // Fit to bounds on first load
    if (bounds && !hasFittedInitialRef.current && cameraRef.current) {
      hasFittedInitialRef.current = true;
      cameraRef.current.fitBounds(bounds, { duration: 0, maxRange: 2000 });
    }
  }, [bounds]);

  // Fly to current stop when it changes
  useEffect(() => {
    if (!mapReady || !cameraRef.current) return;
    const currentStop = stops[currentStopIndex];
    if (!currentStop) return;

    cameraRef.current.flyTo(currentStop.coordinates, {
      range: 400,
      tilt: 60,
      duration: 1200,
    });
  }, [currentStopIndex, mapReady, stops]);

  // Create numbered stop markers using Marker3DInteractiveElement
  useEffect(() => {
    if (!mapReady) return;

    const createMarkers = async () => {
      const { Marker3DInteractiveElement, AltitudeMode } = await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;
      const { PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

      // Get map element from camera ref
      const map3d = cameraRef.current?.mapRef.current;
      if (!map3d) return;

      // Remove existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      // Create markers for each stop
      stops.forEach((stop, index) => {
        const isActive = index === currentStopIndex;
        const isCompleted = completedStops.has(index);

        // Create custom pin content (numbered circle)
        const pinContent = document.createElement("div");
        pinContent.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${isActive ? "40px" : "32px"};
          height: ${isActive ? "40px" : "32px"};
          border-radius: 50%;
          font-weight: 600;
          font-size: ${isActive ? "18px" : "14px"};
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.2s;
          background-color: ${isActive ? "#2563eb" : isCompleted ? "#78716c" : "#ffffff"};
          color: ${isActive || isCompleted ? "#ffffff" : "#44403c"};
        `;
        pinContent.textContent = isCompleted ? "✓" : String(index + 1);

        // Create pin element
        const pin = new PinElement({
          glyph: pinContent,
          background: "transparent",
          borderColor: "transparent",
          scale: isActive ? 1.2 : 1.0,
        });

        // Create interactive marker
        const marker = new Marker3DInteractiveElement({
          position: { lat: stop.coordinates.lat, lng: stop.coordinates.lng, altitude: 0 },
          altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
        });

        marker.append(pin);

        // Handle click
        marker.addEventListener("gmp-click", () => {
          onStopClick(index);
        });

        map3d.append(marker);
        markersRef.current.push(marker);
      });
    };

    createMarkers();

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    };
  }, [mapReady, stops, currentStopIndex, completedStops, onStopClick]);

  // Convert stops to POI format for MapView3D (empty since we handle markers manually)
  const emptyPois: POI[] = [];

  return (
    <div className="w-full h-full relative">
      <MapView3D
        center={center}
        pois={emptyPois}
        cameraRef={cameraRef}
        onMapReady={handleMapReady}
        showRoute={!!routeCoordinates && routeCoordinates.length >= 2}
        routeCoordinates={routeCoordinates}
        travelMode="walk"
        userPosition={(geoMode === "gps-near" || geoMode === "gps-far") ? userPosition : null}
        userAccuracy={userAccuracy}
      />
    </div>
  );
}
