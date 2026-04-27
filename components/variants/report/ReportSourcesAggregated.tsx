"use client";

import { ChevronRight } from "lucide-react";
import type { ReportTheme } from "./report-data";
import { aggregateSources, groupSourcesByTheme } from "./aggregate-sources";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export interface ReportSourcesAggregatedProps {
  themes: ReportTheme[];
}

/**
 * Bunn-seksjon for hele rapporten: kollapset CTA som åpner en drawer med
 * kildene gruppert per tema (i rapport-rekkefølge), alfabetisk innen hver
 * gruppe. Disclosure-mønster — single-click til selve kildene bevart, så
 * Google ToS er overholdt.
 *
 * Google ToS: kun groundingChunks-listen vises her. searchEntryPointHtml
 * ("Google foreslår også"-chips) MÅ stå inline per tema og rendres separat
 * via ReportGroundingChips.
 *
 * Returnerer null hvis ingen tema har kilder.
 */
export default function ReportSourcesAggregated({
  themes,
}: ReportSourcesAggregatedProps) {
  const { sources, latestFetchedAt } = aggregateSources(themes);
  const groups = groupSourcesByTheme(themes);

  if (sources.length === 0) return null;

  return (
    <div className="mt-12 pt-6 border-t border-border/50 text-xs text-muted-foreground">
      <Drawer>
        <DrawerTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <span className="font-medium uppercase tracking-wide">
              Kilder ({sources.length})
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </DrawerTrigger>

        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Kilder ({sources.length})</DrawerTitle>
          </DrawerHeader>

          <div className="max-h-[70vh] overflow-y-auto px-4 pb-6 space-y-6">
            {groups.map((group) => (
              <section key={group.themeId}>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  {group.themeName}
                </h4>
                <ul className="space-y-1.5">
                  {group.sources.map((source) => (
                    <li key={source.domain} className="text-sm">
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
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <DrawerClose className="sr-only">Lukk</DrawerClose>
        </DrawerContent>
      </Drawer>

      <p className="mt-2 text-muted-foreground/70">
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
