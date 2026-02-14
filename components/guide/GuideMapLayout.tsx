"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { MapPin, Sparkles, ChevronDown } from "lucide-react";
import type { PublicPOI } from "@/lib/public-queries";
import { getIcon } from "@/lib/utils/map-icons";
import { useIsDesktop } from "@/lib/hooks/useIsDesktop";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { TierBadge } from "@/components/ui/TierBadge";
import { shouldShowRating } from "@/lib/themes/rating-categories";
import ReportPOICard from "@/components/variants/report/ReportPOICard";

const GuideStickyMap = dynamic(() => import("./GuideStickyMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
      <span className="text-sm text-[#a0937d]">Laster kart...</span>
    </div>
  ),
});

const INITIAL_VISIBLE = 12;

interface GuideMapLayoutProps {
  pois: PublicPOI[];
  areaSlug: string;
  /** When true, cards interact with map instead of navigating to detail page */
  interactive?: boolean;
  /** Static map image URL — shown as zero-JS placeholder until user interacts */
  staticMapUrl?: string | null;
  /** Locale for link generation */
  locale?: "no" | "en";
}

function poiHref(areaSlug: string, slug: string, locale: "no" | "en" = "no") {
  if (locale === "en") return `/en/${areaSlug}/places/${slug}`;
  return `/${areaSlug}/steder/${slug}`;
}

