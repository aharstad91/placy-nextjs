"use client";

import { useState, useCallback } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme, ReportSubSection } from "./report-data";
import { TRANSPORT_CATEGORIES } from "./report-data";
import { useLocale } from "@/lib/i18n/locale-context";
import { t, type Locale } from "@/lib/i18n/strings";
import {
  Star,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
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
  /** Register sub-section elements for scroll tracking (composite key: themeId:categoryId) */
  registerSubSectionRef?: (compositeId: string) => (el: HTMLElement | null) => void;
  /** Set of expanded composite keys (themeId:categoryId) */
  expandedKeys?: Set<string>;
  /** Expand callback for composite key */
  onExpandKey?: (compositeKey: string) => void;
  /** Visual variant — "secondary" suppresses featured cards and uses smaller header */
  variant?: "primary" | "secondary";
}

/** Derive numeric locale string from app locale */
function getNumericLocale(locale: string): string {
  return locale === "en" ? "en-US" : "nb-NO";
}

const LOAD_MORE_BATCH = 6;

/** Progressive load-more: 6 → 12 → all */
function useProgressiveLoad(hiddenCount: number, isExpanded: boolean, onExpand: () => void) {
  const [revealedCount, setRevealedCount] = useState(isExpanded ? hiddenCount : 0);
  const [isLoading, setIsLoading] = useState(false);

  const allRevealed = revealedCount >= hiddenCount || isExpanded;

  const handleLoadMore = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      setRevealedCount((prev) => {
        const next = prev + LOAD_MORE_BATCH;
        // If this batch reveals all or nearly all, just show everything
        if (next >= hiddenCount) {
          setTimeout(() => onExpand(), 1000);
        }
        return Math.min(next, hiddenCount);
      });
      setIsLoading(false);
    }, 800);
  }, [hiddenCount, onExpand]);

  return { revealedCount, isLoading, allRevealed, handleLoadMore } as const;
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
  variant = "primary",
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
      className="py-12 md:py-16 scroll-mt-[7rem]"
    >
      {/* Section header */}
      <div className="max-w-4xl">
        {/* Section heading */}
        <div className="flex items-center gap-3 mb-4">
          <Icon className={variant === "secondary" ? "w-5 h-5 text-[#a0937d]" : "w-6 h-6 text-[#7a7062]"} />
          <h2 className={variant === "secondary"
            ? "text-xl md:text-2xl font-semibold text-[#6a6a6a]"
            : "text-2xl md:text-3xl font-semibold text-[#1a1a1a]"
          }>
            {theme.name}
          </h2>
        </div>

        {/* Category quote — hidden for secondary variant */}
        {variant !== "secondary" && (
          <p className="text-xl md:text-2xl text-[#4a4a4a] leading-relaxed mb-5">
            {theme.quote}
          </p>
        )}

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
        {theme.subSections.map((sub, i) => {
          const compositeKey = `${theme.id}:${sub.categoryId}`;
          const subIsExpanded = expandedKeys?.has(compositeKey) ?? false;

          return (
            <div key={sub.categoryId}>
              {/* Center-dot divider between sub-sections */}
              {i > 0 && (
                <div className="relative my-6">
                  <div className="h-px bg-[#eae6e1]" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#d4cfc8]" />
                </div>
              )}
              <SubSectionContent
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
            </div>
          );
        })}

        {/* Remaining POIs (categories under threshold) — card grid */}
        {remainingPOIs.length > 0 && (
          <POICardGrid
            pois={remainingPOIs}
            activePOIId={activePOIId}
            onPOIClick={onPOIClick}
          />
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

/** Flat rendering (no sub-sections) — card grid with load-more */
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
  const { revealedCount, isLoading, allRevealed, handleLoadMore } = useProgressiveLoad(
    theme.hiddenPOIs.length, isExpanded, onExpand
  );

  const visiblePois = allRevealed
    ? [...theme.pois, ...theme.hiddenPOIs]
    : [...theme.pois, ...theme.hiddenPOIs.slice(0, revealedCount)];

  const remainingCount = theme.hiddenPOIs.length - revealedCount;

  return (
    <div className="mt-4 space-y-4">
      <POICardGrid
        pois={visiblePois}
        activePOIId={activePOIId}
        onPOIClick={onPOIClick}
      />

      {hasHidden && !allRevealed && (
        <LoadMoreButton
          onClick={handleLoadMore}
          isLoading={isLoading}
          locale={locale}
          hiddenCount={remainingCount}
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
  const { revealedCount, isLoading, allRevealed, handleLoadMore } = useProgressiveLoad(
    sub.hiddenPOIs.length, isExpanded, onExpand
  );

  const visiblePois = allRevealed
    ? [...sub.pois, ...sub.hiddenPOIs]
    : [...sub.pois, ...sub.hiddenPOIs.slice(0, revealedCount)];

  const remainingCount = sub.hiddenPOIs.length - revealedCount;

  return (
    <div
      id={compositeKey}
      ref={registerRef?.(compositeKey)}
      className="scroll-mt-[7rem]"
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
      <p className="text-base text-[#4a4a4a] leading-relaxed mb-2">
        {sub.quote}
      </p>

      {/* Bridge text */}
      {sub.bridgeText && (
        <p className="text-sm italic text-[#5a5a5a] leading-relaxed mb-4">
          {sub.bridgeText}
        </p>
      )}

      {/* POI card grid */}
      <POICardGrid
        pois={visiblePois}
        activePOIId={activePOIId}
        onPOIClick={onPOIClick}
      />

      {/* Load more */}
      {hasHidden && !allRevealed && (
        <LoadMoreButton
          onClick={handleLoadMore}
          isLoading={isLoading}
          locale={locale}
          hiddenCount={remainingCount}
        />
      )}
    </div>
  );
}

/** Responsive POI card grid — 2 cols mobile, 3 cols desktop */
function POICardGrid({
  pois,
  activePOIId,
  onPOIClick,
}: {
  pois: POI[];
  activePOIId: string | null;
  onPOIClick?: (poiId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {pois.map((poi) => (
        <div key={poi.id} data-poi-id={poi.id}>
          <ReportPOICard
            poi={poi}
            isActive={activePOIId === poi.id}
            onClick={() => onPOIClick?.(poi.id)}
          />
        </div>
      ))}
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
