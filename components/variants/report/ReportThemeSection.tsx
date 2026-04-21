"use client";

import { useCallback, useState, useMemo } from "react";
import Image from "next/image";
import type { Coordinates, POI } from "@/lib/types";
import type { Map3DInstance } from "@/components/map/map-view-3d";
import type { SlotContext } from "@/components/map/UnifiedMapModal";
import type { ReportTheme } from "./report-data";
import { TRANSPORT_CATEGORIES } from "./report-data";
import { useLocale } from "@/lib/i18n/locale-context";
import { MapPin, Zap, Car, ExternalLink, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { linkPOIsInText } from "@/lib/utils/story-text-linker";
import { renderEmphasizedText } from "@/lib/utils/render-emphasized-text";
import ReportHeroInsight, { getHeroInsightPOIIds } from "./ReportHeroInsight";
import POIPopover from "./POIPopover";
import EditorialPull from "./blocks/EditorialPull";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import UnifiedMapModal from "@/components/map/UnifiedMapModal";
import ReportMapBottomCarousel from "./blocks/ReportMapBottomCarousel";
import ReportAddressInput from "./ReportAddressInput";
import dynamic from "next/dynamic";
import { SkeletonReportMap } from "@/components/ui/SkeletonReportMap";
import ReportMapDrawer from "./ReportMapDrawer";
import BentoShowcase from "./blocks/BentoShowcase";
import { getValentinlystBento, getHverdagslivHorizonCell } from "./blocks/hverdagsliv-bento";
import FeatureCarousel from "./blocks/FeatureCarousel";
import { getMatDrikkeCarousel } from "./blocks/matdrikke-carousel";
import StatRow from "./blocks/StatRow";
import { getTransportStats } from "./blocks/transport-stats";
import TimelineRow from "./blocks/TimelineRow";
import { getBarnTimeline, getBarnStats } from "./blocks/barn-timeline";
import SplitFeature from "./blocks/SplitFeature";
import AnnotatedMap from "./blocks/AnnotatedMap";
import { getNaturMarkers } from "./blocks/natur-annotated";
import { useTransportDashboard } from "@/lib/hooks/useTransportDashboard";
import { formatRelativeDepartureTime } from "@/lib/utils/format-time";
import { DEFAULT_CAMERA_LOCK } from "./blocks/report-3d-config";

const ReportThemeMap = dynamic(() => import("./ReportThemeMap"), {
  ssr: false,
  loading: () => <SkeletonReportMap />,
});

// Google AI-utdyping lazy-lastes: react-markdown bør ikke ligge i main bundle.
// ssr: true så knappen rendres i initial HTML — kun expanded-state er client.
const ReportGroundingInline = dynamic(() => import("./ReportGroundingInline"));

// V2: unified kuratert narrative med POI-inline-chips. Per-tema version-branch —
// v1 bruker ReportGroundingInline, v2 bruker ReportCuratedGrounded.
const ReportCuratedGrounded = dynamic(() => import("./ReportCuratedGrounded"));

// Kilder + Google-chips + attribution — rendres alltid etter kart-preview.
const ReportGroundingSources = dynamic(() => import("./ReportGroundingSources"));

// 3D-motoren lazy-loades på samme måte som 2D — unngår å trekke inn
// @vis.gl/react-google-maps i serverbundlen, og lar 3D-koden kun lastes
// når brukeren faktisk åpner et kart-modal.
const MapView3D = dynamic(
  () => import("@/components/map/map-view-3d").then((mod) => ({ default: mod.MapView3D })),
  {
    ssr: false,
    loading: () => <SkeletonReportMap />,
  },
);

// RouteLayer3D lazy-loades sammen med MapView3D — samme bundling-strategi,
// kun Google Maps 3D-bruk.
const RouteLayer3D = dynamic(
  () => import("@/components/map/route-layer-3d").then((mod) => ({ default: mod.RouteLayer3D })),
  { ssr: false },
);

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
  /** Whether this project has purchased the 3D map add-on */
  has3dAddon: boolean;
  /** Hele prosjektets POI-set — brukes til POI-chip-lookup i curated grounded narrative. */
  allProjectPOIs?: POI[];
}

