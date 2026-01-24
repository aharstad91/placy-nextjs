import { clsx, type ClassValue } from "clsx";

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
