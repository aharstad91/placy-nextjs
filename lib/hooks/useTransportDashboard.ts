"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { EnturDeparture, HyreStatus } from "./useRealtimeData";

// --- Types ---

export interface StopDepartures {
  stopName: string;
  stopId: string;
  walkMin: number;
  departures: EnturDeparture[];
}

export interface ScooterData {
  total: number;
  byOperator: Array<{ systemId: string; name: string; count: number }>;
  positions: Array<{ lat: number; lng: number }>;
}

export interface VehiclePositions {
  total: number;
  positions: Array<{ lat: number; lng: number }>;
}

export interface BysykkelAggregate {
  total: number;
  totalDocks: number;
  stations: number;
  nearest: {
    stationName: string;
    availableBikes: number;
    availableDocks: number;
    isOpen: boolean;
    walkMin: number;
  } | null;
  breakdown: Array<{
    stationId: string;
    name: string;
    availableBikes: number;
    capacity: number;
    distance: number;
  }>;
  positions: Array<{ lat: number; lng: number }>;
}

export interface TransportDashboardData {
  departures: StopDepartures[];
  bysykkel: BysykkelAggregate | null;
  scooters: ScooterData | null;
  freeFloatingCars: VehiclePositions | null;
  carShare: (HyreStatus & { walkMin: number }) | null;
  loading: boolean;
  lastUpdated: Date | null;
}

const BYSYKKEL_RADIUS = 800; // meters — matches "10 min gange" comfort zone

const POLLING_INTERVAL = 90_000; // 90 seconds

// --- Fetch helpers ---

async function fetchDepartures(
  stopPlaceId: string,
  signal: AbortSignal,
): Promise<{ stopName: string; departures: EnturDeparture[] }> {
  const res = await fetch(`/api/entur?stopPlaceId=${stopPlaceId}&limit=5`, { signal });
  if (!res.ok) throw new Error("Entur fetch failed");
  const data = await res.json();
  return {
    stopName: data.stopPlace?.name || "Ukjent",
    departures: data.departures || [],
  };
}

async function fetchBysykkelAggregate(
  lat: number,
  lng: number,
  radius: number,
  signal: AbortSignal,
): Promise<BysykkelAggregate> {
  const res = await fetch(
    `/api/bysykkel?lat=${lat}&lng=${lng}&radius=${radius}`,
    { signal },
  );
  if (!res.ok) throw new Error("Bysykkel fetch failed");
  const data = await res.json();
  return {
    total: data.total ?? 0,
    totalDocks: data.totalDocks ?? 0,
    stations: data.stations ?? 0,
    nearest: data.nearest
      ? {
          stationName: data.nearest.name,
          availableBikes: data.nearest.availableBikes,
          availableDocks: data.nearest.availableDocks,
          isOpen: data.nearest.isOpen,
          walkMin: data.nearest.walkMin,
        }
      : null,
    breakdown: data.breakdown ?? [],
    positions: data.positions ?? [],
  };
}

async function fetchHyre(
  stationId: string,
  signal: AbortSignal,
): Promise<HyreStatus> {
  const res = await fetch(`/api/hyre?stationId=${stationId}`, { signal });
  if (!res.ok) throw new Error("Hyre fetch failed");
  return await res.json();
}

async function fetchMobility(
  lat: number,
  lng: number,
  radius: number,
  signal: AbortSignal,
  formFactors = "SCOOTER,SCOOTER_STANDING",
): Promise<ScooterData> {
  const res = await fetch(
    `/api/mobility?lat=${lat}&lng=${lng}&radius=${radius}&formFactors=${formFactors}`,
    { signal },
  );
  if (!res.ok) throw new Error("Mobility fetch failed");
  return await res.json();
}

// --- Helpers for selecting POIs ---

