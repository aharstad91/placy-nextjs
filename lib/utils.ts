import { clsx, type ClassValue } from "clsx";
import type { Coordinates } from "@/lib/types";

// Kombiner CSS-klasser med clsx
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Formater reisetid til lesbar tekst
export function formatTravelTime(minutes: number | undefined): string {
  if (!minutes) return "—";
  if (minutes < 1) return "< 1 min";
  return `${Math.round(minutes)} min`;
}

// Konverter sekunder til minutter
export function secondsToMinutes(seconds: number): number {
  return Math.ceil(seconds / 60);
}

// Sjekk om POI er innenfor tidsbudsjettet
export function isWithinTimeBudget(
  travelTime: number | undefined,
  timeBudget: number
): boolean {
  if (!travelTime) return false;
  return travelTime <= timeBudget;
}

// Generer Mapbox Directions API URL
export function getDirectionsUrl(
  origin: [number, number],
  destination: [number, number],
  mode: "walking" | "cycling" | "driving"
): string {
  const profile = mode === "walking" ? "walking" : mode === "cycling" ? "cycling" : "driving";
  return `/api/directions?origin=${origin[1]},${origin[0]}&destination=${destination[1]},${destination[0]}&profile=${profile}`;
}

// Mapbox reisemodus mapping
export const travelModeToMapboxProfile = {
  walk: "walking",
  bike: "cycling",
  car: "driving",
} as const;

// Norske labels for reisemodus
export const travelModeLabels = {
  walk: "Til fots",
  bike: "Sykkel",
  car: "Bil",
} as const;

// Ikoner for reisemodus (Lucide)
export const travelModeIcons = {
  walk: "Footprints",
  bike: "Bike",
  car: "Car",
} as const;

// Haversine-avstand mellom to koordinater i meter
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371000; // jordradius i meter
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfLng * sinHalfLng;

  return 2 * R * Math.asin(Math.sqrt(h));
}