export default function ReportThemeSection({
  theme,
  center,
  projectName,
  registerRef,
  variant = "primary",
  mapStyle,
  areaSlug,
  has3dAddon,
  allProjectPOIs,
}: ReportThemeSectionProps) {
  const { locale } = useLocale();
  const Icon = getIcon(theme.icon);
  const isTransport = theme.allPOIs.some((poi) =>
    TRANSPORT_CATEGORIES.has(poi.category.id)
  );

  const [expanded, setExpanded] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const openMap = useCallback(() => setMapDialogOpen(true), []);

  // Parse upper narrative (above cards) — buss, bysykkel, sparkesykkel
  const upperSegments = theme.upperNarrative
    ? linkPOIsInText(theme.upperNarrative, theme.allPOIs)
    : [];

  // Parse lower narrative (below cards) — bil, bildeling, elbil, tog, flybuss
  // Falls back to extendedBridgeText for backward compat.
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

  // Lookup-map for POI-chips i curated grounded narrative (v2).
  // Bruker hele prosjektets POI-set — theme.allPOIs er filtrert (maxCount/school-
  // zone) og kan droppe POIs som curated tekst refererer til. Fallback til
  // theme.allPOIs hvis allProjectPOIs ikke er satt (bakoverkompatibelt).
  const poisById = useMemo(() => {
    const m = new Map<string, POI>();
    for (const poi of allProjectPOIs ?? theme.allPOIs) {
      m.set(poi.id.toLowerCase(), poi);
    }
    return m;
  }, [allProjectPOIs, theme.allPOIs]);

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
        {/* Centered intro block — spot illustration, title, intro text. Editorial-magazine feel. */}
        {variant !== "secondary" ? (
          <div className="flex flex-col items-center text-center mb-8">
            {theme.iconSrc && (
              <Image
                src={theme.iconSrc}
                alt=""
                aria-hidden="true"
                width={288}
                height={288}
                className="w-32 h-32 md:w-36 md:h-36 select-none pointer-events-none mb-3"
                draggable={false}
              />
            )}
            {!theme.iconSrc && (
              <Icon className="w-10 h-10 md:w-12 md:h-12 text-[#7a7062] mb-3" />
            )}
            <h2 className="text-3xl md:text-5xl font-semibold text-[#1a1a1a] tracking-tight mb-5">
              {theme.name}
            </h2>
            {theme.bridgeText && (
              <p className="text-xl md:text-2xl text-[#6a6a6a] leading-snug tracking-tight max-w-2xl">
                {renderEmphasizedText(theme.bridgeText)}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-5">
            <Icon className="w-5 h-5 text-[#a0937d]" />
            <h2 className="text-xl md:text-2xl font-semibold text-[#6a6a6a]">
              {theme.name}
            </h2>
          </div>
        )}

        {/* Block-pilot flag — when active (hverdagsliv bento, mat-drikke carousel),
            banner illustration is suppressed — the block IS the visual. */}
        {(() => { return null; })()}
        {/* Optional banner illustration — hidden for themes with a custom block */}
        {variant !== "secondary" && theme.image && theme.id !== "hverdagsliv" && theme.id !== "mat-drikke" && theme.id !== "transport" && theme.id !== "natur-friluftsliv" && theme.id !== "trening-aktivitet" && (
          <div className="mt-4 mb-12 w-full">
            <Image
              src={theme.image.src}
              alt=""
              aria-hidden="true"
              width={theme.image.width}
              height={theme.image.height}
              sizes="(min-width: 1024px) 800px, 100vw"
              className="w-full h-auto select-none pointer-events-none"
              draggable={false}
              priority={false}
            />
          </div>
        )}

        {/* PILOT: Bento showcase — Hverdagsliv. Rendyrket rundt Valentinlyst Senter
            (ETT subjekt, alle celler handler om det). Horisont-kortet rendres som egen
            blokk under. */}
        {variant !== "secondary" && theme.id === "hverdagsliv" && (() => {
          const bentoCells = getValentinlystBento(theme.allPOIs, center);
          if (!bentoCells) return null;
          return (
            <>
              <BentoShowcase
                sectionKicker="Nabolagets nav"
                sectionTitle="Alt i Valentinlyst Senter"
                cells={bentoCells}
              />
              <BentoShowcase cells={[getHverdagslivHorizonCell()]} />
            </>
          );
        })()}

        {/* PILOT: Feature carousel — Mat & Drikke. Mange likeverdige spisesteder,
            ingen klar hub — perfekt for horisontal scroll av uniforme kort. */}
        {variant !== "secondary" && theme.id === "mat-drikke" && theme.allPOIs.length > 0 && (() => {
          const items = getMatDrikkeCarousel(theme.allPOIs, center);
          const avg = theme.stats.avgRating;
          return (
            <FeatureCarousel
              sectionKicker="Innen rekkevidde"
              sectionTitle="Spisesteder i nabolaget"
              footer={
                avg != null
                  ? `${items.length} av ${theme.stats.totalPOIs} spisesteder · snittrating ${avg.toFixed(1)}`
                  : `${items.length} av ${theme.stats.totalPOIs} spisesteder`
              }
              items={items}
            />
          );
        })()}

        {/* PILOT: TimelineRow + StatRow — Barn & Aktivitet. Skole-progresjon
            (barneskole → ungdomsskole → VGS) som timeline, støtte-stats under. */}
        {variant !== "secondary" && theme.id === "barn-oppvekst" && theme.allPOIs.length > 0 && (() => {
          const timelineNodes = getBarnTimeline(theme.allPOIs, center);
          const statItems = getBarnStats(theme.allPOIs, center);
          return (
            <>
              {timelineNodes && (
                <TimelineRow
                  sectionKicker="Skoleløpet"
                  sectionTitle="Fra første klasse til videregående"
                  nodes={timelineNodes}
                />
              )}
              {statItems.length > 0 && (
                <StatRow
                  sectionKicker="Ellers i nabolaget"
                  sectionTitle="Barnefamilien har alt nær"
                  items={statItems}
                />
              )}
            </>
          );
        })()}

        {/* PILOT: AnnotatedMap — Natur & Friluftsliv. Redaksjonell illustrasjon
            med nummererte callouts for nære park/natur-POIer. */}
        {variant !== "secondary" && theme.id === "natur-friluftsliv" && theme.image && theme.allPOIs.length > 0 && (() => {
          const markers = getNaturMarkers(theme.allPOIs, center);
          if (markers.length === 0) return null;
          return (
            <AnnotatedMap
              sectionKicker="Steder i grønt"
              sectionTitle="Dine nærmeste natur-punkter"
              image={theme.image.src}
              imageWidth={theme.image.width}
              imageHeight={theme.image.height}
              markers={markers}
            />
          );
        })()}

        {/* PILOT: SplitFeature — Trening & Aktivitet. Diptyk som bryter ut av
            sentrert kolonne, venstre tekst + høyre illustrasjon. */}
        {variant !== "secondary" && theme.id === "trening-aktivitet" && theme.image && (
          <SplitFeature
            kicker="Aktivitet i hverdagen"
            title="**Trening rundt hjørnet** — ikke som ekstra avtale."
            body={
              theme.bridgeText ??
              "Gym og utendørs treningsparker innen gangavstand. Når dagens rytme allerede passerer dem, blir aktivitet en vane — ikke et prosjekt."
            }
            bullets={[
              { value: `${theme.stats.totalPOIs}`, label: "treningstilbud i nabolaget" },
              theme.stats.avgRating != null
                ? { value: theme.stats.avgRating.toFixed(1), label: "snittrating på Google" }
                : null,
            ].filter(Boolean) as Array<{ label: string; value?: string }>}
            image={theme.image.src}
            imageWidth={theme.image.width}
            imageHeight={theme.image.height}
            tone="cream"
          />
        )}

        {/* PILOT: EditorialPull — demonstreres på Hverdagsliv som "breather"
            mellom bento og horisont. Hardkodet sitat for pilot. */}
        {variant !== "secondary" && theme.id === "hverdagsliv" && (
          <EditorialPull
            quote="Valentinlyst er ikke et shoppingmål — det er nabolagets praktiske nav. Det er der du møter naboen i kø ved apoteket."
            attribution="Redaksjonell observasjon · Placy"
          />
        )}

        {/* PILOT: StatRow — Transport. Live data (Entur/GBFS) + statiske reise-
            tidsberegninger til Trondheim-ankerpunkter (sentrum, Leangen, Værnes). */}
        {variant !== "secondary" && theme.id === "transport" && (() => {
          const items = getTransportStats(theme.allPOIs, center, isTransport ? transportDashboard : null);
          if (items.length === 0) return null;
          return (
            <StatRow
              sectionKicker="Nøkkeltall"
              sectionTitle="Slik beveger du deg"
              footer="Sanntidsdata: Entur og Trondheim Bysykkel · Statiske beregninger: haversine × gjennomsnittshastighet per transportmåte"
              items={items}
            />
          );
        })()}

        {/* Upper narrative — over kortene (buss, bysykkel, sparkesykkel) */}
        {variant !== "secondary" && upperSegments.length > 0 && (
          <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8] mb-6">
            {upperSegments.map((seg, i) =>
              seg.type === "poi" && seg.poi ? (
                <POIPopover key={i} poi={seg.poi} label={seg.content} />
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

        {/* Lower narrative — alltid full høyde. Progressive disclosure håndteres
            nedenfor med en tease-peek av grounding-narrativen. */}
        {segments.length > 0 && (
          <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
            {segments.map((seg, i) =>
              seg.type === "poi" && seg.poi ? (
                <POIPopover key={i} poi={seg.poi} label={seg.content} />
              ) : seg.type === "external" && seg.url ? (
                <ExternalInlineLink key={i} content={seg.content} url={seg.url} />
              ) : (
                <span key={i}>{seg.content}</span>
              ),
            )}
          </div>
        )}

        {/* Fallback: vis intro hvis ingen lower narrative */}
        {segments.length === 0 && theme.intro && (
          <p className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
            {theme.intro}
          </p>
        )}

        {/* Progressiv disclosure nivå 2 — grounding-narrativ + kart + sources.
            Når !expanded rendres kun en peek av grounding-narrativen bak fade
            (tease-signal: "det ligger mer her"). */}
        {variant !== "secondary" && (segments.length > 0 || theme.intro) && (
          <>
            {/* Transport: address input sitter over grounding. Kun synlig når expanded. */}
            {expanded && isTransport && projectName && (
              <div className="mt-6">
                <ReportAddressInput
                  propertyCoordinates={[center.lng, center.lat]}
                  propertyName={projectName}
                />
              </div>
            )}

            {/* Grounding-narrativ — tease (peek) når !expanded, full når expanded.
                Peek fader teksten bak gradient for å signalere "her ligger mer". */}
            {theme.grounding && (
              <div className="relative mt-4">
                <div
                  className={
                    expanded
                      ? ""
                      : "max-h-[60px] overflow-hidden pointer-events-none select-none"
                  }
                  aria-hidden={expanded ? undefined : true}
                >
                  {theme.grounding.groundingVersion === 2 ? (
                    <ReportCuratedGrounded
                      grounding={theme.grounding}
                      poisById={poisById}
                    />
                  ) : (
                    <ReportGroundingInline grounding={theme.grounding} />
                  )}
                </div>
                {!expanded && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-white"
                  />
                )}
              </div>
            )}

            {/* Les mer / Vis mindre — sentrert under gradient. */}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-medium text-[#6a5f51] hover:text-[#3a3530] transition-colors"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <>
                    Vis mindre
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Les mer om {theme.name}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Kart-preview — under grounding-narrativen, over kilder/legal.
                !mapDialogOpen hindrer dual-WebGL-kontekst på iOS. */}
            {expanded && !mapDialogOpen && theme.allPOIs.length > 0 && (
              <div className="mt-8 animate-in fade-in duration-300">
                <button
                  type="button"
                  onClick={openMap}
                  className="h-[320px] md:h-[440px] rounded-2xl overflow-hidden border border-[#eae6e1] relative w-full block cursor-pointer hover:border-[#d4cfc8] transition-colors group"
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
                  <div className="absolute inset-0 bg-gradient-to-t from-[#f5f1ec] to-transparent pointer-events-none z-10" />
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center translate-y-[25%] pointer-events-none">
                    <p className="text-sm text-[#2a2a2a] font-semibold mb-3">
                      {theme.allPOIs.length} steder på kartet
                    </p>
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-full shadow-lg border border-[#eae6e1] text-sm font-medium text-[#1a1a1a] group-hover:shadow-xl group-hover:border-[#d4cfc8] transition-all">
                      <MapPin className="w-4 h-4 text-[#7a7062]" />
                      Utforsk kartet
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Kilder + Google foreslår også + attribution — helt på bunn. */}
            {expanded && theme.grounding && (
              <ReportGroundingSources grounding={theme.grounding} />
            )}
          </>
        )}

      </div>

      {/* Unified map modal — alltid mounted (dialog-state styrer open) */}
      {theme.allPOIs.length > 0 && (
        <>
          <UnifiedMapModal
            open={mapDialogOpen}
            onOpenChange={setMapDialogOpen}
            title={theme.name}
            has3dAddon={has3dAddon}
            pois={theme.allPOIs}
            center={center}
            areaSlug={areaSlug}
            mapboxSlot={(ctx) => (
              <ReportThemeMap
                pois={theme.allPOIs}
                center={center}
                highlightedPOIId={ctx.activePOI}
                featuredPOIIds={isTransport ? undefined : featuredPOIIds}
                /* Handler-drevne side-effekter: flyTo/scroll kjøres direkte i klikk-
                   handlers, IKKE via useEffect som leser state. Årsak: React batcher
                   state-updates, og ved rask klikking kan en effect lese state med
                   feil `source` etter neste klikk — se plan 2026-04-19. */
                onMarkerClick={(poiId) => {
                  if (ctx.activePOI === poiId) {
                    ctx.setActivePOI(null);
                    return;
                  }
                  ctx.setActivePOI(poiId, "marker");
                  // Kartet er allerede sentrert rundt markøren — kun scroll.
                  ctx.mapController.scrollCardIntoView(poiId, {
                    behavior: "instant",
                  });
                }}
                onMapClick={() => ctx.setActivePOI(null)}
                mapStyle={mapStyle}
                activated={true}
                projectName={projectName}
                trails={theme.trails}
                poiLiveInfo={poiLiveInfo}
                mapChips={mapChips}
                vehiclePositions={vehiclePositions}
              />
            )}
            google3dSlot={(ctx) => (
              <Google3DSlotContent
                ctx={ctx}
                themeId={theme.id}
                pois={theme.allPOIs}
                center={center}
                projectName={projectName}
              />
            )}
            bottomSlot={(ctx) => {
              // Gjenbruker precomputed theme.topRanked (rating × tier-vekt, cap 10).
              // Samme sort-funksjon som text-slider → første 6 i modal matcher slider.
              // Delt carousel på tvers av 2D/3D — mapController er adapter-
              // agnostisk og flyr kamera i begge moduser. Se plan
              // 2026-04-19-feat-delte-kartlag-3d-rute-plan.md.
              if (theme.topRanked.length === 0) return null;
              return (
                <ReportMapBottomCarousel
                  pois={theme.topRanked}
                  ariaLabel={`Steder i ${theme.name}`}
                  activePOIId={ctx.activePOI}
                  onCardClick={(poiId) => {
                    if (ctx.activePOI === poiId) {
                      ctx.setActivePOI(null);
                      return;
                    }
                    ctx.setActivePOI(poiId, "card");
                    // Kortet er allerede synlig — ingen scroll, kun flyTo.
                    ctx.mapController.flyTo(poiId);
                  }}
                  registerCardRef={ctx.registerCardElement}
                  areaSlug={areaSlug}
                />
              );
            }}
          />
        </>
      )}
    </section>
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

// ---------------------------------------------------------------------------
// Google3DSlotContent — dedikert komponent for 3D-render-slot.
// Ekstrahert for å holde rules-of-hooks ren (render-props kan kjøres
// betinget av UnifiedMapModal, så hooks kan ikke ligge i inline-arrow).
// ---------------------------------------------------------------------------

interface Google3DSlotContentProps {
  ctx: SlotContext;
  themeId: string;
  pois: POI[];
  center: Coordinates;
  projectName?: string;
}

function Google3DSlotContent({
  ctx,
  themeId,
  pois,
  center,
  projectName,
}: Google3DSlotContentProps) {
  // Lokal map3d-state for deklarativ RouteLayer3D-mount. UnifiedMapModal har
  // sin egen ref via ctx.registerGoogle3dMap; vi speiler den her slik at
  // RouteLayer3D kan re-rendre når map3d blir klar (en ref ville ikke
  // trigget re-render).
  const [map3dInstance, setMap3dInstance] = useState<Map3DInstance | null>(null);

  const handleMapReady = useCallback(
    (m: Map3DInstance | null) => {
      ctx.registerGoogle3dMap(m);
      setMap3dInstance(m);
    },
    [ctx],
  );

  return (
    <>
      <MapView3D
        mapId={`theme-3d-${themeId}`}
        center={{ lat: center.lat, lng: center.lng, altitude: 0 }}
        cameraLock={DEFAULT_CAMERA_LOCK}
        pois={pois}
        activePOIId={ctx.activePOI}
        onPOIClick={(poiId) => {
          // Parity med 2D-marker-click: scroll korresponderende kort i
          // visning (AC-4). Kartet er allerede sentrert rundt markøren —
          // ingen flyTo her (brukeren traff akkurat den).
          if (ctx.activePOI === poiId) {
            ctx.setActivePOI(null);
            return;
          }
          ctx.setActivePOI(poiId, "marker");
          ctx.mapController.scrollCardIntoView(poiId, {
            behavior: "instant",
          });
        }}
        onMapReady={handleMapReady}
        activated
        projectSite={
          projectName
            ? {
                lat: center.lat,
                lng: center.lng,
                name: projectName,
              }
            : undefined
        }
      />
      {/* Walking-rute fra prosjekt til aktiv POI (AC-6 til AC-10). */}
      <RouteLayer3D map3d={map3dInstance} routeData={ctx.routeData} />
    </>
  );
}
