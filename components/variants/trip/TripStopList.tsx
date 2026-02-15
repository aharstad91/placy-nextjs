"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { POI, TripStopConfig, TripMode, Coordinates } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import { Check, Flag, MapPin } from "lucide-react";
import TripStopDetail from "./TripStopDetail";

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
  openingHours?: OpeningHoursData;
  onNext?: () => void;
  onPrev?: () => void;
  onMarkComplete?: (gpsVerified: boolean, accuracy?: number, coords?: Coordinates) => void;
  // Mode props
  tripMode?: TripMode;
  stopDistances?: Map<number, number>;
  freeModeSortedIndices?: number[];
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
  openingHours,
  onNext,
  onPrev,
  onMarkComplete,
  tripMode = "guided",
  stopDistances,
  freeModeSortedIndices,
}: TripStopListProps) {
  const isFreeMode = tripMode === "free";
  const activeRef = useRef<HTMLLIElement>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

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

  // In free mode, use sorted indices; in guided mode, natural order
  const displayOrder = isFreeMode && freeModeSortedIndices
    ? freeModeSortedIndices
    : stops.map((_, i) => i);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Free mode subtitle */}
      {isFreeMode && (
        <div className="px-5 py-3 border-b border-stone-100">
          <p className="text-xs text-stone-500">
            Utforsk stoppene i din egen rekkefølge
          </p>
        </div>
      )}

      <ul className="divide-y divide-stone-100">
        {displayOrder.map((index) => {
          const stop = stops[index];
          if (!stop) return null;
          const isActive = index === currentStopIndex;
          const isCompleted = completedStops.has(index);
          const isStartPoint = index === 0;
          const config = stopConfigs[index];
          const displayName = config?.nameOverride ?? stop.name;
          const imageUrl = config?.imageUrlOverride ?? stop.featuredImage;
          const hasImage = imageUrl && !imageErrors.has(stop.id);
          const distance = isFreeMode ? stopDistances?.get(index) : undefined;

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

                    {/* Distance badge (free mode) */}
                    {distance != null && (
                      <span className="flex-shrink-0 flex items-center gap-1 text-xs text-stone-400">
                        <MapPin className="w-3 h-3" />
                        {formatDistanceCompact(distance)}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* === EXPANDED CONTENT (rich POI card + trip controls) === */}
              <div
                className={cn(
                  "transition-all duration-300 ease-out",
                  isActive ? "opacity-100 bg-blue-50/50" : "opacity-0 h-0 overflow-hidden"
                )}
              >
                {isActive && onMarkComplete && (
                  <TripStopDetail
                    stop={stop}
                    stopConfig={config}
                    stopIndex={index}
                    totalStops={stops.length}
                    isCompleted={isCompleted}
                    isFirstStop={isFreeMode ? false : isFirstStop}
                    isLastStop={isFreeMode ? false : isLastStop}
                    distanceToStop={distance ?? distanceToStop}
                    userPosition={userPosition}
                    gpsAvailable={gpsAvailable}
                    openingHours={openingHours}
                    onNext={onNext ?? (() => {})}
                    onPrev={onPrev ?? (() => {})}
                    onMarkComplete={onMarkComplete}
                    tripMode={tripMode}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatDistanceCompact(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
