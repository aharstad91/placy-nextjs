"use client";

import { Bike, Car } from "lucide-react";
import type { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { formatRelativeDepartureTime } from "@/lib/utils/format-time";

interface POIRealtimeSectionProps {
  realtimeData: ReturnType<typeof useRealtimeData>;
}

export function POIRealtimeSection({ realtimeData }: POIRealtimeSectionProps) {
  const hasEntur = realtimeData.entur && realtimeData.entur.departures.length > 0;
  const hasBysykkel = !!realtimeData.bysykkel;
  const hasHyre = !!realtimeData.hyre;
  const hasAny = hasEntur || hasBysykkel || hasHyre;

  // Første henting pågår (ingen data ennå) — vis skeleton så brukeren ser
  // at noe er på vei. Faller tilbake til null hvis hentingen ble ferdig uten
  // data (loading=false, hasAny=false).
  if (!hasAny && realtimeData.loading) {
    return (
      <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
        <div className="space-y-1.5 animate-pulse">
          {[68, 56, 44].map((width, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-200 shrink-0" />
              <span
                className="h-2.5 rounded bg-gray-200"
                style={{ width: `${width}%` }}
              />
              <span className="ml-auto h-2.5 w-6 rounded bg-gray-200 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasAny) return null;

  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100 space-y-2">
      {hasEntur && (
        <div className="space-y-1">
          {realtimeData.entur!.departures.slice(0, 3).map((dep, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  dep.isRealtime ? "bg-green-500" : "bg-gray-300"
                }`}
              />
              <span className="flex-1 truncate text-gray-700">
                <span
                  className="font-semibold"
                  style={dep.lineColor ? { color: dep.lineColor } : undefined}
                >
                  {dep.lineCode}
                </span>
                {": "}
                {dep.destination}
              </span>
              <span className="text-gray-600 shrink-0">
                {formatRelativeDepartureTime(dep.departureTime)}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasBysykkel && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Bike className="w-3 h-3 text-blue-500" />
          <span>
            {realtimeData.bysykkel!.availableBikes} ledige sykler &middot;{" "}
            {realtimeData.bysykkel!.availableDocks} ledige låser
          </span>
          {!realtimeData.bysykkel!.isOpen && (
            <span className="text-red-500 ml-1">(Stengt)</span>
          )}
        </div>
      )}

      {hasHyre && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Car className="w-3 h-3 text-emerald-500" />
          <span>{realtimeData.hyre!.numVehiclesAvailable} biler ledige</span>
        </div>
      )}
    </div>
  );
}
