import type { POI, Coordinates } from "@/lib/types";
import type { TransportDashboardData } from "@/lib/hooks/useTransportDashboard";
import type { StatItem } from "./StatRow";
/** Parse "in N min" from an ISO-ish timestamp to a number of minutes. */
function minutesUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return null;
  return Math.max(0, Math.round(diffMs / 60000));
}

/** Haversine meters */
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

/** Known Trondheim anchor coordinates for travel-time estimates */
const ANCHORS = {
  sentrum: { lat: 63.4305, lng: 10.3951 }, // Torvet
  trondheimS: { lat: 63.4363, lng: 10.4047 }, // Trondheim S
  leangen: { lat: 63.4253, lng: 10.4672 }, // Leangen stasjon
  vaernes: { lat: 63.4578, lng: 10.9241 }, // Trondheim Lufthavn
};

/** Bus travel speed estimate (urban, with stops): ~18 km/h */
const BUS_KMH = 18;
/** Flybussen / express bus speed (highway): ~50 km/h */
const FLYBUS_KMH = 50;
/** Cycling speed estimate: ~15 km/h */
const BIKE_KMH = 15;
/** Walking speed: ~5 km/h (with road factor) */
const WALK_KMH = 4.6;

function kmFromMeters(m: number): number {
  return m / 1000;
}

function minutesFor(km: number, kmh: number): number {
  return Math.round((km / kmh) * 60);
}

/**
 * Build the Transport StatRow — mix of live data (Entur/GBFS) and
 * derived travel times to known Trondheim anchor points.
 *
 * Prioritizes live data when available: next bus, free bikes, scooters.
 * Falls back to static estimates otherwise.
 */
export function getTransportStats(
  pois: POI[],
  center: Coordinates,
  dashboard: TransportDashboardData | null | undefined,
): StatItem[] {
  const stats: StatItem[] = [];

  // --- Live: next bus ---
  const firstStop = dashboard?.departures?.[0];
  const nextDep = firstStop?.departures?.[0];
  const nextDepMin = minutesUntil(nextDep?.departureTime);
  if (nextDep && nextDepMin != null) {
    stats.push({
      kicker: "Neste buss",
      value: nextDepMin === 0 ? "Nå" : `${nextDepMin}`,
      unit: nextDepMin === 0 ? undefined : "min",
      subtitle: `Linje ${nextDep.lineCode} → ${nextDep.destination} · ${firstStop?.stopName ?? ""}`,
      iconName: "Bus",
      iconColor: "#3b82f6",
      live: true,
      tone: "sage",
    });
  } else {
    // Fallback: nearest bus stop walk time
    const nearestBus = [...pois]
      .filter((p) => p.category.id === "bus" || p.category.id === "tram")
      .sort((a, b) => haversineM(center, a.coordinates) - haversineM(center, b.coordinates))[0];
    if (nearestBus) {
      const m = haversineM(center, nearestBus.coordinates);
      const walkMin = minutesFor(kmFromMeters(m), WALK_KMH);
      stats.push({
        kicker: "Nærmeste buss",
        value: `${walkMin}`,
        unit: "min",
        subtitle: nearestBus.name,
        iconName: "Bus",
        iconColor: "#3b82f6",
        tone: "sage",
      });
    }
  }

  // --- Live: bysykkel ---
  if (dashboard?.bysykkel && dashboard.bysykkel.total > 0) {
    stats.push({
      kicker: "Bysykkel",
      value: `${dashboard.bysykkel.total}`,
      unit: "ledige",
      subtitle: dashboard.bysykkel.nearest
        ? `${dashboard.bysykkel.nearest.walkMin} min til nærmeste stasjon`
        : `${dashboard.bysykkel.stations} stasjoner i nærheten`,
      iconName: "Bike",
      iconColor: "#10b981",
      live: true,
      tone: "stone",
    });
  }

  // --- Live: sparkesykler ---
  if (dashboard?.scooters && dashboard.scooters.total > 0) {
    stats.push({
      kicker: "Sparkesykler",
      value: `${dashboard.scooters.total}`,
      unit: "stk",
      subtitle: dashboard.scooters.byOperator
        .slice(0, 3)
        .map((o) => o.name.replace("_Trondheim", ""))
        .join(", "),
      iconName: "Zap",
      iconColor: "#8b5cf6",
      live: true,
      tone: "cream",
    });
  }

  // --- Live: Getaround / bildeling ---
  if (dashboard?.freeFloatingCars && dashboard.freeFloatingCars.total > 0) {
    stats.push({
      kicker: "Bildeling",
      value: `${dashboard.freeFloatingCars.total}`,
      unit: "biler",
      subtitle: "Getaround free-floating i nabolaget",
      iconName: "Car",
      iconColor: "#10b981",
      live: true,
      tone: "terracotta",
    });
  }

  // --- Static: sentrum med buss ---
  const sentrumKm = kmFromMeters(haversineM(center, ANCHORS.sentrum));
  stats.push({
    kicker: "Sentrum",
    value: `${minutesFor(sentrumKm, BUS_KMH)}`,
    unit: "min",
    subtitle: `${sentrumKm.toFixed(1)} km med buss til Torvet`,
    iconName: "Bus",
    iconColor: "#3b82f6",
    tone: "cream",
  });

  // --- Static: Leangen med sykkel ---
  const leangenKm = kmFromMeters(haversineM(center, ANCHORS.leangen));
  stats.push({
    kicker: "Leangen stasjon",
    value: `${minutesFor(leangenKm, BIKE_KMH)}`,
    unit: "min",
    subtitle: `${leangenKm.toFixed(1)} km — tog til Værnes og regional`,
    iconName: "Train",
    iconColor: "#6366f1",
    tone: "stone",
  });

  // --- Static: Værnes — Flybussen er express, bruker høyere hastighet ---
  const vaernesKm = kmFromMeters(haversineM(center, ANCHORS.vaernes));
  stats.push({
    kicker: "Værnes lufthavn",
    value: `${minutesFor(vaernesKm, FLYBUS_KMH) + 5}`,
    unit: "min",
    subtitle: `${vaernesKm.toFixed(0)} km med direktebuss (Flybussen)`,
    iconName: "Plane",
    iconColor: "#ef4444",
    tone: "sage",
  });

  // --- Static: Trondheim S ---
  const trhS_km = kmFromMeters(haversineM(center, ANCHORS.trondheimS));
  stats.push({
    kicker: "Trondheim S",
    value: `${minutesFor(trhS_km, BUS_KMH)}`,
    unit: "min",
    subtitle: `${trhS_km.toFixed(1)} km — regional tog + fjerntog`,
    iconName: "Train",
    iconColor: "#6366f1",
    tone: "terracotta",
  });

  // Cap at 8 stats max for clean 2-row grid
  return stats.slice(0, 8);
}
