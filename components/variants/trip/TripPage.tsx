"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Project, POI, TripStopConfig, Coordinates } from "@/lib/types";
import type { RouteSegment } from "@/components/map/route-layer";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useTripCompletion } from "@/lib/hooks/useTripCompletion";
import { useOpeningHours } from "@/lib/hooks/useOpeningHours";
import { haversineDistance } from "@/lib/utils";
import dynamic from "next/dynamic";
import ExplorerBottomSheet from "@/components/variants/explorer/ExplorerBottomSheet";
import TripStopPanel from "./TripStopPanel";

const TripMap = dynamic(() => import("./TripMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
      <div className="w-12 h-12 rounded-full skeleton-shimmer" />
    </div>
  ),
});
import TripIntroOverlay from "./TripIntroOverlay";
import TripCompletionScreen from "./TripCompletionScreen";
import TripHeader from "./TripHeader";
import TripStopList from "./TripStopList";

interface TripPageProps {
  project: Project;
}

type RouteState =
  | { status: "idle" }
  | { status: "fetching" }
  | { status: "ready"; coordinates: [number, number][] }
  | { status: "error"; message: string };

export default function TripPage({ project }: TripPageProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);

  // Get trip config - must be checked before hooks that depend on it
  const tripConfig = project.tripConfig;
  const tripId = tripConfig?.id ?? "";

  // Trip completion state (persisted in localStorage)
  const {
    isHydrated: completionHydrated,
    completion,
    hasSeenIntro,
    isCompleted: isTripCompleted,
    startTrip,
    markIntroSeen,
    markStopComplete,
    completeTrip,
    markCelebrationShown,
  } = useTripCompletion(tripId);

  // Build stops array by resolving POI references
  const stops: POI[] = useMemo(() => {
    if (!tripConfig) return [];
    return tripConfig.stops
      .map((stopConfig) => {
        const poi = project.pois.find((p) => p.id === stopConfig.poiId);
        return poi || null;
      })
      .filter((poi): poi is POI => poi !== null);
  }, [tripConfig, project.pois]);

  // Get stop configs (for overrides)
  const stopConfigs: TripStopConfig[] = tripConfig?.stops ?? [];

  // Geolocation
  const geo = useGeolocation(project.centerCoordinates);

  // Opening hours for current stop (single-element array to reuse existing hook)
  const currentStopArray = useMemo(
    () => (stops[currentStopIndex] ? [stops[currentStopIndex]] : []),
    [stops, currentStopIndex]
  );
  const { hoursData: openingHoursData } = useOpeningHours(currentStopArray);
  const currentStopOpeningHours = stops[currentStopIndex]
    ? openingHoursData.get(stops[currentStopIndex].id)
    : undefined;

  // Build completedStops Set from persisted state
  const completedStops = useMemo(() => {
    const set = new Set<number>();
    if (!completion) return set;

    stopConfigs.forEach((config, index) => {
      if (completion.stops[config.id as string]) {
        set.add(index);
      }
    });

    return set;
  }, [completion, stopConfigs]);

  // Hydration guard
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Calculate distance to current stop
  const distanceToCurrentStop = useMemo(() => {
    if (!geo.userPosition || !stops[currentStopIndex]) return null;
    return haversineDistance(geo.userPosition, stops[currentStopIndex].coordinates);
  }, [geo.userPosition, stops, currentStopIndex]);

  // Check if all stops are completed
  const allStopsCompleted = useMemo(() => {
    return stops.length > 0 && completedStops.size === stops.length;
  }, [stops.length, completedStops.size]);

  // Auto-complete trip when all stops are done
  useEffect(() => {
    if (allStopsCompleted && !isTripCompleted && completionHydrated) {
      completeTrip();
      setShowCompletionScreen(true);
    }
  }, [allStopsCompleted, isTripCompleted, completionHydrated, completeTrip]);

  // Show completion screen if already completed (on page load)
  useEffect(() => {
    if (isTripCompleted && completionHydrated && !showCompletionScreen) {
      // Only auto-show if celebration hasn't been shown yet
      if (!completion?.celebrationShownAt) {
        setShowCompletionScreen(true);
      }
    }
  }, [isTripCompleted, completionHydrated, showCompletionScreen, completion?.celebrationShownAt]);

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

  // Compute route segments (active/inactive per leg) based on currentStopIndex
  const routeSegments: RouteSegment[] | undefined = useMemo(() => {
    if (routeState.status !== "ready" || stops.length < 2) return undefined;

    const coords = routeState.coordinates;

    // Find the closest route coordinate index for each stop (forward-only search)
    const indices: number[] = [];
    for (const stop of stops) {
      let minDist = Infinity;
      let minIdx = indices.length > 0 ? indices[indices.length - 1] : 0;
      const searchStart = indices.length > 0 ? indices[indices.length - 1] : 0;

      for (let i = searchStart; i < coords.length; i++) {
        const dx = coords[i][0] - stop.coordinates.lng;
        const dy = coords[i][1] - stop.coordinates.lat;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }
      indices.push(minIdx);
    }

    // Build one segment per leg (stop i → stop i+1)
    // Active = progress bar: current segment + all completed/passed segments
    const segments: RouteSegment[] = [];
    for (let i = 0; i < indices.length - 1; i++) {
      const start = indices[i];
      const end = indices[i + 1];
      if (end > start) {
        segments.push({
          coordinates: coords.slice(start, end + 1),
          active: i <= currentStopIndex || completedStops.has(i),
        });
      }
    }

    return segments.length > 0 ? segments : undefined;
  }, [routeState, stops, currentStopIndex, completedStops]);

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

  // Handle marking a stop as complete
  const handleMarkComplete = useCallback(
    (gpsVerified: boolean, accuracy?: number, coords?: Coordinates) => {
      const stopConfig = stopConfigs[currentStopIndex];
      if (!stopConfig) return;

      markStopComplete(stopConfig.id as string, gpsVerified, accuracy, coords);
    },
    [currentStopIndex, stopConfigs, markStopComplete]
  );

  // Handle intro overlay start
  const handleIntroStart = useCallback(() => {
    startTrip();
    markIntroSeen();
  }, [startTrip, markIntroSeen]);

  // Handle completion screen close
  const handleCompletionClose = useCallback(() => {
    setShowCompletionScreen(false);
  }, []);

  // Handle celebration shown
  const handleCelebrationShown = useCallback(() => {
    markCelebrationShown();
  }, [markCelebrationShown]);

  // Snap points for bottom sheet
  const snapPoints = useMemo(() => {
    if (typeof window === "undefined") return [160, 400, 700];
    const vh = window.innerHeight;
    return [160, Math.round(vh * 0.45), Math.round(vh * 0.88)];
  }, []);

  // Don't render until hydrated (prevents SSR/client mismatch)
  if (!isHydrated || !completionHydrated) {
    return (
      <div className="h-screen w-full bg-stone-100 flex items-center justify-center">
        <div className="text-stone-500">Laster tur...</div>
      </div>
    );
  }

  // No trip config - show error
  if (!tripConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-100">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-stone-900">
            Ingen turdata funnet
          </h1>
          <p className="mt-2 text-stone-600">
            Dette prosjektet mangler tripConfig.
          </p>
        </div>
      </div>
    );
  }

  // Determine if we should show intro overlay
  const showIntroOverlay = !hasSeenIntro && tripConfig.reward;

  // Determine if we should show celebration (first time completing)
  const shouldCelebrate = isTripCompleted && !completion?.celebrationShownAt;

  // Shared map props
  const mapProps = {
    center: project.centerCoordinates,
    stops,
    currentStopIndex,
    completedStops,
    onStopClick: handleStopClick,
    routeCoordinates:
      routeState.status === "ready" ? routeState.coordinates : undefined,
    routeSegments,
    userPosition: geo.userPosition,
    userAccuracy: geo.accuracy,
    geoMode: geo.mode,
  };

  return (
    <>
      {/* Mobile layout */}
      <div className="lg:hidden h-screen w-full relative overflow-hidden bg-stone-100">
        {/* Map (fullscreen) */}
        <div className="absolute inset-0">
          <TripMap {...mapProps} />
        </div>

        {/* Trip title overlay */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-stone-900">
                  {tripConfig.title}
                </h1>
                {tripConfig.precomputedDistanceMeters && tripConfig.precomputedDurationMinutes && (
                  <p className="text-sm text-stone-500 mt-0.5">
                    {(tripConfig.precomputedDistanceMeters / 1000).toFixed(1)} km
                    {" · "}
                    {tripConfig.precomputedDurationMinutes} min
                  </p>
                )}
              </div>
              {/* Progress indicator */}
              <div className="text-right">
                <span className="text-sm font-medium text-emerald-600">
                  {completedStops.size}/{stops.length}
                </span>
                <p className="text-xs text-stone-400">stopp</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-1 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${(completedStops.size / stops.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bottom sheet */}
        <ExplorerBottomSheet snapPoints={snapPoints} initialSnap={0}>
          <TripStopPanel
            stops={stops}
            stopConfigs={stopConfigs}
            currentStopIndex={currentStopIndex}
            completedStops={completedStops}
            distanceToStop={distanceToCurrentStop}
            userPosition={geo.userPosition}
            gpsAvailable={geo.mode !== "disabled" && geo.mode !== "fallback"}
            openingHours={currentStopOpeningHours}
            onNext={handleNext}
            onPrev={handlePrev}
            onMarkComplete={handleMarkComplete}
            showProgressDots
          />
        </ExplorerBottomSheet>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex h-screen">
        {/* Map: takes remaining width */}
        <div className="flex-1 relative">
          <TripMap {...mapProps} />
        </div>

        {/* Sidebar: flush right panel */}
        <div className="w-[40%] flex-shrink-0 bg-white border-l border-stone-200 flex flex-col overflow-hidden">
          <TripHeader
            tripConfig={tripConfig}
            completedStops={completedStops}
            totalStops={stops.length}
          />
          <TripStopList
            stops={stops}
            stopConfigs={stopConfigs}
            currentStopIndex={currentStopIndex}
            completedStops={completedStops}
            onStopClick={handleStopClick}
            accordion
            distanceToStop={distanceToCurrentStop}
            userPosition={geo.userPosition}
            gpsAvailable={geo.mode !== "disabled" && geo.mode !== "fallback"}
            openingHours={currentStopOpeningHours}
            onNext={handleNext}
            onPrev={handlePrev}
            onMarkComplete={handleMarkComplete}
          />
        </div>
      </div>

      {/* Intro overlay (shown once for trips with rewards) */}
      {showIntroOverlay && (
        <TripIntroOverlay tripConfig={tripConfig} onStart={handleIntroStart} />
      )}

      {/* Completion screen */}
      {showCompletionScreen && completion && (
        <TripCompletionScreen
          tripConfig={tripConfig}
          completion={completion}
          onClose={handleCompletionClose}
          onCelebrationShown={handleCelebrationShown}
          shouldCelebrate={shouldCelebrate}
        />
      )}
    </>
  );
}
