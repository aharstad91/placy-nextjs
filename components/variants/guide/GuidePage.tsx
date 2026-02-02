"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Project, POI, GuideStopConfig } from "@/lib/types";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { haversineDistance } from "@/lib/utils";
import ExplorerBottomSheet from "@/components/variants/explorer/ExplorerBottomSheet";
import GuideMap from "./GuideMap";
import GuideStopPanel from "./GuideStopPanel";

interface GuidePageProps {
  project: Project;
}

type RouteState =
  | { status: "idle" }
  | { status: "fetching" }
  | { status: "ready"; coordinates: [number, number][] }
  | { status: "error"; message: string };

export default function GuidePage({ project }: GuidePageProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [completedStops, setCompletedStops] = useState<Set<number>>(new Set());
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });

  // Get guide config - must be checked before hooks that depend on it
  const guideConfig = project.guideConfig;

  // Build stops array by resolving POI references
  const stops: POI[] = useMemo(() => {
    if (!guideConfig) return [];
    return guideConfig.stops
      .map((stopConfig) => {
        const poi = project.pois.find((p) => p.id === stopConfig.poiId);
        return poi || null;
      })
      .filter((poi): poi is POI => poi !== null);
  }, [guideConfig, project.pois]);

  // Get stop configs (for overrides)
  const stopConfigs: GuideStopConfig[] = guideConfig?.stops ?? [];

  // Geolocation
  const geo = useGeolocation(project.centerCoordinates);

  // Hydration guard
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Calculate distance to current stop
  const distanceToCurrentStop = useMemo(() => {
    if (!geo.userPosition || !stops[currentStopIndex]) return null;
    return haversineDistance(geo.userPosition, stops[currentStopIndex].coordinates);
  }, [geo.userPosition, stops, currentStopIndex]);

  // Fetch route from Mapbox Directions (single multi-waypoint call)
  useEffect(() => {
    if (stops.length < 2) return;

    const abortController = new AbortController();
    setRouteState({ status: "fetching" });

    // Build waypoints string for Mapbox Directions API
    const waypoints = stops
      .map((stop) => `${stop.coordinates.lng},${stop.coordinates.lat}`)
      .join(";");

    fetch(`/api/directions?waypoints=${encodeURIComponent(waypoints)}&mode=walk`, {
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.routes?.[0]?.geometry?.coordinates) {
          setRouteState({
            status: "ready",
            coordinates: data.routes[0].geometry.coordinates,
          });
        } else {
          setRouteState({ status: "error", message: "No route found" });
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setRouteState({ status: "error", message: err.message });
      });

    return () => abortController.abort();
  }, [stops]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentStopIndex < stops.length - 1) {
      setCurrentStopIndex((prev) => prev + 1);
    }
  }, [currentStopIndex, stops.length]);

  const handlePrev = useCallback(() => {
    if (currentStopIndex > 0) {
      setCurrentStopIndex((prev) => prev - 1);
    }
  }, [currentStopIndex]);

  const handleStopClick = useCallback((index: number) => {
    setCurrentStopIndex(index);
  }, []);

  const handleMarkComplete = useCallback(() => {
    setCompletedStops((prev) => {
      const next = new Set(prev);
      next.add(currentStopIndex);
      return next;
    });
  }, [currentStopIndex]);

  // Snap points for bottom sheet
  const snapPoints = useMemo(() => {
    if (typeof window === "undefined") return [160, 400, 700];
    const vh = window.innerHeight;
    return [160, Math.round(vh * 0.45), Math.round(vh * 0.88)];
  }, []);

  // Don't render until hydrated (prevents SSR/client mismatch)
  if (!isHydrated) {
    return (
      <div className="h-screen w-full bg-stone-100 flex items-center justify-center">
        <div className="text-stone-500">Laster guide...</div>
      </div>
    );
  }

  // No guide config - show error
  if (!guideConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-100">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-stone-900">
            Ingen guidedata funnet
          </h1>
          <p className="mt-2 text-stone-600">
            Dette prosjektet mangler guideConfig.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative overflow-hidden bg-stone-100">
      {/* Map (fullscreen) */}
      <div className="absolute inset-0">
        <GuideMap
          center={project.centerCoordinates}
          stops={stops}
          currentStopIndex={currentStopIndex}
          completedStops={completedStops}
          onStopClick={handleStopClick}
          routeCoordinates={
            routeState.status === "ready" ? routeState.coordinates : undefined
          }
          userPosition={geo.userPosition}
          userAccuracy={geo.accuracy}
          geoMode={geo.mode}
        />
      </div>

      {/* Guide title overlay */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg">
          <h1 className="text-lg font-semibold text-stone-900">
            {guideConfig.title}
          </h1>
          {guideConfig.precomputedDistanceMeters && guideConfig.precomputedDurationMinutes && (
            <p className="text-sm text-stone-500 mt-0.5">
              {(guideConfig.precomputedDistanceMeters / 1000).toFixed(1)} km
              {" · "}
              {guideConfig.precomputedDurationMinutes} min
            </p>
          )}
        </div>
      </div>

      {/* Bottom sheet */}
      <ExplorerBottomSheet snapPoints={snapPoints} initialSnap={0}>
        <GuideStopPanel
          stops={stops}
          stopConfigs={stopConfigs}
          currentStopIndex={currentStopIndex}
          completedStops={completedStops}
          distanceToStop={distanceToCurrentStop}
          onNext={handleNext}
          onPrev={handlePrev}
          onMarkComplete={handleMarkComplete}
        />
      </ExplorerBottomSheet>
    </div>
  );
}
