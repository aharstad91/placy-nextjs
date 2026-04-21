"use client";

import { useEffect, useRef } from "react";
import type { ReportThemeGroundingView } from "@/lib/types";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export interface ReportGroundingSourcesProps {
  grounding: ReportThemeGroundingView;
}

/**
 * Bunn-seksjon for Gemini-grounded tema: kilder + "Google foreslår også" +
 * attribution. v1/v2-agnostisk. Rendres separat fra narrativen slik at
 * kart kan ligge mellom narrative og kilder.
 *
 * Google ToS: searchEntryPointHtml rendres verbatim (DOMPurify-sanert ved
 * lagring). target="_blank" legges til på <a>-tags etter mount — ToS-endring
 * av content er forbudt, men target-attr er UI-concern.
 */
export default function ReportGroundingSources({
  grounding,
}: ReportGroundingSourcesProps) {
  const searchEntryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = searchEntryRef.current;
    if (!root) return;
    root.querySelectorAll("a").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer nofollow");
      a.setAttribute("referrerpolicy", "no-referrer");
    });
  }, [grounding.searchEntryPointHtml]);

  const fetchedAtIso =
    grounding.groundingVersion === 2
      ? (grounding.curatedAt ?? grounding.fetchedAt)
      : grounding.fetchedAt;

  return (
    <div className="mt-8">
      {grounding.sources.length > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
            Kilder ({grounding.sources.length})
          </h4>
          <ol className="flex flex-wrap gap-2">
            {grounding.sources.map((source, idx) => (
              <li key={`${source.url}-${idx}`}>
                <HoverCard openDelay={120} closeDelay={60}>
                  <HoverCardTrigger asChild>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <FavIcon domain={source.domain} />
                      <span className="max-w-[180px] truncate">{source.domain}</span>
                    </a>
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="w-80">
                    <p className="text-[13px] font-semibold text-foreground leading-snug mb-1.5">
                      {source.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {source.url}
                    </p>
                  </HoverCardContent>
                </HoverCard>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-border/50 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Google foreslår også
          </p>
          <div
            ref={searchEntryRef}
            className="grounding-search-entry"
            dangerouslySetInnerHTML={{ __html: grounding.searchEntryPointHtml }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Generert med Google AI basert på offentlige kilder. Oppdatert{" "}
          {formatFetchedAt(fetchedAtIso)}.
        </p>
      </div>
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

function FavIcon({ domain }: { domain: string }) {
  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={14}
      height={14}
      className="rounded-sm"
      loading="lazy"
    />
  );
}
