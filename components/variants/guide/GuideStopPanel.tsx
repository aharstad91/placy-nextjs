"use client";

import { useMemo } from "react";
import type { POI, GuideStopConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Check, MapPin } from "lucide-react";

interface GuideStopPanelProps {
  stops: POI[];
  stopConfigs: GuideStopConfig[];
  currentStopIndex: number;
  completedStops: Set<number>;
  distanceToStop?: number | null;
  onNext: () => void;
  onPrev: () => void;
  onMarkComplete: () => void;
}

export default function GuideStopPanel({
  stops,
  stopConfigs,
  currentStopIndex,
  completedStops,
  distanceToStop,
  onNext,
  onPrev,
  onMarkComplete,
}: GuideStopPanelProps) {
  const currentStop = stops[currentStopIndex];
  const currentConfig = stopConfigs[currentStopIndex];
  const isCompleted = completedStops.has(currentStopIndex);
  const isLastStop = currentStopIndex === stops.length - 1;
  const isFirstStop = currentStopIndex === 0;

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

          {/* Mark complete button */}
          <button
            onClick={onMarkComplete}
            disabled={isCompleted}
            className={cn(
              "flex-1 h-10 rounded-full flex items-center justify-center gap-2 font-medium transition-colors",
              isCompleted
                ? "bg-green-100 text-green-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            <Check className="w-4 h-4" />
            <span>{isCompleted ? "Besøkt" : "Merk som besøkt"}</span>
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
