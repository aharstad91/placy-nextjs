"use client";

import type { POI } from "@/lib/types";
import { Star } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";

interface StoryPOIHighlightProps {
  poi: POI;
}

export default function StoryPOIHighlight({ poi }: StoryPOIHighlightProps) {
  const Icon = getIcon(poi.category.icon);
  const walkMin = poi.travelTime?.walk
    ? Math.round(poi.travelTime.walk / 60)
    : null;

  return (
    <div className="flex items-start gap-4 py-4 border-b border-[#eae6e1] last:border-b-0">
      {/* Category icon */}
      <div
        className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full mt-0.5"
        style={{ backgroundColor: poi.category.color + "18" }}
      >
        <Icon className="w-4 h-4" style={{ color: poi.category.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-[#1a1a1a] text-[15px]">{poi.name}</span>
          {poi.googleRating != null && (
            <span className="flex items-center gap-0.5 text-sm text-[#6a6a6a]">
              <Star className="w-3 h-3 text-[#b45309] fill-[#b45309]" />
              {poi.googleRating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Meta: walk time + category */}
        <div className="flex items-center gap-2 text-sm text-[#8a8a8a] mb-1">
          {walkMin != null && <span>{walkMin} min gange</span>}
          {walkMin != null && <span className="text-[#d4cfc8]">·</span>}
          <span>{poi.category.name}</span>
        </div>

        {/* Editorial hook */}
        {poi.editorialHook && (
          <p className="text-sm text-[#5a5a5a] leading-relaxed">
            {poi.editorialHook}
          </p>
        )}
      </div>
    </div>
  );
}
