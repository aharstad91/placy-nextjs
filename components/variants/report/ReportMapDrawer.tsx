"use client";

import { useState, useEffect, useMemo } from "react";
import type { POI } from "@/lib/types";
import { getIcon } from "@/lib/utils/map-icons";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";
import { TierBadge } from "@/components/ui/TierBadge";
import { slugify } from "@/lib/utils/slugify";
import { computeIsOpen } from "@/lib/hooks/useOpeningHours";
import {
  X,
  Sparkles,
  Clock,
  Navigation,
  ExternalLink,
  MapPin,
  BookOpen,
  Bus,
  Bike,
  Car,
  ShoppingBag,
} from "lucide-react";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { isSafeUrl } from "@/lib/utils/url";
import { formatRelativeDepartureTime } from "@/lib/utils/format-time";

interface ReportMapDrawerProps {
  poi: POI;
  onClose: () => void;
  areaSlug?: string | null;
}

export default function ReportMapDrawer({ poi, onClose, areaSlug }: ReportMapDrawerProps) {
  const [imageError, setImageError] = useState(false);
  const [visible, setVisible] = useState(false);
  const isTransportPOI = !!(poi.enturStopplaceId || poi.bysykkelStationId || poi.hyreStationId);
  const realtimeData = useRealtimeData(isTransportPOI ? poi : null);

  // Reset and re-animate when POI changes
  useEffect(() => {
    setVisible(false);
    setImageError(false);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [poi.id]);

  const CategoryIcon = getIcon(poi.category.icon);

  const imageUrl = poi.featuredImage
    ? poi.featuredImage.includes("mymaps.usercontent.google.com")
      ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
      : poi.featuredImage
    : null;

  const hasImage = imageUrl && !imageError;
  const walkMinutes = poi.travelTime?.walk
    ? Math.round(poi.travelTime.walk / 60)
    : null;

  const googleMapsDirectionsUrl = poi.googlePlaceId
    ? `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&destination_place_id=${poi.googlePlaceId}&travelmode=walking`
    : `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&travelmode=walking`;

  const poiPageUrl = areaSlug ? `/${areaSlug}/steder/${slugify(poi.name)}` : null;

  const { todayHours, isOpen } = useMemo(() => {
    const weekdayText = poi.openingHoursJson?.weekday_text;
    if (!weekdayText?.length) return { todayHours: null, isOpen: undefined };

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()];
    const todayLine = weekdayText.find((line) =>
      line.toLowerCase().startsWith(today.toLowerCase())
    );
    const hours = todayLine ? todayLine.replace(/^[^:]+:\s*/, "") : null;

    return { todayHours: hours, isOpen: computeIsOpen(weekdayText) };
  }, [poi.openingHoursJson]);

  return (
    <>
      {/* Desktop: Left sidebar drawer */}
      <div
        className={`hidden md:flex absolute left-0 top-0 h-full z-20 transition-transform duration-300 ease-out ${
          visible ? "translate-x-0" : "-translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[320px] h-full bg-white/95 backdrop-blur-sm border-r border-[#eae6e1] overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-gray-50 shadow-sm border border-gray-200 transition-colors"
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
          <div className="px-4 py-4 space-y-3">
            {/* Name + category + rating */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <CategoryIcon className="w-4 h-4" style={{ color: poi.category.color }} />
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {poi.name}
                </h3>
                <TierBadge poiTier={poi.poiTier} isLocalGem={poi.isLocalGem} variant="inline" />
              </div>
              <div className="flex items-center gap-2 text-xs">
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
                  <p className="text-xs text-amber-900 leading-relaxed">
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

            {/* Description (fallback) */}
            {poi.description && !poi.editorialHook && !poi.localInsight && (
              <p className="text-sm text-gray-500 leading-relaxed">
                {poi.description}
              </p>
            )}

            {/* Anchor summary for parent POIs (e.g., shopping centers) */}
            {poi.anchorSummary && (
              <p className="text-sm text-gray-500 leading-relaxed">{poi.anchorSummary}</p>
            )}

            {/* Child POIs (e.g., stores inside a shopping center) */}
            {poi.childPOIs && poi.childPOIs.length > 0 && (
              <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                  <ShoppingBag className="w-3 h-3" />
                  <span>Butikker i senteret</span>
                </div>
                <div className="space-y-1.5">
                  {poi.childPOIs.map((child) => {
                    const ChildIcon = getIcon(child.category.icon);
                    return (
                      <div key={child.id} className="flex items-center gap-2 text-xs">
                        <ChildIcon className="w-3 h-3" style={{ color: child.category.color }} />
                        <span className="text-gray-700 flex-1 truncate">{child.name}</span>
                        <span className="text-gray-400">{child.category.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Website + Google AI links for parent POIs */}
            {poi.childPOIs && poi.childPOIs.length > 0 && (
              <div className="flex items-center gap-3">
                {poi.googleWebsite && isSafeUrl(poi.googleWebsite) && (
                  <a
                    href={poi.googleWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Nettside
                  </a>
                )}
                <a
                  href={`https://www.google.com/search?udm=50&q=${encodeURIComponent(poi.name + " butikker åpningstider")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Utforsk
                </a>
              </div>
            )}

            {/* Realtime transport data */}
            {isTransportPOI && realtimeData.lastUpdated && (
              <RealtimeSection realtimeData={realtimeData} poi={poi} />
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
            <div className="flex items-center gap-3 pt-1">
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
      </div>

      {/* Mobile: Bottom drawer */}
      <div
        className={`md:hidden absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white border-t border-[#eae6e1] rounded-t-xl max-h-[50vh] overflow-y-auto shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-8 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-2 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-gray-50 shadow-sm border border-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>

          {/* Content — compact for mobile */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <CategoryIcon className="w-4 h-4" style={{ color: poi.category.color }} />
              <h3 className="text-sm font-semibold text-gray-900 truncate">{poi.name}</h3>
              <TierBadge poiTier={poi.poiTier} isLocalGem={poi.isLocalGem} variant="inline" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium" style={{ color: poi.category.color }}>{poi.category.name}</span>
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
                    <MapPin className="w-3 h-3" />{walkMinutes} min
                  </span>
                </>
              )}
            </div>
            {poi.editorialHook && (
              <p className="text-xs text-gray-600 leading-relaxed">{poi.editorialHook}</p>
            )}
            {poi.anchorSummary && (
              <p className="text-xs text-gray-500 leading-relaxed">{poi.anchorSummary}</p>
            )}
            {poi.childPOIs && poi.childPOIs.length > 0 && (
              <div className="space-y-1">
                {poi.childPOIs.map((child) => {
                  const ChildIcon = getIcon(child.category.icon);
                  return (
                    <div key={child.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <ChildIcon className="w-3 h-3" style={{ color: child.category.color }} />
                      <span className="truncate">{child.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Realtime transport data — mobile */}
            {isTransportPOI && realtimeData.lastUpdated && (
              <RealtimeSection realtimeData={realtimeData} poi={poi} />
            )}
            <div className="flex items-center gap-3">
              <a
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700"
              >
                <Navigation className="w-3 h-3" />
                Vis rute
              </a>
              {poi.googleMapsUrl && (
                <a
                  href={poi.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-500"
                >
                  <ExternalLink className="w-3 h-3" />
                  Google Maps
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// --- Realtime data section for transport POIs ---

function RealtimeSection({
  realtimeData,
  poi,
}: {
  realtimeData: ReturnType<typeof useRealtimeData>;
  poi: POI;
}) {
  const hasEntur = realtimeData.entur && realtimeData.entur.departures.length > 0;
  const hasBysykkel = !!realtimeData.bysykkel;
  const hasHyre = !!realtimeData.hyre;

  if (!hasEntur && !hasBysykkel && !hasHyre) return null;

  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100 space-y-2">
      {/* Entur departures */}
      {hasEntur && (
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
            <Bus className="w-3 h-3" />
            <span>Neste avganger</span>
          </div>
          <div className="space-y-1">
            {realtimeData.entur!.departures.slice(0, 3).map((dep, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    dep.isRealtime ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <span className="font-semibold min-w-[2rem]" style={dep.lineColor ? { color: dep.lineColor } : undefined}>
                  {dep.lineCode}
                </span>
                <span className="text-gray-500 flex-1 truncate">{dep.destination}</span>
                <span className="text-gray-600 shrink-0">
                  {formatRelativeDepartureTime(dep.departureTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bysykkel */}
      {hasBysykkel && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Bike className="w-3 h-3 text-blue-500" />
          <span>
            {realtimeData.bysykkel!.availableBikes} ledige sykler &middot;{" "}
            {realtimeData.bysykkel!.availableDocks} ledige låser
          </span>
          {!realtimeData.bysykkel!.isOpen && (
            <span className="text-red-500 ml-1">(Stengt)</span>
          )}
        </div>
      )}

      {/* Hyre */}
      {hasHyre && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Car className="w-3 h-3 text-emerald-500" />
          <span>{realtimeData.hyre!.numVehiclesAvailable} biler ledige</span>
        </div>
      )}
    </div>
  );
}
