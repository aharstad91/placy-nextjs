"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import dynamic from "next/dynamic";
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
}

export default function GuideMapLayout({ pois, areaSlug, interactive = false }: GuideMapLayoutProps) {
  const [activePOIId, setActivePOIId] = useState<string | null>(null);
  const [activePOISource, setActivePOISource] = useState<"card" | "marker">(
    "card"
  );
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const isDesktop = useIsDesktop();

  // Defer map mount until the browser is idle — avoids 4.1 MB Mapbox chunk
  // blocking the main thread during the critical rendering path.
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    const schedule = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
    const id = schedule(() => setMapReady(true));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    return () => cancel(id);
  }, []);

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
              <div
                key={poi.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(poi.id, el);
                  else cardRefs.current.delete(poi.id);
                }}
                data-poi-id={poi.id}
                className="flex-shrink-0 w-[180px] snap-start"
              >
                <ReportPOICard
                  poi={poi}
                  isActive={activePOIId === poi.id}
                  onClick={() => handleCardLocate(poi.id)}
                />
              </div>
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
          <div className="sticky top-20 h-[calc(100vh-5rem-4rem)] rounded-2xl overflow-hidden">
            {isDesktop && mapReady ? (
              <GuideStickyMap
                pois={pois}
                activePOIId={activePOIId}
                activePOISource={activePOISource}
                onMarkerClick={handleMarkerClick}
                onMapClick={handleMapClick}
              />
            ) : (
              <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
                <span className="text-sm text-[#a0937d]">Laster kart...</span>
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
}: {
  pois: PublicPOI[];
  activePOIId: string | null;
  onPOIClick: (poiId: string) => void;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
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
}: {
  poi: PublicPOI;
  isActive: boolean;
  poiId: string;
  onPOIClick: (poiId: string) => void;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
}) {
  const [imageError, setImageError] = useState(false);
  const CategoryIcon = getIcon(poi.category.icon);

  const imageUrl = poi.featuredImage
    ? poi.featuredImage
    : poi.photoReference
    ? `/api/places/photo?photoReference=${poi.photoReference}&maxWidth=400`
    : null;

  const hasImage = imageUrl && !imageError;

  const handleClick = useCallback(() => onPOIClick(poiId), [onPOIClick, poiId]);
  const cardRef = useCallback(
    (el: HTMLElement | null) => {
      if (el) cardRefs.current?.set(poiId, el);
      else cardRefs.current?.delete(poiId);
    },
    [cardRefs, poiId]
  );

  return (
    <button
      ref={cardRef}
      data-poi-id={poiId}
      onClick={handleClick}
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
    </button>
  );
});
