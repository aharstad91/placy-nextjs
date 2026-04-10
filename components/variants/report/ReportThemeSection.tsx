"use client";

import { useState, useMemo, useCallback } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { TRANSPORT_CATEGORIES } from "./report-data";
import { useLocale } from "@/lib/i18n/locale-context";
import { Star, MapPin, Map as MapIcon, X } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { linkPOIsInText } from "@/lib/utils/story-text-linker";
import ReportHeroInsight from "./ReportHeroInsight";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import ReportAddressInput from "./ReportAddressInput";
import dynamic from "next/dynamic";
import { SkeletonReportMap } from "@/components/ui/SkeletonReportMap";
import ReportMapDrawer from "./ReportMapDrawer";

const ReportThemeMap = dynamic(() => import("./ReportThemeMap"), {
  ssr: false,
  loading: () => <SkeletonReportMap />,
});

interface ReportThemeSectionProps {
  theme: ReportTheme;
  center: Coordinates;
  projectName?: string;
  /** Callback ref to register this section for IntersectionObserver tracking */
  registerRef?: (el: HTMLElement | null) => void;
  /** Visual variant — "secondary" uses smaller header */
  variant?: "primary" | "secondary";
  /** Map style override */
  mapStyle?: string;
  /** Area slug for POI page links in map popup */
  areaSlug?: string | null;
}

