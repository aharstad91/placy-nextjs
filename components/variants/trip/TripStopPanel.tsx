"use client";

import { useMemo } from "react";
import type { POI, TripStopConfig, Coordinates } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
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
}: TripStopPanelProps) {
  const currentStop = stops[currentStopIndex];
  const currentConfig = stopConfigs[currentStopIndex];
  const isCompleted = completedStops.has(currentStopIndex);
  const isLastStop = currentStopIndex === stops.length - 1;
  const isFirstStop = currentStopIndex === 0;

  if (!currentStop) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Progress dots (only on mobile) */}
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
        />
      </div>
    </div>
  );
}
