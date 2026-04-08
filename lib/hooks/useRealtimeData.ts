"use client";

import { useState, useEffect } from "react";
import type { POI } from "@/lib/types";

// Types for realtime data
export interface EnturDeparture {
  departureTime: string;
  isRealtime: boolean;
  destination: string;
  lineCode: string;
  transportMode: string;
  lineColor?: string;
}

export interface BysykkelStatus {
  availableBikes: number;
  availableDocks: number;
  isOpen: boolean;
  name?: string;
}

export interface HyreStatus {
  stationName: string;
  numVehiclesAvailable: number;
}

export interface RealtimeData {
  entur?: {
    stopName: string;
    departures: EnturDeparture[];
  };
  bysykkel?: BysykkelStatus;
  hyre?: HyreStatus;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const POLLING_INTERVAL = 60 * 1000; // 60 seconds

async function fetchEntur(stopPlaceId: string, signal: AbortSignal) {
  const response = await fetch(`/api/entur?stopPlaceId=${stopPlaceId}&limit=5`, { signal });
  if (!response.ok) throw new Error("Failed to fetch Entur data");
  const result = await response.json();
  return {
    stopName: result.stopPlace?.name || "Unknown",
    departures: result.departures || [],
  };
}

async function fetchBysykkel(stationId: string, signal: AbortSignal) {
  const response = await fetch(`/api/bysykkel?stationId=${stationId}`, { signal });
  if (!response.ok) throw new Error("Failed to fetch Bysykkel data");
  const result = await response.json();
  return {
    availableBikes: result.availableBikes,
    availableDocks: result.availableDocks,
    isOpen: result.isOpen,
    name: result.name,
  };
}

async function fetchHyre(stationId: string, signal: AbortSignal) {
  const response = await fetch(`/api/hyre?stationId=${stationId}`, { signal });
  if (!response.ok) throw new Error("Failed to fetch Hyre data");
  return await response.json() as HyreStatus;
}

export function useRealtimeData(poi: POI | null): RealtimeData {
  const [data, setData] = useState<RealtimeData>({
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const enturId = poi?.enturStopplaceId;
  const bysykkelId = poi?.bysykkelStationId;
  const hyreId = poi?.hyreStationId;
  const poiId = poi?.id;

  useEffect(() => {
    if (!poiId || (!enturId && !bysykkelId && !hyreId)) {
      setData({ loading: false, error: null, lastUpdated: null });
      return;
    }

    const controller = new AbortController();

    async function fetchData() {
      if (controller.signal.aborted) return;

      // Only show loading skeleton on initial fetch, not polling updates
      setData(prev => prev.lastUpdated
        ? { ...prev, error: null }
        : { ...prev, loading: true, error: null, entur: undefined, bysykkel: undefined, hyre: undefined }
      );

      const results = await Promise.allSettled([
        enturId ? fetchEntur(enturId, controller.signal) : null,
        bysykkelId ? fetchBysykkel(bysykkelId, controller.signal) : null,
        hyreId ? fetchHyre(hyreId, controller.signal) : null,
      ]);

      if (controller.signal.aborted) return;

      const enturResult = results[0].status === "fulfilled" ? results[0].value : null;
      const bysykkelResult = results[1].status === "fulfilled" ? results[1].value : null;
      const hyreResult = results[2].status === "fulfilled" ? results[2].value : null;

      const hasError = results.some(r => r.status === "rejected");

      setData({
        entur: enturResult || undefined,
        bysykkel: bysykkelResult || undefined,
        hyre: hyreResult || undefined,
        loading: false,
        error: hasError ? "Noe sanntidsdata er utilgjengelig" : null,
        lastUpdated: new Date(),
      });
    }

    fetchData();
    const intervalId = setInterval(fetchData, POLLING_INTERVAL);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [poiId, enturId, bysykkelId, hyreId]);

  return data;
}
