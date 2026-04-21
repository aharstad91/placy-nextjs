"use client";

import { useMemo } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { resolveThemeId } from "@/lib/themes";
import { getIcon } from "@/lib/utils/map-icons";
import { useTransportDashboard } from "@/lib/hooks/useTransportDashboard";
import type { StopDepartures } from "@/lib/hooks/useTransportDashboard";
import TransitDashboardCard from "./blocks/TransitDashboardCard";

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
// 3. Transport — Live Dashboard
// ============================================================

// DEMO: hardkodede stopp for å vise alle tre tabs (Tog / Trikk / Buss)
const DEMO_EXTRA_STOPS: StopDepartures[] = [
  { stopName: "Leangen stasjon", stopId: "demo-train-2", walkMin: 3, categoryId: "train", quays: [], departures: [] },
  { stopName: "Marienborg stasjon", stopId: "demo-train-3", walkMin: 4, categoryId: "train", quays: [], departures: [] },
  { stopName: "Heimdal stasjon", stopId: "demo-train-4", walkMin: 5, categoryId: "train", quays: [], departures: [] },
  { stopName: "Kongens gate", stopId: "demo-tram-1", walkMin: 2, categoryId: "tram", quays: [], departures: [] },
  { stopName: "Skansen", stopId: "demo-tram-2", walkMin: 3, categoryId: "tram", quays: [], departures: [] },
  { stopName: "Elgeseter gate", stopId: "demo-tram-3", walkMin: 4, categoryId: "tram", quays: [], departures: [] },
  { stopName: "Nedre Elvehavn", stopId: "demo-tram-4", walkMin: 5, categoryId: "tram", quays: [], departures: [] },
  { stopName: "Jernbanetorget T-bane", stopId: "demo-metro-1", walkMin: 1, categoryId: "metro", quays: [], departures: [] },
  { stopName: "Nationaltheatret", stopId: "demo-metro-2", walkMin: 2, categoryId: "metro", quays: [], departures: [] },
  { stopName: "Stortinget", stopId: "demo-metro-3", walkMin: 3, categoryId: "metro", quays: [], departures: [] },
  { stopName: "Taxi — Sentralstasjonen", stopId: "demo-taxi-1", walkMin: 1, categoryId: "taxi", quays: [], departures: [] },
  { stopName: "Taxi — Torget", stopId: "demo-taxi-2", walkMin: 3, categoryId: "taxi", quays: [], departures: [] },
  { stopName: "Taxi — Pirsenteret", stopId: "demo-taxi-3", walkMin: 4, categoryId: "taxi", quays: [], departures: [] },
];

function TransportDashboard({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;
  const dashboard = useTransportDashboard(pois, center);

  const transitStops = pois.filter(
    (p) =>
      estimateWalkMin(p, center) <= 5 &&
      ["bus", "tram", "train"].includes(p.category.id),
  ).length;

  const demoStops = [...dashboard.departures, ...DEMO_EXTRA_STOPS];

  return (
    <TransitDashboardCard
      stops={demoStops}
      loading={dashboard.loading}
      lastUpdated={dashboard.lastUpdated}
      transitCount={transitStops}
    />
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
  transport: TransportDashboard,
  opplevelser: OpplevelserInsight,
};

/** Tier 1 extractors — returns the POIs shown in the hero insight card */
const TIER1_EXTRACTORS: Record<
  string,
  (pois: POI[], center: Coordinates) => POI[]
> = {
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
  opplevelser: (pois, center) => {
    return KULTUR_TYPES.map((t) => nearestOf(pois, center, ...t.catIds)).filter(
      Boolean,
    ) as POI[];
  },
};
