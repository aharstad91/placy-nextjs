"use client";

import type { POI, TripStopConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface TripStopListProps {
  stops: POI[];
  stopConfigs: TripStopConfig[];
  currentStopIndex: number;
  completedStops: Set<number>;
  onStopClick: (index: number) => void;
}

export default function TripStopList({
  stops,
  stopConfigs,
  currentStopIndex,
  completedStops,
  onStopClick,
}: TripStopListProps) {
  return (
    <div className="flex-shrink-0 max-h-[40%] overflow-y-auto border-b border-stone-200">
      <ul className="divide-y divide-stone-100">
        {stops.map((stop, index) => {
          const isActive = index === currentStopIndex;
          const isCompleted = completedStops.has(index);
          const config = stopConfigs[index];
          const displayName = config?.nameOverride ?? stop.name;

          return (
            <li key={stop.id}>
              <button
                onClick={() => onStopClick(index)}
                className={cn(
                  "w-full flex items-center gap-3 px-6 py-3 text-left transition-colors",
                  isActive
                    ? "bg-blue-50"
                    : "hover:bg-stone-50"
                )}
              >
                {/* Number/check circle */}
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
                  ) : (
                    index + 1
                  )}
                </span>

                {/* Stop name */}
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
