"use client";

import { useRef, useEffect, useCallback } from "react";
import type { POI, Category, TravelMode } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import ExplorerPOICard from "./ExplorerPOICard";
import * as LucideIcons from "lucide-react";
import { Compass, Footprints, Bike, Car, ExternalLink } from "lucide-react";

// Travel mode options matching theme story modal
const travelModes: { mode: TravelMode; label: string; icon: React.ReactNode }[] = [
  { mode: "walk", label: "Til fots", icon: <Footprints className="w-4 h-4" /> },
  { mode: "bike", label: "Sykkel", icon: <Bike className="w-4 h-4" /> },
  { mode: "car", label: "Bil", icon: <Car className="w-4 h-4" /> },
];

interface ExplorerPanelProps {
  pois: POI[];
  allPOIs: POI[];
  categories: Category[];
  activeCategories: Set<string>;
  activePOI: string | null;
  highlightedPOI?: string | null;
  contextHint: string | null;
  onPOIClick: (poiId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  onToggleAll: () => void;
  visibleCount: number;
  totalCount: number;
  travelTimesLoading?: boolean;
  projectName?: string;
  openingHoursData?: Map<string, OpeningHoursData>;
  travelMode?: TravelMode;
  onSetTravelMode?: (mode: TravelMode) => void;
  collectionPOIs?: string[];
  onToggleCollection?: (poiId: string) => void;
  isCollectionView?: boolean;
  collectionPoiCount?: number;
  collectionCreatedAt?: string;
  collectionEmail?: string | null;
  explorerUrl?: string;
}

export default function ExplorerPanel({
  pois,
  allPOIs,
  categories,
  activeCategories,
  activePOI,
  highlightedPOI,
  contextHint,
  onPOIClick,
  onToggleCategory,
  onToggleAll,
  visibleCount,
  totalCount,
  travelTimesLoading,
  projectName,
  openingHoursData,
  travelMode = "walk",
  onSetTravelMode,
  collectionPOIs = [],
  onToggleCollection,
  isCollectionView,
  collectionPoiCount,
  collectionCreatedAt,
  collectionEmail,
  explorerUrl,
}: ExplorerPanelProps) {
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

  // Get Lucide icon component
  const getIcon = (iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  };

  // Count POIs per category (from all POIs, not just visible)
  const categoryCounts = new Map<string, number>();
  for (const poi of allPOIs) {
    const count = categoryCounts.get(poi.category.id) || 0;
    categoryCounts.set(poi.category.id, count + 1);
  }

  // Only show categories that exist in data
  const availableCategories = categories.filter(
    (c) => (categoryCounts.get(c.id) || 0) > 0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-100">
        {/* Dark header — matches theme story modal */}
        <div className="p-4 pb-3 bg-gray-900 text-white">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            {isCollectionView ? "Din samling" : "Neighborhood Story"}
          </h2>
          <h1 className="text-xl font-bold mb-1">
            {isCollectionView
              ? `${collectionPoiCount ?? totalCount} steder`
              : projectName ? `Utforsk ${projectName}` : "Utforsk nabolaget"}
          </h1>
          <p className="text-sm text-gray-400">
            {isCollectionView ? (
              <>
                {collectionCreatedAt && (
                  <span>
                    Opprettet {new Date(collectionCreatedAt).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                  </span>
                )}
                {collectionEmail && (
                  <span>
                    {collectionCreatedAt ? " · " : ""}Delt med {collectionEmail.replace(/^(.{1})(.*)(@.*)$/, (_, first, middle, domain) => first + "•".repeat(Math.min(middle.length, 4)) + domain)}
                  </span>
                )}
                {(collectionCreatedAt || collectionEmail) && <br />}
                <a
                  href={explorerUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
                >
                  Utforsk alle steder
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            ) : (
              <>{totalCount} steder funnet</>
            )}
          </p>
        </div>

        {/* Travel mode controls */}
        {onSetTravelMode && (
          <div className="px-4 py-3 border-b border-gray-100 bg-white">
            <label className="text-xs text-gray-500 mb-1.5 block">Travel Mode</label>
            <div className="flex gap-1">
              {travelModes.map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  onClick={() => onSetTravelMode(mode)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    travelMode === mode
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category filters — horizontal scroll — hidden in collection view */}
        {!isCollectionView && <div className="px-4 py-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {availableCategories.map((category) => {
              const Icon = getIcon(category.icon);
              const isActive = activeCategories.has(category.id);
              const count = categoryCounts.get(category.id) || 0;

              return (
                <button
                  key={category.id}
                  onClick={() => onToggleCategory(category.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 min-h-[36px] ${
                    isActive
                      ? "text-white shadow-sm"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  }`}
                  style={{
                    backgroundColor: isActive ? category.color : undefined,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{category.name}</span>
                  <span
                    className={`ml-0.5 px-1.5 rounded-full text-[10px] ${
                      isActive ? "bg-white/20" : "bg-gray-200"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>}

        {/* Count indicator + context hint */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {visibleCount} av {totalCount} steder synlige
          </span>
          {travelTimesLoading && (
            <span className="text-xs text-sky-500 animate-pulse">
              Beregner gangtider…
            </span>
          )}
          {contextHint && !travelTimesLoading && (
            <span className="text-xs text-gray-400">
              — {contextHint}
            </span>
          )}
        </div>
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
          <div className="space-y-3 p-4">
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

    </div>
  );
}
