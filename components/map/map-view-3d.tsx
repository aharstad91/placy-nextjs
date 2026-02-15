// @ts-nocheck — 3D map component preserved for future use, requires @vis.gl/react-google-maps
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { APIProvider, useApiIsLoaded } from "@vis.gl/react-google-maps";
import type { Coordinates, POI, TravelMode, CameraConstraints } from "@/lib/types";
import { DEFAULT_CAMERA_CONSTRAINTS } from "@/lib/types";
import { clampRange } from "@/lib/map-utils";
import { POIMarkers3D } from "./poi-marker-3d";
import { RouteLayer3D, UserLocationMarker3D, ProjectCenterMarker3D } from "./route-layer-3d";
import { useMap3DCamera } from "@/lib/hooks/useMap3DCamera";
import { Map3DFallback, isWebGLAvailable } from "./Map3DFallback";

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface MapView3DInnerProps {
  center: Coordinates;
  pois: POI[];
  activePOI?: string | null;
  onPOIClick?: (poiId: string) => void;
  onMapClick?: () => void;
  onMapReady?: (map: google.maps.maps3d.Map3DElement) => void;
  showRoute?: boolean;
  routeCoordinates?: [number, number][];
  travelMode?: TravelMode;
  userPosition?: Coordinates | null;
  userAccuracy?: number | null;
  initialBounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  // Camera control ref
  cameraRef?: React.MutableRefObject<ReturnType<typeof useMap3DCamera> | null>;
  // Project center marker (shown when GPS is disabled)
  showProjectCenter?: boolean;
  projectCenterLabel?: string;
  // Camera constraints for performance optimization
  constraints?: CameraConstraints;
  // Active marker ref callback (for action buttons)
  onActiveMarkerRef?: (marker: google.maps.maps3d.Marker3DInteractiveElement) => void;
}

