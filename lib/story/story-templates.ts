/**
 * Story Mode — Template strings for narrative elements.
 * Uses interpolate() from i18n for variable substitution.
 */

import { interpolate } from "@/lib/i18n/strings";

// --- Chat bubble templates ---

/** Shorten address-style names: "Gata 7, 7014 Trondheim, Norge" → "Gata 7" */
function shortName(name: string): string {
  const firstComma = name.indexOf(",");
  return firstComma > 0 ? name.substring(0, firstComma).trim() : name;
}

export function introText(projectName: string): string {
  return interpolate("La oss utforske området rundt {name}", { name: shortName(projectName) });
}

export function themeIntroText(themeName: string): string {
  return interpolate("Her er de beste {name}-stedene i nærheten", { name: themeName.toLowerCase() });
}

export function summaryIntroText(): string {
  return "Her er området ditt oppsummert";
}

// --- Bridge text templates ---

/** Fallback theme intro when no editorial bridgeText exists */
export function themeIntroBridge(themeName: string, poiCount: number): string {
  return interpolate("Du har {count} {name}-steder i nærheten — la oss se på de beste", {
    count: String(poiCount),
    name: themeName.toLowerCase(),
  });
}

/** Highlight the top POI in a theme batch */
export function topPoiHighlight(
  poiName: string,
  rating: number | null,
  walkMin: number | null,
): string {
  const parts: string[] = [poiName];
  if (rating != null) {
    parts.push(interpolate("{rating} på Google", { rating: rating.toFixed(1) }));
  }
  if (walkMin != null) {
    parts.push(interpolate("{min} min å gå", { min: String(walkMin) }));
  }
  if (parts.length === 1) return interpolate("{name} topper listen", { name: poiName });
  return parts[0] + " topper listen — " + parts.slice(1).join(", ");
}

/** Bridge text for "Se flere" batches */
export function moreBatchBridge(remaining: number): string {
  return interpolate("Her er {count} til", { count: String(remaining) });
}

// --- Choice prompt labels ---

export const CHOICE_SEE_MORE = "Se flere";
export const CHOICE_NEXT_THEME = "Neste tema";
export const CHOICE_SUMMARY = "Oppsummering";
