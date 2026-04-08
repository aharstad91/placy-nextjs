"use client";

import { useEffect, useRef } from "react";
import type { POI } from "@/lib/types";
import { Star, X, MapPin } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";

interface StoryPOIDialogProps {
  poi: POI | null;
  onClose: () => void;
}

export default function StoryPOIDialog({ poi, onClose }: StoryPOIDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, [poi]);

  // Close on Escape or backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  if (!poi) return null;

  const Icon = getIcon(poi.category.icon);
  const walkMin = poi.travelTime?.walk
    ? Math.round(poi.travelTime.walk / 60)
    : null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onClose={onClose}
      className="backdrop:bg-black/40 backdrop:backdrop-blur-sm bg-transparent p-0 m-auto max-w-sm w-[calc(100%-2rem)] rounded-2xl open:animate-in open:fade-in open:zoom-in-95"
    >
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-full"
              style={{ backgroundColor: poi.category.color + "18" }}
            >
              <Icon className="w-5 h-5" style={{ color: poi.category.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-[#1a1a1a] text-lg leading-tight">
                {poi.name}
              </h3>
              <span className="text-sm text-[#8a8a8a]">{poi.category.name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#f5f3f0] transition-colors -mt-1 -mr-1"
          >
            <X className="w-4 h-4 text-[#8a8a8a]" />
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 px-5 pb-3 text-sm">
          {poi.googleRating != null && (
            <span className="flex items-center gap-1 text-[#4a4a4a]">
              <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
              <span className="font-medium">{poi.googleRating.toFixed(1)}</span>
              {poi.googleReviewCount != null && (
                <span className="text-[#8a8a8a]">
                  ({poi.googleReviewCount})
                </span>
              )}
            </span>
          )}
          {walkMin != null && (
            <span className="flex items-center gap-1 text-[#6a6a6a]">
              <MapPin className="w-3 h-3" />
              {walkMin} min gange
            </span>
          )}
        </div>

        {/* Editorial hook */}
        {poi.editorialHook && (
          <div className="px-5 pb-4">
            <p className="text-[15px] text-[#3a3a3a] leading-relaxed">
              {poi.editorialHook}
            </p>
          </div>
        )}

        {/* Local insight */}
        {poi.localInsight && (
          <div className="px-5 pb-5 pt-0">
            <p className="text-sm text-[#6a6a6a] italic leading-relaxed">
              {poi.localInsight}
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}
