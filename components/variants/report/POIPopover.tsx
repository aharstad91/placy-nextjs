"use client";

import type { POI } from "@/lib/types";
import { Star, MapPin } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

export interface POIPopoverProps {
  poi: POI;
  /** Visible inline label — defaults to poi.name. */
  label?: string;
}

export default function POIPopover({ poi, label }: POIPopoverProps) {
  const Icon = getIcon(poi.category.icon);
  const walkMin = poi.travelTime?.walk
    ? Math.round(poi.travelTime.walk / 60)
    : null;

  const imageUrl = poi.featuredImage
    ? poi.featuredImage.includes("mymaps.usercontent.google.com")
      ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
      : poi.featuredImage
    : null;

  const displayLabel = label ?? poi.name;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="font-semibold text-[#1a1a1a] underline decoration-[#d4cfc8] decoration-2 underline-offset-2 hover:decoration-[#8a8a8a] transition-colors cursor-pointer"
        >
          {displayLabel}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-0 gap-0 overflow-hidden">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={poi.name} className="w-full aspect-[16/9] object-cover" />
        )}
        <div className="p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
              style={{ backgroundColor: poi.category.color + "18" }}
            >
              <Icon className="w-4 h-4" style={{ color: poi.category.color }} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight truncate">{poi.name}</div>
              <div className="text-xs text-muted-foreground">{poi.category.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-muted-foreground mb-2">
            {poi.googleRating != null && (
              <span className="flex items-center gap-0.5">
                <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
                <span className="font-medium text-foreground">{poi.googleRating.toFixed(1)}</span>
                {poi.googleReviewCount != null && <span>({poi.googleReviewCount})</span>}
              </span>
            )}
            {walkMin != null && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {walkMin} min gange
              </span>
            )}
          </div>

          {poi.editorialHook && (
            <p className="text-[13px] text-[#3a3a3a] leading-relaxed">{poi.editorialHook}</p>
          )}
          {poi.localInsight && (
            <p className="text-xs text-muted-foreground italic leading-relaxed mt-1.5">{poi.localInsight}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
