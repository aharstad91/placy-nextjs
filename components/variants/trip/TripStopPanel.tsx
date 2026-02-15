"use client";

import { useMemo } from "react";
import type { POI, TripStopConfig, TripMode, Coordinates } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import { MapPin, Check } from "lucide-react";
import TripStopDetail from "./TripStopDetail";

interface TripStopPanelProps {
  stops: POI[];
  stopConfigs: TripStopConfig[];
  currentStopIndex: number;
  completedStops: Set<number>;
  distanceToStop?: number | null;
  userPosition?: Coordinates | null;
  gpsAvailable?: boolean;
  openingHours?: OpeningHoursData;
  onNext: () => void;
  onPrev: () => void;
  onMarkComplete: (gpsVerified: boolean, accuracy?: number, coords?: Coordinates) => void;
  showProgressDots?: boolean;
  // Mode props
  tripMode?: TripMode;
  stopDistances?: Map<number, number>;
  freeModeSortedIndices?: number[];
  onStopClick?: (index: number) => void;
}

export default function TripStopPanel({
  stops,
  stopConfigs,
  currentStopIndex,
  completedStops,
  distanceToStop,
  userPosition,
  gpsAvailable = true,
  openingHours,
  onNext,
  onPrev,
  onMarkComplete,
  showProgressDots = true,
  tripMode = "guided",
  stopDistances,
  freeModeSortedIndices,
  onStopClick,
}: TripStopPanelProps) {
  const currentStop = stops[currentStopIndex];
  const currentConfig = stopConfigs[currentStopIndex];
  const isCompleted = completedStops.has(currentStopIndex);
  const isLastStop = currentStopIndex === stops.length - 1;
  const isFirstStop = currentStopIndex === 0;
  const isFreeMode = tripMode === "free";

  // Free mode: show all stops in a scrollable list
  if (isFreeMode) {
    const displayOrder = freeModeSortedIndices ?? stops.map((_, i) => i);

    return (
      <div className="flex flex-col h-full">
        {/* Free mode header */}
        <div className="px-4 py-3 border-b border-stone-100">
          <p className="text-xs text-stone-500">
            Utforsk stoppene i din egen rekkefølge
          </p>
        </div>

        {/* Stop list */}
        <div className="flex-1 overflow-auto">
          {displayOrder.map((index) => {
            const stop = stops[index];
            if (!stop) return null;
            const config = stopConfigs[index];
            const isActive = index === currentStopIndex;
            const completed = completedStops.has(index);
            const distance = stopDistances?.get(index);
            const displayName = config?.nameOverride ?? stop.name;

            return (
              <div key={stop.id}>
                {/* Tappable row */}
                <button
                  onClick={() => onStopClick?.(index)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-stone-50 transition-colors",
                    isActive ? "bg-blue-50" : "hover:bg-stone-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Status circle */}
                    <span
                      className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold",
                        completed
                          ? "bg-emerald-500 text-white"
                          : isActive
                            ? "bg-blue-600 text-white"
                            : "bg-stone-200 text-stone-600"
                      )}
                    >
                      {completed ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        index + 1
                      )}
                    </span>

                    {/* Name + category */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className={cn(
                          "text-sm font-medium truncate",
                          completed ? "text-stone-500 line-through" : "text-stone-800"
                        )}
                      >
                        {displayName}
                      </h3>
                      {stop.category?.name && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate">
                          {stop.category.name}
                        </p>
                      )}
                    </div>

                    {/* Distance badge */}
                    {distance != null && (
                      <span className="flex-shrink-0 flex items-center gap-1 text-xs text-stone-500">
                        <MapPin className="w-3 h-3" />
                        {formatDistance(distance)}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded detail when active */}
                {isActive && (
                  <div className="bg-blue-50/50">
                    <TripStopDetail
                      stop={stop}
                      stopConfig={config}
                      stopIndex={index}
                      totalStops={stops.length}
                      isCompleted={completed}
                      isFirstStop={false}
                      isLastStop={false}
                      distanceToStop={distance ?? null}
                      userPosition={userPosition}
                      gpsAvailable={gpsAvailable}
                      openingHours={openingHours}
                      onNext={onNext}
                      onPrev={onPrev}
                      onMarkComplete={onMarkComplete}
                      tripMode="free"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Guided mode: single stop at a time with prev/next
  if (!currentStop) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Progress dots (only on mobile guided mode) */}
      {showProgressDots && (
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
            {currentStopIndex === 0 ? "Start" : currentStopIndex}/{stops.length - 1}
          </span>
        </div>
      )}

      {/* Rich POI card with trip controls */}
      <div className="flex-1 overflow-auto">
        <TripStopDetail
          stop={currentStop}
          stopConfig={currentConfig}
          stopIndex={currentStopIndex}
          totalStops={stops.length}
          isCompleted={isCompleted}
          isFirstStop={isFirstStop}
          isLastStop={isLastStop}
          distanceToStop={distanceToStop}
          userPosition={userPosition}
          gpsAvailable={gpsAvailable}
          openingHours={openingHours}
          onNext={onNext}
          onPrev={onPrev}
          onMarkComplete={onMarkComplete}
          tripMode="guided"
        />
      </div>
    </div>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
