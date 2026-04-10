"use client";

import { useMemo, useState } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { resolveThemeId } from "@/lib/themes";
import { getSchoolZone } from "@/lib/utils/school-zones";
import { getIcon } from "@/lib/utils/map-icons";
import { Star, MapPin, Bike, Car, Zap, ShoppingBag, ExternalLink, Sparkles } from "lucide-react";
import { isSafeUrl } from "@/lib/utils/url";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useTransportDashboard } from "@/lib/hooks/useTransportDashboard";
import type { StopDepartures } from "@/lib/hooks/useTransportDashboard";
import { formatRelativeDepartureTime } from "@/lib/utils/format-time";

interface HeroInsightProps {
  theme: ReportTheme;
  center: Coordinates;
}

export default function ReportHeroInsight({ theme, center }: HeroInsightProps) {
  const resolved = resolveThemeId(theme.id);
  const Renderer = RENDERERS[resolved];
  if (!Renderer) return null;
  return <Renderer theme={theme} center={center} />;
}

/**
 * Returns the set of POI IDs used in the hero insight card (Tier 1).
 * Used by the text generator to avoid repeating these in prose.
 */
export function getHeroInsightPOIIds(
  themeId: string,
  pois: POI[],
  center: Coordinates,
): Set<string> {
  const resolved = resolveThemeId(themeId);
  const extractor = TIER1_EXTRACTORS[resolved];
  if (!extractor) return new Set();
  return new Set(extractor(pois, center).map((p) => p.id));
}

// ============================================================
// Shared helpers
// ============================================================