export default function GuideMapLayout({ pois, areaSlug, interactive = false, staticMapUrl, locale = "no" }: GuideMapLayoutProps) {
  const [activePOIId, setActivePOIId] = useState<string | null>(null);
  const [activePOISource, setActivePOISource] = useState<"card" | "marker">(
    "card"
  );
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const isDesktop = useIsDesktop();

  // Desktop: defer Mapbox until user interacts (hover/click) — eliminates
  // 4.3 MB parse + WebGL init from Lighthouse entirely.
  // Mobile: load on toggle (showMobileMap already gates it).
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const triggerMapLoad = useCallback(() => {
    if (!mapReady) setMapReady(true);
  }, [mapReady]);

  // When mobile map toggle opens, also trigger map load
  useEffect(() => {
    if (showMobileMap) triggerMapLoad();
  }, [showMobileMap, triggerMapLoad]);

  // Split POIs into featured (Tier 1) and rest
  const featured = pois.filter((p) => p.poiTier === 1);
  const rest = pois.filter((p) => p.poiTier !== 1);
  const visibleRest = showAll ? rest : rest.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rest.length - INITIAL_VISIBLE;

  // Card click → toggle highlight + fly map to POI
  const handleCardLocate = useCallback((poiId: string) => {
    setActivePOIId((prev) => (prev === poiId ? null : poiId));
    setActivePOISource("card");
  }, []);

  // Marker click → highlight card + scroll to it
  const handleMarkerClick = useCallback((poiId: string) => {
    setActivePOIId((prev) => (prev === poiId ? null : poiId));
    setActivePOISource("marker");

    const card = cardRefs.current.get(poiId);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Click on empty map area → deselect
  const handleMapClick = useCallback(() => {
    setActivePOIId(null);
  }, []);

  const cardList = (
    <>
      {/* Highlighted POIs (Tier 1) — horizontal scroll */}
      {featured.length > 0 && (
        <div className="mb-6">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[#d4cfc8]">
            {featured.map((poi) => (
              <a
                key={poi.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(poi.id, el);
                  else cardRefs.current.delete(poi.id);
                }}
                href={poiHref(areaSlug, poi.slug, locale)}
                data-poi-id={poi.id}
                className="flex-shrink-0 w-[180px] snap-start"
                onClick={interactive ? (e) => { e.preventDefault(); handleCardLocate(poi.id); } : undefined}
              >
                <ReportPOICard
                  poi={poi}
                  isActive={activePOIId === poi.id}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Compact POI rows — 2-column layout */}
      {visibleRest.length > 0 && (
        <CompactPOIList
          pois={visibleRest}
          activePOIId={activePOIId}
          onPOIClick={handleCardLocate}
          cardRefs={cardRefs}
          areaSlug={areaSlug}
          interactive={interactive}
          locale={locale}
        />
      )}

      {/* Load more */}
      {hiddenCount > 0 && !showAll && (
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-2 rounded-full border border-[#d4cfc8] bg-white px-5 py-2 text-sm text-[#4a4a4a] hover:bg-[#faf9f7] hover:border-[#b5b0a8] transition-all"
          >
            <ChevronDown className="w-4 h-4" />
            <span>Hent flere punkter ({hiddenCount})</span>
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile layout */}
      <div className="lg:hidden">
        <div className="mb-4">
          <button
            onClick={() => setShowMobileMap((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#eae6e1] rounded-lg text-sm font-medium text-[#1a1a1a] hover:border-[#d4cfc8] hover:shadow-sm transition-all w-full justify-center"
          >
            <MapPin className="w-4 h-4 text-[#a0937d]" />
            {showMobileMap ? "Skjul kart" : "Vis kart"}
          </button>

          {showMobileMap && (
            <div className="mt-3 h-[250px] rounded-lg overflow-hidden border border-[#eae6e1]">
              {mapReady ? (
                <GuideStickyMap
                  pois={pois}
                  activePOIId={activePOIId}
                  activePOISource={activePOISource}
                  onMarkerClick={handleMarkerClick}
                  onMapClick={handleMapClick}
                  onLoad={() => setMapLoaded(true)}
                />
              ) : (
                <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
                  <span className="text-sm text-[#a0937d]">Laster kart...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {cardList}
      </div>

      {/* Desktop layout — 50/50 split matching Report */}
      <div className="hidden lg:flex max-w-[1920px] mx-auto">
        {/* Left: Scrollable card list */}
        <div className="w-[50%] px-16 min-w-0 overflow-hidden">
          {cardList}
        </div>

        {/* Right: Sticky map */}
        <div className="w-[50%] pt-16 pr-16 pb-16">
          <div
            className="sticky top-20 h-[calc(100vh-5rem-4rem)] rounded-2xl overflow-hidden relative"
            onMouseEnter={triggerMapLoad}
            onClick={triggerMapLoad}
          >
            {/* Static map placeholder — zero JS, instant render */}
            {staticMapUrl && !mapLoaded && (
              <div className="absolute inset-0 z-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={staticMapUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {!mapReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-white/90 backdrop-blur-sm text-sm text-[#6a6a6a] px-4 py-2 rounded-full shadow-sm">
                      Hold over for interaktivt kart
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Fallback when no static URL */}
            {!staticMapUrl && !mapReady && (
              <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
                <span className="text-sm text-[#a0937d]">Laster kart...</span>
              </div>
            )}

            {/* Interactive map — loads behind static image, fades in */}
            {isDesktop && mapReady && (
              <div className={`absolute inset-0 transition-opacity duration-500 ${mapLoaded ? "opacity-100 z-20" : "opacity-0 z-0"}`}>
                <GuideStickyMap
                  pois={pois}
                  activePOIId={activePOIId}
                  activePOISource={activePOISource}
                  onMarkerClick={handleMarkerClick}
                  onMapClick={handleMapClick}
                  onLoad={() => setMapLoaded(true)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Two-column compact row grid (matching Report design) */
function CompactPOIList({
  pois,
  activePOIId,
  onPOIClick,
  cardRefs,
  areaSlug,
  interactive,
  locale = "no",
}: {
  pois: PublicPOI[];
  activePOIId: string | null;
  onPOIClick: (poiId: string) => void;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
  areaSlug: string;
  interactive: boolean;
  locale?: "no" | "en";
}) {
  const leftPois = pois.filter((_, i) => i % 2 === 0);
  const rightPois = pois.filter((_, i) => i % 2 === 1);

  const renderColumn = (columnPois: PublicPOI[]) => (
    <div className="flex-1 flex flex-col gap-2.5">
      {columnPois.map((poi) => (
        <CompactPOIRow
          key={poi.id}
          poi={poi}
          isActive={activePOIId === poi.id}
          poiId={poi.id}
          onPOIClick={onPOIClick}
          cardRefs={cardRefs}
          areaSlug={areaSlug}
          interactive={interactive}
          locale={locale}
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

/** Compact POI row — thumbnail, name, badges, category, rating */
const CompactPOIRow = memo(function CompactPOIRow({
  poi,
  isActive,
  poiId,
  onPOIClick,
  cardRefs,
  areaSlug,
  interactive,
  locale = "no",
}: {
  poi: PublicPOI;
  isActive: boolean;
  poiId: string;
  onPOIClick: (poiId: string) => void;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
  areaSlug: string;
  interactive: boolean;
  locale?: "no" | "en";
}) {
  const [imageError, setImageError] = useState(false);
  const CategoryIcon = getIcon(poi.category.icon);

  const imageUrl = poi.featuredImage
    ? poi.featuredImage
    : poi.photoReference
    ? `/api/places/photo?photoReference=${poi.photoReference}&maxWidth=96`
    : null;

  const hasImage = imageUrl && !imageError;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (interactive) {
      e.preventDefault();
      onPOIClick(poiId);
    }
  }, [onPOIClick, poiId, interactive]);
  const cardRef = useCallback(
    (el: HTMLElement | null) => {
      if (el) cardRefs.current?.set(poiId, el);
      else cardRefs.current?.delete(poiId);
    },
    [cardRefs, poiId]
  );

  return (
    <a
      ref={cardRef}
      href={poiHref(areaSlug, poi.slug, locale)}
      data-poi-id={poiId}
      onClick={handleClick}
      className={`block w-full text-left rounded-xl border overflow-hidden transition-all ${
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
            <Image
              src={imageUrl}
              alt={poi.name}
              width={48}
              height={48}
              sizes="48px"
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
                <span className="text-gray-300 flex-shrink-0">&middot;</span>
                <GoogleRating rating={poi.googleRating} reviewCount={poi.googleReviewCount} size="sm" />
              </>
            )}
          </div>
        </div>
      </div>
    </a>
  );
});
