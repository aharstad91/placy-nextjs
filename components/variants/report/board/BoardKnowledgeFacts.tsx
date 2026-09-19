"use client";

import { ArrowUpRight } from "lucide-react";
import type { PublishedKnowledge } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sourceHost } from "./SourcedContent";

const TEMPORAL_LABEL: Partial<
  Record<PublishedKnowledge["temporalKind"], string>
> = {
  regulated: "Regulert",
  planned: "Planlagt",
  marketed: "Markedsført",
  under_construction: "Under bygging",
  inference: "Tolkning",
  absence_of_evidence: "Ikke dokumentert",
  historical: "Historisk",
};

/**
 * Reviderte prosjekt- og temafakta som ikke har et kartpunkt.
 *
 * POI-fakta hører hjemme i stedsdetaljen. Denne blokken er plassen for det som
 * ellers ikke kunne vises uten å lage en falsk markør: skolekrets, et regulert
 * tilbud uten fast plassering, eller et forhold som gjelder hele prosjektet.
 */
export function BoardKnowledgeFacts({
  knowledge,
  className,
}: {
  knowledge?: PublishedKnowledge[];
  className?: string;
}) {
  const facts = (knowledge ?? []).filter((fact) => !fact.poiId);
  if (facts.length === 0) return null;

  return (
    <section
      data-testid="board-knowledge-facts"
      className={cn("mt-5 border-t border-stone-200 pt-4", className)}
    >
      <h2 className="text-[13px] font-semibold text-stone-800">
        Dokumenterte opplysninger
      </h2>
      <div className="mt-2.5 space-y-3">
        {facts.map((fact) => {
          const status = TEMPORAL_LABEL[fact.temporalKind];
          return (
            <article key={fact.id} data-testid="board-knowledge-fact">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {(fact.subjectName || fact.topic) && (
                  <h3 className="text-[13px] font-medium text-stone-700">
                    {fact.subjectName || fact.topic}
                  </h3>
                )}
                {status && (
                  <span
                    data-testid={`knowledge-status-${fact.temporalKind}`}
                    className="rounded-full border border-stone-200 px-1.5 py-px text-[10px] font-medium text-stone-500"
                  >
                    {status}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] leading-[1.55] text-stone-600">
                {fact.factText}
              </p>
              {fact.sourceUrls.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {fact.sourceUrls.map((url, index) => (
                    <a
                      key={`${fact.id}-${url}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="knowledge-source-link"
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-stone-500 underline decoration-stone-300 underline-offset-[3px] hover:text-stone-800"
                    >
                      <span>
                        {fact.sourceTitles[index] || sourceHost(url) || "Kilde"}
                      </span>
                      <ArrowUpRight size={12} strokeWidth={2.5} aria-hidden />
                    </a>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
