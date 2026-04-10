"use client";

import { useState, useMemo, useCallback } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { TRANSPORT_CATEGORIES } from "./report-data";
import { useLocale } from "@/lib/i18n/locale-context";
import { Star, MapPin, Map as MapIcon, X, Zap, Car, ExternalLink, Sparkles } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { linkPOIsInText } from "@/lib/utils/story-text-linker";
import ReportHeroInsight, { getHeroInsightPOIIds } from "./ReportHeroInsight";
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
import { useTransportDashboard } from "@/lib/hooks/useTransportDashboard";
import { formatRelativeDepartureTime } from "@/lib/utils/format-time";

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

  // Parse upper narrative (above cards) — buss, bysykkel, sparkesykkel
  const upperSegments = theme.upperNarrative
    ? linkPOIsInText(theme.upperNarrative, theme.allPOIs)
    : [];

  // Parse lower narrative (below cards) — bil, bildeling, elbil, tog, flybuss
  // Falls back to extendedBridgeText for backward compat
  const lowerText = theme.lowerNarrative ?? theme.extendedBridgeText;
  const segments = lowerText
    ? linkPOIsInText(lowerText, theme.allPOIs)
    : [];

  // POIs mentioned in text + hero insight card — show permanent labels on the map
  const featuredPOIIds = useMemo(() => {
    const textIds = segments.filter((s) => s.type === "poi" && s.poi).map((s) => s.poi!.id);
    const heroIds = getHeroInsightPOIIds(theme.id, theme.allPOIs, center);
    return new Set([...textIds, ...Array.from(heroIds)]);
  }, [segments, theme.id, theme.allPOIs, center]);

  // Live transport data for map labels (only fetches when transport theme)
  const emptyPois = useMemo(() => [] as POI[], []);
  const transportDashboard = useTransportDashboard(
    isTransport ? theme.allPOIs : emptyPois,
    center,
  );

  // Build live info strings per POI for map tooltips
  const poiLiveInfo = useMemo(() => {
    if (!isTransport || !transportDashboard.lastUpdated) return undefined;
    const info: Record<string, string> = {};

    // Bus/tram/train stops: match stopId (enturStopplaceId) back to POI id
    for (const stop of transportDashboard.departures) {
      const dep = stop.departures[0];
      if (!dep) continue;
      const poi = theme.allPOIs.find((p) => p.enturStopplaceId === stop.stopId);
      if (poi) {
        info[poi.id] = `${dep.lineCode} → ${dep.destination} om ${formatRelativeDepartureTime(dep.departureTime)}`;
      }
    }

    // Bysykkel: map each live station's count onto its matching POI by name
    if (transportDashboard.bysykkel) {
      const breakdown = transportDashboard.bysykkel.breakdown;
      for (const station of breakdown) {
        const stripped = station.name.replace("Trondheim Bysykkel: ", "");
        const poi = theme.allPOIs.find(
          (p) =>
            p.bysykkelStationId &&
            p.category.id === "bike" &&
            (p.name.includes(stripped) || stripped.includes(p.name.replace("Trondheim Bysykkel: ", ""))),
        );
        if (poi) {
          info[poi.id] = `${station.availableBikes} ledige sykler`;
        }
      }
      // Fallback: if no POI matched but we have nearest data, label the first bysykkel POI
      if (
        transportDashboard.bysykkel.nearest &&
        !Object.values(info).some((v) => v.includes("ledige sykler"))
      ) {
        const bPoi = theme.allPOIs.find((p) => p.bysykkelStationId);
        if (bPoi) info[bPoi.id] = `${transportDashboard.bysykkel.nearest.availableBikes} ledige sykler`;
      }
    }

    // Hyre: show available cars
    if (transportDashboard.carShare) {
      const cs = transportDashboard.carShare;
      const hyrePoi = theme.allPOIs.find((p) => p.hyreStationId && p.category.id === "carshare");
      if (hyrePoi) {
        info[hyrePoi.id] = `${cs.numVehiclesAvailable} biler ledige`;
      }
    }

    return Object.keys(info).length > 0 ? info : undefined;
  }, [isTransport, transportDashboard, theme.allPOIs]);

  // Floating chips for the map (scooter count — no fixed POI)
  const mapChips = useMemo(() => {
    if (!isTransport) return undefined;
    const chips: Array<{ icon: React.ReactNode; label: string }> = [];
    if (transportDashboard.scooters && transportDashboard.scooters.total > 0) {
      chips.push({
        icon: <Zap className="w-3.5 h-3.5 text-[#8b5cf6]" />,
        label: `${transportDashboard.scooters.total} sparkesykler i nærheten`,
      });
    }
    if (transportDashboard.freeFloatingCars && transportDashboard.freeFloatingCars.total > 0) {
      chips.push({
        icon: <Car className="w-3.5 h-3.5 text-[#10b981]" />,
        label: `${transportDashboard.freeFloatingCars.total} Getaround-biler i nærheten`,
      });
    }
    return chips.length > 0 ? chips : undefined;
  }, [isTransport, transportDashboard.scooters, transportDashboard.freeFloatingCars]);

  // Combine scooter + car positions for map dots
  const vehiclePositions = useMemo(() => {
    if (!isTransport) return undefined;
    const positions: Array<{ lat: number; lng: number; color: string }> = [];
    if (transportDashboard.scooters?.positions) {
      for (const p of transportDashboard.scooters.positions) {
        positions.push({ ...p, color: "#8b5cf6" }); // purple for scooters
      }
    }
    if (transportDashboard.freeFloatingCars?.positions) {
      for (const p of transportDashboard.freeFloatingCars.positions) {
        positions.push({ ...p, color: "#10b981" }); // green for cars
      }
    }
    return positions.length > 0 ? positions : undefined;
  }, [isTransport, transportDashboard.scooters?.positions, transportDashboard.freeFloatingCars?.positions]);

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

        {/* Bridge text as sub-heading — generisk kategori-intro */}
        {variant !== "secondary" && theme.bridgeText && (
          <p className="text-lg md:text-xl italic text-[#5a5a5a] leading-relaxed mb-5">
            {theme.bridgeText}
          </p>
        )}

        {/* Upper narrative — over kortene (buss, bysykkel, sparkesykkel) */}
        {variant !== "secondary" && upperSegments.length > 0 && (
          <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8] mb-6">
            {upperSegments.map((seg, i) =>
              seg.type === "poi" && seg.poi ? (
                <POIInlineLink key={i} poi={seg.poi} content={seg.content} />
              ) : seg.type === "external" && seg.url ? (
                <ExternalInlineLink key={i} content={seg.content} url={seg.url} />
              ) : (
                <span key={i}>{seg.content}</span>
              ),
            )}
          </div>
        )}

        {/* Hero insight — category-specific structured data */}
        {variant !== "secondary" && (
          <ReportHeroInsight theme={theme} center={center} />
        )}

        {/* Lower narrative — under kortene (bil, bildeling, elbil, tog, flybuss) */}
        {segments.length > 0 && (
          <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
            {segments.map((seg, i) =>
              seg.type === "poi" && seg.poi ? (
                <POIInlineLink key={i} poi={seg.poi} content={seg.content} />
              ) : seg.type === "external" && seg.url ? (
                <ExternalInlineLink key={i} content={seg.content} url={seg.url} />
              ) : (
                <span key={i}>{seg.content}</span>
              ),
            )}
          </div>
        )}

        {/* Fallback: show intro if no lower text */}
        {segments.length === 0 && theme.intro && (
          <p className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
            {theme.intro}
          </p>
        )}

        {/* Address input for transport theme */}
        {isTransport && projectName && (
          <div className="mt-6">
            <ReportAddressInput
              propertyCoordinates={[center.lng, center.lat]}
              propertyName={projectName}
            />
          </div>
        )}

      </div>

      {/* Per-category map — dormant preview + modal on activate */}
      {theme.allPOIs.length > 0 && (
        <>
          {/* Dormant map preview — entire area is clickable */}
          <button
            onClick={() => { setSelectedPOIId(null); setMapDialogOpen(true); }}
            className="mt-8 md:max-w-4xl h-[320px] md:h-[440px] rounded-2xl overflow-hidden border border-[#eae6e1] relative w-full block cursor-pointer hover:border-[#d4cfc8] transition-colors group"
          >
            <ReportThemeMap
              pois={theme.allPOIs}
              center={center}
              highlightedPOIId={null}
              onMarkerClick={() => {}}
              mapStyle={mapStyle}
              activated={false}
              projectName={projectName}
              trails={theme.trails}
              vehiclePositions={vehiclePositions}
            />

            {/* Gradient overlay — 100% solid at bottom, fades to transparent at top */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#f5f1ec] to-transparent pointer-events-none z-10" />

            {/* CTA — vertically centered + 25% down */}
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center translate-y-[25%] pointer-events-none">
              <p className="text-sm text-[#2a2a2a] font-semibold mb-3">
                {theme.allPOIs.length} steder på kartet
              </p>
              <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-full shadow-lg border border-[#eae6e1] text-sm font-medium text-[#1a1a1a] group-hover:shadow-xl group-hover:border-[#d4cfc8] transition-all">
                <MapIcon className="w-4 h-4 text-[#7a7062]" />
                Utforsk kartet
              </div>
            </div>
          </button>

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
                  featuredPOIIds={isTransport ? undefined : featuredPOIIds}
                  onMarkerClick={handleMarkerClick}
                  onMapClick={handleMapClick}
                  mapStyle={mapStyle}
                  activated={true}
                  projectName={projectName}
                  trails={theme.trails}
                  poiLiveInfo={poiLiveInfo}
                  mapChips={mapChips}
                  vehiclePositions={vehiclePositions}
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
      <PopoverContent side="top" className="w-72 p-0 gap-0 overflow-hidden">
        {/* Image */}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={poi.name} className="w-full aspect-[16/9] object-cover" />
        )}
        <div className="p-4">
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ExternalInlineLink({ content, url }: { content: string; url: string }) {
  if (url.includes("google.com/search")) {
    return <GoogleAIInlineLink content={content} url={url} />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-0.5 font-semibold text-[#1a1a1a] underline decoration-[#d4cfc8] decoration-2 underline-offset-2 hover:decoration-[#8a8a8a] transition-colors"
    >
      {content}
      <ExternalLink className="w-[0.7em] h-[0.7em] translate-y-[0.05em] shrink-0 opacity-50" />
    </a>
  );
}

function GoogleAIInlineLink({ content, url }: { content: string; url: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-baseline gap-0.5 font-semibold text-[#4f46e5] underline decoration-[#c7d2fe] decoration-2 underline-offset-2 hover:decoration-[#818cf8] transition-colors cursor-pointer"
        >
          {content}
          <Sparkles className="w-[0.7em] h-[0.7em] translate-y-[0.05em] shrink-0 opacity-70" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#4f46e5]" />
          <span className="font-semibold text-sm">Utforsk med Google AI</span>
        </div>
        <p className="text-sm text-[#4a4a4a] leading-relaxed mb-3">
          Vil du vite mer om <span className="font-medium">{content}</span>? Google AI kan gi deg utdypende svar om ruter, reisetider og destinasjoner.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-sm bg-[#4f46e5] text-white rounded-lg hover:bg-[#4338ca] transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Åpne Google AI
        </a>
        <p className="text-xs text-[#a0a0a0] mt-2 leading-relaxed">
          Google AI kan gi unøyaktig informasjon. Verifiser mot AtB eller Entur.
        </p>
      </PopoverContent>
    </Popover>
  );
}
