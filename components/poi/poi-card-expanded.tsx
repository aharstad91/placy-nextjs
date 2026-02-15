"use client";

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
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Globe,
  Phone,
} from "lucide-react";
import { useState } from "react";
import type { POI, TravelMode } from "@/lib/types";
import { cn, formatTravelTime } from "@/lib/utils";
import { useTravelSettings } from "@/lib/store";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";

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

interface POICardExpandedProps {
  poi: POI;
  travelMode: TravelMode;
  isActive?: boolean;
  onShowOnMap?: () => void;
  className?: string;
}

export function POICardExpanded({
  poi,
  travelMode,
  isActive,
  onShowOnMap,
  className,
}: POICardExpandedProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { timeBudget } = useTravelSettings();
  const realtimeData = useRealtimeData(poi);
  // Use cached data from Supabase instead of runtime Google API calls
  const placeDetails = {
    website: poi.googleWebsite,
    phone: poi.googlePhone,
  };

  const IconComponent = iconMap[poi.category.icon] || MapPin;
  const TravelIcon = travelModeIcons[travelMode];
  const travelTime = poi.travelTime?.[travelMode];

  const isOutsideBudget = travelTime !== undefined && travelTime > timeBudget;
  const hasExpandedContent = poi.editorialHook || poi.localInsight || poi.description;
  const hasRealtimeData = realtimeData.entur || realtimeData.bysykkel;

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
        "bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200",
        isActive && "ring-2 ring-primary-500 ring-offset-2",
        isOutsideBudget && "opacity-50",
        className
      )}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Ikon */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: poi.category.color }}
        >
          <IconComponent className="w-6 h-6 text-white" />
        </div>

        {/* Innhold */}
        <div className="flex-1 min-w-0">
          {/* Navn */}
          <h4 className="font-semibold text-gray-900 text-base leading-tight mb-1">
            {poi.name}
          </h4>

          {/* Reisetid */}
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
            <TravelIcon className="w-4 h-4" />
            <span>{formatTravelTime(travelTime)}</span>
          </div>

          {/* Beskrivelse (hvis kort nok) */}
          {poi.description && !poi.editorialHook && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">{poi.description}</p>
          )}
        </div>

        {/* Se på kart-knapp */}
        <button
          onClick={onShowOnMap}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex-shrink-0"
        >
          <MapPinned className="w-4 h-4" />
          Se på kart
        </button>
      </div>

      {/* Sanntidsdata */}
      {hasRealtimeData && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
          {/* Buss/kollektiv avganger */}
          {realtimeData.entur && realtimeData.entur.departures.length > 0 && (
            <div className="mb-2">
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

          {/* Bysykkel tilgjengelighet */}
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

      {/* Utvidet innhold */}
      {hasExpandedContent && (
        <>
          {/* Expand toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-1 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Skjul detaljer
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Vis detaljer
              </>
            )}
          </button>

          {/* Expanded content */}
          {isExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {/* Editorial hook */}
              {poi.editorialHook && (
                <div>
                  <p className="text-sm text-gray-700 italic">&ldquo;{poi.editorialHook}&rdquo;</p>
                </div>
              )}

              {/* Local insight */}
              {poi.localInsight && (
                <div className="bg-primary-50 rounded-lg p-3">
                  <p className="text-sm text-primary-800">
                    <span className="font-medium">💡 Lokaltips:</span> {poi.localInsight}
                  </p>
                </div>
              )}

              {/* Google rating */}
              {poi.googleRating && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{poi.googleRating}</span>
                  {poi.googleReviewCount && (
                    <span className="text-gray-400">({poi.googleReviewCount} anmeldelser)</span>
                  )}
                </div>
              )}

              {/* Website link */}
              {placeDetails?.website && (
                <a
                  href={placeDetails.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  Besøk nettside
                </a>
              )}

              {/* Phone number */}
              {placeDetails?.phone && (
                <a
                  href={`tel:${placeDetails.phone}`}
                  className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-primary-600"
                >
                  <Phone className="w-4 h-4" />
                  {placeDetails.phone}
                </a>
              )}

              {/* Google Maps link */}
              {poi.googleMapsUrl && (
                <a
                  href={poi.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                >
                  Åpne i Google Maps
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
