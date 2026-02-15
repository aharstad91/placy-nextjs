"use client";

import { useState, useEffect, useMemo } from "react";
import type { POI } from "@/lib/types";
import { getIcon } from "@/lib/utils/map-icons";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";
import { TierBadge } from "@/components/ui/TierBadge";
import { slugify } from "@/lib/utils/slugify";
import {
  X,
  Sparkles,
  Clock,
  Navigation,
  ExternalLink,
  MapPin,
  BookOpen,
} from "lucide-react";

interface MapPopupCardProps {
  poi: POI;
  onClose: () => void;
  areaSlug?: string | null;
}

export default function MapPopupCard({ poi, onClose, areaSlug }: MapPopupCardProps) {
  const [imageError, setImageError] = useState(false);

  // Reset image error when POI changes
  useEffect(() => {
    setImageError(false);
  }, [poi.id]);

  const CategoryIcon = getIcon(poi.category.icon);

  const imageUrl = poi.featuredImage
    ? poi.featuredImage.includes("mymaps.usercontent.google.com")
      ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
      : poi.featuredImage
    : poi.photoReference
    ? `/api/places/photo?photoReference=${poi.photoReference}&maxWidth=400`
    : null;

  const hasImage = imageUrl && !imageError;
  const walkMinutes = poi.travelTime?.walk
    ? Math.round(poi.travelTime.walk / 60)
    : null;

  const googleMapsDirectionsUrl = poi.googlePlaceId
    ? `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&destination_place_id=${poi.googlePlaceId}&travelmode=walking`
    : `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&travelmode=walking`;

  const poiPageUrl = areaSlug ? `/${areaSlug}/steder/${slugify(poi.name)}` : null;

  // Opening hours from cached data (no API call)
  const { todayHours, isOpen } = useMemo(() => {
    const weekdayText = poi.openingHoursJson?.weekday_text;
    if (!weekdayText?.length) return { todayHours: null, isOpen: undefined };

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()];
    const todayLine = weekdayText.find((line) =>
      line.toLowerCase().startsWith(today.toLowerCase())
    );
    const hours = todayLine ? todayLine.replace(/^[^:]+:\s*/, "") : null;

    // Compute isOpen from time range
    let open: boolean | undefined;
    if (hours) {
      const lower = hours.toLowerCase();
      if (lower.includes("closed")) open = false;
      else if (lower.includes("open 24 hours")) open = true;
      else {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const match = hours.match(
          /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
        );
        if (match) {
          const toMin = (h: number, m: number, ap: string) => {
            let hr = h;
            if (ap === "PM" && hr !== 12) hr += 12;
            if (ap === "AM" && hr === 12) hr = 0;
            return hr * 60 + m;
          };
          const openMin = toMin(parseInt(match[1]), parseInt(match[2]), match[3].toUpperCase());
          const closeMin = toMin(parseInt(match[4]), parseInt(match[5]), match[6].toUpperCase());
          if (closeMin <= openMin) {
            open = currentMinutes >= openMin || currentMinutes < closeMin;
          } else {
            open = currentMinutes >= openMin && currentMinutes < closeMin;
          }
        }
      }
    }

    return { todayHours: hours, isOpen: open };
  }, [poi.openingHoursJson]);

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-30 animate-fade-in"
      style={{ pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-[300px] overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow-sm border border-gray-200 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-gray-600" />
        </button>

        {/* Featured image */}
        {hasImage && (
          <div className="w-full aspect-[16/9] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={poi.name}
              className="w-full h-full object-cover"
              loading="eager"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {/* Content */}
        <div className="px-3.5 py-3 space-y-2">
          {/* Name + category + rating */}
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {poi.name}
              </h3>
              <TierBadge poiTier={poi.poiTier} isLocalGem={poi.isLocalGem} variant="inline" />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium" style={{ color: poi.category.color }}>
                {poi.category.name}
              </span>
              {shouldShowRating(poi.category.id) && poi.googleRating != null && poi.googleRating > 0 && (
                <>
                  <span className="text-gray-300">&middot;</span>
                  <GoogleRating rating={poi.googleRating} reviewCount={poi.googleReviewCount} size="sm" />
                </>
              )}
              {walkMinutes != null && (
                <>
                  <span className="text-gray-300">&middot;</span>
                  <span className="flex items-center gap-0.5 text-gray-500">
                    <MapPin className="w-3 h-3" />
                    {walkMinutes} min
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Editorial hook */}
          {poi.editorialHook && (
            <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
              <div className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 leading-relaxed line-clamp-4">
                  {poi.editorialHook}
                </p>
              </div>
            </div>
          )}

          {/* Local insight */}
          {poi.localInsight && (
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
              {poi.localInsight}
            </p>
          )}

          {/* Description (fallback) */}
          {poi.description && !poi.editorialHook && !poi.localInsight && (
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
              {poi.description}
            </p>
          )}

          {/* Opening hours */}
          {todayHours && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>
                I dag: {todayHours}
                {isOpen === true && (
                  <span className="text-emerald-600 font-medium ml-1">&middot; Åpen nå</span>
                )}
                {isOpen === false && (
                  <span className="text-gray-400 ml-1">&middot; Stengt</span>
                )}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-0.5">
            <a
              href={googleMapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
            >
              <Navigation className="w-3 h-3" />
              Vis rute
            </a>

            {poiPageUrl && (
              <a
                href={poiPageUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                Les mer
              </a>
            )}

            {poi.googleMapsUrl && (
              <a
                href={poi.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Google Maps
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Arrow pointing down */}
      <div className="w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45 mx-auto -mt-2" />
    </div>
  );
}
