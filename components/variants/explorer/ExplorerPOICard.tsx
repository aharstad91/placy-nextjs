"use client";

import { useState } from "react";
import type { POI, TravelMode } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { cn, formatTravelTime } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import {
  Star,
  MapPin,
  MapPinned,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Footprints,
  Bike,
  Car,
  Bus,
  Navigation,
  Clock,
  Globe,
  Phone,
} from "lucide-react";

const travelModeIcons = {
  walk: Footprints,
  bike: Bike,
  car: Car,
};

interface ExplorerPOICardProps {
  poi: POI;
  isActive: boolean;
  onClick: () => void;
  openingHours?: OpeningHoursData;
  travelTimesLoading?: boolean;
  isOutsideBudget?: boolean;
  travelMode?: TravelMode;
}

export default function ExplorerPOICard({
  poi,
  isActive,
  onClick,
  openingHours,
  travelTimesLoading,
  isOutsideBudget,
  travelMode = "walk",
}: ExplorerPOICardProps) {
  const [imageError, setImageError] = useState(false);

  // Get category icon
  const getIcon = (iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  };

  const CategoryIcon = getIcon(poi.category.icon);

  const realtimeData = useRealtimeData(isActive ? poi : null);

  const imageUrl = poi.featuredImage
    ? poi.featuredImage
    : poi.photoReference
    ? `/api/places/photo?reference=${poi.photoReference}&maxwidth=400`
    : null;

  const travelTime = poi.travelTime?.[travelMode];
  const TravelIcon = travelModeIcons[travelMode];
  const isOpen = openingHours?.isOpen;
  const hasRealtimeData = realtimeData.entur || realtimeData.bysykkel;

  // Google Maps directions URL
  const googleMapsDirectionsUrl = poi.googlePlaceId
    ? `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&destination_place_id=${poi.googlePlaceId}&travelmode=walking`
    : `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&travelmode=walking`;

  // Format departure time to relative format
  const formatDepartureTime = (isoTime: string) => {
    const departure = new Date(isoTime);
    const now = new Date();
    const diffMs = departure.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins <= 0) return "Nå";
    if (diffMins === 1) return "1 min";
    return `${diffMins} min`;
  };

  return (
    <div
      className={cn(
        "w-full text-left transition-all duration-200",
        isActive ? "bg-gray-50" : "hover:bg-gray-50/50",
        isOutsideBudget && !isActive && "opacity-50"
      )}
    >
      <button onClick={onClick} className="w-full text-left">
      <div className="px-4 py-3">
        {/* Main row */}
        <div className="flex items-start gap-3">
          {/* Category icon */}
          <div
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
            style={{ backgroundColor: poi.category.color }}
          >
            <CategoryIcon className="w-4 h-4 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {poi.name}
              </h3>
              {poi.editorialHook && (
                <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              )}
            </div>

            {/* Meta line: category · rating · walk time · open status */}
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span
                className="text-xs font-medium"
                style={{ color: poi.category.color }}
              >
                {poi.category.name}
              </span>

              {poi.googleRating && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-0.5 text-xs text-gray-500">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {poi.googleRating.toFixed(1)}
                  </span>
                </>
              )}

              {travelTime != null && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-0.5 text-xs text-gray-500">
                    <TravelIcon className="w-3 h-3" />
                    {Math.round(travelTime)} min
                  </span>
                </>
              )}

              {travelTime == null && travelTimesLoading && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="w-10 h-3 bg-gray-100 rounded animate-pulse" />
                </>
              )}

              {isOpen === true && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs font-medium text-emerald-600">
                    Åpen
                  </span>
                </>
              )}

              {isOpen === false && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">
                    Stengt
                  </span>
                </>
              )}
            </div>
          </div>

          {/* "Se på kart" + Expand indicator */}
          <div className="flex items-center gap-1 flex-shrink-0 mt-1">
            <span className="flex items-center gap-1 text-xs font-medium text-sky-600">
              <MapPinned className="w-3.5 h-3.5" />
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-gray-300 transition-transform duration-200",
                isActive && "rotate-180 text-gray-500"
              )}
            />
          </div>
        </div>

        {/* Expanded content */}
        {isActive && (
          <div className="mt-3 ml-12 space-y-3">
            {/* Image */}
            {imageUrl && !imageError && (
              <div className="rounded-lg overflow-hidden aspect-[16/9] bg-gray-100">
                <img
                  src={imageUrl}
                  alt={poi.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {/* Editorial hook */}
            {poi.editorialHook && (
              <div className="bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-100">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900 leading-relaxed">
                    {poi.editorialHook}
                  </p>
                </div>
              </div>
            )}

            {/* Local insight */}
            {poi.localInsight && (
              <p className="text-sm text-gray-500 leading-relaxed">
                {poi.localInsight}
              </p>
            )}

            {/* Description (fallback if no editorial) */}
            {poi.description && !poi.editorialHook && (
              <p className="text-sm text-gray-500 leading-relaxed">
                {poi.description}
              </p>
            )}

            {/* Opening hours */}
            {openingHours?.openingHours && openingHours.openingHours.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <Clock className="w-3 h-3" />
                  Åpningstider
                </div>
                <div className="text-xs text-gray-500 space-y-0.5 pl-4.5">
                  {openingHours.openingHours.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Realtime data */}
            {hasRealtimeData && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                {/* Bus/transit departures */}
                {realtimeData.entur && realtimeData.entur.departures.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                      <Bus className="w-3 h-3" />
                      <span>Neste avganger</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {realtimeData.entur.departures.slice(0, 3).map((dep, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-gray-200"
                        >
                          <span className="font-medium">{dep.lineCode}</span>
                          <span className="text-gray-400">{dep.destination}</span>
                          <span className={dep.isRealtime ? "text-green-600" : "text-gray-600"}>
                            {formatDepartureTime(dep.departureTime)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bike share availability */}
                {realtimeData.bysykkel && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Bike className="w-3 h-3" />
                    <span>
                      {realtimeData.bysykkel.availableBikes} ledige sykler,{" "}
                      {realtimeData.bysykkel.availableDocks} ledige låser
                    </span>
                    {!realtimeData.bysykkel.isOpen && (
                      <span className="text-red-500 ml-1">(Stengt)</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <a
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
              >
                <Navigation className="w-3 h-3" />
                Vis rute
              </a>

              {poi.googleMapsUrl && (
                <a
                  href={poi.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Google Maps
                </a>
              )}

              {poi.address && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin className="w-3 h-3" />
                  {poi.address}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      </button>
    </div>
  );
}
