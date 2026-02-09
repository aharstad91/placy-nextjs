"use client";

import { Footprints, Bike, Car } from "lucide-react";
import type { TravelMode } from "@/lib/types";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";

const TRAVEL_MODE_ICONS = {
  walk: Footprints,
  bike: Bike,
  car: Car,
} as const;

interface MarkerTooltipProps {
  name: string;
  categoryName: string;
  categoryId: string;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  /** Travel time in whole minutes, pre-rounded by caller. */
  travelTimeMinutes?: number | null;
  travelMode?: TravelMode;
  /** Override category name with custom text (e.g. "Start" in TripMap) */
  subtitle?: string;
}

export function MarkerTooltip({
  name,
  categoryName,
  categoryId,
  googleRating,
  googleReviewCount,
  travelTimeMinutes,
  travelMode,
  subtitle,
}: MarkerTooltipProps) {
  const displaySubtitle = subtitle ?? categoryName;
  const showRating =
    shouldShowRating(categoryId) &&
    googleRating != null &&
    googleRating > 0;
  const TravelIcon = travelMode ? TRAVEL_MODE_ICONS[travelMode] : null;

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap pointer-events-none z-20 animate-fade-in">
      <div className="bg-white px-3 py-1.5 rounded-lg shadow-lg border border-gray-100 text-xs">
        <div className="font-semibold text-gray-900 truncate max-w-[200px]">
          {name}
        </div>
        {displaySubtitle && (
          <div className="flex items-center gap-1.5 mt-0.5 text-gray-500">
            <span>{displaySubtitle}</span>
            {showRating && (
              <>
                <span className="text-gray-300">&middot;</span>
                <GoogleRating
                  rating={googleRating!}
                  reviewCount={googleReviewCount ?? undefined}
                  size="xs"
                  variant="light"
                />
              </>
            )}
            {travelTimeMinutes != null && travelTimeMinutes > 0 && TravelIcon && (
              <>
                <span className="text-gray-300">&middot;</span>
                <TravelIcon className="w-3 h-3" />
                <span>{travelTimeMinutes} min</span>
              </>
            )}
          </div>
        )}
      </div>
      {/* Arrow pointing down */}
      <div className="w-2 h-2 bg-white border-b border-r border-gray-100 rotate-45 mx-auto -mt-1.5" />
    </div>
  );
}
