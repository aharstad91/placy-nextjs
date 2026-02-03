"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import type { Coordinates, POI, TravelMode, CameraConstraints } from "@/lib/types";
import { DEFAULT_CAMERA_CONSTRAINTS } from "@/lib/types";
import { calculateBoundsWithBuffer } from "@/lib/map-utils";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";
import MapView3D, { useMap3DCamera } from "@/components/map/map-view-3d";
import { MarkerActionButtons } from "@/components/map/MarkerActionButtons";
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

  // Track active marker element for action buttons
  const [activeMarkerElement, setActiveMarkerElement] =
    useState<google.maps.maps3d.Marker3DInteractiveElement | null>(null);

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

  // Handle POI click without camera movement
  const handlePOIClick = useCallback((poiId: string) => {
    // Just select the POI without moving camera
    // The route/path will be created by the parent component
    onPOIClick(poiId);
  }, [onPOIClick]);

  // Handle 3D toggle
  const handle3DToggle = useCallback(() => {
    if (!cameraRef.current) return;

    const currentCamera = cameraRef.current.getCamera();
    if (!currentCamera || !currentCamera.center) return;

    // Check if already in 3D (tilt > 30°)
    const isIn3D = currentCamera.tilt && currentCamera.tilt > 30;

    if (isIn3D) {
      // Return to top-down
      cameraRef.current.flyTo(
        { lat: currentCamera.center.lat, lng: currentCamera.center.lng },
        { tilt: 0, range: currentCamera.range, duration: 1200 }
      );
    } else {
      // Go to 3D
      cameraRef.current.flyTo(
        { lat: currentCamera.center.lat, lng: currentCamera.center.lng },
        { tilt: 55, range: 600, duration: 1200 }
      );
    }
  }, []);

  // Removed: Auto-fit bounds to show full route
  // Keep zoom level unchanged when selecting POI

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
        // Marker ref callback for action buttons
        onActiveMarkerRef={setActiveMarkerElement}
      />

      {/* Action buttons overlay */}
      {activePOI && routeData && (
        <MarkerActionButtons
          markerElement={activeMarkerElement}
          travelTime={Math.round(routeData.travelTime)}
          travelMode={travelMode}
          onToggle3D={handle3DToggle}
          show={true}
        />
      )}

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
