import type { ReportTheme } from "./report-data";

export interface AggregatedSource {
  domain: string;
  url: string;
  title: string;
  themeNames: string[];
}

export interface AggregatedSourcesResult {
  sources: AggregatedSource[];
  /** Latest fetchedAt across all themes' grounding. Empty string if none. */
  latestFetchedAt: string;
}

/**
 * Bygger én aggregert kildeliste på tvers av temaer. Dedupliserer på domene
 * (case-insensitive). Første URL/title for et gitt domene vinner.
 * themeNames akkumuleres i insertion-rekkefølge (dvs. den rekkefølgen domenet
 * først dukker opp på tvers av temaene).
 *
 * Sortert alfabetisk på domene for forutsigbar lesing.
 */
export function aggregateSources(themes: ReportTheme[]): AggregatedSourcesResult {
  const map = new Map<string, AggregatedSource>();
  let latestFetchedAt = "";

  for (const theme of themes) {
    const grounding = theme.grounding;
    if (!grounding) continue;
    if (grounding.fetchedAt > latestFetchedAt) {
      latestFetchedAt = grounding.fetchedAt;
    }
    for (const source of grounding.sources) {
      const key = source.domain.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        if (!existing.themeNames.includes(theme.name)) {
          existing.themeNames.push(theme.name);
        }
      } else {
        map.set(key, {
          domain: source.domain,
          url: source.url,
          title: source.title,
          themeNames: [theme.name],
        });
      }
    }
  }

  const sources = Array.from(map.values()).sort((a, b) =>
    a.domain.localeCompare(b.domain, "nb"),
  );

  return { sources, latestFetchedAt };
}
