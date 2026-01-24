"use client";

import { useState, useEffect, useCallback } from "react";
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

export interface RealtimeData {
  entur?: {
    stopName: string;
    departures: EnturDeparture[];
  };
  bysykkel?: BysykkelStatus;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const POLLING_INTERVAL = 60 * 1000; // 60 seconds

export function useRealtimeData(poi: POI | null): RealtimeData {
  const [data, setData] = useState<RealtimeData>({
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const fetchEnturData = useCallback(async (stopPlaceId: string) => {
    try {
      const response = await fetch(`/api/entur?stopPlaceId=${stopPlaceId}&limit=5`);
      if (!response.ok) throw new Error("Failed to fetch Entur data");
      const result = await response.json();
      return {
        stopName: result.stopPlace?.name || "Unknown",
        departures: result.departures || [],
      };
    } catch (error) {
      console.error("Entur fetch error:", error);
      return null;
    }
  }, []);

  const fetchBysykkelData = useCallback(async (stationId: string) => {
    try {
      const response = await fetch(`/api/bysykkel?stationId=${stationId}`);
      if (!response.ok) throw new Error("Failed to fetch Bysykkel data");
      const result = await response.json();
      return {
        availableBikes: result.availableBikes,
        availableDocks: result.availableDocks,
        isOpen: result.isOpen,
        name: result.name,
      };
    } catch (error) {
      console.error("Bysykkel fetch error:", error);
      return null;
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!poi) {
      setData({
        loading: false,
        error: null,
        lastUpdated: null,
      });
      return;
    }

    const hasEntur = !!poi.enturStopplaceId;
    const hasBysykkel = !!poi.bysykkelStationId;

    if (!hasEntur && !hasBysykkel) {
      setData({
        loading: false,
        error: null,
        lastUpdated: null,
      });
      return;
    }

    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [enturResult, bysykkelResult] = await Promise.all([
        hasEntur ? fetchEnturData(poi.enturStopplaceId!) : Promise.resolve(null),
        hasBysykkel ? fetchBysykkelData(poi.bysykkelStationId!) : Promise.resolve(null),
      ]);

      setData({
        entur: enturResult || undefined,
        bysykkel: bysykkelResult || undefined,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to fetch realtime data",
      }));
    }
  }, [poi, fetchEnturData, fetchBysykkelData]);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();

    const hasRealtimeData = poi?.enturStopplaceId || poi?.bysykkelStationId;
    if (!hasRealtimeData) return;

    const intervalId = setInterval(fetchData, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchData, poi?.enturStopplaceId, poi?.bysykkelStationId]);

  return data;
}
