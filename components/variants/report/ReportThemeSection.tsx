"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme, ReportSubSection } from "./report-data";
import { TRANSPORT_CATEGORIES } from "./report-data";
import { useLocale } from "@/lib/i18n/locale-context";
import { t, type Locale } from "@/lib/i18n/strings";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import {
  Star,
  ChevronDown,
  MapPin,
  Sparkles,
  Loader2,
  Navigation,
  ExternalLink,
  Bus,
  Bike,
  Clock,
} from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";
import ReportInteractiveMapSection from "./ReportInteractiveMapSection";
import ReportAddressInput from "./ReportAddressInput";
import ReportPOICard from "./ReportPOICard";
import { TierBadge } from "@/components/ui/TierBadge";

interface ReportThemeSectionProps {
  theme: ReportTheme;
  center: Coordinates;
  explorerBaseUrl?: string | null;
  projectName?: string;
  /** Callback ref to register this section for IntersectionObserver tracking */
  registerRef?: (el: HTMLElement | null) => void;
  /** When true, hides the per-section inline map (desktop sticky map is shown instead) */
  useStickyMap?: boolean;
  /** Active POI ID from the page-level sticky map */
  activePOIId?: string | null;
  /** Callback when a POI card is clicked (for sticky map sync) */
  onPOIClick?: (poiId: string) => void;
  /** Whether this theme is expanded (showing all POIs) */
  isExpanded?: boolean;
  /** Callback when theme is expanded via "Vis meg mer" */
  onExpand?: (themeId: string) => void;
  /** Register sub-section elements for scroll tracking (composite key: themeId:categoryId) */
  registerSubSectionRef?: (compositeId: string) => (el: HTMLElement | null) => void;
  /** Set of expanded composite keys (themeId:categoryId) */
  expandedKeys?: Set<string>;
  /** Expand callback for composite key */
  onExpandKey?: (compositeKey: string) => void;
}

/** Derive numeric locale string from app locale */
function getNumericLocale(locale: string): string {
  return locale === "en" ? "en-US" : "nb-NO";
}

/** Shared load-more state machine for theme sections and sub-sections */
function useLoadMore(isExpanded: boolean, onExpand: () => void) {
  const [loadState, setLoadState] = useState<"idle" | "loading" | "done">(
    isExpanded ? "done" : "idle"
  );

  const handleLoadMore = useCallback(() => {
    setLoadState("loading");
    setTimeout(() => {
      setLoadState("done");
      setTimeout(() => onExpand(), 1000);
    }, 2000);
  }, [onExpand]);

  const showAll = loadState === "done" || isExpanded;
  return { loadState, handleLoadMore, showAll } as const;
}

