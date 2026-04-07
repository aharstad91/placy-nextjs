"use client";

import { memo } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, MapPin, ExternalLink } from "lucide-react";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { getIcon } from "@/lib/utils/map-icons";
import type { POI } from "@/lib/types";
import { GoogleRating } from "@/components/ui/GoogleRating";

interface StoryPOICardProps {
  poi: POI;
  isExpanded: boolean;
  onToggle: () => void;
  staggerDelay?: number;
}

export default memo(function StoryPOICard({
  poi,
  isExpanded,
  onToggle,
  staggerDelay = 0,
}: StoryPOICardProps) {
  const revealRef = useScrollReveal();
  const walkMinutes = poi.travelTime?.walk
    ? Math.round(poi.travelTime.walk / 60)
    : null;
  const CategoryIcon = getIcon(poi.category.icon);
  const imageUrl = poi.featuredImage ?? null;

  return (
    <div
      ref={revealRef}
      className="story-block w-full"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full rounded-xl overflow-hidden bg-white border border-[#eae6e1] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] text-left"
      >
        {/* Image / fallback */}
        <div className="relative w-full aspect-[16/9] overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={poi.name}
              fill
              sizes="(min-width: 640px) 576px, 100vw"
              className="object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: poi.category.color + "15" }}
            >
              {CategoryIcon && (
                <CategoryIcon
                  className="w-10 h-10"
                  style={{ color: poi.category.color }}
                  strokeWidth={1.5}
                />
              )}
            </div>
          )}

          {/* Walk distance badge */}
          {walkMinutes != null && (
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
              <MapPin className="w-3 h-3 text-[#6a6a6a]" />
              <span className="text-xs font-medium text-[#1a1a1a] tabular-nums">
                {walkMinutes} min
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <span
            className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mb-2"
            style={{
              backgroundColor: poi.category.color + "18",
              color: poi.category.color,
            }}
          >
            {poi.category.name}
          </span>
          <h3 className="text-base font-semibold text-[#1a1a1a] leading-snug">
            {poi.name}
          </h3>
          {poi.editorialHook && (
            <p className="text-sm text-[#6a6a6a] leading-relaxed mt-1 line-clamp-2">
              {poi.editorialHook}
            </p>
          )}
          <div className="flex items-center gap-1 mt-2.5 text-[#a0937d]">
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            <span className="text-xs font-medium">
              {isExpanded ? "Vis mindre" : "Vis mer"}
            </span>
          </div>
        </div>
      </button>

      {/* Accordion expansion */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bg-white border-x border-b border-[#eae6e1] rounded-b-xl -mt-px"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-[#eae6e1]">
            {poi.googleRating != null && (
              <div className="mb-3">
                <GoogleRating
                  rating={poi.googleRating}
                  reviewCount={poi.googleReviewCount}
                  size="sm"
                />
              </div>
            )}
            {poi.address && (
              <p className="text-sm text-[#6a6a6a] mb-3">{poi.address}</p>
            )}
            {poi.localInsight && (
              <p className="text-sm text-[#6a6a6a] mb-3 italic">
                {poi.localInsight}
              </p>
            )}
            {poi.googleMapsUrl && (
              <a
                href={poi.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] hover:text-[#4a4a4a] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Se i Google Maps
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