export default function ReportThemeSection({
  theme,
  center,
  projectName,
  registerRef,
  variant = "primary",
  mapStyle,
  areaSlug,
}: ReportThemeSectionProps) {
  const { locale } = useLocale();
  const Icon = getIcon(theme.icon);
  const isTransport = theme.allPOIs.some((poi) =>
    TRANSPORT_CATEGORIES.has(poi.category.id)
  );

  // Map dialog state
  const [mapDialogOpen, setMapDialogOpen] = useState(false);

  // Selected POI state (self-contained per section)
  const [selectedPOIId, setSelectedPOIId] = useState<string | null>(null);

  const poiById = useMemo(() => {
    const lookup: Record<string, POI> = {};
    for (const poi of theme.allPOIs) lookup[poi.id] = poi;
    return lookup;
  }, [theme.allPOIs]);

  const selectedPOI = selectedPOIId ? poiById[selectedPOIId] ?? null : null;

  const handleMarkerClick = useCallback((poiId: string) => {
    setSelectedPOIId((prev) => (prev === poiId ? null : poiId));
  }, []);

  const handleMapClick = useCallback(() => {
    setSelectedPOIId(null);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedPOIId(null);
  }, []);

  // Parse extended bridge text into segments with inline POI links
  const segments = theme.extendedBridgeText
    ? linkPOIsInText(theme.extendedBridgeText, theme.allPOIs)
    : [];

  // POIs mentioned in the text — show permanent labels on the activated map
  const featuredPOIIds = useMemo(
    () => new Set(segments.filter((s) => s.type === "poi" && s.poi).map((s) => s.poi!.id)),
    [segments]
  );

  return (
    <section
      id={theme.id}
      ref={registerRef}
      className="py-16 md:py-24 scroll-mt-[7rem]"
    >
      <div className="md:max-w-4xl">
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

        {/* Category quote — editorial pitch */}
        {variant !== "secondary" && theme.quote && (
          <p className="text-xl md:text-2xl text-[#4a4a4a] leading-relaxed mb-5">
            {theme.quote}
          </p>
        )}

        {/* Hero insight — category-specific structured data */}
        {variant !== "secondary" && (
          <ReportHeroInsight theme={theme} center={center} />
        )}

        {/* Bridge text — short narrative intro */}
        {theme.bridgeText && (
          <p className="text-lg italic text-[#5a5a5a] leading-relaxed mb-6">
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

        {/* Extended narrative text with inline POI links */}
        {segments.length > 0 && (
          <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
            {segments.map((seg, i) =>
              seg.type === "poi" && seg.poi ? (
                <POIInlineLink
                  key={i}
                  poi={seg.poi}
                  content={seg.content}
                />
              ) : (
                <span key={i}>{seg.content}</span>
              ),
            )}
          </div>
        )}

        {/* Fallback: show intro if no extended text */}
        {segments.length === 0 && theme.intro && (
          <p className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
            {theme.intro}
          </p>
        )}

      </div>

      {/* Per-category map — dormant preview + modal on activate */}
      {theme.allPOIs.length > 0 && (
        <>
          {/* Dormant map preview */}
          <div className="mt-8 md:max-w-4xl h-[280px] md:h-[400px] rounded-2xl overflow-hidden border border-[#eae6e1] relative">
            <ReportThemeMap
              pois={theme.allPOIs}
              center={center}
              highlightedPOIId={null}
              onMarkerClick={() => {}}
              mapStyle={mapStyle}
              activated={false}
              projectName={projectName}
              trails={theme.trails}
            />

            {/* Overlay + CTA */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center -mt-[10%] pointer-events-none">
              <div className="absolute inset-0 bg-white/60" />
              <p className="relative text-sm text-[#6a6a6a] mb-3">Se alle {theme.allPOIs.length} steder på kartet</p>
              <button
                onClick={() => { setSelectedPOIId(null); setMapDialogOpen(true); }}
                className="relative pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-white rounded-full shadow-lg border border-[#eae6e1] text-sm font-medium text-[#1a1a1a] hover:shadow-xl hover:border-[#d4cfc8] transition-all"
              >
                <MapIcon className="w-4 h-4 text-[#7a7062]" />
                Utforsk kartet
              </button>
            </div>
          </div>

          {/* Map modal — bottom drawer on mobile, centered modal on desktop */}
          <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
            <DialogContent
              showCloseButton={false}
              className="flex flex-col !max-w-none p-0 overflow-hidden gap-0 bg-white fixed bottom-0 left-0 right-0 h-[85vh] rounded-t-2xl rounded-b-none md:static md:w-[80vw] md:h-[80vh] md:rounded-2xl"
            >
              <DialogTitle className="sr-only">{theme.name} — kart</DialogTitle>

              {/* Drag handle — mobile only */}
              <div className="flex justify-center pt-2 pb-0 md:hidden">
                <div className="w-8 h-1 rounded-full bg-gray-300" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 md:px-5 md:py-3 border-b border-[#eae6e1] bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <Icon className="w-5 h-5 text-[#7a7062]" />
                  <span className="text-sm md:text-base font-semibold text-[#1a1a1a]">{theme.name}</span>
                </div>
                <button
                  onClick={() => setMapDialogOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5f3f0] transition-colors"
                >
                  <X className="w-4 h-4 text-[#6a6a6a]" />
                </button>
              </div>

              {/* Map + drawer */}
              <div className="relative flex-1 min-h-0 p-0 md:p-8">
                <ReportThemeMap
                  pois={theme.allPOIs}
                  center={center}
                  highlightedPOIId={selectedPOIId}
                  featuredPOIIds={featuredPOIIds}
                  onMarkerClick={handleMarkerClick}
                  onMapClick={handleMapClick}
                  mapStyle={mapStyle}
                  activated={true}
                  projectName={projectName}
                  trails={theme.trails}
                />

                {/* POI drawer */}
                {selectedPOI && (
                  <ReportMapDrawer
                    poi={selectedPOI}
                    onClose={handleDrawerClose}
                    areaSlug={areaSlug}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}

// --- POI inline link with Popover ---

function POIInlineLink({ poi, content }: { poi: POI; content: string }) {
  const Icon = getIcon(poi.category.icon);
  const walkMin = poi.travelTime?.walk ? Math.round(poi.travelTime.walk / 60) : null;

  const imageUrl = poi.featuredImage
    ? poi.featuredImage.includes("mymaps.usercontent.google.com")
      ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
      : poi.featuredImage
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-baseline gap-1 font-semibold text-[#1a1a1a] underline decoration-[#d4cfc8] decoration-2 underline-offset-2 hover:decoration-[#8a8a8a] transition-colors cursor-pointer"
        >
          <span
            className="inline-flex items-center justify-center w-[1.2em] h-[1.2em] rounded-full shrink-0 overflow-hidden relative translate-y-[0.15em]"
            style={!imageUrl ? { backgroundColor: poi.category.color + "20" } : undefined}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Icon className="w-[0.6em] h-[0.6em]" style={{ color: poi.category.color }} />
            )}
          </span>
          {content}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-4 gap-0">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
            style={{ backgroundColor: poi.category.color + "18" }}
          >
            <Icon className="w-4 h-4" style={{ color: poi.category.color }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm leading-tight truncate">{poi.name}</div>
            <div className="text-xs text-muted-foreground">{poi.category.name}</div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground mb-2">
          {poi.googleRating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
              <span className="font-medium text-foreground">{poi.googleRating.toFixed(1)}</span>
              {poi.googleReviewCount != null && <span>({poi.googleReviewCount})</span>}
            </span>
          )}
          {walkMin != null && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {walkMin} min gange
            </span>
          )}
        </div>

        {/* Editorial content */}
        {poi.editorialHook && (
          <p className="text-[13px] text-[#3a3a3a] leading-relaxed">{poi.editorialHook}</p>
        )}
        {poi.localInsight && (
          <p className="text-xs text-muted-foreground italic leading-relaxed mt-1.5">{poi.localInsight}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