export default function ReportThemeSection({
  theme,
  center,
  explorerBaseUrl,
  projectName,
  registerRef,
  useStickyMap,
  activePOIId,
  onPOIClick,
  isExpanded,
  onExpand,
  registerSubSectionRef,
  expandedKeys,
  onExpandKey,
}: ReportThemeSectionProps) {
  const { locale } = useLocale();
  const Icon = getIcon(theme.icon);
  const numLocale = getNumericLocale(locale);
  const isTransport = theme.allPOIs.some((poi) =>
    TRANSPORT_CATEGORIES.has(poi.category.id)
  );

  return (
    <section
      id={theme.id}
      ref={registerRef}
      className="py-12 md:py-16 scroll-mt-20"
    >
      {/* Section header */}
      <div className="max-w-4xl">
        {/* Section heading */}
        <div className="flex items-center gap-3 mb-4">
          <Icon className="w-6 h-6 text-[#7a7062]" />
          <h2 className="text-2xl md:text-3xl font-semibold text-[#1a1a1a]">
            {theme.name}
          </h2>
        </div>

        {/* Category quote */}
        <p className="text-xl md:text-2xl text-[#4a4a4a] leading-relaxed mb-5">
          {theme.quote}
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-[#6a6a6a] mb-8">
          <span>
            {theme.stats.totalPOIs} {t(locale, "places")}
          </span>
          {theme.stats.avgRating != null && (
            <>
              <span className="text-[#d4cfc8]">|</span>
              <span className="flex items-center gap-1">
                {t(locale, "avg")}{" "}
                <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
                <span className="font-medium text-[#1a1a1a]">
                  {theme.stats.avgRating.toFixed(1)}
                </span>
              </span>
            </>
          )}
          {theme.stats.totalReviews > 0 && (
            <>
              <span className="text-[#d4cfc8]">|</span>
              <span>
                {theme.stats.totalReviews.toLocaleString(numLocale)}{" "}
                {t(locale, "reviews")}
              </span>
            </>
          )}
        </div>

        {/* Theme intro */}
        {theme.intro && (
          <p className="text-lg text-[#4a4a4a] leading-relaxed mb-8">
            {theme.intro}
          </p>
        )}

        {/* Bridge text */}
        {theme.bridgeText && (
          <p className="text-lg italic text-[#5a5a5a] leading-relaxed mb-8">
            {theme.bridgeText}
          </p>
        )}

        {/* Address input for transport theme */}
        {isTransport && projectName && (
          <div className="mb-6">
            <ReportAddressInput
              propertyCoordinates={[center.lng, center.lat]}
              propertyName={projectName}
            />
          </div>
        )}
      </div>

      {/* POI content — different rendering for sticky map vs inline map */}
      {useStickyMap ? (
        <StickyMapContent
          theme={theme}
          activePOIId={activePOIId ?? null}
          onPOIClick={onPOIClick}
          isExpanded={isExpanded ?? false}
          onExpand={() => onExpand?.(theme.id)}
          registerSubSectionRef={registerSubSectionRef}
          expandedKeys={expandedKeys}
          onExpandKey={onExpandKey}
        />
      ) : (
        <ReportInteractiveMapSection
          theme={theme}
          center={center}
          sectionId={theme.id}
          explorerBaseUrl={explorerBaseUrl}
        />
      )}
    </section>
  );
}

/** POI content rendered when the page-level sticky map is active (desktop) */
function StickyMapContent({
  theme,
  activePOIId,
  onPOIClick,
  isExpanded,
  onExpand,
  registerSubSectionRef,
  expandedKeys,
  onExpandKey,
}: {
  theme: ReportTheme;
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
  isExpanded: boolean;
  onExpand: () => void;
  /** Register a sub-section element for scroll tracking */
  registerSubSectionRef?: (compositeId: string) => (el: HTMLElement | null) => void;
  /** Set of expanded composite keys (themeId:categoryId) */
  expandedKeys?: Set<string>;
  /** Expand callback for composite key */
  onExpandKey?: (compositeKey: string) => void;
}) {
  const { locale } = useLocale();
  const numLocale = getNumericLocale(locale);

  // If theme has sub-sections, render them instead of flat list
  if (theme.subSections && theme.subSections.length > 0) {
    // Collect POI IDs that belong to sub-sections
    const subSectionPoiIds = new Set<string>();
    for (const sub of theme.subSections) {
      for (const poi of sub.allPOIs) subSectionPoiIds.add(poi.id);
    }

    // Remaining POIs: those not in any sub-section
    const remainingPOIs = theme.allPOIs.filter(
      (p) => !subSectionPoiIds.has(p.id)
    );

    return (
      <div className="mt-4 space-y-8">
        {theme.subSections.map((sub) => {
          const compositeKey = `${theme.id}:${sub.categoryId}`;
          const subIsExpanded = expandedKeys?.has(compositeKey) ?? false;

          return (
            <SubSectionContent
              key={sub.categoryId}
              sub={sub}
              compositeKey={compositeKey}
              activePOIId={activePOIId}
              onPOIClick={onPOIClick}
              isExpanded={subIsExpanded}
              onExpand={() => onExpandKey?.(compositeKey)}
              registerRef={registerSubSectionRef}
              locale={locale}
              numLocale={numLocale}
            />
          );
        })}

        {/* Remaining POIs (categories under threshold) — flat list */}
        {remainingPOIs.length > 0 && (
          <div>
            <CompactPOIList
              pois={remainingPOIs}
              activePOIId={activePOIId}
              onPOIClick={onPOIClick}
            />
          </div>
        )}
      </div>
    );
  }

  // No sub-sections — render as before
  return (
    <FlatThemeContent
      theme={theme}
      activePOIId={activePOIId}
      onPOIClick={onPOIClick}
      isExpanded={isExpanded}
      onExpand={onExpand}
    />
  );
}

/** Original flat rendering (no sub-sections) */
function FlatThemeContent({
  theme,
  activePOIId,
  onPOIClick,
  isExpanded,
  onExpand,
}: {
  theme: ReportTheme;
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
  isExpanded: boolean;
  onExpand: () => void;
}) {
  const { locale } = useLocale();
  const hasHidden = theme.hiddenPOIs.length > 0;
  const { loadState, handleLoadMore, showAll } = useLoadMore(isExpanded, onExpand);

  const visiblePois = showAll
    ? [...theme.listPOIs, ...theme.hiddenPOIs]
    : theme.listPOIs;

  return (
    <div className="mt-4 space-y-4">
      {theme.displayMode === "editorial" && theme.highlightPOIs.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[#d4cfc8]">
          {theme.highlightPOIs.map((poi) => (
            <div
              key={poi.id}
              data-poi-id={poi.id}
              className="flex-shrink-0 w-[180px] snap-start"
            >
              <ReportPOICard
                poi={poi}
                isActive={activePOIId === poi.id}
                onClick={() => onPOIClick?.(poi.id)}
              />
            </div>
          ))}
        </div>
      )}

      {visiblePois.length > 0 && (
        <CompactPOIList
          pois={visiblePois}
          activePOIId={activePOIId}
          onPOIClick={onPOIClick}
        />
      )}

      {hasHidden && loadState !== "done" && !isExpanded && (
        <LoadMoreButton
          onClick={handleLoadMore}
          isLoading={loadState === "loading"}
          locale={locale}
          hiddenCount={theme.hiddenPOIs.length}
        />
      )}
    </div>
  );
}

/** Single sub-section with its own header, highlight cards, list, and load-more */
function SubSectionContent({
  sub,
  compositeKey,
  activePOIId,
  onPOIClick,
  isExpanded,
  onExpand,
  registerRef,
  locale,
  numLocale,
}: {
  sub: ReportSubSection;
  compositeKey: string;
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
  isExpanded: boolean;
  onExpand: () => void;
  registerRef?: (compositeId: string) => (el: HTMLElement | null) => void;
  locale: Locale;
  numLocale: string;
}) {
  const Icon = getIcon(sub.icon);
  const hasHidden = sub.hiddenPOIs.length > 0;
  const { loadState, handleLoadMore, showAll } = useLoadMore(isExpanded, onExpand);

  const visiblePois = showAll
    ? [...sub.listPOIs, ...sub.hiddenPOIs]
    : sub.listPOIs;

  return (
    <div
      id={compositeKey}
      ref={registerRef?.(compositeKey)}
      className="scroll-mt-20"
    >
      {/* Sub-section header */}
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full"
          style={{ backgroundColor: sub.color }}
        >
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-[#1a1a1a]">{sub.name}</h3>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6a6a6a] mb-2">
        <span>
          {sub.stats.totalPOIs} {t(locale, "places")}
        </span>
        {sub.stats.avgRating != null && (
          <>
            <span className="text-[#d4cfc8]">|</span>
            <span className="flex items-center gap-1">
              {t(locale, "avg")}{" "}
              <Star className="w-3 h-3 text-[#b45309] fill-[#b45309]" />
              <span className="font-medium text-[#1a1a1a]">
                {sub.stats.avgRating.toFixed(1)}
              </span>
            </span>
          </>
        )}
        {sub.stats.totalReviews > 0 && (
          <>
            <span className="text-[#d4cfc8]">|</span>
            <span>
              {sub.stats.totalReviews.toLocaleString(numLocale)}{" "}
              {t(locale, "reviews")}
            </span>
          </>
        )}
      </div>

      {/* Quote */}
      <p className="text-base text-[#4a4a4a] leading-relaxed mb-4">
        {sub.quote}
      </p>

      {/* Highlight photo cards */}
      {sub.displayMode === "editorial" && sub.highlightPOIs.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[#d4cfc8] mb-3">
          {sub.highlightPOIs.map((poi) => (
            <div
              key={poi.id}
              data-poi-id={poi.id}
              className="flex-shrink-0 w-[180px] snap-start"
            >
              <ReportPOICard
                poi={poi}
                isActive={activePOIId === poi.id}
                onClick={() => onPOIClick?.(poi.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Compact card grid */}
      {visiblePois.length > 0 && (
        <CompactPOIList
          pois={visiblePois}
          activePOIId={activePOIId}
          onPOIClick={onPOIClick}
        />
      )}

      {/* Load more */}
      {hasHidden && loadState !== "done" && !isExpanded && (
        <LoadMoreButton
          onClick={handleLoadMore}
          isLoading={loadState === "loading"}
          locale={locale}
          hiddenCount={sub.hiddenPOIs.length}
        />
      )}
    </div>
  );
}

/** Explorer-style POI card list — two independent columns so accordion only affects its own column */
function CompactPOIList({
  pois,
  activePOIId,
  onPOIClick,
}: {
  pois: POI[];
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
}) {
  // Split into two independent columns (interleaved: 0,2,4… left — 1,3,5… right)
  const leftPois = pois.filter((_, i) => i % 2 === 0);
  const rightPois = pois.filter((_, i) => i % 2 === 1);

  const renderColumn = (columnPois: POI[]) => (
    <div className="flex-1 flex flex-col gap-2.5">
      {columnPois.map((poi) => (
        <ReportPOIRow
          key={poi.id}
          poi={poi}
          isActive={activePOIId === poi.id}
          isExpanded={activePOIId === poi.id}
          onClick={() => onPOIClick?.(poi.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex items-start gap-2.5">
      {renderColumn(leftPois)}
      {renderColumn(rightPois)}
    </div>
  );
}

/** Single POI card with accordion expand — stays in its grid column */
function ReportPOIRow({
  poi,
  isActive,
  isExpanded,
  onClick,
}: {
  poi: POI;
  isActive: boolean;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [openingHours, setOpeningHours] = useState<{
    isOpen?: boolean;
    openingHours?: string[];
  } | null>(null);
  const [hoursLoading, setHoursLoading] = useState(false);
  const CategoryIcon = getIcon(poi.category.icon);

  // Fetch realtime data only when expanded
  const realtimeData = useRealtimeData(isExpanded ? poi : null);
  const hasRealtimeData = realtimeData.entur || realtimeData.bysykkel;

  // Fetch opening hours on expand
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!isExpanded || !poi.googlePlaceId || fetchedRef.current) return;
    fetchedRef.current = true;
    setHoursLoading(true);
    fetch(`/api/places/${poi.googlePlaceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setOpeningHours({ isOpen: data.isOpen, openingHours: data.openingHours });
      })
      .catch(() => {})
      .finally(() => setHoursLoading(false));
  }, [isExpanded, poi.googlePlaceId]);

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

  return (
    <div
      data-poi-id={poi.id}
      className={`w-full text-left rounded-xl border overflow-hidden transition-all ${
        isActive
          ? "bg-[#f0ede8] border-[#d4cfc8] ring-1 ring-[#d4cfc8]"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
      }`}
    >
      {/* Clickable header row */}
      <button
        onClick={onClick}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3 px-3 py-3">
          {/* Thumbnail / Category icon */}
          <div
            className={`flex-shrink-0 overflow-hidden ${
              hasImage ? "w-12 h-12 rounded-xl" : "w-9 h-9 rounded-full mt-0.5"
            }`}
            style={!hasImage ? { backgroundColor: poi.category.color } : undefined}
          >
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={poi.name}
                className="w-full h-full object-cover"
                loading="lazy"
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
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {poi.name}
              </h3>
              <TierBadge poiTier={poi.poiTier} isLocalGem={poi.isLocalGem} variant="inline" />
              {poi.editorialHook && (
                <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
              <span className="text-xs font-medium flex-shrink-0" style={{ color: poi.category.color }}>
                {poi.category.name}
              </span>
              {shouldShowRating(poi.category.id) && poi.googleRating != null && poi.googleRating > 0 && (
                <>
                  <span className="text-gray-300 flex-shrink-0">·</span>
                  <GoogleRating rating={poi.googleRating} reviewCount={poi.googleReviewCount} size="sm" />
                </>
              )}
              {walkMinutes != null && (
                <>
                  <span className="text-gray-300 flex-shrink-0">·</span>
                  <span className="flex items-center gap-0.5 text-xs text-gray-500 flex-shrink-0">
                    <MapPin className="w-3 h-3" />
                    {walkMinutes} min
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Chevron indicator */}
          <ChevronDown
            className={`w-4 h-4 text-gray-300 flex-shrink-0 mt-1.5 transition-transform duration-200 ${
              isExpanded ? "rotate-180 text-gray-500" : ""
            }`}
          />
        </div>
      </button>

      {/* Accordion expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2.5">
          {/* Expanded image */}
          {hasImage && (
            <div className="w-full aspect-[16/9] rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
              {linkifyText(poi.localInsight)}
            </p>
          )}

          {/* Description (fallback if no editorial) */}
          {poi.description && !poi.editorialHook && (
            <p className="text-sm text-gray-500 leading-relaxed">
              {linkifyText(poi.description)}
            </p>
          )}

          {/* Today's opening hours */}
          {openingHours?.openingHours && openingHours.openingHours.length > 0 && (() => {
            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const today = days[new Date().getDay()];
            const todayLine = openingHours.openingHours!.find((line) =>
              line.toLowerCase().startsWith(today.toLowerCase())
            );
            const hours = todayLine
              ? todayLine.replace(/^[^:]+:\s*/, "")
              : null;

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
            <div className="p-2.5 bg-gray-50 rounded-lg space-y-2">
              {/* Bus/transit departures */}
              {realtimeData.entur && realtimeData.entur.departures.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <Bus className="w-3 h-3" />
                    <span>Neste avganger</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {realtimeData.entur.departures.slice(0, 3).map((dep, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200"
                      >
                        <span className="font-medium">{dep.lineCode}</span>
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
                    {realtimeData.bysykkel.availableBikes} sykler, {realtimeData.bysykkel.availableDocks} låser
                  </span>
                  {!realtimeData.bysykkel.isOpen && (
                    <span className="text-red-500 ml-1">(Stengt)</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
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
      )}
    </div>
  );
}

/** Button that morphs: "Hent flere punkter" → spinner + "Henter flere punkter..." */
function LoadMoreButton({
  onClick,
  isLoading,
  locale,
  hiddenCount,
}: {
  onClick: () => void;
  isLoading: boolean;
  locale: string;
  hiddenCount: number;
}) {
  const idleText =
    locale === "en"
      ? `Load more places (${hiddenCount})`
      : `Hent flere punkter (${hiddenCount})`;
  const loadingText =
    locale === "en" ? "Loading more places..." : "Henter flere punkter...";

  return (
    <div className="flex justify-center pt-2">
      <button
        onClick={isLoading ? undefined : onClick}
        disabled={isLoading}
        className={`flex items-center gap-2 rounded-full border px-5 py-2 text-sm transition-all duration-300 ${
          isLoading
            ? "border-[#e8e4df] bg-[#faf9f7] text-[#8a8a8a] cursor-default"
            : "border-[#d4cfc8] bg-white text-[#4a4a4a] hover:bg-[#faf9f7] hover:border-[#b5b0a8]"
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4" style={{ animation: "spin 0.35s linear infinite" }} />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        <span>{isLoading ? loadingText : idleText}</span>
      </button>
    </div>
  );
}
