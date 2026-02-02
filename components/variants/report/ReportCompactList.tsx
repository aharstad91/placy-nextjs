"use client";

import { useState } from "react";
import Link from "next/link";
import type { POI } from "@/lib/types";
import { Star, MapPin, ChevronDown, ExternalLink } from "lucide-react";

interface ReportCompactListProps {
  pois: POI[];
  explorerBaseUrl?: string | null;
  themeCategories?: string[];
}

const INITIAL_VISIBLE = 5;

function buildExplorerUrl(
  baseUrl: string,
  poiId: string,
  categories?: string[]
): string {
  const params = new URLSearchParams();
  params.set("poi", poiId);
  if (categories && categories.length > 0) {
    params.set("categories", categories.join(","));
  }
  return `${baseUrl}?${params.toString()}`;
}

export default function ReportCompactList({
  pois,
  explorerBaseUrl,
  themeCategories,
}: ReportCompactListProps) {
  const [showAll, setShowAll] = useState(false);

  if (pois.length === 0) return null;

  const visiblePOIs = showAll ? pois : pois.slice(0, INITIAL_VISIBLE);
  const hasMore = pois.length > INITIAL_VISIBLE;

  return (
    <div className="mt-4">
      <div className="bg-white rounded-xl border border-[#eae6e1] divide-y divide-[#f0ece7] overflow-hidden">
        {visiblePOIs.map((poi) => {
          const walkMinutes = poi.travelTime?.walk
            ? Math.round(poi.travelTime.walk / 60)
            : null;

          const explorerUrl = explorerBaseUrl
            ? buildExplorerUrl(explorerBaseUrl, poi.id, themeCategories)
            : null;

          const rowContent = (
            <>
              {/* Category color dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: poi.category.color }}
              />

              {/* Name */}
              <span className="flex-1 text-sm font-medium text-[#1a1a1a] truncate">
                {poi.name}
              </span>

              {/* Rating */}
              {poi.googleRating != null && (
                <span className="flex items-center gap-1 text-sm text-[#6a6a6a] flex-shrink-0">
                  <Star className="w-3 h-3 text-[#b45309] fill-[#b45309]" />
                  {poi.googleRating.toFixed(1)}
                </span>
              )}

              {/* Walking distance */}
              {walkMinutes != null && (
                <span className="flex items-center gap-0.5 text-xs text-[#8a8a8a] flex-shrink-0">
                  <MapPin className="w-3 h-3" />
                  {walkMinutes} min
                </span>
              )}

              {/* Google Maps icon (secondary when explorer exists) */}
              {explorerUrl && poi.googleMapsUrl ? (
                <a
                  href={poi.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Åpne i Google Maps"
                >
                  <ExternalLink className="w-3 h-3 text-[#c0b9ad] hover:text-[#7a7062]" />
                </a>
              ) : (
                <ExternalLink className="w-3 h-3 text-[#c0b9ad] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </>
          );

          if (explorerUrl) {
            return (
              <Link
                key={poi.id}
                href={explorerUrl}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-[#faf9f7] transition-colors"
              >
                {rowContent}
              </Link>
            );
          }

          return (
            <a
              key={poi.id}
              href={poi.googleMapsUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-4 py-3 hover:bg-[#faf9f7] transition-colors"
            >
              {rowContent}
            </a>
          );
        })}
      </div>

      {/* Show more toggle */}
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#7a7062] hover:text-[#4a4a4a] transition-colors mx-auto"
        >
          <span>
            Vis alle ({pois.length})
          </span>
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
