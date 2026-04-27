"use client";

import { useEffect, useRef } from "react";
import type { ReportThemeGroundingView } from "@/lib/types";

export interface ReportGroundingChipsProps {
  grounding: ReportThemeGroundingView;
}

/**
 * Inline "Google foreslår også"-blokk per tema. Rendrer searchEntryPointHtml
 * verbatim (DOMPurify-sanert ved lagring).
 *
 * Google ToS: searchEntryPointHtml MÅ stå adjacent til sin grounded response.
 * target/rel/referrerpolicy settes på <a>-tags etter mount — content-modifikasjon
 * er forbudt, men attr-injeksjon er UI-concern.
 */
export default function ReportGroundingChips({
  grounding,
}: ReportGroundingChipsProps) {
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

  if (!grounding.searchEntryPointHtml) return null;

  return (
    <div className="mt-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        Google foreslår også
      </p>
      <div
        ref={searchEntryRef}
        className="grounding-search-entry"
        dangerouslySetInnerHTML={{ __html: grounding.searchEntryPointHtml }}
      />
    </div>
  );
}
