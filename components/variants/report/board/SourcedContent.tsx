"use client";

import { ArrowUpRight, Info, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DevelopmentStatus, EditorialSource } from "@/lib/types";
import { SIDEBAR_PROSE } from "./sidebar-style";

/**
 * Merkene et board trenger når innholdet ikke er vårt, og når stedet ikke er
 * bygget ennå.
 *
 * ## Hvorfor de er én fil
 *
 * Fordi de alltid opptrer sammen og må leses som ett språk. Et sted som er
 * planlagt OG omtrentlig plassert OG hentet fra kundens egen side, bærer tre
 * merker i samme rad; er de designet hver for seg, blir raden en oppramsing i
 * tre ulike stemmer. Samme feil som eyebrow-overskriftene hadde før 2026-08-28.
 *
 * ## Hvorfor de er så lavmælte
 *
 * Merkene skal kunne stå på HVER rad i et tema uten å ta over. De er
 * tekstfarget, ikke fargekodede flater: et rødt «planlagt»-skilt ville lest som
 * en advarsel, og en plan er ikke et problem. Det eneste som roper er ingenting
 * — forskjellen ligger i ordet.
 */

// ---------------------------------------------------------------------------
// Eksisterende vs. planlagt
// ---------------------------------------------------------------------------

/**
 * «Planlagt»-merket. Rendrer INGENTING for eksisterende steder.
 *
 * Asymmetrien er med vilje: et vanlig board er utelukkende steder som finnes,
 * og et «finnes»-merke på hver eneste rad ville vært støy uten informasjon.
 * Merket bærer bare avviket.
 */
export function StatusBadge({
  status,
  className,
}: {
  status?: DevelopmentStatus;
  className?: string;
}) {
  if (status !== "planned") return null;
  return (
    <span
      data-testid="status-planned"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-stone-300",
        "px-1.5 py-px text-[11px] font-medium leading-[1.45] text-stone-500",
        className,
      )}
    >
      Planlagt
    </span>
  );
}

/**
 * Forbeholdet ved en omtrentlig plassering.
 *
 * Vises som en egen linje, ikke som en tooltip: et forbehold bak en hover er et
 * forbehold som ikke finnes på mobil.
 */
export function PrecisionNote({
  note,
  className,
}: {
  note?: string;
  className?: string;
}) {
  if (!note) return null;
  return (
    <p
      data-testid="precision-note"
      className={cn(
        "mt-2 flex items-start gap-1.5 text-[13px] leading-[1.5] text-stone-500",
        className,
      )}
    >
      <MapPin
        size={14}
        strokeWidth={2.25}
        className="mt-[3px] shrink-0 text-stone-400"
        aria-hidden
      />
      <span>{note}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Kilden
// ---------------------------------------------------------------------------

/** Vertsnavnet uten `www.` — det leseren kjenner igjen som «kilden». */
export function sourceHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Lenken ut til originalen.
 *
 * Dette er ikke en fotnote — det er veien videre. Kartet gir plassering og
 * sammenheng; kundens egen side har detaljene, bildene og det ferskeste. En
 * demo som beholder leseren hos seg selv ville bevist feil påstand.
 */
export function SourceLink({
  source,
  className,
  testId = "source-link",
}: {
  source?: EditorialSource;
  className?: string;
  testId?: string;
}) {
  if (!source?.url) return null;
  const host = sourceHost(source.url) ?? source.label;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      className={cn(
        "group inline-flex max-w-full items-center gap-1 rounded-md text-[13px] font-medium",
        "leading-[1.5] text-stone-600 underline decoration-stone-300 underline-offset-[3px]",
        "transition-colors hover:text-stone-900 hover:decoration-stone-500",
        className,
      )}
    >
      <span className="truncate">
        {source.page ? `${source.page} på ${host}` : host}
      </span>
      <ArrowUpRight
        size={13}
        strokeWidth={2.5}
        className="shrink-0 text-stone-400 transition-colors group-hover:text-stone-700"
        aria-hidden
      />
    </a>
  );
}

/**
 * Kildelinja under et temas prosa: «Tekst og utvalg fra <lenke>».
 *
 * Står UNDER teksten og ikke over, fordi rekkefølgen er leserens: først hva som
 * står, så hvem som har skrevet det.
 */
export function SourceCredit({
  source,
  className,
}: {
  source?: EditorialSource;
  className?: string;
}) {
  if (!source?.url) return null;
  return (
    <p
      data-testid="source-credit"
      className={cn("mt-3 text-[13px] leading-[1.5] text-stone-500", className)}
    >
      Tekst og utvalg fra <SourceLink source={source} testId="source-credit-link" />
    </p>
  );
}

// ---------------------------------------------------------------------------
// Det vi ikke kan plassere
// ---------------------------------------------------------------------------

/**
 * Stedene kilden navngir uten at vi kan sette dem i kartet.
 *
 * Den ærligste raden i boardet, og den mest nyttige i et salgsmøte: den viser
 * nøyaktig hvilke data som mangler for at resten av innholdet skal bli
 * utforskbart. Å utelate navnene hadde skjult et hull; å gjette koordinatene
 * hadde gjort gjetningen til et faktum.
 */
export function UnplacedNote({
  names,
  className,
}: {
  names?: string[];
  className?: string;
}) {
  if (!names?.length) return null;
  return (
    <div
      data-testid="unplaced-note"
      className={cn(
        "mt-4 rounded-[10px] border border-dashed border-stone-200 bg-stone-50/70 px-3 py-2.5",
        className,
      )}
    >
      <p className="flex items-start gap-1.5 text-[13px] font-medium leading-[1.5] text-stone-600">
        <Info size={14} strokeWidth={2.25} className="mt-[3px] shrink-0 text-stone-400" aria-hidden />
        <span>Nevnt i kilden, men ikke plassert i kartet</span>
      </p>
      <p className={cn(SIDEBAR_PROSE, "mt-1 text-[13px] leading-[1.5] text-stone-500")}>
        {names.join(" · ")}
      </p>
    </div>
  );
}
