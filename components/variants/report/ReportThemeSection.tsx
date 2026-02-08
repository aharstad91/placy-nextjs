"use client";

import { useState } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { useLocale } from "@/lib/i18n/locale-context";
import { t } from "@/lib/i18n/strings";
import { Star, ChevronDown, MapPin, Sparkles } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";
import ReportInteractiveMapSection from "./ReportInteractiveMapSection";
import ReportAddressInput from "./ReportAddressInput";
import ReportPOICard from "./ReportPOICard";

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
}

// Categories that indicate a transport-related theme
const TRANSPORT_CATEGORIES = new Set([
  "bus",
  "train",
  "tram",
  "bike",
  "parking",
  "carshare",
  "taxi",
  "airport",
]);

export default function ReportThemeSection({
  theme,
  center,
  explorerBaseUrl,
  projectName,
  registerRef,
  useStickyMap,
  activePOIId,
  onPOIClick,
}: ReportThemeSectionProps) {
  const { locale } = useLocale();
  const Icon = getIcon(theme.icon);
  const numLocale = locale === "en" ? "en-US" : "nb-NO";

  // Check if this is a transport theme by looking at POI categories
  const isTransport = theme.allPOIs.some((poi) =>
    TRANSPORT_CATEGORIES.has(poi.category.id)
  );

  return (
    <section
      id={theme.id}
      ref={registerRef}
      className="py-10 md:py-14 scroll-mt-20"
    >
      {/* Section header */}
      <div className="max-w-4xl">
        {/* Section heading */}
        <div className="flex items-center gap-3 mb-3">
          <Icon className="w-5 h-5 text-[#7a7062]" />
          <h2 className="text-xl md:text-2xl font-semibold text-[#1a1a1a]">
            {theme.name}
          </h2>
        </div>

        {/* Category quote */}
        <p className="text-lg md:text-xl text-[#4a4a4a] leading-relaxed mb-4">
          {theme.quote}
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6a6a6a] mb-6">
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
          <p className="text-base text-[#4a4a4a] leading-relaxed mb-6">
            {theme.intro}
          </p>
        )}

        {/* Bridge text */}
        {theme.bridgeText && (
          <p className="text-base italic text-[#5a5a5a] leading-relaxed mb-6">
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
}: {
  theme: ReportTheme;
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
}) {
  const [showHidden, setShowHidden] = useState(false);
  const { locale } = useLocale();

  const visiblePOIs = [...theme.highlightPOIs, ...theme.listPOIs];
  const hasHidden = theme.hiddenPOIs.length > 0;

  if (theme.displayMode === "editorial") {
    return (
      <EditorialContent
        highlightPOIs={theme.highlightPOIs}
        listPOIs={theme.listPOIs}
        hiddenPOIs={showHidden ? theme.hiddenPOIs : []}
        activePOIId={activePOIId}
        onPOIClick={onPOIClick}
        hasHidden={hasHidden && !showHidden}
        onShowMore={() => setShowHidden(true)}
        locale={locale}
      />
    );
  }

  // Functional mode — compact list only
  return (
    <FunctionalContent
      pois={visiblePOIs}
      hiddenPOIs={showHidden ? theme.hiddenPOIs : []}
      activePOIId={activePOIId}
      onPOIClick={onPOIClick}
      hasHidden={hasHidden && !showHidden}
      onShowMore={() => setShowHidden(true)}
      locale={locale}
    />
  );
}

/** Editorial mode: highlight photo cards in horizontal scroll + compact list below */
function EditorialContent({
  highlightPOIs,
  listPOIs,
  hiddenPOIs,
  activePOIId,
  onPOIClick,
  hasHidden,
  onShowMore,
  locale,
}: {
  highlightPOIs: POI[];
  listPOIs: POI[];
  hiddenPOIs: POI[];
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
  hasHidden: boolean;
  onShowMore: () => void;
  locale: string;
}) {
  return (
    <div className="mt-4 space-y-4">
      {/* Highlight cards — horizontal scroll */}
      {highlightPOIs.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[#d4cfc8]">
          {highlightPOIs.map((poi) => (
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

      {/* List POIs — compact rows */}
      {listPOIs.length > 0 && (
        <CompactPOIList
          pois={listPOIs}
          activePOIId={activePOIId}
          onPOIClick={onPOIClick}
        />
      )}

      {/* Hidden POIs revealed */}
      {hiddenPOIs.length > 0 && (
        <CompactPOIList
          pois={hiddenPOIs}
          activePOIId={activePOIId}
          onPOIClick={onPOIClick}
        />
      )}

      {/* Show more button */}
      {hasHidden && (
        <ShowMoreButton onClick={onShowMore} locale={locale} />
      )}
    </div>
  );
}

/** Functional mode: all POIs in compact list */
function FunctionalContent({
  pois,
  hiddenPOIs,
  activePOIId,
  onPOIClick,
  hasHidden,
  onShowMore,
  locale,
}: {
  pois: POI[];
  hiddenPOIs: POI[];
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
  hasHidden: boolean;
  onShowMore: () => void;
  locale: string;
}) {
  return (
    <div className="mt-4 space-y-4">
      <CompactPOIList
        pois={pois}
        activePOIId={activePOIId}
        onPOIClick={onPOIClick}
      />

      {hiddenPOIs.length > 0 && (
        <CompactPOIList
          pois={hiddenPOIs}
          activePOIId={activePOIId}
          onPOIClick={onPOIClick}
        />
      )}

      {hasHidden && (
        <ShowMoreButton onClick={onShowMore} locale={locale} />
      )}
    </div>
  );
}

/** Explorer-style POI card grid for report sections */
function CompactPOIList({
  pois,
  activePOIId,
  onPOIClick,
}: {
  pois: POI[];
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {pois.map((poi) => (
        <ReportPOIRow
          key={poi.id}
          poi={poi}
          isActive={activePOIId === poi.id}
          onClick={() => onPOIClick?.(poi.id)}
        />
      ))}
    </div>
  );
}

/** Single POI card — matches Explorer collapsed card style with border + radius */
function ReportPOIRow({
  poi,
  isActive,
  onClick,
}: {
  poi: POI;
  isActive: boolean;
  onClick: () => void;
}) {
  const [imageError, setImageError] = useState(false);
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

  return (
    <button
      data-poi-id={poi.id}
      onClick={onClick}
      className={`w-full text-left rounded-xl border overflow-hidden transition-all ${
        isActive
          ? "bg-[#f0ede8] border-[#d4cfc8] ring-1 ring-[#d4cfc8]"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
      }`}
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
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {poi.name}
            </h3>
            {poi.editorialHook && (
              <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs font-medium" style={{ color: poi.category.color }}>
              {poi.category.name}
            </span>
            {shouldShowRating(poi.category.id) && poi.googleRating != null && poi.googleRating > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <GoogleRating rating={poi.googleRating} reviewCount={poi.googleReviewCount} size="sm" />
              </>
            )}
            {walkMinutes != null && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-0.5 text-xs text-gray-500">
                  <MapPin className="w-3 h-3" />
                  {walkMinutes} min
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ShowMoreButton({
  onClick,
  locale,
}: {
  onClick: () => void;
  locale: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-[#6a6a6a] hover:text-[#1a1a1a] transition-colors"
    >
      <ChevronDown className="w-4 h-4" />
      {locale === "en" ? "Show more" : "Vis flere"}
    </button>
  );
}
