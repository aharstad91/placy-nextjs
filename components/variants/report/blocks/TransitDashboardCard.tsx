"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Bus, Train, TramFront } from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import type { StopDepartures, QuayDepartures } from "@/lib/hooks/useTransportDashboard";
import type { EnturDeparture } from "@/lib/hooks/useRealtimeData";
import { formatRelativeDepartureTime } from "@/lib/utils/format-time";

// --- Config ---

const CATEGORIES = [
  { id: "train", label: "Tog", Icon: Train },
  { id: "tram", label: "Trikk", Icon: TramFront },
  { id: "bus", label: "Buss", Icon: Bus },
] as const;

// --- Props ---

interface TransitDashboardCardProps {
  stops: StopDepartures[];
  loading: boolean;
  lastUpdated: Date | null;
  transitCount: number;
}

// --- DepartureGrid (inner helper) ---

function DepartureGrid({ stop }: { stop: StopDepartures }) {
  const hasQuays = stop.quays && stop.quays.length > 0;

  if (hasQuays) {
    return (
      <div className="mt-1 grid grid-cols-2 gap-x-8 gap-y-3">
        {stop.quays.map((quay: QuayDepartures) => {
          if (quay.departures.length === 0) return null;
          const directionLabel = quay.departures[0].destination;
          return (
            <div key={quay.quayId} className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.1em] text-[#a0937d] font-medium mb-1 truncate">
                → {directionLabel}
              </div>
              <div className="space-y-0.5">
                {quay.departures.map((dep: EnturDeparture, i: number) => (
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
    );
  }

  if (stop.departures.length === 0) {
    return <div className="text-sm text-[#a0a0a0] py-1">Ingen avganger</div>;
  }

  return (
    <div className="space-y-0.5 mt-1">
      {stop.departures.slice(0, 4).map((dep: EnturDeparture, i: number) => (
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
          <span className="text-[#6a6a6a] flex-1 min-w-0 truncate">{dep.destination}</span>
          <span className="text-[#8a8a8a] shrink-0">
            om {formatRelativeDepartureTime(dep.departureTime)}
          </span>
        </div>
      ))}
    </div>
  );
}

// --- StopAccordionRow ---

function StopAccordionRow({
  stop,
  isOpen,
  onToggle,
}: {
  stop: StopDepartures;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#f0ede8] last:border-0">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-3 py-3 text-left"
      >
        <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 truncate">
          {stop.stopName}
        </span>
        <span className="text-sm text-[#8a8a8a] shrink-0">{stop.walkMin} min</span>
        <ChevronDown
          className={`w-4 h-4 text-[#a0937d] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="pb-3">
          <DepartureGrid stop={stop} />
        </div>
      )}
    </div>
  );
}

// --- StopList (handles accordion vs flat per-tab) ---

function StopList({
  stops,
  showAccordion,
  openStops,
  onToggle,
}: {
  stops: StopDepartures[];
  showAccordion: boolean;
  openStops: Set<string>;
  onToggle: (stopId: string) => void;
}) {
  if (stops.length === 0) {
    return (
      <div className="text-sm text-[#a0a0a0] py-2">Ingen holdeplasser funnet</div>
    );
  }

  if (!showAccordion) {
    // Flat visning — 1 stopp
    return <DepartureGrid stop={stops[0]} />;
  }

  return (
    <div>
      {stops.map((stop) => (
        <StopAccordionRow
          key={stop.stopId}
          stop={stop}
          isOpen={openStops.has(stop.stopId)}
          onToggle={() => onToggle(stop.stopId)}
        />
      ))}
    </div>
  );
}

// --- Main component ---

export default function TransitDashboardCard({
  stops,
  loading,
  lastUpdated,
  transitCount,
}: TransitDashboardCardProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [openStops, setOpenStops] = useState<Set<string>>(new Set());

  // Grupper stopp per kategori
  const grouped: Record<string, StopDepartures[]> = {};
  for (const stop of stops) {
    const cat = stop.categoryId ?? "bus";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(stop);
  }

  const activeCategories = CATEGORIES.filter((cat) => (grouped[cat.id]?.length ?? 0) > 0);
  const showTabs = activeCategories.length >= 2;

  // Sett aktiv tab når data ankommer (unngår race condition med tom array på mount)
  useEffect(() => {
    if (!activeTab && activeCategories.length > 0) {
      setActiveTab(activeCategories[0].id);
    }
  }, [activeCategories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedTab = activeTab ?? activeCategories[0]?.id ?? "bus";

  const toggleStop = (stopId: string) =>
    setOpenStops((prev) =>
      prev.has(stopId)
        ? (() => {
            const s = new Set(prev);
            s.delete(stopId);
            return s;
          })()
        : new Set(prev).add(stopId),
    );

  return (
    <div className="rounded-xl bg-[#faf9f7] border border-[#eae6e1] px-5 py-4 md:px-6 md:py-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-[0.15em] text-[#a0937d] font-medium">
          Kollektivtransport
        </div>
        {lastUpdated && (
          <div className="text-xs text-[#b0a898]">
            oppdatert kl{" "}
            {lastUpdated.toLocaleTimeString("nb-NO", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && stops.length === 0 && (
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

      {/* Tom tilstand */}
      {!loading && stops.length === 0 && (
        <div className="text-sm text-[#a0a0a0]">
          Ingen kollektivtransport innen 5 min gange
        </div>
      )}

      {/* Innhold */}
      {stops.length > 0 && (
        <>
          {showTabs ? (
            <Tabs
              value={resolvedTab}
              onValueChange={setActiveTab}
              className="gap-0"
            >
              <TabsList className="mb-3 h-8 gap-1 bg-[#f0ede8] rounded-full px-1">
                {activeCategories.map((cat) => {
                  const Icon = cat.Icon;
                  return (
                    <TabsTrigger
                      key={cat.id}
                      value={cat.id}
                      className="gap-1.5 px-3 py-1 text-xs rounded-full data-active:bg-white data-active:shadow-sm data-active:text-[#1a1a1a] text-[#8a8a8a]"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cat.label}
                      <span className="opacity-60 ml-0.5">{grouped[cat.id].length}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {activeCategories.map((cat) => {
                const catStops = grouped[cat.id] ?? [];
                return (
                  <TabsContent key={cat.id} value={cat.id} className="mt-0">
                    <StopList
                      stops={catStops}
                      showAccordion={catStops.length >= 2}
                      openStops={openStops}
                      onToggle={toggleStop}
                    />
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <StopList
              stops={grouped[resolvedTab] ?? stops}
              showAccordion={(grouped[resolvedTab] ?? stops).length >= 2}
              openStops={openStops}
              onToggle={toggleStop}
            />
          )}
        </>
      )}

      {/* Footer */}
      {transitCount > 0 && (
        <div className="mt-3 pt-3 border-t border-[#eae6e1] text-sm text-[#8a8a8a]">
          {transitCount} holdeplasser innen 5 min gange
        </div>
      )}
    </div>
  );
}
