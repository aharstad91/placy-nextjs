"use client";

import { Marker, Popup } from "react-map-gl/mapbox";
import { useState } from "react";
import {
  Coffee,
  UtensilsCrossed,
  Bus,
  Bike,
  ParkingCircle,
  Car,
  TrainFront,
  Plane,
  MapPin,
} from "lucide-react";
import type { POI } from "@/lib/types";
import { cn } from "@/lib/utils";

// Map ikon-navn til Lucide-komponenter
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Coffee,
  UtensilsCrossed,
  Bus,
  Bike,
  ParkingCircle,
  Car,
  TrainFront,
  Plane,
  MapPin,
};

interface POIMarkerProps {
  poi: POI;
  isActive?: boolean;
  isCenter?: boolean;
  onClick?: () => void;
}

export function POIMarker({ poi, isActive, isCenter, onClick }: POIMarkerProps) {
  const [showPopup, setShowPopup] = useState(false);

  const IconComponent = iconMap[poi.category.icon] || MapPin;
  const color = poi.category.color || "#6b7280";

  return (
    <>
      <Marker
        longitude={poi.coordinates.lng}
        latitude={poi.coordinates.lat}
        anchor="center"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          onClick?.();
        }}
      >
        <div className="relative">
          {/* Pulserende ring for aktiv markør */}
          {isActive && !isCenter && (
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-75"
              style={{ backgroundColor: color }}
            />
          )}

          <button
            className={cn(
              "relative flex items-center justify-center rounded-full transition-all duration-200",
              isCenter
                ? "w-10 h-10 bg-primary-500 text-white shadow-lg"
                : isActive
                ? "w-10 h-10 shadow-lg scale-125"
                : "w-8 h-8 shadow-md hover:scale-110"
            )}
            style={{ backgroundColor: isCenter ? undefined : color }}
            onMouseEnter={() => setShowPopup(true)}
            onMouseLeave={() => setShowPopup(false)}
          >
            <IconComponent className={cn("text-white", isCenter || isActive ? "w-5 h-5" : "w-4 h-4")} />

            {/* Aktiv markør-label */}
            {isActive && !isCenter && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span
                  className="px-2 py-1 text-xs font-medium text-white rounded shadow-lg"
                  style={{ backgroundColor: color }}
                >
                  {poi.name}
                </span>
              </div>
            )}
          </button>
        </div>
      </Marker>

      {/* Popup ved hover */}
      {showPopup && !isActive && (
        <Popup
          longitude={poi.coordinates.lng}
          latitude={poi.coordinates.lat}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          offset={20}
          className="poi-popup"
        >
          <div className="px-2 py-1 text-sm font-medium">{poi.name}</div>
        </Popup>
      )}
    </>
  );
}
