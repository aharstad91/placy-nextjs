"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PortfolioRow } from "@/lib/portfolio/rows";

/**
 * Prosjektlista. Den ER trykkflaten: kartet spenner titalls mil, og i tette
 * klynger ligger prosjektene få piksler fra hverandre. Lista bærer navnene og
 * garanterer at hvert prosjekt kan nås, uansett hvor pinnene havner.
 *
 * Rader med board er lenker, rader uten er knapper som bare markerer. Skillet
 * er synlig i tre lag samtidig — ramme, statustekst og pil — så det ikke
 * hviler på farge alene.
 */

export interface PortfolioListProps {
  rows: PortfolioRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** Rullecontainerens ref, så et valg fra kartet kan rulles inn i syne. */
  scrollRef?: React.Ref<HTMLUListElement>;
}

export function PortfolioList({
  rows,
  selectedId,
  onSelect,
  onHover,
  scrollRef,
}: PortfolioListProps) {
  return (
    <ul
      ref={scrollRef}
      // Én scroller. Nøstede scrollere i et bunnpanel gir en flate der
      // brukeren aldri vet hvilken som tar draget.
      className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-stone-200"
    >
      {rows.map((row) => (
        <li key={row.id} data-project-row={row.id}>
          <Row
            row={row}
            selected={row.id === selectedId}
            onSelect={() => onSelect(row.id)}
            onHover={onHover}
          />
        </li>
      ))}
    </ul>
  );
}

function Row({
  row,
  selected,
  onSelect,
  onHover,
}: {
  row: PortfolioRow;
  selected: boolean;
  onSelect: () => void;
  onHover: (id: string | null) => void;
}) {
  const shared = {
    "aria-current": selected,
    onMouseEnter: () => onHover(row.id),
    onMouseLeave: () => onHover(null),
    onFocus: () => onHover(row.id),
    onBlur: () => onHover(null),
    className: [
      "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors",
      selected ? "bg-[#fbeee8]" : "hover:bg-stone-50",
    ].join(" "),
  };

  const body = (
    <>
      <span
        aria-hidden="true"
        className={[
          "mt-1 h-3 w-3 shrink-0 rounded-full border-2",
          row.hasBoard
            ? "bg-[#fbeee8] border-[#c45c3a]"
            : "bg-white border-stone-300",
        ].join(" ")}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-stone-900">
          {row.name}
        </span>
        {row.subtitle && (
          <span className="block text-xs text-stone-500">{row.subtitle}</span>
        )}
        <span
          className={[
            "mt-1 block text-xs font-medium",
            row.hasBoard ? "text-[#c45c3a]" : "text-stone-400",
          ].join(" ")}
        >
          {row.statusLabel}
        </span>
      </span>
      {row.hasBoard && (
        <ArrowUpRight
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-[#c45c3a]"
        />
      )}
    </>
  );

  if (row.href) {
    return (
      <Link {...shared} href={row.href} onClick={onSelect}>
        {body}
      </Link>
    );
  }

  return (
    <button {...shared} type="button" onClick={onSelect}>
      {body}
    </button>
  );
}
