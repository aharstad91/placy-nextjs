"use client";

import Image from "next/image";
import { getIcon } from "@/lib/utils/map-icons";
import type { LucideIcon } from "lucide-react";

/**
 * BentoShowcase — Apple-inspired bento grid for highlighting the most interesting
 * moments in a category. Mixes cell sizes (hero / feature / stat / horizon) to
 * create visual hierarchy without a uniform list.
 *
 * First pilot: used on Hverdagsliv. Pattern will generalize once validated.
 */

export type BentoTone = "cream" | "sage" | "terracotta" | "stone" | "night";

export interface BentoCell {
  /** Column span — 1, 2, 3, or 4 (grid is 4-col on desktop) */
  colSpan: 1 | 2 | 3 | 4;
  /** Row span — 1 or 2 */
  rowSpan: 1 | 2;
  /** Visual tone — controls background + text color */
  tone?: BentoTone;
  /** Optional kicker label above the title (UPPERCASE tracking) */
  kicker?: string;
  /** Title — the bold headline of the cell */
  title: string;
  /** Optional body text under the title */
  body?: string;
  /** Optional big stat number shown prominently (e.g. "8 min") */
  stat?: { value: string; unit?: string };
  /** Optional hero illustration src — rendered full-bleed inside the cell */
  image?: string;
  /** Image treatment:
   *  - "subtle" (default): heavy white wash, text is primary
   *  - "dominant": image is primary, subtle bottom gradient only
   */
  imageTreatment?: "subtle" | "dominant";
  /** Optional lucide icon name (from map-icons) — small accent in cell */
  iconName?: string;
  /** Optional custom icon component — used when you want a specific Lucide */
  IconComponent?: LucideIcon;
}

export interface BentoShowcaseProps {
  /** Optional kicker at top of section (e.g. "I nabolaget") */
  sectionKicker?: string;
  /** Optional headline above the grid */
  sectionTitle?: string;
  cells: BentoCell[];
}

// Tone → classes. Kept as object to make palette tweaks centralized.
const TONE_CLASSES: Record<BentoTone, { bg: string; text: string; kicker: string; accent: string }> = {
  cream:      { bg: "bg-[#f5f1ec]",       text: "text-[#1a1a1a]", kicker: "text-[#8b7e6b]", accent: "text-[#7a7062]" },
  sage:       { bg: "bg-[#dde5d6]",       text: "text-[#1f2a20]", kicker: "text-[#5a6a52]", accent: "text-[#3f5138]" },
  terracotta: { bg: "bg-[#e8d0bb]",       text: "text-[#2a1d14]", kicker: "text-[#8a6a50]", accent: "text-[#5e3f2a]" },
  stone:      { bg: "bg-[#e8e4df]",       text: "text-[#1a1a1a]", kicker: "text-[#7a7062]", accent: "text-[#5a5147]" },
  night:      { bg: "bg-[#2a2520]",       text: "text-[#f5f1ec]", kicker: "text-[#a0937d]", accent: "text-[#c8b99a]" },
};

// Column span → responsive classes. Mobile collapses to single column always.
const COL_SPAN: Record<1 | 2 | 3 | 4, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
};

const ROW_SPAN: Record<1 | 2, string> = {
  1: "md:row-span-1",
  2: "md:row-span-2",
};

export default function BentoShowcase({
  sectionKicker,
  sectionTitle,
  cells,
}: BentoShowcaseProps) {
  return (
    <div className="my-12">
      {(sectionKicker || sectionTitle) && (
        <div className="mb-6 text-center">
          {sectionKicker && (
            <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-2">
              {sectionKicker}
            </p>
          )}
          {sectionTitle && (
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1a1a1a]">
              {sectionTitle}
            </h3>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[180px] md:auto-rows-[200px] gap-3 md:gap-4">
        {cells.map((cell, i) => (
          <BentoCell key={i} cell={cell} />
        ))}
      </div>
    </div>
  );
}

function BentoCell({ cell }: { cell: BentoCell }) {
  const tone = cell.tone ?? "cream";
  const toneClasses = TONE_CLASSES[tone];
  const hasImage = Boolean(cell.image);
  const isDominant = cell.imageTreatment === "dominant" && hasImage;
  const Icon =
    cell.IconComponent ??
    (cell.iconName ? (getIcon(cell.iconName) as LucideIcon) : null);

  // In dominant-image mode text sits on a dark gradient — force light text colors
  const textClass = isDominant ? "text-white" : toneClasses.text;
  const kickerClass = isDominant ? "text-white/85" : toneClasses.kicker;
  const bodyClass = isDominant ? "text-white/85" : tone === "night" ? "text-[#c8b99a]" : "text-[#5a5147]";
  const accentClass = isDominant ? "text-white/85" : toneClasses.accent;

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl",
        COL_SPAN[cell.colSpan],
        ROW_SPAN[cell.rowSpan],
        toneClasses.bg,
        toneClasses.text,
        "flex flex-col",
      ].join(" ")}
    >
      {/* Background image if present — underneath text layer */}
      {hasImage && (
        <Image
          src={cell.image!}
          alt=""
          fill
          aria-hidden="true"
          draggable={false}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover pointer-events-none select-none"
        />
      )}

      {/* Gradient over images for text legibility. Two treatments:
          - dominant: bottom fade + subtle top fade to protect kicker
          - subtle:   heavy white wash, text is primary */}
      {hasImage && cell.imageTreatment === "dominant" && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#1f2a20]/90 via-[#1f2a20]/35 to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#1f2a20]/55 to-transparent"
          />
        </>
      )}
      {hasImage && cell.imageTreatment !== "dominant" && (
        <div
          aria-hidden="true"
          className={
            tone === "night"
              ? "absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
              : "absolute inset-0 bg-gradient-to-t from-white/85 via-white/50 to-white/10"
          }
        />
      )}

      {/* Content */}
      <div className="relative z-10 p-5 md:p-6 flex flex-col h-full">
        {/* Top: kicker + icon */}
        <div className="flex items-start justify-between gap-3">
          {cell.kicker && (
            <p className={`text-[11px] uppercase tracking-[0.18em] font-medium ${kickerClass}`}>
              {cell.kicker}
            </p>
          )}
          {Icon && !cell.stat && (
            <Icon className={`w-5 h-5 shrink-0 ${accentClass}`} />
          )}
        </div>

        {/* Main: push to bottom with mt-auto */}
        <div className="mt-auto">
          {cell.stat && (
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className={`text-4xl md:text-5xl font-semibold tracking-tight ${textClass}`}>
                {cell.stat.value}
              </span>
              {cell.stat.unit && (
                <span className={`text-sm md:text-base font-medium ${accentClass}`}>
                  {cell.stat.unit}
                </span>
              )}
            </div>
          )}

          <h4
            className={[
              "font-semibold tracking-tight leading-tight",
              cell.colSpan >= 2 && cell.rowSpan === 2
                ? "text-2xl md:text-3xl"
                : cell.colSpan >= 2
                  ? "text-xl md:text-2xl"
                  : "text-base md:text-lg",
              textClass,
            ].join(" ")}
          >
            {cell.title}
          </h4>

          {cell.body && (
            <p
              className={[
                "mt-2 leading-snug",
                cell.colSpan >= 2 ? "text-sm md:text-base" : "text-xs md:text-sm",
                bodyClass,
              ].join(" ")}
            >
              {cell.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
