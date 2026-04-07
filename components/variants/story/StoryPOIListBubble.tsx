"use client";

import { memo, useState, useCallback } from "react";
import Image from "next/image";
import { Star, ExternalLink } from "lucide-react";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { getIcon } from "@/lib/utils/map-icons";
import type { POI } from "@/lib/types";

interface StoryPOIListBubbleProps {
  pois: readonly POI[];
  themeColor: string;
  staggerDelay?: number;
}

function formatWalkMinutes(poi: POI): string | null {
  const seconds = poi.travelTime?.walk;
  if (seconds == null) return null;
  return `${Math.round(seconds / 60)} min`;
}

export default memo(function StoryPOIListBubble({
  pois,
  themeColor,
  staggerDelay = 0,
}: StoryPOIListBubbleProps) {
  const revealRef = useScrollReveal();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((poiId: string) => {
    setExpandedId((prev) => (prev === poiId ? null : poiId));
  }, []);

  const handleImgError = useCallback((poiId: string) => {
    setImgErrors((prev) => new Set(prev).add(poiId));
  }, []);

  return (
    <div
      ref={revealRef}
      className="max-w-[90%]"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <div className="bg-white border border-[#eae6e1] rounded-2xl rounded-tl-md shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {pois.map((poi, index) => {
          const isFirst = index === 0;
          const isExpanded = expandedId === poi.id;
          const walkMin = formatWalkMinutes(poi);
          const imageUrl = poi.featuredImage && !imgErrors.has(poi.id) ? poi.featuredImage : null;
          const CategoryIcon = getIcon(poi.category.icon);

          return (
            <div key={poi.id}>
              {/* Divider between items */}
              {index > 0 && <div className="mx-3 h-px bg-[#f0eeeb]" />}

              {/* Compact row */}
              <button
                type="button"
                onClick={() => toggleExpand(poi.id)}
                className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left hover:bg-[#faf9f7] transition-colors"
              >
                {/* Favorite star or dot */}
                {isFirst ? (
                  <Star
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: themeColor }}
                    fill={themeColor}
                    strokeWidth={0}
                  />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: themeColor + "60" }}
                  />
                )}

                {/* Name */}
                <span className="flex-1 text-[13px] font-medium text-[#1a1a1a] truncate">
                  {poi.name}
                </span>

                {/* Rating */}
                {poi.googleRating != null && (
                  <span className="text-[12px] text-[#6a6a6a] tabular-nums flex-shrink-0">
                    {poi.googleRating.toFixed(1)}
                  </span>
                )}

                {/* Walk time */}
                {walkMin && (
                  <span className="text-[12px] text-[#a0937d] tabular-nums flex-shrink-0">
                    {walkMin}
                  </span>
                )}
              </button>

              {/* Inline expand */}
              <div
                className="grid transition-[grid-template-rows] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="px-3.5 pb-3 pt-1">
                    {/* Image or fallback */}
                    {imageUrl ? (
                      <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden mb-2.5">
                        <Image
                          src={imageUrl}
                          alt={poi.name}
                          fill
                          sizes="(min-width: 640px) 500px, 85vw"
                          className="object-cover"
                          loading="lazy"
                          onError={() => handleImgError(poi.id)}
                        />
                      </div>
                    ) : (
                      <div
                        className="w-full aspect-[3/1] rounded-lg flex items-center justify-center mb-2.5"
                        style={{ backgroundColor: themeColor + "10" }}
                      >
                        {CategoryIcon && (
                          <CategoryIcon
                            className="w-8 h-8"
                            style={{ color: themeColor }}
                            strokeWidth={1.2}
                          />
                        )}
                      </div>
                    )}

                    {/* Editorial hook */}
                    {poi.editorialHook && (
                      <p className="text-[13px] text-[#6a6a6a] leading-relaxed mb-2">
                        {poi.editorialHook}
                      </p>
                    )}

                    {/* Address */}
                    {poi.address && (
                      <p className="text-[12px] text-[#a0937d] mb-2">{poi.address}</p>
                    )}

                    {/* Google Maps link */}
                    {poi.googleMapsUrl && (
                      <a
                        href={poi.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[#1a1a1a] hover:text-[#4a4a4a] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Google Maps
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
