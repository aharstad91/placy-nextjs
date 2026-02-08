"use client";

import { useState, useCallback } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { useLocale } from "@/lib/i18n/locale-context";
import { t } from "@/lib/i18n/strings";
import { Star, ChevronDown, MapPin, Sparkles, Loader2 } from "lucide-react";
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
  /** Whether this theme is expanded (showing all POIs) */
  isExpanded?: boolean;
  /** Callback when theme is expanded via "Vis meg mer" */
  onExpand?: (themeId: string) => void;
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
  isExpanded,
  onExpand,
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
          isExpanded={isExpanded ?? false}
          onExpand={() => onExpand?.(theme.id)}
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
}: {
  theme: ReportTheme;
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
  isExpanded: boolean;
  onExpand: () => void;
}) {
  const { locale } = useLocale();
  const hasHidden = theme.hiddenPOIs.length > 0;

  // Staged reveal: loading → cards appear → map markers appear
  const [loadState, setLoadState] = useState<"idle" | "loading" | "done">(
    isExpanded ? "done" : "idle"
  );

  const handleLoadMore = useCallback(() => {
    setLoadState("loading");

    // Step 1: After 2s — reveal cards, hide button
    setTimeout(() => {
      setLoadState("done");

      // Step 2: After 1s more — add markers to map
      setTimeout(() => {
        onExpand();
      }, 1000);
    }, 2000);
  }, [onExpand]);

  const showCards = loadState === "done" || isExpanded;

  return (
    <div className="mt-4 space-y-4">
      {/* Highlight photo cards — horizontal scroll (editorial themes only) */}
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

      {/* Compact card grid — initial visible POIs */}
      {theme.listPOIs.length > 0 && (
        <CompactPOIList
          pois={theme.listPOIs}
          activePOIId={activePOIId}
          onPOIClick={onPOIClick}
        />
      )}

      {/* Hidden POIs revealed after staged loading */}
      {showCards && theme.hiddenPOIs.length > 0 && (
        <div
          className="transition-all duration-300 ease-out"
          style={{ animation: "fadeSlideIn 0.6s ease-out" }}
        >
          <CompactPOIList
            pois={theme.hiddenPOIs}
            activePOIId={activePOIId}
            onPOIClick={onPOIClick}
          />
          <style jsx>{`
            @keyframes fadeSlideIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Load more button — morphs between states */}
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
