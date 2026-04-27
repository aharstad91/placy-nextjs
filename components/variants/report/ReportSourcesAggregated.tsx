"use client";

import type { ReportTheme } from "./report-data";
import { aggregateSources } from "./aggregate-sources";

export interface ReportSourcesAggregatedProps {
  themes: ReportTheme[];
}

/**
 * Bunn-seksjon for hele rapporten: aggregert kildeliste på tvers av temaer,
 * deduplisert per domene med tema-badges. Liten, dempet typografi —
 * metadata-footer, ikke innhold.
 *
 * Google ToS: kun groundingChunks-listen aggregeres her. searchEntryPointHtml
 * ("Google foreslår også"-chips) MÅ stå inline per tema og rendres separat
 * via ReportGroundingChips.
 *
 * Returnerer null hvis ingen tema har kilder (matcher omit-ved-feil-kontrakten).
 */
export default function ReportSourcesAggregated({
  themes,
}: ReportSourcesAggregatedProps) {
  const { sources, latestFetchedAt } = aggregateSources(themes);

  if (sources.length === 0) return null;

  return (
    <div className="mt-12 pt-6 border-t border-border/50">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
        Kilder ({sources.length})
      </h4>
      <ul className="space-y-1.5">
        {sources.map((source) => (
          <li key={source.domain} className="text-xs text-muted-foreground">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              referrerPolicy="no-referrer"
              title={source.title}
              className="text-foreground/80 hover:text-foreground hover:underline"
            >
              {source.domain}
            </a>
            {source.themeNames.length > 0 && (
              <span className="ml-2 text-muted-foreground/70">
                ({source.themeNames.join(", ")})
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground/70">
        Generert med Google AI basert på offentlige kilder.
        {latestFetchedAt && ` Sist oppdatert ${formatFetchedAt(latestFetchedAt)}.`}
      </p>
    </div>
  );
}

function formatFetchedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("no-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
