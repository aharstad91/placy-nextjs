"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import type { Coordinates, POI, TravelMode, CameraConstraints } from "@/lib/types";
import { DEFAULT_CAMERA_CONSTRAINTS } from "@/lib/types";
import { calculateBoundsWithBuffer } from "@/lib/map-utils";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";
import MapView3D, { useMap3DCamera } from "@/components/map/map-view-3d";
import GeoLocationWidget from "./GeoLocationWidget";

interface ExplorerMap3DProps {
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

export default function ExplorerMap3D({
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
}: ExplorerMap3DProps) {
  const cameraRef = useRef<ReturnType<typeof useMap3DCamera> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const lastFittedPOIRef = useRef<string | null>(null);
  const hasFittedBoundsRef = useRef(false);

  // Determine if we should show the project center marker
  // (only when GPS is not active)
  const showProjectCenter = geoMode === "disabled" || geoMode === "loading" || geoMode === "fallback";

  // Handle map ready
  const handleMapReady = useCallback((map: google.maps.maps3d.Map3DElement) => {
    setMapReady(true);
  }, []);

  // Handle map background click (dismiss active POI)
  const handleMapClick = useCallback(() => {
    onDismissActive?.();
  }, [onDismissActive]);

  // Handle POI click with fly animation
  const handlePOIClick = useCallback((poiId: string) => {
    const poi = pois.find(p => p.id === poiId);
    if (poi && cameraRef.current) {
      cameraRef.current.flyTo(poi.coordinates, {
        range: 500,
        tilt: 60,
        duration: 1200
      });
    }
    onPOIClick(poiId);
  }, [pois, onPOIClick]);

  // Fit map to show full route when a NEW POI is selected
  useEffect(() => {
    if (!mapReady || !routeData?.coordinates.length || !activePOI || !cameraRef.current) return;

    // Only fit bounds when selecting a different POI
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

    cameraRef.current.fitBounds(
      { minLat, maxLat, minLng, maxLng },
      { duration: 800, padding: 0.3 }
    );
  }, [routeData, mapReady, activePOI]);

  // Reset fitted POI ref when route is dismissed
  useEffect(() => {
    if (!activePOI) {
      lastFittedPOIRef.current = null;
    }
  }, [activePOI]);

  // Fit bounds to show both user and project when in hybrid mode (first time only)
  useEffect(() => {
    if (!mapReady || !userPosition || geoMode !== "gps-far" || hasFittedBoundsRef.current || !cameraRef.current) return;

    hasFittedBoundsRef.current = true;

    const minLat = Math.min(center.lat, userPosition.lat);
    const maxLat = Math.max(center.lat, userPosition.lat);
    const minLng = Math.min(center.lng, userPosition.lng);
    const maxLng = Math.max(center.lng, userPosition.lng);

    cameraRef.current.fitBounds(
      { minLat, maxLat, minLng, maxLng },
      { duration: 1200, maxRange: 5000 }
    );
  }, [mapReady, userPosition, geoMode, center]);

  // Calculate visible POIs based on camera bounds (approximation)
  // In 3D, we don't have exact viewport bounds, so we estimate based on camera position and range
  const updateVisiblePOIs = useCallback(() => {
    if (!cameraRef.current) return;

    const camera = cameraRef.current.getCamera();
    if (!camera || !camera.center) return;

    // Estimate visible radius based on camera range
    // At range=1000m and tilt=50°, roughly 500m visible in each direction
    const rangeMeters = camera.range || 1000;
    const centerLat = camera.center.lat;
    const centerLng = camera.center.lng;
    const visibleRadiusKm = (rangeMeters / 1000) * 0.8; // ~80% of range as visible radius
    const latDelta = visibleRadiusKm / 111; // 1° lat ≈ 111km
    const lngDelta = visibleRadiusKm / (111 * Math.cos(centerLat * Math.PI / 180));

    const bounds = {
      minLat: centerLat - latDelta,
      maxLat: centerLat + latDelta,
      minLng: centerLng - lngDelta,
      maxLng: centerLng + lngDelta
    };

    const visibleIds = new Set<string>();
    for (const poi of pois) {
      if (
        poi.coordinates.lat >= bounds.minLat &&
        poi.coordinates.lat <= bounds.maxLat &&
        poi.coordinates.lng >= bounds.minLng &&
        poi.coordinates.lng <= bounds.maxLng
      ) {
        visibleIds.add(poi.id);
      }
    }

    onViewportPOIs(visibleIds, 0);

    // Estimate zoom level from range (approximate)
    // range 500 ≈ zoom 16, range 2000 ≈ zoom 14, range 5000 ≈ zoom 12
    const zoomEstimate = Math.max(10, Math.min(18, 18 - Math.log2(rangeMeters / 250)));
    onZoomChange(zoomEstimate);
  }, [pois, onViewportPOIs, onZoomChange]);

  // Update visible POIs when map is ready
  useEffect(() => {
    if (mapReady) {
      const timer = setTimeout(updateVisiblePOIs, 500);
      return () => clearTimeout(timer);
    }
  }, [mapReady, updateVisiblePOIs]);

  // Add POIs for project center marker if needed
  const poisWithCenter = useMemo(() => {
    if (!showProjectCenter) return pois;
    // We'll handle center marker separately via a custom marker
    return pois;
  }, [pois, showProjectCenter]);

  // Calculate camera constraints from POI bounds for performance optimization
  const constraints = useMemo((): CameraConstraints => {
    // Include center in bounds calculation to ensure project area is always visible
    const allCoords = [center, ...allPOIs.map(p => p.coordinates)];
    const bounds = calculateBoundsWithBuffer(
      allCoords,
      DEFAULT_CAMERA_CONSTRAINTS.boundsBuffer
    );

    return {
      minTilt: DEFAULT_CAMERA_CONSTRAINTS.minTilt,
      maxTilt: DEFAULT_CAMERA_CONSTRAINTS.maxTilt,
      minRange: DEFAULT_CAMERA_CONSTRAINTS.minRange,
      maxRange: DEFAULT_CAMERA_CONSTRAINTS.maxRange,
      bounds,
    };
  }, [center, allPOIs]);

  return (
    <div className="w-full h-full relative">
      <MapView3D
        center={center}
        pois={poisWithCenter}
        activePOI={activePOI}
        onPOIClick={handlePOIClick}
        onMapClick={handleMapClick}
        onMapReady={handleMapReady}
        showRoute={!!routeData}
        routeCoordinates={routeData?.coordinates}
        travelMode={travelMode}
        userPosition={userPosition}
        userAccuracy={userAccuracy ?? undefined}
        initialBounds={initialBounds}
        cameraRef={cameraRef}
        // Project center marker props
        showProjectCenter={showProjectCenter}
        projectCenterLabel="Sentrum"
        // Camera constraints for performance
        constraints={constraints}
      />

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
