"use client";

import { useEffect, useState, useRef } from "react";
import { Cuboid, Footprints, Bike, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TravelMode, Coordinates } from "@/lib/types";

interface Map3DActionButtonsProps {
  travelTime: number; // in minutes
  travelMode: TravelMode;
  onToggle3D: () => void;
  show: boolean;
  markerPosition: Coordinates; // lat/lng of the marker
  map3d: google.maps.maps3d.Map3DElement | null;
}

const TRAVEL_MODE_ICONS = {
  walk: Footprints,
  bike: Bike,
  car: Car,
} as const;

/**
 * Calculate screen position of a 3D coordinate using map camera
 */
function calculateScreenPosition(
  map3d: google.maps.maps3d.Map3DElement,
  position: Coordinates
): { x: number; y: number } | null {
  try {
    // Get map container dimensions
    const mapRect = map3d.getBoundingClientRect();

    // Get camera properties
    const camera = {
      center: map3d.center,
      heading: map3d.heading,
      tilt: map3d.tilt,
      range: map3d.range
    };

    if (!camera.center) return null;

    // Simple projection approximation for near-top-down views
    // For more accurate 3D projection, we'd need full camera matrix math

    // Calculate deltas from camera center
    const latDelta = position.lat - camera.center.lat;
    const lngDelta = position.lng - camera.center.lng;

    // Convert to approximate screen pixels
    // At tilt=0, range determines scale (smaller range = more zoomed in)
    const scale = mapRect.height / ((camera.range ?? 1200) / 100);

    // Account for heading (rotation)
    const headingRad = (camera.heading || 0) * Math.PI / 180;
    const cosH = Math.cos(headingRad);
    const sinH = Math.sin(headingRad);

    // Rotate deltas by heading
    const rotatedLat = latDelta * cosH - lngDelta * sinH;
    const rotatedLng = latDelta * sinH + lngDelta * cosH;

    // Project to screen (inverted Y axis for screen coordinates)
    const x = mapRect.width / 2 + rotatedLng * scale * 1000;
    const y = mapRect.height / 2 - rotatedLat * scale * 1000;

    // Account for tilt (perspective)
    const tiltFactor = 1 - (camera.tilt || 0) / 90 * 0.3;
    const adjustedY = y * tiltFactor;

    return { x, y: adjustedY };
  } catch (err) {
    console.error('Failed to calculate screen position:', err);
    return null;
  }
}

/**
 * Action buttons that appear next to active 3D marker
 * Positioned using calculated screen coordinates from map camera
 */
export function Map3DActionButtons({
  travelTime,
  travelMode,
  onToggle3D,
  show,
  markerPosition,
  map3d,
}: Map3DActionButtonsProps) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  // Update position continuously while visible
  useEffect(() => {
    if (!show || !map3d) {
      setScreenPos(null);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
      return;
    }

    const updatePosition = () => {
      const pos = calculateScreenPosition(map3d, markerPosition);
      setScreenPos(pos);

      // Continue updating if still visible
      if (show) {
        rafRef.current = requestAnimationFrame(updatePosition);
      }
    };

    updatePosition();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
    };
  }, [show, map3d, markerPosition.lat, markerPosition.lng]);

  if (!show || !screenPos) return null;

  const TravelIcon = TRAVEL_MODE_ICONS[travelMode];

  return (
    <div
      className="fixed z-20 pointer-events-none"
      style={{
        left: screenPos.x + 24, // Offset to the right of marker
        top: screenPos.y - 22, // Vertically centered with marker
        transform: 'translate(0, 0)', // No transform to avoid subpixel issues
      }}
    >
      <div className="flex items-center gap-2">
        {/* 3D Toggle Button */}
        <button
          onClick={onToggle3D}
          className={cn(
            // Touch-friendly size: 44px minimum
            "pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center",
            "bg-white border-2 border-gray-200 shadow-lg",
            "transition-all duration-200",
            "hover:scale-105 hover:shadow-xl hover:bg-blue-50",
            "active:scale-95",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            // Entry animation
            "animate-[fadeInSlide_200ms_ease-out_50ms_both]"
          )}
          aria-label="Se i 3D"
        >
          <Cuboid className="w-5 h-5 text-gray-700" />
        </button>

        {/* Travel Time Display */}
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-full",
            "bg-white border-2 border-gray-200 shadow-lg",
            "text-sm font-medium text-gray-700",
            "transition-all duration-200",
            // Entry animation with delay
            "animate-[fadeInSlide_200ms_ease-out_100ms_both]"
          )}
        >
          <span>{travelTime}min</span>
          <TravelIcon className="w-4 h-4 text-gray-500" />
        </div>
      </div>
    </div>
  );
}
