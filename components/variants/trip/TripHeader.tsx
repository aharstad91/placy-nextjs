"use client";

import type { TripConfig, TripMode } from "@/lib/types";
import TripModeToggle from "./TripModeToggle";

interface TripHeaderProps {
  tripConfig: TripConfig;
  completedStops: Set<number>;
  totalStops: number;
  tripMode: TripMode;
  onModeChange: (mode: TripMode) => void;
}

export default function TripHeader({
  tripConfig,
  completedStops,
  totalStops,
  tripMode,
  onModeChange,
}: TripHeaderProps) {
  return (
    <div className="flex-shrink-0 px-6 py-5 border-b border-stone-200">
      <h1 className="text-xl font-semibold text-stone-900">
        {tripConfig.title}
      </h1>

      {/* Distance + duration info */}
      {(tripConfig.precomputedDistanceMeters || tripConfig.precomputedDurationMinutes) && (
        <p className="text-sm text-stone-500 mt-1">
          {tripConfig.precomputedDistanceMeters && (
            <>{(tripConfig.precomputedDistanceMeters / 1000).toFixed(1)} km</>
          )}
          {tripConfig.precomputedDistanceMeters && tripConfig.precomputedDurationMinutes && " · "}
          {tripConfig.precomputedDurationMinutes && (
            <>{tripConfig.precomputedDurationMinutes} min</>
          )}
        </p>
      )}

      {/* Mode toggle */}
      <div className="mt-3">
        <TripModeToggle mode={tripMode} onModeChange={onModeChange} />
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${totalStops > 0 ? (completedStops.size / totalStops) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm font-medium text-emerald-600 tabular-nums">
          {completedStops.size}/{totalStops}
        </span>
      </div>
    </div>
  );
}
