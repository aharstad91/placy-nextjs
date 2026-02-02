"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import type { POI, GuideStopConfig, Coordinates } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Check, MapPin, Navigation, Clock, Loader2 } from "lucide-react";

// GPS verification radius in meters
const GPS_VERIFICATION_RADIUS = 50;
// Fallback timer duration in seconds
const FALLBACK_TIMER_SECONDS = 30;

type VerificationState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "near-stop"; distance: number }
  | { status: "waiting-fallback"; remainingSeconds: number }
  | { status: "verified"; method: "gps" | "fallback" };

interface GuideStopPanelProps {
  stops: POI[];
  stopConfigs: GuideStopConfig[];
  currentStopIndex: number;
  completedStops: Set<number>;
  distanceToStop?: number | null;
  userPosition?: Coordinates | null;
  gpsAvailable?: boolean;
  onNext: () => void;
  onPrev: () => void;
  onMarkComplete: (gpsVerified: boolean, accuracy?: number, coords?: Coordinates) => void;
}

export default function GuideStopPanel({
  stops,
  stopConfigs,
  currentStopIndex,
  completedStops,
  distanceToStop,
  userPosition,
  gpsAvailable = true,
  onNext,
  onPrev,
  onMarkComplete,
}: GuideStopPanelProps) {
  const currentStop = stops[currentStopIndex];
  const currentConfig = stopConfigs[currentStopIndex];
  const isCompleted = completedStops.has(currentStopIndex);
  const isLastStop = currentStopIndex === stops.length - 1;
  const isFirstStop = currentStopIndex === 0;

  // Verification state
  const [verificationState, setVerificationState] = useState<VerificationState>({ status: "idle" });
  const fallbackTimerRef = useRef<{ timeoutId: NodeJS.Timeout; canceled: boolean } | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if user is near the stop (within GPS verification radius)
  const isNearStop = useMemo(() => {
    if (distanceToStop === null || distanceToStop === undefined) return false;
    return distanceToStop <= GPS_VERIFICATION_RADIUS;
  }, [distanceToStop]);

  // Cleanup timers
  const cleanupTimers = useCallback(() => {
    if (fallbackTimerRef.current) {
      fallbackTimerRef.current.canceled = true;
      clearTimeout(fallbackTimerRef.current.timeoutId);
      fallbackTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Reset verification state when changing stops
  useEffect(() => {
    cleanupTimers();
    setVerificationState({ status: "idle" });
  }, [currentStopIndex, cleanupTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupTimers();
  }, [cleanupTimers]);

  // Handle GPS arriving while waiting for fallback (race condition handling)
  useEffect(() => {
    if (
      verificationState.status === "waiting-fallback" &&
      isNearStop &&
      gpsAvailable
    ) {
      // GPS confirmed location - cancel fallback timer and mark verified
      cleanupTimers();
      setVerificationState({ status: "verified", method: "gps" });
      onMarkComplete(true, undefined, userPosition ?? undefined);
    }
  }, [isNearStop, gpsAvailable, verificationState.status, cleanupTimers, onMarkComplete, userPosition]);

  // Handle mark complete button click
  const handleMarkCompleteClick = useCallback(() => {
    if (isCompleted) return;

    // If already near stop via GPS, mark immediately
    if (isNearStop && gpsAvailable) {
      setVerificationState({ status: "verified", method: "gps" });
      onMarkComplete(true, undefined, userPosition ?? undefined);
      return;
    }

    // Start fallback timer
    setVerificationState({ status: "waiting-fallback", remainingSeconds: FALLBACK_TIMER_SECONDS });

    // Countdown interval
    countdownIntervalRef.current = setInterval(() => {
      setVerificationState((prev) => {
        if (prev.status !== "waiting-fallback") return prev;
        const newRemaining = prev.remainingSeconds - 1;
        if (newRemaining <= 0) {
          return prev; // Will be handled by main timer
        }
        return { ...prev, remainingSeconds: newRemaining };
      });
    }, 1000);

    // Main fallback timer with cancel token
    const cancelToken = { canceled: false };
    const timeoutId = setTimeout(() => {
      if (cancelToken.canceled) return;
      cleanupTimers();
      setVerificationState({ status: "verified", method: "fallback" });
      onMarkComplete(false);
    }, FALLBACK_TIMER_SECONDS * 1000);

    fallbackTimerRef.current = { timeoutId, canceled: cancelToken.canceled };
  }, [isCompleted, isNearStop, gpsAvailable, userPosition, onMarkComplete, cleanupTimers]);

  // Format distance
  const formattedDistance = useMemo(() => {
    if (distanceToStop === null || distanceToStop === undefined) return null;
    if (distanceToStop < 1000) {
      return `${Math.round(distanceToStop)} m`;
    }
    return `${(distanceToStop / 1000).toFixed(1)} km`;
  }, [distanceToStop]);

  if (!currentStop) return null;

  // Use override values from config if provided
  const displayName = currentConfig?.nameOverride ?? currentStop.name;
  const displayDescription = currentConfig?.descriptionOverride ?? currentStop.description;

  return (
    <div className="flex flex-col h-full">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 py-3 border-b border-stone-100">
        {stops.map((_, index) => (
          <div
            key={index}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors",
              index === currentStopIndex
                ? "bg-blue-600"
                : completedStops.has(index)
                ? "bg-stone-400"
                : "bg-stone-200"
            )}
          />
        ))}
        <span className="ml-2 text-xs text-stone-500">
          {currentStopIndex + 1}/{stops.length}
        </span>
      </div>

      {/* Stop info */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {/* Header with number and distance */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
              {currentStopIndex + 1}
            </span>
            <h2 className="text-xl font-semibold text-stone-900">{displayName}</h2>
          </div>
          {formattedDistance && (
            <div className="flex items-center gap-1 text-sm text-stone-500">
              <MapPin className="w-3.5 h-3.5" />
              <span>{formattedDistance}</span>
            </div>
          )}
        </div>

        {/* Transition text */}
        {currentConfig?.transitionText && (
          <p className="text-sm text-blue-700 italic mb-3 pl-11">
            {currentConfig.transitionText}
          </p>
        )}

        {/* Description */}
        {displayDescription && (
          <p className="text-stone-600 text-sm leading-relaxed pl-11 mb-4">
            {displayDescription}
          </p>
        )}

        {/* Featured image */}
        {currentStop.featuredImage && (
          <div className="pl-11 mb-4">
            <img
              src={currentStop.featuredImage}
              alt={displayName}
              className="w-full h-40 object-cover rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-stone-100 bg-white">
        <div className="flex items-center gap-3">
          {/* Previous button */}
          <button
            onClick={onPrev}
            disabled={isFirstStop}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              isFirstStop
                ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Mark complete button with morphing verification state */}
          <button
            onClick={handleMarkCompleteClick}
            disabled={isCompleted || verificationState.status === "waiting-fallback"}
            className={cn(
              "flex-1 h-12 rounded-full flex flex-col items-center justify-center font-medium transition-all duration-300",
              isCompleted
                ? "bg-green-100 text-green-700"
                : verificationState.status === "waiting-fallback"
                ? verificationState.remainingSeconds <= 10
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
                : isNearStop && gpsAvailable
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {isCompleted ? (
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Besøkt</span>
              </div>
            ) : verificationState.status === "waiting-fallback" ? (
              verificationState.remainingSeconds <= 10 ? (
                // Last 10 seconds - green, almost done
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>Godkjennes om {verificationState.remainingSeconds}s</span>
                  </div>
                </div>
              ) : (
                // First 20 seconds - amber, checking GPS
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sjekker GPS... {verificationState.remainingSeconds}s</span>
                  </div>
                </div>
              )
            ) : isNearStop && gpsAvailable ? (
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                <span>Du er her!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Merk som besøkt</span>
              </div>
            )}
          </button>

          {/* Next button */}
          <button
            onClick={onNext}
            disabled={isLastStop}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              isLastStop
                ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
