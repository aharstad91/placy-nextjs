"use client";

import { useRef, useEffect, useCallback } from "react";
import type { POI, TravelMode } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import { Compass } from "lucide-react";
import ExplorerPOICard from "./ExplorerPOICard";

interface ExplorerPOIListProps {
  pois: POI[];
  activePOI: string | null;
  highlightedPOI?: string | null;
  contextHint: string | null;
  onPOIClick: (poiId: string) => void;
  visibleCount: number;
  totalCount: number;
  travelTimesLoading?: boolean;
  projectName?: string;
  openingHoursData?: Map<string, OpeningHoursData>;
  travelMode?: TravelMode;
  collectionPOIs?: string[];
  onToggleCollection?: (poiId: string) => void;
}

export default function ExplorerPOIList({
  pois,
  activePOI,
  highlightedPOI,
  contextHint,
  onPOIClick,
  visibleCount,
  totalCount,
  travelTimesLoading,
  projectName,
  openingHoursData,
  travelMode = "walk",
  collectionPOIs = [],
  onToggleCollection,
}: ExplorerPOIListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to active POI in list
  useEffect(() => {
    if (!activePOI || !listRef.current) return;
    const cardEl = cardRefs.current.get(activePOI);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activePOI]);

  const setCardRef = useCallback(
    (poiId: string) => (el: HTMLDivElement | null) => {
      if (el) {
        cardRefs.current.set(poiId, el);
      } else {
        cardRefs.current.delete(poiId);
      }
    },
    []
  );

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 p-4 pb-3 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">
          {projectName ? `Utforsk ${projectName}` : "Utforsk nabolaget"}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {visibleCount} av {totalCount} steder synlige
          {travelTimesLoading && (
            <span className="text-sky-500 animate-pulse ml-2">
              Beregner gangtider…
            </span>
          )}
        </p>
        {contextHint && !travelTimesLoading && (
          <p className="text-xs text-sky-600 mt-1">{contextHint}</p>
        )}
      </div>

      {/* POI list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {pois.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
            <Compass className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">
              Panorer eller zoom kartet for å se steder her
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {pois.map((poi) => (
              <div
                key={poi.id}
                ref={setCardRef(poi.id)}
                className={cn(
                  "rounded-xl border overflow-hidden transition-all duration-300",
                  highlightedPOI === poi.id && "ring-2 ring-blue-500",
                  activePOI === poi.id
                    ? "border-sky-200 ring-2 ring-sky-500 ring-offset-1 shadow-md"
                    : "border-gray-200"
                )}
              >
                <ExplorerPOICard
                  poi={poi}
                  isActive={activePOI === poi.id}
                  onClick={() => onPOIClick(poi.id)}
                  openingHours={openingHoursData?.get(poi.id)}
                  travelTimesLoading={travelTimesLoading}
                  travelMode={travelMode}
                  isInCollection={collectionPOIs.includes(poi.id)}
                  onToggleCollection={onToggleCollection}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
