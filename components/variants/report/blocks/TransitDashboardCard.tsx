"use client";

import { useState, useEffect } from "react";
import { Bus, Train, TramFront, TrainFrontTunnel, CarTaxiFront, Sparkles } from "lucide-react";
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

/**
 * Per-category illustrations. Swap in real images once generated.
 * Key = category id, value = /public path.
 */
const CATEGORY_ILLUSTRATIONS: Partial<Record<string, string>> = {
  // train: "/illustrations/transit-train.jpg",
  // metro: "/illustrations/transit-metro.jpg",
  // tram:  "/illustrations/transit-tram.jpg",
  // bus:   "/illustrations/transit-bus.jpg",
  // taxi:  "/illustrations/transit-taxi.jpg",
};

// --- Props ---

interface TransitDashboardCardProps {
  stops: StopDepartures[];
  loading: boolean;
  lastUpdated: Date | null;
  transitCount: number;
}

// --- StopRow ---

function StopRow({ stop }: { stop: StopDepartures }) {
  const googleUrl = `https://www.google.com/search?udm=50&q=${encodeURIComponent(stop.stopName + " holdeplass avganger")}`;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#f0ede8] last:border-0">
      <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 truncate">
        {stop.stopName}
      </span>
      <span className="text-sm text-[#8a8a8a] shrink-0">{stop.walkMin} min</span>
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-[#6b5f56] border border-[#e0d8cf] hover:bg-[#f5f3ef] transition-colors shrink-0"
      >
        <Sparkles className="w-3 h-3" />
        Utforsk
      </a>
    </div>
  );
}

// --- StopList with illustration panel ---

function StopList({ stops, categoryId }: { stops: StopDepartures[]; categoryId: string }) {
  const illustrationSrc = CATEGORY_ILLUSTRATIONS[categoryId];

  return (
    <div className="flex gap-3">
      {/* Left: illustration panel (1/3 width) — hidden on mobile to give stop names room */}
      <div className="hidden sm:block w-1/3 shrink-0 relative rounded-lg overflow-hidden bg-[#ede9e3] min-h-[120px]">
        {illustrationSrc ? (
          <Image
            src={illustrationSrc}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 30vw, 200px"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#e6e0d6] to-[#cfc8bd]" />
        )}
      </div>

      {/* Right: stop list (2/3 width) */}
      <div className="flex-1 min-w-0">
        {stops.map((stop) => (
          <StopRow key={stop.stopId} stop={stop} />
        ))}
      </div>
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
              <TabsList className="mb-3 h-9 w-full gap-0 bg-[#f0ede8] rounded-full px-1 py-0 overflow-x-auto scrollbar-hide justify-start sm:justify-center">
                {activeCategories.map((cat) => {
                  const Icon = cat.Icon;
                  return (
                    <TabsTrigger
                      key={cat.id}
                      value={cat.id}
                      className="shrink-0 sm:flex-1 gap-1.5 px-3 sm:px-2 py-1 text-xs rounded-full data-[state=active]:bg-[#2c2521] data-[state=active]:text-white text-[#8a8a8a]"
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {cat.label}
                      <span className="opacity-60 ml-0.5 shrink-0">{grouped[cat.id].length}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {activeCategories.map((cat) => (
                <TabsContent key={cat.id} value={cat.id} className="mt-0">
                  <StopList stops={grouped[cat.id] ?? []} categoryId={cat.id} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <StopList stops={currentStops} categoryId={resolvedTab} />
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
