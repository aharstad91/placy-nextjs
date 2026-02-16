"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { POI, TravelMode } from "@/lib/types";
import type { OpeningHoursData } from "@/lib/hooks/useOpeningHours";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import {
  MapPin,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Footprints,
  Bike,
  Car,
  Bus,
  Navigation,
  Clock,
  Plus,
  Check,
  Route,
  BookOpen,
} from "lucide-react";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";
import { slugify } from "@/lib/utils/slugify";
import { isSafeUrl } from "@/lib/utils/url";

const travelModeIcons = {
  walk: Footprints,
  bike: Bike,
  car: Car,
};

interface ExplorerPOICardProps {
  poi: POI;
  isActive: boolean;
  onClick?: () => void;
  openingHours?: OpeningHoursData;
  travelTimesLoading?: boolean;
  travelMode?: TravelMode;
  isInCollection?: boolean;
  onToggleCollection?: (poiId: string) => void;
  areaSlug?: string | null;
  alwaysExpanded?: boolean;
  hideChevron?: boolean;
  className?: string;
}

export default function ExplorerPOICard({
  poi,
  isActive,
  onClick,
  openingHours,
  travelTimesLoading,
  travelMode = "walk",
  isInCollection,
  onToggleCollection,
  areaSlug,
  alwaysExpanded,
  hideChevron,
  className,
}: ExplorerPOICardProps) {
  const [imageError, setImageError] = useState(false);

  // Get category icon
  const getIcon = (iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  };

  const CategoryIcon = getIcon(poi.category.icon);

  const isExpanded = alwaysExpanded || isActive;

  const realtimeData = useRealtimeData(isExpanded ? poi : null);

  // Fetch trip cross-references when card is expanded
  const [tripRefs, setTripRefs] = useState<{ title: string; urlSlug: string }[]>([]);
  useEffect(() => {
    if (!isExpanded) return;
    let cancelled = false;
    fetch(`/api/poi-trips?poiId=${encodeURIComponent(poi.id)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setTripRefs(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isExpanded, poi.id]);

  const imageUrl = poi.featuredImage
    ? poi.featuredImage.includes("mymaps.usercontent.google.com")
      ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
      : poi.featuredImage
    : null;

  const hasImage = imageUrl && !imageError;
  const travelTime = poi.travelTime?.[travelMode];
  const TravelIcon = travelModeIcons[travelMode];
  const isOpen = openingHours?.isOpen;
  const hasRealtimeData = realtimeData.entur || realtimeData.bysykkel;

  // Public POI page URL (for SEO internal linking)
  const poiPageUrl = areaSlug ? `/${areaSlug}/steder/${slugify(poi.name)}` : null;

  // Google Maps directions URL
  const googleMapsDirectionsUrl = poi.googlePlaceId
    ? `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&destination_place_id=${poi.googlePlaceId}&travelmode=walking`
    : `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&travelmode=walking`;

  // Auto-link URLs in text
  const linkifyText = (text: string) => {
    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    if (parts.length === 1) return text;
    return parts.map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:text-sky-700 underline break-all"
          >
            {part.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

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

  // Expanded image + title section (shared between normal and alwaysExpanded modes)
  const expandedHeader = (
    <>
      {/* Compact image strip */}
      {hasImage && (
        <div className="w-full aspect-[21/9] overflow-hidden">
          <img
            src={imageUrl}
            alt={poi.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* Title row below image */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Category icon (when no image) or small badge */}
          <div
            className={cn(
              "flex-shrink-0 rounded-full flex items-center justify-center",
              hasImage ? "w-6 h-6 mt-0.5" : "w-9 h-9"
            )}
            style={{ backgroundColor: poi.category.color }}
          >
            <CategoryIcon className={cn("text-white", hasImage ? "w-3 h-3" : "w-4 h-4")} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{poi.name}</h3>
              {poi.editorialHook && (
                <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs font-medium" style={{ color: poi.category.color }}>
                {poi.category.name}
              </span>
              {shouldShowRating(poi.category.id) &&
                poi.googleRating != null &&
                poi.googleRating > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <GoogleRating
                      rating={poi.googleRating}
                      reviewCount={poi.googleReviewCount}
                      size="sm"
                    />
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
            </div>
          </div>

          {/* Save button + chevron (hidden in alwaysExpanded trip mode) */}
          {!alwaysExpanded && (
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
              {onToggleCollection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollection(poi.id);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium transition-colors",
                    isInCollection
                      ? "bg-sky-50 text-sky-600"
                      : "bg-gray-100 text-gray-500 hover:bg-sky-50 hover:text-sky-600"
                  )}
                >
                  {isInCollection ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Lagret</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Lagre</span>
                    </>
                  )}
                </button>
              )}
              {!hideChevron && <ChevronDown className="w-4 h-4 text-gray-500 rotate-180" />}
            </div>
          )}
        </div>
      </div>
    </>
  );

  // Expanded content (editorial, hours, realtime, actions, trip refs)
  const expandedContent = (
    <div className="px-4 pb-3">
      <div className="space-y-2.5">
        {/* Editorial hook */}
        {poi.editorialHook && (
          <div className="bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-100">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 leading-relaxed">{poi.editorialHook}</p>
            </div>
          </div>
        )}

        {/* Local insight */}
        {poi.localInsight && (
          <p className="text-sm text-gray-500 leading-relaxed">{linkifyText(poi.localInsight)}</p>
        )}

        {/* Description (fallback if no editorial) */}
        {poi.description && !poi.editorialHook && (
          <p className="text-sm text-gray-500 leading-relaxed">{linkifyText(poi.description)}</p>
        )}

        {/* Today's opening hours */}
        {openingHours?.openingHours &&
          openingHours.openingHours.length > 0 &&
          (() => {
            const days = [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ];
            const today = days[new Date().getDay()];
            const todayLine = openingHours.openingHours.find((line) =>
              line.toLowerCase().startsWith(today.toLowerCase())
            );
            const hours = todayLine ? todayLine.replace(/^[^:]+:\s*/, "") : null;

            return (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span>
                  I dag: {hours || "Ukjent"}
                  {openingHours.isOpen === true && (
                    <span className="text-emerald-600 font-medium ml-1">· Åpen nå</span>
                  )}
                  {openingHours.isOpen === false && (
                    <span className="text-gray-400 ml-1">· Stengt</span>
                  )}
                </span>
              </div>
            );
          })()}

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
        <div className="flex items-center gap-3 pt-1 flex-wrap">
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

          {poiPageUrl && (
            <Link
              href={poiPageUrl}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <BookOpen className="w-3 h-3" />
              Les mer
            </Link>
          )}

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

          {poi.facebookUrl && isSafeUrl(poi.facebookUrl) && (
            <a
              href={poi.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Facebook
            </a>
          )}

          {poi.address && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="w-3 h-3" />
              {poi.address}
            </span>
          )}
        </div>

        {/* Trip cross-reference badges */}
        {tripRefs.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {tripRefs.map((trip) => (
              <Link
                key={trip.urlSlug}
                href={`/trips/${trip.urlSlug}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <Route className="w-3 h-3" />
                Del av: {trip.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // === ALWAYS EXPANDED MODE (used by Trip) ===
  if (alwaysExpanded) {
    return (
      <div className={cn("w-full text-left", className)}>
        {expandedHeader}
        {expandedContent}
      </div>
    );
  }

  // === NORMAL MODE (used by Explorer) ===
  return (
    <div
      className={cn(
        "w-full text-left transition-all duration-300 ease-out",
        isExpanded ? "bg-gray-50" : "hover:bg-gray-50/50",
        className
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className="w-full text-left cursor-pointer"
      >
        {/* === COLLAPSED STATE === */}
        <div
          className={cn(
            "px-4 py-3 transition-all duration-300 ease-out",
            isExpanded ? "opacity-0 h-0 py-0 overflow-hidden" : "opacity-100"
          )}
        >
          <div className="flex items-start gap-3">
            {/* Thumbnail / Category icon */}
            <div
              className={cn(
                "flex-shrink-0 overflow-hidden",
                hasImage ? "w-12 h-12 rounded-xl" : "w-9 h-9 rounded-full mt-0.5"
              )}
              style={!hasImage ? { backgroundColor: poi.category.color } : undefined}
            >
              {hasImage ? (
                <img
                  src={imageUrl}
                  alt={poi.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <CategoryIcon className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{poi.name}</h3>
                {poi.editorialHook && (
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs font-medium" style={{ color: poi.category.color }}>
                  {poi.category.name}
                </span>
                {shouldShowRating(poi.category.id) &&
                  poi.googleRating != null &&
                  poi.googleRating > 0 && (
                    <>
                      <span className="text-gray-300">·</span>
                      <GoogleRating
                        rating={poi.googleRating}
                        reviewCount={poi.googleReviewCount}
                        size="sm"
                      />
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
                    <span className="text-xs font-medium text-emerald-600">Åpen</span>
                  </>
                )}
                {isOpen === false && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">Stengt</span>
                  </>
                )}
              </div>
            </div>

            {/* Save button + chevron */}
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
              {onToggleCollection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollection(poi.id);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium transition-colors",
                    isInCollection
                      ? "bg-sky-50 text-sky-600"
                      : "bg-gray-100 text-gray-500 hover:bg-sky-50 hover:text-sky-600"
                  )}
                >
                  {isInCollection ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Lagret</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Lagre</span>
                    </>
                  )}
                </button>
              )}
              {!hideChevron && <ChevronDown className="w-4 h-4 text-gray-300" />}
            </div>
          </div>
        </div>

        {/* === EXPANDED STATE === */}
        <div
          className={cn(
            "transition-all duration-300 ease-out",
            isExpanded ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
          )}
        >
          {expandedHeader}
        </div>
      </div>

      {/* Expanded content — outside clickable area so links work */}
      {isExpanded && expandedContent}
    </div>
  );
}