function estimateWalkMin(poi: POI, center: Coordinates): number {
  if (poi.travelTime?.walk) return Math.round(poi.travelTime.walk / 60);
  const R = 6_371_000;
  const dLat = ((poi.coordinates.lat - center.lat) * Math.PI) / 180;
  const dLng = ((poi.coordinates.lng - center.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((center.lat * Math.PI) / 180) *
      Math.cos((poi.coordinates.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const meters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(meters / 80); // 80m/min walk speed
}

interface TransportSources {
  /** The 2 nearest bus/tram/train stops with enturStopplaceId */
  enturStops: Array<{ poi: POI; walkMin: number }>;
  /** Nearest Hyre station with hyreStationId */
  hyreStation: { poi: POI; walkMin: number } | null;
}

function selectTransportSources(pois: POI[], center: Coordinates): TransportSources {
  const sorted = [...pois]
    .map((poi) => ({ poi, walkMin: estimateWalkMin(poi, center) }))
    .sort((a, b) => a.walkMin - b.walkMin);

  const enturStops = sorted
    .filter((s) => s.poi.enturStopplaceId && ["bus", "tram", "train"].includes(s.poi.category.id))
    .slice(0, 1);

  const hyreStation = sorted.find((s) => s.poi.hyreStationId) ?? null;

  return { enturStops, hyreStation };
}

// --- Hook ---

export function useTransportDashboard(
  pois: POI[],
  center: Coordinates,
): TransportDashboardData {
  const sources = useMemo(() => selectTransportSources(pois, center), [pois, center]);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const [data, setData] = useState<TransportDashboardData>({
    departures: [],
    bysykkel: null,
    scooters: null,
    freeFloatingCars: null,
    carShare: null,
    loading: false,
    lastUpdated: null,
  });

  // Stable keys for effect deps
  const enturIds = sources.enturStops.map((s) => s.poi.enturStopplaceId).join(",");
  const hyreId = sources.hyreStation?.poi.hyreStationId || "";

  useEffect(() => {
    // Always poll — bysykkel/scooters/cars are queried by coordinates,
    // so they run even when no dedicated POIs exist.

    const controller = new AbortController();

    async function poll() {
      if (controller.signal.aborted) return;

      setData((prev) =>
        prev.lastUpdated
          ? prev // silent update on subsequent polls
          : { ...prev, loading: true },
      );

      const promises: Array<Promise<unknown>> = [];
      const s = sourcesRef.current;

      // Entur departures (1 promise per stop)
      for (const stop of s.enturStops) {
        if (stop.poi.enturStopplaceId) {
          promises.push(
            fetchDepartures(stop.poi.enturStopplaceId, controller.signal).then((r) => ({
              type: "entur" as const,
              stopId: stop.poi.enturStopplaceId!,
              walkMin: stop.walkMin,
              ...r,
            })),
          );
        }
      }

      // Bysykkel — aggregate across all stations in radius
      promises.push(
        fetchBysykkelAggregate(
          center.lat,
          center.lng,
          BYSYKKEL_RADIUS,
          controller.signal,
        ).then((r) => ({ type: "bysykkel" as const, ...r })),
      );

      // Hyre
      if (s.hyreStation?.poi.hyreStationId) {
        promises.push(
          fetchHyre(s.hyreStation.poi.hyreStationId, controller.signal).then((r) => ({
            type: "hyre" as const,
            walkMin: s.hyreStation!.walkMin,
            ...r,
          })),
        );
      }

      // Scooters
      promises.push(
        fetchMobility(center.lat, center.lng, 750, controller.signal).then((r) => ({
          type: "scooter" as const,
          ...r,
        })),
      );

      // Free-floating cars (Getaround)
      promises.push(
        fetchMobility(center.lat, center.lng, 2000, controller.signal, "CAR").then((r) => ({
          type: "freecar" as const,
          total: r.total,
          positions: r.positions,
        })),
      );

      const results = await Promise.allSettled(promises);
      if (controller.signal.aborted) return;

      const departures: StopDepartures[] = [];
      let bysykkel: TransportDashboardData["bysykkel"] = null;
      let carShare: TransportDashboardData["carShare"] = null;
      let scooters: TransportDashboardData["scooters"] = null;
      let freeFloatingCars: TransportDashboardData["freeFloatingCars"] = null;

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const val = result.value as Record<string, unknown>;

        if (val.type === "entur") {
          departures.push({
            stopName: val.stopName as string,
            stopId: val.stopId as string,
            walkMin: val.walkMin as number,
            departures: val.departures as EnturDeparture[],
          });
        } else if (val.type === "bysykkel") {
          bysykkel = {
            total: val.total as number,
            totalDocks: val.totalDocks as number,
            stations: val.stations as number,
            nearest: val.nearest as BysykkelAggregate["nearest"],
            breakdown: val.breakdown as BysykkelAggregate["breakdown"],
            positions: val.positions as BysykkelAggregate["positions"],
          };
        } else if (val.type === "hyre") {
          carShare = {
            stationName: val.stationName as string,
            walkMin: val.walkMin as number,
            numVehiclesAvailable: val.numVehiclesAvailable as number,
          };
        } else if (val.type === "scooter") {
          scooters = {
            total: val.total as number,
            byOperator: val.byOperator as ScooterData["byOperator"],
            positions: (val.positions as ScooterData["positions"]) || [],
          };
        } else if (val.type === "freecar") {
          freeFloatingCars = {
            total: val.total as number,
            positions: (val.positions as VehiclePositions["positions"]) || [],
          };
        }
      }

      // Sort departures by walk time
      departures.sort((a, b) => a.walkMin - b.walkMin);

      setData({
        departures,
        bysykkel,
        scooters,
        freeFloatingCars,
        carShare,
        loading: false,
        lastUpdated: new Date(),
      });
    }

    poll();
    const intervalId = setInterval(poll, POLLING_INTERVAL);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
   
  }, [enturIds, hyreId, center.lat, center.lng]);

  return data;
}
