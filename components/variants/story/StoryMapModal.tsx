"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { X, ExternalLink, Star } from "lucide-react";
import type { POI, Coordinates } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/utils/map-icons";

// Lazy-load MapView (no SSR — Mapbox GL JS requires browser)
const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#eae6e1] animate-pulse" />
    ),
  },
);

interface StoryMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  pois: readonly POI[];
  center: Coordinates;
  themeColor: string;
  themeName: string;
}

export default function StoryMapModal({
  isOpen,
  onClose,
  pois,
  center,
  themeColor,
  themeName,
}: StoryMapModalProps) {
  const [activePOI, setActivePOI] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    // Lock body scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handlePOIClick = useCallback((poiId: string) => {
    setActivePOI((prev) => (prev === poiId ? null : poiId));
  }, []);

  if (!isOpen) return null;

  const activePOIData = activePOI
    ? pois.find((p) => p.id === activePOI)
    : null;

  const walkMin = activePOIData?.travelTime?.walk
    ? Math.round(activePOIData.travelTime.walk / 60)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative flex flex-col w-full h-full bg-white">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#eae6e1] bg-white z-10">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: themeColor }}
            />
            <span className="text-sm font-semibold text-[#1a1a1a]">
              {themeName}
            </span>
            <span className="text-xs text-[#a0937d]">
              {pois.length} steder
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f0eeeb] transition-colors"
            aria-label="Lukk kart"
          >
            <X className="w-4 h-4 text-[#6a6a6a]" />
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            center={center}
            pois={pois as POI[]}
            activePOI={activePOI}
            onPOIClick={handlePOIClick}
          />
        </div>

        {/* Active POI detail card — slides up from bottom */}
        {activePOIData && (
          <div className="flex-shrink-0 border-t border-[#eae6e1] bg-white px-4 py-3 animate-slide-up">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: activePOIData.category.color + "18",
                      color: activePOIData.category.color,
                    }}
                  >
                    {activePOIData.category.name}
                  </span>
                  {activePOIData.googleRating != null && (
                    <span className="text-[11px] text-[#6a6a6a] tabular-nums flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400" fill="#fbbf24" strokeWidth={0} />
                      {activePOIData.googleRating.toFixed(1)}
                    </span>
                  )}
                  {walkMin != null && (
                    <span className="text-[11px] text-[#a0937d] tabular-nums">
                      {walkMin} min
                    </span>
                  )}
                </div>
                <h3 className="text-[15px] font-semibold text-[#1a1a1a] truncate">
                  {activePOIData.name}
                </h3>
                {activePOIData.editorialHook && (
                  <p className="text-[12px] text-[#6a6a6a] leading-relaxed mt-1 line-clamp-2">
                    {activePOIData.editorialHook}
                  </p>
                )}
              </div>
              {activePOIData.googleMapsUrl && (
                <a
                  href={activePOIData.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center hover:bg-[#2d2d2d] transition-colors"
                  aria-label="Åpne i Google Maps"
                >
                  <ExternalLink className="w-4 h-4 text-white" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
