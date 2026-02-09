"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import type { POI, TripStopConfig, Coordinates } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Check,
  Flag,
  MapPin,
  Navigation,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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

interface TripStopListProps {
  stops: POI[];
  stopConfigs: TripStopConfig[];
  currentStopIndex: number;
  completedStops: Set<number>;
  onStopClick: (index: number) => void;
  // Props for inline panel functionality (desktop accordion mode)
  accordion?: boolean;
  distanceToStop?: number | null;
  userPosition?: Coordinates | null;
  gpsAvailable?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  onMarkComplete?: (gpsVerified: boolean, accuracy?: number, coords?: Coordinates) => void;
}

export default function TripStopList({
  stops,
  stopConfigs,
  currentStopIndex,
  completedStops,
  onStopClick,
  accordion = false,
  distanceToStop,
  userPosition,
  gpsAvailable = true,
  onNext,
  onPrev,
  onMarkComplete,
}: TripStopListProps) {
  const activeRef = useRef<HTMLLIElement>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // --- GPS Verification state (only used in accordion mode) ---
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
  }, [currentStopIndex, cleanupTimers]);

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
      onMarkComplete?.(true, undefined, userPosition ?? undefined);
    }
  }, [isNearStop, gpsAvailable, verificationState.status, cleanupTimers, onMarkComplete, userPosition]);

  const handleMarkCompleteClick = useCallback(() => {
    const isCompleted = completedStops.has(currentStopIndex);
    if (isCompleted || !onMarkComplete) return;

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
  }, [completedStops, currentStopIndex, isNearStop, gpsAvailable, userPosition, onMarkComplete, cleanupTimers]);

  const formattedDistance = useMemo(() => {
    if (distanceToStop === null || distanceToStop === undefined) return null;
    if (distanceToStop < 1000) return `${Math.round(distanceToStop)} m`;
    return `${(distanceToStop / 1000).toFixed(1)} km`;
  }, [distanceToStop]);

  // Auto-scroll to active stop
  useEffect(() => {
    if (accordion && activeRef.current) {
      // Small delay to let the expansion animation start
      const timeout = setTimeout(() => {
        activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [currentStopIndex, accordion]);

  const handleImageError = useCallback((id: string) => {
    setImageErrors((prev) => new Set(prev).add(id));
  }, []);

  // Non-accordion (compact list) — original behavior
  if (!accordion) {
    return (
      <div className="flex-shrink-0 max-h-[40%] overflow-y-auto border-b border-stone-200">
        <ul className="divide-y divide-stone-100">
          {stops.map((stop, index) => {
            const isActive = index === currentStopIndex;
            const isCompleted = completedStops.has(index);
            const isStartPoint = index === 0;
            const config = stopConfigs[index];
            const displayName = config?.nameOverride ?? stop.name;

            return (
              <li key={stop.id}>
                <button
                  onClick={() => onStopClick(index)}
                  className={cn(
                    "w-full flex items-center gap-3 px-6 py-3 text-left transition-colors",
                    isActive ? "bg-blue-50" : "hover:bg-stone-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2",
                      isActive && "bg-blue-600 text-white border-blue-600",
                      isCompleted && !isActive && "bg-stone-500 text-white border-stone-500",
                      !isActive && !isCompleted && "bg-white text-stone-500 border-stone-300"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : isStartPoint ? (
                      <Flag className="w-3.5 h-3.5" />
                    ) : (
                      index
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm truncate",
                      isActive
                        ? "font-medium text-blue-900"
                        : isCompleted
                        ? "text-stone-500 line-through"
                        : "text-stone-700"
                    )}
                  >
                    {displayName}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // --- Accordion mode (desktop) ---
  const isFirstStop = currentStopIndex === 0;
  const isLastStop = currentStopIndex === stops.length - 1;
  const currentIsCompleted = completedStops.has(currentStopIndex);

  return (
    <div className="flex-1 overflow-y-auto">
      <ul className="divide-y divide-stone-100">
        {stops.map((stop, index) => {
          const isActive = index === currentStopIndex;
          const isCompleted = completedStops.has(index);
          const isStartPoint = index === 0;
          const config = stopConfigs[index];
          const displayName = config?.nameOverride ?? stop.name;
          const displayDescription = config?.descriptionOverride ?? stop.description;
          const imageUrl = config?.imageUrlOverride ?? stop.featuredImage;
          const hasImage = imageUrl && !imageErrors.has(stop.id);

          return (
            <li key={stop.id} ref={isActive ? activeRef : undefined}>
              {/* Clickable header — always visible */}
              <button
                onClick={() => onStopClick(index)}
                className={cn(
                  "w-full text-left transition-all duration-300 ease-out",
                  isActive ? "bg-blue-50/50" : "hover:bg-stone-50"
                )}
              >
                {/* === COLLAPSED STATE === */}
                <div
                  className={cn(
                    "px-5 py-3 transition-all duration-300 ease-out",
                    isActive ? "opacity-0 h-0 py-0 overflow-hidden" : "opacity-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    {hasImage ? (
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden">
                        <img
                          src={imageUrl}
                          alt={displayName}
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(stop.id)}
                        />
                      </div>
                    ) : (
                      /* Number/check circle */
                      <span
                        className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2",
                          isCompleted && "bg-stone-500 text-white border-stone-500",
                          !isCompleted && "bg-white text-stone-500 border-stone-300"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : isStartPoint ? (
                          <Flag className="w-3.5 h-3.5" />
                        ) : (
                          index
                        )}
                      </span>
                    )}

                    {/* Name + category */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {hasImage && (
                          <span
                            className={cn(
                              "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold",
                              isCompleted
                                ? "bg-stone-500 text-white"
                                : "bg-stone-200 text-stone-600"
                            )}
                          >
                            {isCompleted ? (
                              <Check className="w-3 h-3" />
                            ) : isStartPoint ? (
                              <Flag className="w-3 h-3" />
                            ) : (
                              index
                            )}
                          </span>
                        )}
                        <h3
                          className={cn(
                            "text-sm font-medium truncate",
                            isCompleted ? "text-stone-500 line-through" : "text-stone-800"
                          )}
                        >
                          {displayName}
                        </h3>
                      </div>
                      <p className="text-xs text-stone-500 truncate mt-0.5">
                        {stop.category.name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* === EXPANDED HEADER (image strip) === */}
                <div
                  className={cn(
                    "transition-all duration-300 ease-out",
                    isActive ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
                  )}
                >
                  {hasImage && (
                    <div className="w-full aspect-[21/9] overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(stop.id)}
                      />
                    </div>
                  )}

                  {/* Title row */}
                  <div className="px-5 pt-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {isStartPoint ? <Flag className="w-4 h-4" /> : index}
                        </span>
                        <div>
                          <h3 className="text-base font-semibold text-stone-900">
                            {displayName}
                          </h3>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {stop.category.name}
                          </p>
                        </div>
                      </div>
                      {formattedDistance && isActive && (
                        <div className="flex items-center gap-1 text-sm text-stone-500 flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{formattedDistance}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* === EXPANDED CONTENT (outside button for interactivity) === */}
              <div
                className={cn(
                  "transition-all duration-300 ease-out",
                  isActive
                    ? "opacity-100 bg-blue-50/50"
                    : "opacity-0 h-0 overflow-hidden"
                )}
              >
                <div className="px-5 pb-4">
                  {/* Transition text */}
                  {config?.transitionText && (
                    <p className="text-sm text-blue-700 italic mb-3 pl-11">
                      {config.transitionText}
                    </p>
                  )}

                  {/* Description */}
                  {displayDescription && (
                    <p className="text-stone-600 text-sm leading-relaxed pl-11 mb-4">
                      {displayDescription}
                    </p>
                  )}

                  {/* Navigation + Mark Complete */}
                  <div className="flex items-center gap-3 pl-11">
                    {/* Previous button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                      disabled={isFirstStop}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                        isFirstStop
                          ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Mark complete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkCompleteClick(); }}
                      disabled={currentIsCompleted || verificationState.status === "waiting-fallback"}
                      className={cn(
                        "flex-1 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all duration-300",
                        currentIsCompleted
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
                      {currentIsCompleted ? (
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

                    {/* Next button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                      disabled={isLastStop}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                        isLastStop
                          ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      )}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