function MapView3DInner({
  center,
  pois,
  activePOI,
  onPOIClick,
  onMapClick,
  onMapReady,
  showRoute = false,
  routeCoordinates,
  travelMode = "walk",
  userPosition,
  userAccuracy,
  initialBounds,
  cameraRef,
  showProjectCenter = false,
  projectCenterLabel = "Sentrum",
  constraints,
  onActiveMarkerRef
}: MapView3DInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapElementRef = useRef<google.maps.maps3d.Map3DElement | null>(null);
  const isLoaded = useApiIsLoaded();
  const [isReady, setIsReady] = useState(false);
  const [isLoadingTiles, setIsLoadingTiles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialFit = useRef(false);
  const reducedMotion = prefersReducedMotion();

  const camera = useMap3DCamera();

  // Check WebGL availability
  const [webGLAvailable, setWebGLAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    setWebGLAvailable(isWebGLAvailable());
  }, []);

  // Show fallback if WebGL is not available
  if (webGLAvailable === false) {
    return <Map3DFallback pois={pois} />;
  }

  // Expose camera controls via ref
  useEffect(() => {
    if (cameraRef) {
      cameraRef.current = camera;
    }
  }, [camera, cameraRef]);

  // Initialize 3D map
  useEffect(() => {
    if (!isLoaded) return;

    const initMap = async () => {
      try {
        const { Map3DElement } = await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;

        if (!mapContainerRef.current) return;

        // Clean up existing map
        if (mapElementRef.current) {
          mapElementRef.current.remove();
        }

        // Merge constraints with defaults
        const effectiveConstraints = {
          minTilt: constraints?.minTilt ?? DEFAULT_CAMERA_CONSTRAINTS.minTilt,
          maxTilt: constraints?.maxTilt ?? DEFAULT_CAMERA_CONSTRAINTS.maxTilt,
          minRange: constraints?.minRange ?? DEFAULT_CAMERA_CONSTRAINTS.minRange,
          maxRange: constraints?.maxRange ?? DEFAULT_CAMERA_CONSTRAINTS.maxRange,
          bounds: constraints?.bounds,
        };

        // Create 3D map element
        // CRITICAL: mode must be set for 3D to render
        const map3d = new Map3DElement({
          center: { lat: center.lat, lng: center.lng, altitude: 0 },
          tilt: 0, // Start with top-down view
          heading: 0,
          range: 1200,
          mode: "SATELLITE" as google.maps.MapMode,
          // Native tilt constraints
          minTilt: effectiveConstraints.minTilt,
          maxTilt: effectiveConstraints.maxTilt,
          // Native bounds constraint (lat/lng restriction)
          ...(effectiveConstraints.bounds && {
            bounds: new google.maps.LatLngBounds(
              { lat: effectiveConstraints.bounds.south, lng: effectiveConstraints.bounds.west },
              { lat: effectiveConstraints.bounds.north, lng: effectiveConstraints.bounds.east }
            )
          })
        });

        // CRITICAL: gmp-map-3d needs explicit dimensions
        map3d.style.width = "100%";
        map3d.style.height = "100%";
        map3d.style.display = "block";

        // Handle background click (dismiss active POI)
        map3d.addEventListener("gmp-click", (event) => {
          // Check if click was on a marker by looking at event target
          // If it's just the map, trigger dismiss
          const target = event.target as HTMLElement;
          if (target === map3d) {
            onMapClick?.();
          }
        });

        mapElementRef.current = map3d;
        camera.mapRef.current = map3d;
        mapContainerRef.current.appendChild(map3d);

        // Range constraint via listener (no native minRange/maxRange support)
        // Only enforce constraints after user stops zooming (debounced)
        let lastClampedRange = map3d.range ?? 1200;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        map3d.addEventListener("gmp-rangechange", () => {
          const currentRange = map3d.range ?? 1200;
          const clampedRange = clampRange(
            currentRange,
            effectiveConstraints.minRange,
            effectiveConstraints.maxRange
          );

          // Clear pending constraint enforcement
          if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
          }

          // Only enforce constraint after user stops zooming (300ms delay)
          if (clampedRange !== currentRange && Math.abs(clampedRange - lastClampedRange) > 1) {
            debounceTimer = setTimeout(() => {
              lastClampedRange = clampedRange;
              map3d.range = clampedRange;
              debounceTimer = null;
            }, 300);
          }
        });

        // Listen for tiles loaded to hide loading indicator
        map3d.addEventListener("gmp-centerchange", () => {
          // After first center change, tiles should be loading/loaded
          setTimeout(() => setIsLoadingTiles(false), 1000);
        }, { once: true });

        setIsReady(true);
        setError(null);
        onMapReady?.(map3d);

      } catch (err) {
        console.error("Failed to initialize 3D map:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    initMap();

    return () => {
      if (mapElementRef.current) {
        mapElementRef.current.remove();
        mapElementRef.current = null;
      }
    };
  }, [isLoaded, center.lat, center.lng, onMapClick, onMapReady, camera.mapRef]);

  // Fit to initial bounds on first load
  useEffect(() => {
    if (!isReady || hasInitialFit.current || !initialBounds) return;
    hasInitialFit.current = true;

    camera.fitBounds(initialBounds, { duration: reducedMotion ? 0 : 0 });
  }, [isReady, initialBounds, camera, reducedMotion]);

  // Fit to POI bounds if no initial bounds provided
  useEffect(() => {
    if (!isReady || hasInitialFit.current || initialBounds || pois.length === 0) return;
    hasInitialFit.current = true;

    const coords = pois.map(p => p.coordinates);
    const bounds = camera.calculateBounds(coords);
    camera.fitBounds(bounds, { duration: reducedMotion ? 0 : 0 });
  }, [isReady, initialBounds, pois, camera, reducedMotion]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          <div className="text-red-600 font-medium mb-2">Failed to load 3D map</div>
          <div className="text-gray-600 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ minHeight: "400px" }}
      />

      {/* POI markers */}
      {isReady && (
        <POIMarkers3D
          pois={pois}
          activePOI={activePOI ?? null}
          onPOIClick={onPOIClick}
          map3d={mapElementRef.current}
          onActiveMarkerRef={onActiveMarkerRef}
        />
      )}

      {/* Route layer */}
      {isReady && showRoute && routeCoordinates && routeCoordinates.length > 0 && (
        <RouteLayer3D
          coordinates={routeCoordinates}
          travelMode={travelMode}
          map3d={mapElementRef.current}
        />
      )}

      {/* User location marker */}
      {isReady && userPosition && (
        <UserLocationMarker3D
          position={userPosition}
          accuracy={userAccuracy ?? undefined}
          map3d={mapElementRef.current}
        />
      )}

      {/* Project center marker (shown when GPS is disabled) */}
      {isReady && showProjectCenter && (
        <ProjectCenterMarker3D
          position={center}
          label={projectCenterLabel}
          map3d={mapElementRef.current}
        />
      )}

      {/* Loading overlay while tiles load */}
      {isReady && isLoadingTiles && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 pointer-events-none z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="text-sm text-gray-600">Laster 3D-kart...</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface MapView3DProps extends MapView3DInnerProps {
  apiKey?: string;
}

/**
 * Google Maps 3D map component with POI markers, routes, and camera controls
 *
 * @example
 * ```tsx
 * const cameraRef = useRef(null);
 *
 * <MapView3D
 *   center={{ lat: 63.43, lng: 10.39 }}
 *   pois={pois}
 *   activePOI={activePOI}
 *   onPOIClick={(id) => setActivePOI(id)}
 *   cameraRef={cameraRef}
 * />
 *
 * // Later: cameraRef.current?.flyTo({ lat: 63.43, lng: 10.39 })
 * ```
 */
export default function MapView3D({ apiKey, ...props }: MapView3DProps) {
  const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          <div className="text-red-600 font-medium mb-2">Missing API Key</div>
          <div className="text-gray-600 text-sm">
            Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={key}>
      <MapView3DInner {...props} />
    </APIProvider>
  );
}

// Re-export camera hook for external use
export { useMap3DCamera } from "@/lib/hooks/useMap3DCamera";
