"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Project, POI, GuideStopConfig, Coordinates } from "@/lib/types";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useGuideCompletion } from "@/lib/hooks/useGuideCompletion";
import { haversineDistance } from "@/lib/utils";
import ExplorerBottomSheet from "@/components/variants/explorer/ExplorerBottomSheet";
import GuideMap3D from "./GuideMap3D";
import GuideStopPanel from "./GuideStopPanel";
import GuideIntroOverlay from "./GuideIntroOverlay";
import GuideCompletionScreen from "./GuideCompletionScreen";

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
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);

  // Get guide config - must be checked before hooks that depend on it
  const guideConfig = project.guideConfig;
  const guideId = guideConfig?.id ?? "";

  // Guide completion state (persisted in localStorage)
  const {
    isHydrated: completionHydrated,
    completion,
    hasSeenIntro,
    isCompleted: isGuideCompleted,
    startGuide,
    markIntroSeen,
    markStopComplete,
    completeGuide,
    markCelebrationShown,
  } = useGuideCompletion(guideId);

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

  // Auto-complete guide when all stops are done
  useEffect(() => {
    if (allStopsCompleted && !isGuideCompleted && completionHydrated) {
      completeGuide();
      setShowCompletionScreen(true);
    }
  }, [allStopsCompleted, isGuideCompleted, completionHydrated, completeGuide]);

  // Show completion screen if already completed (on page load)
  useEffect(() => {
    if (isGuideCompleted && completionHydrated && !showCompletionScreen) {
      // Only auto-show if celebration hasn't been shown yet
      if (!completion?.celebrationShownAt) {
        setShowCompletionScreen(true);
      }
    }
  }, [isGuideCompleted, completionHydrated, showCompletionScreen, completion?.celebrationShownAt]);

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
    startGuide();
    markIntroSeen();
  }, [startGuide, markIntroSeen]);

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

  // Determine if we should show intro overlay
  const showIntroOverlay = !hasSeenIntro && guideConfig.reward;

  // Determine if we should show celebration (first time completing)
  const shouldCelebrate = isGuideCompleted && !completion?.celebrationShownAt;

  return (
    <div className="h-screen w-full relative overflow-hidden bg-stone-100">
      {/* Map (fullscreen) */}
      <div className="absolute inset-0">
        <GuideMap3D
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
          <div className="flex items-center justify-between">
            <div>
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
        <GuideStopPanel
          stops={stops}
          stopConfigs={stopConfigs}
          currentStopIndex={currentStopIndex}
          completedStops={completedStops}
          distanceToStop={distanceToCurrentStop}
          userPosition={geo.userPosition}
          gpsAvailable={geo.mode !== "disabled" && geo.mode !== "fallback"}
          onNext={handleNext}
          onPrev={handlePrev}
          onMarkComplete={handleMarkComplete}
        />
      </ExplorerBottomSheet>

      {/* Intro overlay (shown once for guides with rewards) */}
      {showIntroOverlay && (
        <GuideIntroOverlay guideConfig={guideConfig} onStart={handleIntroStart} />
      )}

      {/* Completion screen */}
      {showCompletionScreen && completion && (
        <GuideCompletionScreen
          guideConfig={guideConfig}
          completion={completion}
          onClose={handleCompletionClose}
          onCelebrationShown={handleCelebrationShown}
          shouldCelebrate={shouldCelebrate}
        />
      )}
    </div>
  );
}
