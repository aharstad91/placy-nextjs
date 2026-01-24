"use client";

import { useState } from "react";
import Image from "next/image";
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
  Star,
  MapPinned,
  Footprints,
} from "lucide-react";
import type { POI, TravelMode } from "@/lib/types";
import { cn, formatTravelTime } from "@/lib/utils";

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

// Reisemodus-ikoner
const travelModeIcons = {
  walk: Footprints,
  bike: Bike,
  car: Car,
};

interface POICardProps {
  poi: POI;
  travelMode: TravelMode;
  isActive?: boolean;
  onShowOnMap?: () => void;
  className?: string;
}

export function POICard({
  poi,
  travelMode,
  isActive,
  onShowOnMap,
  className,
}: POICardProps) {
  const [imageError, setImageError] = useState(false);
  const IconComponent = iconMap[poi.category.icon] || MapPin;
  const TravelIcon = travelModeIcons[travelMode];
  const travelTime = poi.travelTime?.[travelMode];

  const showFeaturedImage = poi.featuredImage && !imageError;

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200 min-w-[200px] max-w-[220px] flex-shrink-0",
        isActive && "ring-2 ring-primary-500 ring-offset-2",
        className
      )}
    >
      {/* Reisetid-badge øverst */}
      <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 flex items-center justify-center gap-1">
        <TravelIcon className="w-3 h-3" />
        <span>{formatTravelTime(travelTime)} {travelMode === "walk" ? "walk" : travelMode === "bike" ? "bike" : "drive"}</span>
      </div>

      {/* Bilde/ikon område */}
      <div className="h-24 bg-gray-100 relative">
        {showFeaturedImage ? (
          <>
            <Image
              src={poi.featuredImage!}
              alt={poi.name}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
            {/* Kategori-badge over bildet */}
            <div
              className="absolute bottom-2 left-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
              style={{ backgroundColor: poi.category.color }}
            >
              <IconComponent className="w-4 h-4 text-white" />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: poi.category.color }}
            >
              <IconComponent className="w-6 h-6 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Innhold */}
      <div className="p-3">
        {/* Type og rating */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="uppercase tracking-wider">{poi.category.name}</span>
          {poi.googleRating && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {poi.googleRating}
            </span>
          )}
        </div>

        {/* Navn */}
        <h4 className="font-medium text-gray-900 text-sm leading-tight line-clamp-2 mb-2">
          {poi.name}
        </h4>

        {/* Se på kart-knapp */}
        <button
          onClick={onShowOnMap}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <MapPinned className="w-3 h-3" />
          Se på kart
        </button>
      </div>
    </div>
  );
}

export function POICardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-200 overflow-hidden min-w-[200px] max-w-[220px] flex-shrink-0 animate-pulse",
        className
      )}
    >
      {/* Reisetid-badge skeleton */}
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-center">
        <div className="h-3 w-16 bg-gray-200 rounded" />
      </div>

      {/* Bilde/ikon område skeleton */}
      <div className="h-24 bg-gray-200" />

      {/* Innhold skeleton */}
      <div className="p-3">
        {/* Type skeleton */}
        <div className="h-3 w-12 bg-gray-200 rounded mb-2" />

        {/* Navn skeleton */}
        <div className="h-4 w-full bg-gray-200 rounded mb-1" />
        <div className="h-4 w-3/4 bg-gray-200 rounded mb-3" />

        {/* Knapp skeleton */}
        <div className="h-8 w-full bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}
