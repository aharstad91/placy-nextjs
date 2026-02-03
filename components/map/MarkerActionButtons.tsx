"use client";

import { useEffect, useState, useRef } from "react";
import { Cuboid, Footprints, Bike, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TravelMode } from "@/lib/types";

interface MarkerActionButtonsProps {
  markerElement: google.maps.maps3d.Marker3DInteractiveElement | null;
  travelTime: number; // in minutes
  travelMode: TravelMode;
  onToggle3D: () => void;
  show: boolean;
}

const TRAVEL_MODE_ICONS = {
  walk: Footprints,
  bike: Bike,
  car: Car,
} as const;

export function MarkerActionButtons({
  markerElement,
  travelTime,
  travelMode,
  onToggle3D,
  show,
}: MarkerActionButtonsProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate screen position of marker
  useEffect(() => {
    if (!markerElement || !show) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      // Find the marker's DOM element (first child of Marker3DInteractiveElement)
      const markerDOM = markerElement.querySelector('div');
      if (!markerDOM) return;

      const rect = markerDOM.getBoundingClientRect();

      // Position to the right of marker with 8px gap
      const x = rect.right + 8;
      const y = rect.top + rect.height / 2; // Vertically centered

      setPosition({ x, y });
    };

    // Initial position
    updatePosition();

    // Update on scroll/resize (marker moves in viewport)
    const observer = new MutationObserver(updatePosition);
    observer.observe(markerElement, { attributes: true, childList: true, subtree: true });

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [markerElement, show]);

  if (!position || !show) return null;

  const TravelIcon = TRAVEL_MODE_ICONS[travelMode];

  return (
    <div
      ref={containerRef}
      className="fixed z-20 pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateY(-50%)', // Center vertically
      }}
    >
      <div className="flex items-center gap-2">
        {/* 3D Button */}
        <button
          onClick={onToggle3D}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle3D();
            }
          }}
          className={cn(
            // Touch-friendly size: 44px minimum (iOS guideline)
            "pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center",
            "bg-white border-2 border-gray-200 shadow-lg",
            "transition-all duration-200",
            "hover:scale-105 hover:shadow-xl hover:bg-blue-50",
            "active:scale-95",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            // Entry animation
            "opacity-0 translate-x-[-8px] animate-[fadeInSlide_200ms_ease-out_50ms_forwards]"
          )}
          aria-label="Se i 3D"
          tabIndex={0}
        >
          <Cuboid className="w-5 h-5 text-gray-700" />
        </button>

        {/* Travel Time Display */}
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "bg-white border-2 border-gray-200 shadow-lg",
            "text-sm font-medium text-gray-700",
            "transition-all duration-200",
            // Entry animation with delay
            "opacity-0 translate-x-[-8px] animate-[fadeInSlide_200ms_ease-out_100ms_forwards]"
          )}
        >
          <span>{travelTime}min</span>
          <TravelIcon className="w-4 h-4 text-gray-500" />
        </div>
      </div>
    </div>
  );
}
