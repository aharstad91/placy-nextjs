"use client";

import { useState } from "react";
import type { POI } from "@/lib/types";
import { MapPin } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";

interface ReportPOICardProps {
  poi: POI;
  isActive?: boolean;
  onClick?: () => void;
}

/**
 * Compact ~180px photo card for horizontal scroll rows in editorial theme sections.
 * Shows: 16:9 image, name, rating, editorial hook, walking distance.
 * Fallback: category-color background with Lucide icon when no photo available.
 */
export default function ReportPOICard({ poi, isActive, onClick }: ReportPOICardProps) {
  const [imgError, setImgError] = useState(false);

  const imageUrl = resolveImageUrl(poi, imgError);
  const walkMinutes = poi.travelTime?.walk
    ? Math.round(poi.travelTime.walk / 60)
    : null;
  const CategoryIcon = getIcon(poi.category.icon);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={`group block bg-white rounded-lg overflow-hidden transition-all cursor-pointer ${
        isActive
          ? "shadow-md ring-2"
          : "border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm"
      }`}
      style={isActive ? { "--tw-ring-color": poi.category.color } as React.CSSProperties : undefined}
    >
      {/* 16:9 image or category icon fallback */}
      <div
        className="w-full aspect-[16/9] overflow-hidden flex items-center justify-center"
        style={!imageUrl ? { backgroundColor: poi.category.color + "20" } : undefined}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={poi.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <CategoryIcon
            className="w-8 h-8"
            style={{ color: poi.category.color }}
          />
        )}
      </div>

      <div className="p-2.5">
        {/* Name */}
        <h4 className="text-sm font-medium text-[#1a1a1a] leading-snug truncate">
          {poi.name}
        </h4>

        {/* Rating + distance row */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {shouldShowRating(poi.category.id) && poi.googleRating != null && poi.googleRating > 0 && (
            <GoogleRating rating={poi.googleRating} reviewCount={poi.googleReviewCount} size="sm" />
          )}
          {walkMinutes != null && (
            <>
              {poi.googleRating != null && <span className="text-gray-300">·</span>}
              <span className="flex items-center gap-0.5 text-xs text-[#8a8a8a]">
                <MapPin className="w-3 h-3" />
                {walkMinutes} min
              </span>
            </>
          )}
        </div>

        {/* Editorial hook */}
        {poi.editorialHook && (
          <p className="text-xs text-[#6a6a6a] leading-relaxed truncate mt-1">
            {poi.editorialHook}
          </p>
        )}
      </div>
    </div>
  );
}

function resolveImageUrl(poi: POI, imgError: boolean): string | null {
  if (imgError) return null;
  if (poi.featuredImage) return poi.featuredImage;
  if (poi.photoReference)
    return `/api/places/photo?photoReference=${encodeURIComponent(poi.photoReference)}&maxWidth=400`;
  return null;
}
