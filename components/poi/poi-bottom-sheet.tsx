"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronUp, MapPin, Clock, ExternalLink, Phone, Globe } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { POI, TravelMode } from "@/lib/types";
import { cn, formatTravelTime } from "@/lib/utils";
import { isSafeUrl } from "@/lib/utils/url";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";

interface POIBottomSheetProps {
  poi: POI | null;
  travelMode: TravelMode;
  onClose: () => void;
  onShowRoute?: () => void;
}

export function POIBottomSheet({ poi, travelMode, onClose, onShowRoute }: POIBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentTranslateY, setCurrentTranslateY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Get the category icon
  const getIcon = (iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  };

  // Reset state when POI changes
  useEffect(() => {
    if (poi) {
      setIsExpanded(false);
      setCurrentTranslateY(0);
    }
  }, [poi?.id]);

  // Handle drag start
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    setDragStartY(clientY);
  }, []);

  // Handle drag move
  const handleDragMove = useCallback(
    (clientY: number) => {
      if (!isDragging) return;
      const deltaY = clientY - dragStartY;
      // Only allow dragging down (positive deltaY) when not expanded
      // Or dragging up (negative deltaY) when not fully expanded
      if (deltaY > 0 || !isExpanded) {
        setCurrentTranslateY(Math.max(-100, deltaY));
      }
    },
    [isDragging, dragStartY, isExpanded]
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // If dragged down more than 100px, close
    if (currentTranslateY > 100) {
      onClose();
    }
    // If dragged up more than 50px, expand
    else if (currentTranslateY < -50) {
      setIsExpanded(true);
    }
    // Otherwise snap back
    setCurrentTranslateY(0);
  }, [isDragging, currentTranslateY, onClose]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse handlers (for testing on desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientY);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  if (!poi) return null;

  const CategoryIcon = getIcon(poi.category.icon);
  const travelTime = poi.travelTime?.[travelMode];

  return (
    <>
      {/* Backdrop */}
      <div
        className="md:hidden fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl",
          "transform transition-all duration-300 ease-out",
          isDragging && "transition-none"
        )}
        style={{
          transform: `translateY(${currentTranslateY}px)`,
          maxHeight: isExpanded ? "80vh" : "auto",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Compact header */}
        <div className="px-4 pb-4">
          <div className="flex items-start gap-3">
            {/* Category icon */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: poi.category.color + "20" }}
            >
              <CategoryIcon
                className="w-5 h-5"
                style={{ color: poi.category.color }}
              />
            </div>

            {/* POI info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{poi.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{poi.category.name}</span>
                {travelTime && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTravelTime(travelTime)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Expand button */}
          {!isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="mt-3 w-full flex items-center justify-center gap-1 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
              Se mer
            </button>
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-6 border-t border-gray-100 pt-4 max-h-[50vh] overflow-y-auto">
            {/* Editorial hook */}
            {poi.editorialHook && (
              <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                {poi.editorialHook}
              </p>
            )}

            {/* Local insight */}
            {poi.localInsight && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Lokaltips:</span> {poi.localInsight}
                </p>
              </div>
            )}

            {/* Google rating */}
            {shouldShowRating(poi.category.id) && poi.googleRating != null && poi.googleRating > 0 && (
              <div className="mb-4">
                <GoogleRating rating={poi.googleRating} reviewCount={poi.googleReviewCount} size="md" showLabel />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {onShowRoute && (
                <button
                  onClick={onShowRoute}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Vis rute
                </button>
              )}
              {poi.googleMapsUrl && (
                <a
                  href={poi.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              {poi.facebookUrl && isSafeUrl(poi.facebookUrl) && (
                <a
                  href={poi.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Collapse button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Vis mindre
            </button>
          </div>
        )}
      </div>
    </>
  );
}
