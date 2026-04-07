/**
 * Story Mode — Template strings for narrative elements.
 * Uses interpolate() from i18n for variable substitution.
 */

import { interpolate } from "@/lib/i18n/strings";

// --- Chat bubble templates ---

export function introText(projectName: string): string {
  return interpolate("La oss utforske området rundt {name}", { name: projectName });
}

export function themeIntroText(themeName: string): string {
  return interpolate("Her er de beste {name}-stedene i nærheten", { name: themeName.toLowerCase() });
}

export function summaryIntroText(): string {
  return "Her er området ditt oppsummert";
}

// --- Bridge text templates ---

export function bridgeText(themeName: string): string {
  return interpolate("La oss se på {name}", { name: themeName.toLowerCase() });
}

// --- Fact templates ---

export function totalPoisFact(count: number): string {
  return interpolate("{count} steder innen gangavstand", { count: String(count) });
}

export function themePoisFact(count: number, categoryName: string): string {
  return interpolate("{count} {name} i nærheten", {
    count: String(count),
    name: categoryName.toLowerCase(),
  });
}

// --- Choice prompt labels ---

export const CHOICE_SEE_MORE = "Se flere";
export const CHOICE_NEXT_THEME = "Neste tema";
export const CHOICE_SUMMARY = "Oppsummering";
