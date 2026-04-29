"use client";

import { Bus, Bike, Car } from "lucide-react";
import type { POI } from "@/lib/types";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { formatRelativeDepartureTime } from "@/lib/utils/format-time";
import { TRANSPORT_CATEGORIES } from "../../report-data";

interface BoardLiveTransportProps {
  poi: POI;
}

/**
 * Kompakt sanntids-info-blokk for transport-POI-er i mobile board-sheet.
 *
 * Bruker `useRealtimeData` (single-POI-hook) — dette er én aktiv POI i sheeten,
 * så vi unngår `useTransportDashboard` som er bygget for multi-POI-aggregering
 * på tvers av et tema. `ReportMapDrawer` følger samme mønster.
 *
 * Trigges når POI har `enturStopplaceId`, `bysykkelStationId`, eller
 * `hyreStationId`, ELLER når kategori-IDen er i `TRANSPORT_CATEGORIES` (siste
 * gir loading-skeleton når POI er transport men ikke har integration-ID).
 *
 * Feiler stille — ingen render hvis API-ene returnerer tomt.
 */
export function BoardLiveTransport({ poi }: BoardLiveTransportProps) {
  const hasIntegration = !!(
    poi.enturStopplaceId ||
    poi.bysykkelStationId ||
    poi.hyreStationId
  );
  const isTransportCategory = TRANSPORT_CATEGORIES.has(poi.category.id);

  // Bare fetch hvis POI har en konkret integrasjons-ID — ellers er det ingen
  // sanntidsdata å hente (kategorien er kanskje "parking" som ikke har feed).
  const realtime = useRealtimeData(hasIntegration ? poi : null);

  // Skjul blokken helt når POI ikke er transport.
  if (!isTransportCategory) return null;

  // Loading-skeleton: vis kun hvis vi faktisk venter på sanntidsdata
  if (realtime.loading) {
    return (
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-stone-200 mt-4">
        <div className="text-xs text-stone-500">Henter sanntidsdata…</div>
      </div>
    );
  }

  const hasEntur = realtime.entur && realtime.entur.departures.length > 0;
  const hasBysykkel = !!realtime.bysykkel;
  const hasHyre = !!realtime.hyre;

  // Stille feiltilstand: hvis vi venter på data og fikk ingenting (eller POI
  // ikke har integration-ID), render ingenting. Crash ikke hele sheet.
  if (!hasEntur && !hasBysykkel && !hasHyre) return null;

  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-stone-200 space-y-2.5 mt-4">
      {/* Entur departures — buss/tram/train */}
      {hasEntur && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
            <Bus className="w-3.5 h-3.5" />
            <span>Neste avganger</span>
          </div>
          <div className="space-y-1.5">
            {realtime.entur!.departures.slice(0, 3).map((dep, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    dep.isRealtime ? "bg-green-500" : "bg-stone-300"
                  }`}
                  aria-label={dep.isRealtime ? "Sanntid" : "Rutetabell"}
                />
                <span
                  className="font-semibold min-w-[2rem] text-stone-900"
                  style={dep.lineColor ? { color: dep.lineColor } : undefined}
                >
                  {dep.lineCode}
                </span>
                <span className="text-stone-700 flex-1 truncate">
                  {dep.destination}
                </span>
                <span className="text-stone-600 shrink-0 tabular-nums">
                  {formatRelativeDepartureTime(dep.departureTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bysykkel */}
      {hasBysykkel && (
        <div className="flex items-center gap-2 text-sm text-stone-700">
          <Bike className="w-4 h-4 text-stone-500 shrink-0" />
          <span>
            <span className="font-semibold text-stone-900">
              {realtime.bysykkel!.availableBikes}
            </span>{" "}
            ledige sykler{" "}
            <span className="text-stone-500">
              · {realtime.bysykkel!.availableDocks} ledige låser
            </span>
          </span>
          {!realtime.bysykkel!.isOpen && (
            <span className="text-red-500 text-xs">(Stengt)</span>
          )}
        </div>
      )}

      {/* Hyre — bildelingsstasjon */}
      {hasHyre && (
        <div className="flex items-center gap-2 text-sm text-stone-700">
          <Car className="w-4 h-4 text-stone-500 shrink-0" />
          <span>
            <span className="font-semibold text-stone-900">
              {realtime.hyre!.numVehiclesAvailable}
            </span>{" "}
            biler ledige
          </span>
        </div>
      )}
    </div>
  );
}
