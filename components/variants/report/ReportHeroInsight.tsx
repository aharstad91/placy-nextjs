"use client";

import { useMemo } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { resolveThemeId } from "@/lib/themes";
import { getIcon } from "@/lib/utils/map-icons";
import { useTransportDashboard } from "@/lib/hooks/useTransportDashboard";
import TransitDashboardCard from "./blocks/TransitDashboardCard";
import { estimateWalkMin, nearestOf, KULTUR_TYPES } from "./hero-insight-pois";

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

// Tier-1 POI-utvelgerne (getHeroInsightPOIIds + TIER1_EXTRACTORS + rene helpers)
// bor i ./hero-insight-pois.ts slik at de kan kalles server-side. Her lever kun
// render-siden (klientkomponenter + display-helpers).

// ============================================================
// Shared display helper
// ============================================================

function fmtWalk(poi: POI, center: Coordinates): string {
  const m = estimateWalkMin(poi, center);
  return m > 0 ? `${m} min` : "";
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

function TransportDashboard({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;
  const dashboard = useTransportDashboard(pois, center);

  const transitStops = pois.filter(
    (p) =>
      estimateWalkMin(p, center) <= 5 &&
      ["bus", "tram", "train"].includes(p.category.id),
  ).length;

  return (
    <TransitDashboardCard
      stops={dashboard.departures}
      loading={dashboard.loading}
      lastUpdated={dashboard.lastUpdated}
      transitCount={transitStops}
    />
  );
}

// ============================================================
// 7. Opplevelser — Kulturtilbudet
// ============================================================

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
