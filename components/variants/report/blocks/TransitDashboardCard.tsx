"use client";

import { useState, useEffect } from "react";
import { Bus, Train, TramFront, TrainFrontTunnel, CarTaxiFront, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import type { StopDepartures } from "@/lib/hooks/useTransportDashboard";

// --- Config ---

const CATEGORIES = [
  { id: "train", label: "Tog", Icon: Train },
  { id: "metro", label: "T-bane", Icon: TrainFrontTunnel },
  { id: "tram", label: "Trikk", Icon: TramFront },
  { id: "bus", label: "Buss", Icon: Bus },
  { id: "taxi", label: "Taxi", Icon: CarTaxiFront },
] as const;

// --- Props ---

interface TransitDashboardCardProps {
  stops: StopDepartures[];
  loading: boolean;
  lastUpdated: Date | null;
  transitCount: number;
  /** Optional illustration shown bottom-left as a subtle decoration */
  illustrationSrc?: string;
}

// --- StopRow ---

function StopRow({ stop }: { stop: StopDepartures }) {
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(stop.stopName + " holdeplass")}&udm=50`;

  return (
    <a
      href={googleUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 border-b border-[#f0ede8] last:border-0 -mx-5 px-5 md:-mx-6 md:px-6 hover:bg-[#f5f3ef] transition-colors group"
    >
      <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 truncate">
        {stop.stopName}
      </span>
      <span className="text-sm text-[#8a8a8a] shrink-0">{stop.walkMin} min</span>
      <ArrowUpRight className="w-3.5 h-3.5 text-[#c0b8b0] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

// --- Main component ---

export default function TransitDashboardCard({
  stops,
  loading,
  lastUpdated,
  transitCount,
  illustrationSrc,
}: TransitDashboardCardProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Group stops per category
  const grouped: Record<string, StopDepartures[]> = {};
  for (const stop of stops) {
    const cat = stop.categoryId ?? "bus";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(stop);
  }

  const activeCategories = CATEGORIES.filter((cat) => (grouped[cat.id]?.length ?? 0) > 0);
  const showTabs = activeCategories.length >= 2;

  // Set active tab when data arrives (avoids race condition on mount)
  useEffect(() => {
    if (!activeTab && activeCategories.length > 0) {
      setActiveTab(activeCategories[0].id);
    }
  }, [activeCategories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedTab = activeTab ?? activeCategories[0]?.id ?? "bus";
  const currentStops = grouped[resolvedTab] ?? stops;

  return (
    <div className="rounded-xl bg-[#faf9f7] border border-[#eae6e1] px-5 py-4 md:px-6 md:py-5 mb-6 relative">
      {/* Background illustration */}
      {illustrationSrc && (
        <div className="absolute bottom-0 left-0 w-28 h-20 pointer-events-none" aria-hidden>
          <Image
            src={illustrationSrc}
            alt=""
            fill
            className="object-cover object-bottom opacity-[0.12]"
            sizes="112px"
          />
        </div>
      )}

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
        <div className="animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-3 border-b border-[#f0ede8] last:border-0"
            >
              <div className="h-4 bg-[#eae6e1] rounded flex-1" />
              <div className="h-4 bg-[#eae6e1] rounded w-12" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && stops.length === 0 && (
        <div className="text-sm text-[#a0a0a0]">
          Ingen kollektivtransport innen 5 min gange
        </div>
      )}

      {/* Content */}
      {stops.length > 0 && (
        <>
          {showTabs ? (
            <Tabs value={resolvedTab} onValueChange={setActiveTab} className="flex-col gap-0">
              <TabsList className="mb-3 h-8 w-full gap-0 bg-[#f0ede8] rounded-full px-1">
                {activeCategories.map((cat) => {
                  const Icon = cat.Icon;
                  return (
                    <TabsTrigger
                      key={cat.id}
                      value={cat.id}
                      className="flex-1 gap-1.5 px-2 py-1 text-xs rounded-full data-[state=active]:bg-[#2c2521] data-[state=active]:text-white text-[#8a8a8a]"
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
                    {catStops.map((stop) => (
                      <StopRow key={stop.stopId} stop={stop} />
                    ))}
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <div>
              {currentStops.map((stop) => (
                <StopRow key={stop.stopId} stop={stop} />
              ))}
            </div>
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
