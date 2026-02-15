"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import type { POI, TripStopConfig, TripMode, Coordinates } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  Navigation,
  Loader2,
} from "lucide-react";
import ExplorerPOICard from "@/components/variants/explorer/ExplorerPOICard";

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

interface TripStopDetailProps {
  stop: POI;
  stopConfig?: TripStopConfig;
  stopIndex: number;
  totalStops: number;
  isCompleted: boolean;
  isFirstStop: boolean;
  isLastStop: boolean;
  distanceToStop?: number | null;
  userPosition?: Coordinates | null;
  gpsAvailable?: boolean;
  openingHours?: OpeningHoursData;
  onNext: () => void;
  onPrev: () => void;
  onMarkComplete: (gpsVerified: boolean, accuracy?: number, coords?: Coordinates) => void;
  tripMode?: TripMode;
}

export default function TripStopDetail({
  stop,
  stopConfig,
  stopIndex,
  totalStops,
  isCompleted,
  isFirstStop,
  isLastStop,
  distanceToStop,
  userPosition,
  gpsAvailable = true,
  openingHours,
  onNext,
  onPrev,
  onMarkComplete,
  tripMode = "guided",
}: TripStopDetailProps) {
  const isFreeMode = tripMode === "free";
  // --- GPS Verification state ---
  const [verificationState, setVerificationState] = useState<VerificationState>({ status: "idle" });
  const fallbackTimerRef = useRef<{ timeoutId: NodeJS.Timeout; canceled: boolean } | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isNearStop = useMemo(() => {
    if (distanceToStop === null || distanceToStop === undefined) return false;
    return distanceToStop <= GPS_VERIFICATION_RADIUS;
  }, [distanceToStop]);

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

  // Reset verification when stop changes
  useEffect(() => {
    cleanupTimers();
    setVerificationState({ status: "idle" });
  }, [stopIndex, cleanupTimers]);

  useEffect(() => {
    return () => cleanupTimers();
  }, [cleanupTimers]);

  // GPS arrives while waiting for fallback
  useEffect(() => {
    if (
      verificationState.status === "waiting-fallback" &&
      isNearStop &&
      gpsAvailable
    ) {
      cleanupTimers();
      setVerificationState({ status: "verified", method: "gps" });
      onMarkComplete(true, undefined, userPosition ?? undefined);
    }
  }, [isNearStop, gpsAvailable, verificationState.status, cleanupTimers, onMarkComplete, userPosition]);

  const handleMarkCompleteClick = useCallback(() => {
    if (isCompleted) return;

    if (isNearStop && gpsAvailable) {
      setVerificationState({ status: "verified", method: "gps" });
      onMarkComplete(true, undefined, userPosition ?? undefined);
      return;
    }

    setVerificationState({ status: "waiting-fallback", remainingSeconds: FALLBACK_TIMER_SECONDS });

    countdownIntervalRef.current = setInterval(() => {
      setVerificationState((prev) => {
        if (prev.status !== "waiting-fallback") return prev;
        const newRemaining = prev.remainingSeconds - 1;
        if (newRemaining <= 0) return prev;
        return { ...prev, remainingSeconds: newRemaining };
      });
    }, 1000);

    const cancelToken = { canceled: false };
    const timeoutId = setTimeout(() => {
      if (cancelToken.canceled) return;
      cleanupTimers();
      setVerificationState({ status: "verified", method: "fallback" });
      onMarkComplete(false);
    }, FALLBACK_TIMER_SECONDS * 1000);

    fallbackTimerRef.current = { timeoutId, canceled: cancelToken.canceled };
  }, [isCompleted, isNearStop, gpsAvailable, userPosition, onMarkComplete, cleanupTimers]);

  const formattedDistance = useMemo(() => {
    if (distanceToStop === null || distanceToStop === undefined) return null;
    if (distanceToStop < 1000) return `${Math.round(distanceToStop)} m`;
    return `${(distanceToStop / 1000).toFixed(1)} km`;
  }, [distanceToStop]);

  return (
    <div className="flex flex-col p-4 gap-3">
      {/* Rich POI card (always expanded, no save button) */}
      <ExplorerPOICard
        poi={stop}
        isActive={false}
        alwaysExpanded
        openingHours={openingHours}
        travelMode="walk"
        className="rounded-xl border border-stone-200 overflow-hidden shadow-sm bg-white"
      />

      {/* Trip-specific content below the card */}
      <div>
        {/* Distance badge */}
        {formattedDistance && (
          <div className="flex items-center gap-1 text-sm text-stone-500 mb-3">
            <MapPin className="w-3.5 h-3.5" />
            <span>{formattedDistance}</span>
          </div>
        )}

        {/* Transition text (guided mode only) */}
        {!isFreeMode && stopConfig?.transitionText && (
          <div className="flex gap-2.5 mb-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <Navigation className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 leading-relaxed">
              {stopConfig.transitionText}
            </p>
          </div>
        )}

        {/* Navigation + Mark Complete */}
        <div className="flex items-center gap-3">
          {/* Previous button (guided only) */}
          {!isFreeMode && (
            <button
              onClick={onPrev}
              disabled={isFirstStop}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                isFirstStop
                  ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Mark complete button */}
          <button
            onClick={handleMarkCompleteClick}
            disabled={isCompleted || verificationState.status === "waiting-fallback"}
            className={cn(
              "flex-1 h-12 rounded-full flex items-center justify-center font-medium transition-all duration-300",
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
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Besøkt
              </span>
            ) : verificationState.status === "waiting-fallback" ? (
              verificationState.remainingSeconds <= 10 ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Godkjennes om {verificationState.remainingSeconds}s
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sjekker GPS... {verificationState.remainingSeconds}s
                </span>
              )
            ) : isNearStop && gpsAvailable ? (
              <span className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                Du er her!
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Merk som besøkt
              </span>
            )}
          </button>

          {/* Next button (guided only) */}
          {!isFreeMode && (
            <button
              onClick={onNext}
              disabled={isLastStop}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                isLastStop
                  ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
