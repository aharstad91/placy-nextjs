import type { ReportConfig } from "@/lib/types";

/**
 * Den felles Placy-interaksjonen for rapport- og områdeboards.
 *
 * Nyhavna-demoen beviste modellen: kartet er en innrammet modul på desktop,
 * og alle POI-er åpner i det samme sidepanelet. Dette er produktatferd, ikke
 * kundekonfigurasjon, og derfor eksplisitte defaults i delt kode.
 */
export const DEFAULT_REPORT_LAYOUT = "framed" as const;
export const DEFAULT_REPORT_PLACE_PANEL = true;

export function isInitiallyRevealed(
  config: ReportConfig | undefined,
  legacyNyhavna = false,
): boolean {
  const configured = config?.presentation?.initialView;
  if (configured) return configured === "revealed";
  // Midlertidig kompatibilitet til det publiserte Nyhavna-boardet har fått
  // `presentation.initialView = "revealed"` i ordinær produktkonfig.
  return legacyNyhavna;
}
