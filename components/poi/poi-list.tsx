"use client";

import { useRef } from "react";
import { ChevronRight } from "lucide-react";
import type { POI, TravelMode } from "@/lib/types";
import { POICard } from "./poi-card";
import { cn } from "@/lib/utils";

interface POIListProps {
  pois: POI[];
  travelMode: TravelMode;
  activePOI?: string | null;
  onPOIClick?: (poiId: string) => void;
  onShowAll?: () => void;
  showAllLabel?: string;
  className?: string;
}

export function POIList({
  pois,
  travelMode,
  activePOI,
  onPOIClick,
  onShowAll,
  showAllLabel = "Se alle punkter",
  className,
}: POIListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("relative", className)}>
      {/* Horisontal scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 poi-scroll-container scrollbar-hide"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* POI-kort */}
        {pois.map((poi) => (
          <div
            key={poi.id}
            style={{ scrollSnapAlign: "start" }}
          >
            <POICard
              poi={poi}
              travelMode={travelMode}
              isActive={activePOI === poi.id}
              onShowOnMap={() => onPOIClick?.(poi.id)}
            />
          </div>
        ))}

        {/* "Se alle punkter" CTA-kort */}
        {onShowAll && (
          <button
            onClick={onShowAll}
            className="bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 min-w-[200px] max-w-[220px] flex-shrink-0 flex flex-col items-center justify-center gap-3 p-6 transition-colors"
            style={{ scrollSnapAlign: "start" }}
          >
            {/* Ikoner */}
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs">📍</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-xs">📍</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                <span className="text-white text-xs">📍</span>
              </div>
            </div>

            {/* Tekst */}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">{showAllLabel}</p>
              <p className="text-xs text-primary-500">Total {pois.length} locations</p>
            </div>

            {/* Pil */}
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}