/** Haversine distance in meters */
function haversineM(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Walk minutes — uses travelTime if available, else estimates from haversine x 1.3 road factor */
function estimateWalkMin(poi: POI, center: Coordinates): number {
  if (poi.travelTime?.walk != null) return Math.round(poi.travelTime.walk / 60);
  return Math.round((haversineM(center, poi.coordinates) * 1.3) / 83);
}

function fmtWalk(poi: POI, center: Coordinates): string {
  const m = estimateWalkMin(poi, center);
  return m > 0 ? `${m} min` : "";
}

function byWalk(pois: POI[], center: Coordinates): POI[] {
  return [...pois].sort(
    (a, b) => estimateWalkMin(a, center) - estimateWalkMin(b, center),
  );
}

function ofCats(pois: POI[], ...ids: string[]): POI[] {
  const s = new Set(ids);
  return pois.filter((p) => s.has(p.category.id));
}

function nearestOf(pois: POI[], center: Coordinates, ...catIds: string[]): POI | undefined {
  return byWalk(ofCats(pois, ...catIds), center)[0];
}

// ============================================================
// Card wrapper
// ============================================================

function InsightCard({
  title,
  children,
  footer,
  headerRight,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#faf9f7] border border-[#eae6e1] px-5 py-4 md:px-6 md:py-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-[0.15em] text-[#a0937d] font-medium">
          {title}
        </div>
        {headerRight && (
          <div className="text-[11px] text-[#a0a0a0]">{headerRight}</div>
        )}
      </div>
      {children}
      {footer && (
        <div className="mt-3 pt-3 border-t border-[#eae6e1] text-sm text-[#8a8a8a]">
          {footer}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 1. Barn & Aktivitet — Skolekretskortet
// ============================================================

const HIGHER_ED = [
  "vgs",
  "videregående",
  "ntnu",
  "høgskole",
  "høyskole",
  "universitet",
];

function isHigherEd(name: string): boolean {
  const lower = name.toLowerCase();
  return HIGHER_ED.some((kw) => lower.includes(kw));
}

/** Fuzzy match: checks if POI name contains the zone name, tolerating 1 character difference at the end */
function fuzzySchoolMatch(poiName: string, zoneName: string): boolean {
  const poi = poiName.toLowerCase();
  const zone = zoneName.toLowerCase();
  // Exact substring match
  if (poi.includes(zone)) return true;
  // Try matching with last char stripped (handles Blussuvold vs Blussuvoll)
  if (zone.length >= 4 && poi.includes(zone.slice(0, -1))) return true;
  return false;
}

function classifySchools(schools: POI[], center: Coordinates) {
  const zone = getSchoolZone(center.lat, center.lng);

  const nonHigherEd = schools.filter((s) => !isHigherEd(s.name));
  const higherEd = byWalk(schools.filter((s) => isHigherEd(s.name)), center);

  let barneskole: POI | null = null;
  let ungdomsskole: POI | null = null;

  if (zone.barneskole) {
    barneskole =
      nonHigherEd.find((s) => fuzzySchoolMatch(s.name, zone.barneskole!)) ?? null;
  }
  if (zone.ungdomsskole) {
    ungdomsskole =
      nonHigherEd.find((s) => fuzzySchoolMatch(s.name, zone.ungdomsskole!)) ?? null;
  }

  // Fallback: nearest schools if no zone data or no match found
  if (!barneskole && nonHigherEd.length > 0) {
    const sorted = byWalk(nonHigherEd, center);
    barneskole = sorted[0] ?? null;
    if (!ungdomsskole && sorted.length > 1) {
      ungdomsskole = sorted[1] ?? null;
    }
  }

  const hasZone = !!(zone.barneskole || zone.ungdomsskole);
  const vgs = higherEd[0] ?? null;

  return { barneskole, ungdomsskole, vgs, hasZone };
}

function BarnOppvekstInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;
  const schools = ofCats(pois, "skole");
  const kindergartens = ofCats(pois, "barnehage");
  const playgrounds = ofCats(pois, "lekeplass");

  const data = useMemo(
    () => classifySchools(schools, center),
    [schools, center],
  );

  if (!data.barneskole && !data.ungdomsskole && !data.vgs) return null;

  const footerParts: string[] = [];
  if (kindergartens.length > 0)
    footerParts.push(`${kindergartens.length} barnehager`);
  if (playgrounds.length > 0)
    footerParts.push(`${playgrounds.length} lekeplasser`);

  return (
    <InsightCard
      title={data.hasZone ? "Skolekrets" : "Skoler i nærheten"}
      footer={
        footerParts.length > 0 ? (
          <>{footerParts.join(" \u00b7 ")} i nabolaget</>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.barneskole && (
          <SchoolCard level="Barneskole (1–7)" poi={data.barneskole} center={center} />
        )}
        {data.ungdomsskole && (
          <SchoolCard level="Ungdomsskole (8–10)" poi={data.ungdomsskole} center={center} />
        )}
        {data.vgs && <SchoolCard level="Videregående" poi={data.vgs} center={center} />}
      </div>
    </InsightCard>
  );
}

function SchoolCard({ level, poi, center }: { level: string; poi: POI; center: Coordinates }) {
  const [imageError, setImageError] = useState(false);
  const walk = fmtWalk(poi, center);
  const Icon = getIcon(poi.category.icon);

  const imageUrl = poi.featuredImage
    ? poi.featuredImage.includes("mymaps.usercontent.google.com")
      ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
      : poi.featuredImage
    : null;

  const hasImage = imageUrl && !imageError;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-left rounded-lg border border-[#eae6e1] overflow-hidden hover:border-[#d4cfc8] hover:shadow-sm transition-all cursor-pointer bg-white">
          {/* Image / fallback */}
          <div className="aspect-[16/10] relative">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={poi.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: poi.category.color + "15" }}
              >
                <Icon className="w-8 h-8" style={{ color: poi.category.color }} />
              </div>
            )}
          </div>
          {/* Text */}
          <div className="px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#a0937d] mb-0.5">
              {level}
            </div>
            <div className="text-sm font-semibold text-[#1a1a1a] truncate">{poi.name}</div>
            {walk && (
              <div className="flex items-center gap-1 text-xs text-[#8a8a8a] mt-1">
                <MapPin className="w-3 h-3" />
                {walk}
              </div>
            )}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-4 gap-0">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
              style={{ backgroundColor: poi.category.color + "18" }}
            >
              <Icon className="w-4 h-4" style={{ color: poi.category.color }} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight truncate">{poi.name}</div>
              <div className="text-xs text-muted-foreground">{level}</div>
            </div>
          </div>
          {walk && (
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {walk}
              </span>
            </div>
          )}
          {poi.editorialHook && (
            <p className="text-[13px] text-[#3a3a3a] leading-relaxed">{poi.editorialHook}</p>
          )}
          {poi.localInsight && (
            <p className="text-xs text-muted-foreground italic leading-relaxed mt-1.5">
              {poi.localInsight}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// 2. Hverdagsliv — Nærmeste per behov
// ============================================================

type HverdagsConfig = { catIds: string[]; label: string };
type HverdagsRow = { label: string; poi: POI };

const HVERDAGS_ANCHOR = {
  catIds: ["shopping"],
  label: "Kjøpesenter",
} satisfies HverdagsConfig;

const HVERDAGS_PRIMARY = [
  { catIds: ["supermarket", "convenience"], label: "Dagligvare" },
  { catIds: ["pharmacy"], label: "Apotek" },
  { catIds: ["doctor", "dentist", "hospital"], label: "Lege" },
] satisfies HverdagsConfig[];

const HVERDAGS_SECONDARY = [
  { catIds: ["liquor_store"], label: "Vinmonopol" },
  { catIds: ["post"], label: "Post" },
  { catIds: ["bank"], label: "Bank" },
  { catIds: ["haircare"], label: "Frisør" },
] satisfies HverdagsConfig[];

function HverdagslivInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const anchor = useMemo(
    () => nearestOf(pois, center, ...HVERDAGS_ANCHOR.catIds) ?? null,
    [pois, center],
  );

  const primaryRows = useMemo(
    () =>
      HVERDAGS_PRIMARY.map((t) => {
        const poi = nearestOf(pois, center, ...t.catIds);
        return poi ? ({ label: t.label, poi } as HverdagsRow) : null;
      }).filter((r): r is HverdagsRow => r !== null),
    [pois, center],
  );

  const secondaryRows = useMemo(
    () =>
      HVERDAGS_SECONDARY.map((t) => {
        const poi = nearestOf(pois, center, ...t.catIds);
        return poi ? ({ label: t.label, poi } as HverdagsRow) : null;
      }).filter((r): r is HverdagsRow => r !== null),
    [pois, center],
  );

  if (!anchor && primaryRows.length < 1) return null;

  const within10 = pois.filter((p) => estimateWalkMin(p, center) <= 10).length;

  function renderRow(row: HverdagsRow, compact: boolean) {
    const Icon = getIcon(row.poi.category.icon);
    const walk = fmtWalk(row.poi, center);
    return (
      <div key={row.label} className={`flex items-center gap-3 ${compact ? "py-1" : "py-1.5"}`}>
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
          style={{ backgroundColor: row.poi.category.color + "15" }}
        >
          <Icon
            className={compact ? "w-3 h-3" : "w-3.5 h-3.5"}
            style={{ color: row.poi.category.color }}
          />
        </div>
        <span
          className={`font-medium text-[#1a1a1a] flex-1 min-w-0 truncate ${compact ? "text-[13px]" : "text-[15px]"}`}
        >
          {row.poi.name}
        </span>
        <span
          className={`text-[#8a8a8a] shrink-0 hidden sm:inline ${compact ? "text-xs" : "text-sm"}`}
        >
          {row.label}
        </span>
        {walk && (
          <span
            className={`text-[#8a8a8a] shrink-0 w-12 text-right ${compact ? "text-xs" : "text-sm"}`}
          >
            {walk}
          </span>
        )}
      </div>
    );
  }

  return (
    <InsightCard
      title="Hverdagen i gangavstand"
      footer={within10 > 0 ? `${within10} hverdagstjenester innen 10 min` : undefined}
    >
      {/* Tier 1 — Kjøpesenter-anker */}
      {anchor &&
        (() => {
          const walk = fmtWalk(anchor, center);
          const hasWebsite = anchor.googleWebsite && isSafeUrl(anchor.googleWebsite);
          const googleAiUrl = `https://www.google.com/search?udm=50&q=${encodeURIComponent(anchor.name + " butikker åpningstider")}`;
          return (
            <div
              className="rounded-lg p-3 mb-3"
              style={{ backgroundColor: "#22c55e12" }}
              {...(anchor.googlePlaceId ? { "data-google-ai-target": anchor.googlePlaceId } : {})}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" style={{ color: "#22c55e" }} />
                  <span className="font-semibold text-[#1a1a1a] text-[15px]">{anchor.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {walk && <span className="text-sm text-[#8a8a8a]">{walk}</span>}
                  {hasWebsite && (
                    <a
                      href={anchor.googleWebsite!}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
                    </a>
                  )}
                  <a
                    href={googleAiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Sparkles className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
                  </a>
                </div>
              </div>
              {anchor.anchorSummary && (
                <p className="text-xs text-[#6a6a6a] mt-1 ml-6">{anchor.anchorSummary}</p>
              )}
              {anchor.childPOIs && anchor.childPOIs.length > 0 && (
                <div className="mt-2 ml-6 space-y-0.5">
                  {anchor.childPOIs.map((child) => {
                    const ChildIcon = getIcon(child.category.icon);
                    return (
                      <div key={child.id} className="flex items-center gap-2 text-xs text-[#6a6a6a]">
                        <ChildIcon className="w-3 h-3" style={{ color: child.category.color }} />
                        <span>{child.name}</span>
                        <span className="text-[#aaa]">{child.category.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

      {/* Tier 2 — Primærtjenester */}
      <div className="space-y-1">{primaryRows.map((row) => renderRow(row, false))}</div>

      {/* Tier 3 — Sekundærtjenester (kun hvis data finnes) */}
      {secondaryRows.length > 0 && (
        <div className="space-y-0.5 mt-2 pt-2 border-t border-[#f0f0f0]">
          {secondaryRows.map((row) => renderRow(row, true))}
        </div>
      )}
    </InsightCard>
  );
}

// ============================================================
// 3. Transport — Live Dashboard
// ============================================================

function TransportDashboard({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;
  const dashboard = useTransportDashboard(pois, center);

  const transitStops = pois.filter(
    (p) =>
      estimateWalkMin(p, center) <= 5 &&
      ["bus", "tram", "train"].includes(p.category.id),
  ).length;

  // Fallback: if no departures loaded yet, show static stop list
  const hasLiveData = dashboard.departures.length > 0 || dashboard.lastUpdated;

  return (
    <>
      {/* Kollektivliste med sanntidsavganger */}
      <InsightCard
        title="Nærmeste bussholdeplass"
        headerRight={
          dashboard.lastUpdated
            ? `oppdatert kl ${dashboard.lastUpdated.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`
            : undefined
        }
        footer={
          transitStops > 0
            ? `${transitStops} holdeplasser innen 5 min gange`
            : undefined
        }
      >

        {/* Loading skeleton */}
        {dashboard.loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="h-5 bg-[#eae6e1] rounded w-3/4 mb-2" />
                <div className="h-4 bg-[#eae6e1] rounded w-1/2 ml-10 mb-1" />
                <div className="h-4 bg-[#eae6e1] rounded w-2/5 ml-10" />
              </div>
            ))}
          </div>
        )}

        {/* Live departure list */}
        {hasLiveData && !dashboard.loading && (
          <div className="space-y-4">
            {dashboard.departures.map((stop) => (
              <DepartureBlock key={stop.stopId} stop={stop} />
            ))}
          </div>
        )}

        {/* Static fallback if no live data and not loading */}
        {!hasLiveData && !dashboard.loading && (
          <StaticTransportList pois={pois} center={center} />
        )}
      </InsightCard>

      {/* Mobilitetskort — bysykkel, sparkesykkel, bildeling, lading */}
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.15em] text-[#a0937d] font-medium mb-3">
          Tilgjengelig i nærheten
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Bysykkel */}
        <MobilityCard
          icon={<Bike className="w-4 h-4 text-[#3b82f6]" />}
          iconBg="#3b82f620"
          label="Bysykkel"
          value={dashboard.bysykkel
            ? dashboard.bysykkel.total > 0
              ? `${dashboard.bysykkel.total} ledige sykler`
              : "Ingen nå"
            : "–"}
          subtitle={dashboard.bysykkel
            ? dashboard.bysykkel.stations > 0 && dashboard.bysykkel.nearest
              ? `${dashboard.bysykkel.stations} ${dashboard.bysykkel.stations === 1 ? "stasjon" : "stasjoner"} · ${dashboard.bysykkel.nearest.walkMin} min til nærmeste`
              : "Ingen stasjoner innen 800m"
            : "Laster..."}
          loading={dashboard.loading && !dashboard.bysykkel}
          popoverContent={dashboard.bysykkel ? (
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Bike className="w-4 h-4 text-[#3b82f6]" />
                <span className="font-semibold text-sm">Bysykkel i nærheten</span>
              </div>
              {dashboard.bysykkel.stations === 0 ? (
                <div className="text-sm text-[#8a8a8a]">
                  Ingen bysykkelstasjoner innen 800m
                </div>
              ) : (
                <div className="text-sm text-[#4a4a4a] space-y-1">
                  {dashboard.bysykkel.breakdown.slice(0, 5).map((st) => (
                    <div key={st.stationId} className="flex justify-between gap-3">
                      <span className="truncate">
                        {st.name.replace("Trondheim Bysykkel: ", "")}
                      </span>
                      <span className="font-medium whitespace-nowrap">
                        {st.availableBikes} / {st.capacity}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1 border-t border-[#eae6e1] font-medium">
                    <span>Totalt ledige sykler</span>
                    <span>{dashboard.bysykkel.total}</span>
                  </div>
                </div>
              )}
              <div className="text-xs text-[#a0a0a0] mt-2">
                Innen 800m · Trondheim Bysykkel
              </div>
            </div>
          ) : undefined}
        />

        {/* Sparkesykkel */}
        <MobilityCard
          icon={<Zap className="w-4 h-4 text-[#8b5cf6]" />}
          iconBg="#8b5cf620"
          label="Sparkesykkel"
          value={dashboard.scooters
            ? dashboard.scooters.total > 0
              ? `${dashboard.scooters.total} tilgjengelig`
              : "Ingen nå"
            : "–"}
          subtitle={dashboard.scooters?.byOperator
            .map((op) => op.name.replace("_Trondheim", "").replace(" trondheim", ""))
            .join(" · ") || "Laster..."}
          loading={dashboard.loading && !dashboard.scooters}
          popoverContent={dashboard.scooters ? (
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[#8b5cf6]" />
                <span className="font-semibold text-sm">Sparkesykler i nærheten</span>
              </div>
              {dashboard.scooters.total === 0 ? (
                <div className="text-sm text-[#8a8a8a]">
                  Ingen sparkesykler innen 750m akkurat nå
                </div>
              ) : (
                <div className="text-sm text-[#4a4a4a] space-y-1">
                  {dashboard.scooters.byOperator.map((op) => (
                    <div key={op.systemId} className="flex justify-between">
                      <span>{op.name.replace("_Trondheim", "").replace(" trondheim", "")}</span>
                      <span className="font-medium">{op.count}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1 border-t border-[#eae6e1] font-medium">
                    <span>Totalt</span>
                    <span>{dashboard.scooters.total}</span>
                  </div>
                </div>
              )}
              <div className="text-xs text-[#a0a0a0] mt-2">Innen 750m</div>
            </div>
          ) : undefined}
        />

        {/* Bildeling — Hyre + Getaround samlet */}
        {(() => {
          const hyreCount = dashboard.carShare?.numVehiclesAvailable ?? 0;
          const getaroundCount = dashboard.freeFloatingCars?.total ?? 0;
          const totalCars = hyreCount + getaroundCount;
          const hasData = dashboard.carShare || dashboard.freeFloatingCars;
          const providers: string[] = [];
          if (hyreCount > 0) providers.push("Hyre");
          if (getaroundCount > 0) providers.push("Getaround");

          return (
            <MobilityCard
              icon={<Car className="w-4 h-4 text-[#10b981]" />}
              iconBg="#10b98120"
              label="Bildeling"
              value={hasData ? `${totalCars} biler` : "–"}
              subtitle={hasData
                ? providers.join(" · ") || "Laster..."
                : "Laster..."}
              loading={dashboard.loading && !hasData}
              popoverContent={hasData ? (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="w-4 h-4 text-[#10b981]" />
                    <span className="font-semibold text-sm">Bildeling i nærheten</span>
                  </div>
                  <div className="text-sm text-[#4a4a4a] space-y-1">
                    {hyreCount > 0 && dashboard.carShare && (
                      <div className="flex justify-between">
                        <span>Hyre ({dashboard.carShare.stationName})</span>
                        <span className="font-medium">{hyreCount}</span>
                      </div>
                    )}
                    {getaroundCount > 0 && (
                      <div className="flex justify-between">
                        <span>Getaround (fri parkering)</span>
                        <span className="font-medium">{getaroundCount}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-[#eae6e1] font-medium">
                      <span>Totalt</span>
                      <span>{totalCars}</span>
                    </div>
                  </div>
                  <div className="text-xs text-[#a0a0a0] mt-2">Innen 2 km</div>
                </div>
              ) : undefined}
            />
          );
        })()}

        {/* Lading */}
        {(() => {
          const chargingPOIs = pois.filter((p) => p.category.id === "charging_station");
          if (chargingPOIs.length === 0) return null;
          const nearest = chargingPOIs.reduce((a, b) => {
            const aw = estimateWalkMin(a, center);
            const bw = estimateWalkMin(b, center);
            return aw < bw ? a : b;
          });
          const nearestWalk = fmtWalk(nearest, center);

          return (
            <MobilityCard
              icon={<Zap className="w-4 h-4 text-[#f59e0b]" />}
              iconBg="#f59e0b20"
              label="Elbillading"
              value={`${chargingPOIs.length} stasjoner`}
              subtitle={nearestWalk ? `Nærmeste ${nearestWalk} gange` : "I nabolaget"}
              popoverContent={(
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-[#f59e0b]" />
                    <span className="font-semibold text-sm">Ladestasjoner i nærheten</span>
                  </div>
                  <div className="text-sm text-[#4a4a4a] space-y-1.5">
                    {chargingPOIs
                      .sort((a, b) => estimateWalkMin(a, center) - estimateWalkMin(b, center))
                      .map((poi) => (
                        <div key={poi.id} className="flex justify-between gap-2">
                          <span className="truncate">{poi.name}</span>
                          <span className="text-[#8a8a8a] shrink-0">{fmtWalk(poi, center)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            />
          );
        })()}
        </div>
      </div>
    </>
  );
}

// --- Departure block for one stop ---

function DepartureBlock({ stop }: { stop: StopDepartures }) {
  const Icon = getIcon("Bus");

  // Prefer quay-grouped data; fall back to flat departures for backward compat
  const hasQuays = stop.quays && stop.quays.length > 0;

  return (
    <div>
      {/* Stop header */}
      <div className="flex items-center gap-3 py-1">
        <div className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 bg-[#3b82f615]">
          <Icon className="w-3.5 h-3.5 text-[#3b82f6]" />
        </div>
        <a
          href={`https://entur.no/nearby-stop-place-detail?id=${stop.stopId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#1a1a1a] hover:text-[#3b82f6] transition-colors text-[15px] flex-1 min-w-0 truncate"
        >
          {stop.stopName}
        </a>
        <span className="text-sm text-[#8a8a8a] shrink-0">{stop.walkMin} min</span>
      </div>

      {/* Direction blocks per quay — 50/50 grid */}
      {hasQuays ? (
        <div className="ml-10 mt-1 grid grid-cols-2 gap-x-8 gap-y-3">
          {stop.quays.map((quay) => {
            if (quay.departures.length === 0) return null;
            const directionLabel = quay.departures[0].destination;
            return (
              <div key={quay.quayId} className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#a0937d] font-medium mb-1 truncate">
                  → {directionLabel}
                </div>
                <div className="space-y-0.5">
                  {quay.departures.map((dep, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5 text-sm">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          dep.isRealtime ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <span
                        className="font-semibold w-6 shrink-0"
                        style={dep.lineColor ? { color: `#${dep.lineColor}` } : undefined}
                      >
                        {dep.lineCode}
                      </span>
                      <span className="text-[#8a8a8a] shrink-0">
                        om {formatRelativeDepartureTime(dep.departureTime)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : stop.departures.length > 0 ? (
        /* Fallback: flat list */
        <div className="ml-10 space-y-0.5 mt-1">
          {stop.departures.slice(0, 4).map((dep, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5 text-sm">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  dep.isRealtime ? "bg-green-500" : "bg-gray-300"
                }`}
              />
              <span
                className="font-semibold min-w-[2.5rem]"
                style={dep.lineColor ? { color: `#${dep.lineColor}` } : undefined}
              >
                {dep.lineCode}
              </span>
              <span className="text-[#6a6a6a] flex-1 min-w-0 truncate">
                {dep.destination}
              </span>
              <span className="text-[#8a8a8a] shrink-0">
                om {formatRelativeDepartureTime(dep.departureTime)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ml-10 text-sm text-[#a0a0a0] py-0.5">Ingen avganger</div>
      )}
    </div>
  );
}

// --- Mobility card with popover ---

function MobilityCard({
  icon,
  iconBg,
  label,
  value,
  subtitle,
  loading,
  popoverContent,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  subtitle: string;
  loading?: boolean;
  popoverContent?: React.ReactNode;
}) {
  const cardContent = (
    <div className={`rounded-lg border border-[#eae6e1] bg-white p-3 text-center ${popoverContent ? "hover:border-[#d4cfc8] hover:shadow-sm transition-all cursor-pointer" : ""}`}>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-8 bg-[#eae6e1] rounded-full mx-auto" />
          <div className="h-3 bg-[#eae6e1] rounded w-2/3 mx-auto" />
          <div className="h-2.5 bg-[#eae6e1] rounded w-1/2 mx-auto" />
        </div>
      ) : (
        <>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1.5"
            style={{ backgroundColor: iconBg }}
          >
            {icon}
          </div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[#a0937d] mb-0.5">
            {label}
          </div>
          <div className="text-sm font-semibold text-[#1a1a1a]">{value}</div>
          <div className="text-[11px] text-[#8a8a8a] mt-0.5 truncate">{subtitle}</div>
        </>
      )}
    </div>
  );

  if (!popoverContent) return cardContent;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-left w-full">{cardContent}</button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-0 gap-0">
        {popoverContent}
      </PopoverContent>
    </Popover>
  );
}

// --- Static fallback (original stop list) ---

function StaticTransportList({ pois, center }: { pois: POI[]; center: Coordinates }) {
  const stops = useMemo(() => {
    const result: POI[] = [];
    const seen = new Set<string>();
    for (const catId of ["train", "tram", "bus"]) {
      for (const poi of byWalk(ofCats(pois, catId), center)) {
        if (!seen.has(poi.id) && result.length < 4) {
          result.push(poi);
          seen.add(poi.id);
        }
      }
    }
    if (result.length < 4) {
      const bike = nearestOf(pois, center, "bike");
      if (bike && !seen.has(bike.id)) result.push(bike);
    }
    return result;
  }, [pois, center]);

  return (
    <div className="space-y-1">
      {stops.map((poi) => {
        const CatIcon = getIcon(poi.category.icon);
        const walk = fmtWalk(poi, center);
        return (
          <div key={poi.id} className="flex items-center gap-3 py-1.5">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
              style={{ backgroundColor: poi.category.color + "15" }}
            >
              <CatIcon className="w-3.5 h-3.5" style={{ color: poi.category.color }} />
            </div>
            <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 min-w-0 truncate">
              {poi.name}
            </span>
            <span className="text-sm text-[#8a8a8a] shrink-0 hidden sm:inline">
              {poi.category.name}
            </span>
            {walk && (
              <span className="text-sm text-[#8a8a8a] shrink-0 w-12 text-right">{walk}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 4. Natur & Friluftsliv — Primærområde
// ============================================================

function NaturInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const areas = useMemo(() => {
    const sorted = byWalk(pois, center);
    return { primary: sorted[0] ?? null, secondary: sorted.slice(1, 3) };
  }, [pois, center]);

  if (!areas.primary) return null;

  return (
    <InsightCard
      title="Naturen er nær"
      footer={
        pois.length > 1
          ? `${pois.length} parker og grøntområder i nabolaget`
          : undefined
      }
    >
      <div className="mb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold text-[#1a1a1a]">
            {areas.primary.name}
          </span>
          {fmtWalk(areas.primary, center) && (
            <span className="text-sm text-[#8a8a8a]">
              {fmtWalk(areas.primary, center)}
            </span>
          )}
        </div>
        {areas.primary.editorialHook && (
          <p className="text-sm text-[#6a6a6a] mt-1 leading-relaxed">
            {areas.primary.editorialHook}
          </p>
        )}
      </div>

      {areas.secondary.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {areas.secondary.map((poi) => (
            <span key={poi.id} className="text-[#6a6a6a]">
              {poi.name}{" "}
              <span className="text-[#a0937d]">{fmtWalk(poi, center)}</span>
            </span>
          ))}
        </div>
      )}
    </InsightCard>
  );
}

// ============================================================
// 5. Mat & Drikke — Kvalitetsankeret
// ============================================================

function MatDrikkeInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const topRated = useMemo(() => {
    return [...pois]
      .filter((p) => p.googleRating != null && p.googleRating >= 3.5)
      .sort((a, b) => {
        const rd = (b.googleRating ?? 0) - (a.googleRating ?? 0);
        return rd !== 0
          ? rd
          : (b.googleReviewCount ?? 0) - (a.googleReviewCount ?? 0);
      })
      .slice(0, 3);
  }, [pois]);

  if (topRated.length < 2) return null;

  const rated = pois.filter((p) => p.googleRating != null);
  const avg =
    rated.length > 0
      ? (rated.reduce((s, p) => s + (p.googleRating ?? 0), 0) / rated.length).toFixed(1)
      : null;

  return (
    <InsightCard
      title="Lokale favoritter"
      footer={<>{pois.length} spisesteder{avg && <> · snittrating {avg}</>}</>}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {topRated.map((poi) => (
          <FoodCard key={poi.id} poi={poi} center={center} />
        ))}
      </div>
    </InsightCard>
  );
}

function FoodCard({ poi, center }: { poi: POI; center: Coordinates }) {
  const [imageError, setImageError] = useState(false);
  const walk = fmtWalk(poi, center);
  const Icon = getIcon(poi.category.icon);

  const imageUrl = poi.featuredImage
    ? poi.featuredImage.includes("mymaps.usercontent.google.com")
      ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
      : poi.featuredImage
    : null;

  const hasImage = imageUrl && !imageError;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-left rounded-lg border border-[#eae6e1] overflow-hidden hover:border-[#d4cfc8] hover:shadow-sm transition-all cursor-pointer bg-white">
          <div className="aspect-[16/10] relative">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={poi.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: poi.category.color + "15" }}
              >
                <Icon className="w-8 h-8" style={{ color: poi.category.color }} />
              </div>
            )}
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#a0937d] mb-0.5">
              {poi.category.name}
            </div>
            <div className="text-sm font-semibold text-[#1a1a1a] truncate">{poi.name}</div>
            <div className="flex items-center gap-2 mt-1">
              {poi.googleRating != null && (
                <span className="flex items-center gap-0.5 text-xs">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span className="font-medium text-[#1a1a1a]">{poi.googleRating.toFixed(1)}</span>
                </span>
              )}
              {walk && (
                <span className="flex items-center gap-0.5 text-xs text-[#8a8a8a]">
                  <MapPin className="w-3 h-3" />
                  {walk}
                </span>
              )}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-4 gap-0">
        <div>
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
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground mb-2">
            {poi.googleRating != null && (
              <span className="flex items-center gap-0.5">
                <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
                <span className="font-medium text-foreground">{poi.googleRating.toFixed(1)}</span>
                {poi.googleReviewCount != null && <span>({poi.googleReviewCount})</span>}
              </span>
            )}
            {walk && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {walk}
              </span>
            )}
          </div>
          {poi.editorialHook && (
            <p className="text-[13px] text-[#3a3a3a] leading-relaxed">{poi.editorialHook}</p>
          )}
          {poi.localInsight && (
            <p className="text-xs text-muted-foreground italic leading-relaxed mt-1.5">
              {poi.localInsight}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// 6. Trening & Aktivitet — Breddevisning
// ============================================================

const TRENING_TYPES: { catIds: string[]; label: string }[] = [
  { catIds: ["gym"], label: "Treningssenter" },
  { catIds: ["swimming"], label: "Sv\u00f8mmehall" },
  { catIds: ["fitness_park"], label: "Treningspark" },
  { catIds: ["spa"], label: "Spa" },
];

function TreningInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const byType = useMemo(() => {
    return TRENING_TYPES.map((type) => {
      const nearest = nearestOf(pois, center, ...type.catIds);
      if (!nearest) return null;
      return { ...type, poi: nearest };
    }).filter(Boolean) as { catIds: string[]; label: string; poi: POI }[];
  }, [pois, center]);

  if (byType.length < 1) return null;

  return (
    <InsightCard
      title="Hold deg i form"
      footer={`${pois.length} treningsmuligheter i nabolaget`}
    >
      <div className="space-y-1">
        {byType.map(({ poi, label }) => {
          const Icon = getIcon(poi.category.icon);
          const walk = fmtWalk(poi, center);
          return (
            <div key={poi.id} className="flex items-center gap-3 py-1.5">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                style={{ backgroundColor: poi.category.color + "15" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: poi.category.color }} />
              </div>
              <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 min-w-0 truncate">
                {poi.name}
              </span>
              <span className="text-sm text-[#8a8a8a] shrink-0 hidden sm:inline">
                {label}
              </span>
              {walk && (
                <span className="text-sm text-[#8a8a8a] shrink-0 w-12 text-right">{walk}</span>
              )}
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

// ============================================================
// 7. Opplevelser — Kulturtilbudet
// ============================================================

const KULTUR_TYPES: { catIds: string[]; label: string }[] = [
  { catIds: ["library"], label: "Bibliotek" },
  { catIds: ["cinema"], label: "Kino" },
  { catIds: ["museum"], label: "Museum" },
  { catIds: ["theatre"], label: "Teater" },
  { catIds: ["bowling", "amusement"], label: "Underholdning" },
];

function OpplevelserInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const byType = useMemo(() => {
    return KULTUR_TYPES.map((type) => {
      const nearest = nearestOf(pois, center, ...type.catIds);
      if (!nearest) return null;
      return { ...type, poi: nearest };
    }).filter(Boolean) as { catIds: string[]; label: string; poi: POI }[];
  }, [pois, center]);

  if (byType.length < 1) return null;

  return (
    <InsightCard
      title="Kultur i nærheten"
      footer={`${pois.length} kulturopplevelser i nabolaget`}
    >
      <div className="space-y-1">
        {byType.map(({ poi, label }) => {
          const Icon = getIcon(poi.category.icon);
          const walk = fmtWalk(poi, center);
          return (
            <div key={poi.id} className="flex items-center gap-3 py-1.5">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                style={{ backgroundColor: poi.category.color + "15" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: poi.category.color }} />
              </div>
              <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 min-w-0 truncate">
                {poi.name}
              </span>
              <span className="text-sm text-[#8a8a8a] shrink-0 hidden sm:inline">
                {label}
              </span>
              {walk && (
                <span className="text-sm text-[#8a8a8a] shrink-0 w-12 text-right">{walk}</span>
              )}
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

// ============================================================
// Registries
// ============================================================

const RENDERERS: Record<string, React.FC<HeroInsightProps>> = {
  "barn-oppvekst": BarnOppvekstInsight,
  hverdagsliv: HverdagslivInsight,
  hverdagstjenester: HverdagslivInsight,
  transport: TransportDashboard,
  "natur-friluftsliv": NaturInsight,
  "mat-drikke": MatDrikkeInsight,
  "trening-aktivitet": TreningInsight,
  opplevelser: OpplevelserInsight,
};

/** Tier 1 extractors — returns the POIs shown in the hero insight card */
const TIER1_EXTRACTORS: Record<
  string,
  (pois: POI[], center: Coordinates) => POI[]
> = {
  "barn-oppvekst": (pois, center) => {
    const schools = ofCats(pois, "skole");
    const { barneskole, ungdomsskole, vgs } = classifySchools(schools, center);
    return [barneskole, ungdomsskole, vgs].filter(Boolean) as POI[];
  },
  hverdagsliv: (pois, center) => {
    const anchor = nearestOf(pois, center, ...HVERDAGS_ANCHOR.catIds);
    const tier2 = HVERDAGS_PRIMARY.map((t) => nearestOf(pois, center, ...t.catIds));
    return [anchor, ...tier2].filter(Boolean) as POI[];
  },
  hverdagstjenester: (pois, center) => {
    const anchor = nearestOf(pois, center, ...HVERDAGS_ANCHOR.catIds);
    const tier2 = HVERDAGS_PRIMARY.map((t) => nearestOf(pois, center, ...t.catIds));
    return [anchor, ...tier2].filter(Boolean) as POI[];
  },
  transport: (pois, center) => {
    const result: POI[] = [];
    const seen = new Set<string>();
    // Transit stops
    for (const catId of ["train", "tram", "bus"]) {
      for (const poi of byWalk(ofCats(pois, catId), center)) {
        if (!seen.has(poi.id) && result.length < 4) {
          result.push(poi);
          seen.add(poi.id);
        }
      }
    }
    // Nearest bysykkel + carshare for dashboard labels
    const bike = nearestOf(pois, center, "bike");
    if (bike && !seen.has(bike.id)) { result.push(bike); seen.add(bike.id); }
    const car = nearestOf(pois, center, "carshare");
    if (car && !seen.has(car.id)) { result.push(car); seen.add(car.id); }
    return result;
  },
  "natur-friluftsliv": (pois, center) => {
    const sorted = byWalk(pois, center);
    return sorted.slice(0, 3);
  },
  "mat-drikke": (pois) => {
    return [...pois]
      .filter((p) => p.googleRating != null && p.googleRating >= 3.5)
      .sort((a, b) => {
        const rd = (b.googleRating ?? 0) - (a.googleRating ?? 0);
        return rd !== 0
          ? rd
          : (b.googleReviewCount ?? 0) - (a.googleReviewCount ?? 0);
      })
      .slice(0, 3);
  },
  "trening-aktivitet": (pois, center) => {
    return TRENING_TYPES.map((t) => nearestOf(pois, center, ...t.catIds)).filter(
      Boolean,
    ) as POI[];
  },
  opplevelser: (pois, center) => {
    return KULTUR_TYPES.map((t) => nearestOf(pois, center, ...t.catIds)).filter(
      Boolean,
    ) as POI[];
  },
};
