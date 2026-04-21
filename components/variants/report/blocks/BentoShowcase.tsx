"use client";

import Image from "next/image";
import { getIcon } from "@/lib/utils/map-icons";
import type { LucideIcon } from "lucide-react";
import { ExternalLink, Sparkles } from "lucide-react";

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
  /** Optional action buttons rendered at cell bottom (hero cells mostly) */
  actions?: BentoAction[];
  /** Optional compact footer — small pill list of additional items (e.g. "og mer" row) */
  pills?: Array<{ label: string; iconName?: string; color?: string }>;
}

export interface BentoAction {
  label: string;
  url: string;
  /** "primary" = solid contrast; "ghost" = translucent */
  variant: "primary" | "ghost";
  /** "external" adds ExternalLink icon; "sparkles" adds Sparkles icon */
  icon?: "external" | "sparkles";
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

function BentoActionButton({
  action,
  onDark,
}: {
  action: BentoAction;
  onDark: boolean;
}) {
  const Icon = action.icon === "sparkles" ? Sparkles : action.icon === "external" ? ExternalLink : null;

  const classes =
    action.variant === "primary"
      ? onDark
        ? "bg-white text-[#1a2a1a] hover:bg-white/90"
        : "bg-[#22c55e] text-white hover:bg-[#16a34a]"
      : onDark
        ? "bg-white/12 text-white border border-white/35 hover:bg-white/20 backdrop-blur-sm"
        : "bg-white text-[#15803d] border border-[#22c55e]/35 hover:bg-[#22c55e]/5";

  return (
    <a
      href={action.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={[
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
        classes,
      ].join(" ")}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {action.label}
    </a>
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

        {/* Main content. Pill-heavy rows hug the top (kicker + title + pills read as a block);
            other cells push content to bottom so kicker sits alone at top and main body anchors. */}
        <div className={cell.pills && cell.pills.length > 0 ? "mt-3" : "mt-auto"}>
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

          {cell.pills && cell.pills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cell.pills.map((pill, i) => {
                const PillIcon = pill.iconName ? (getIcon(pill.iconName) as LucideIcon) : null;
                return (
                  <span
                    key={i}
                    className={[
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      isDominant
                        ? "bg-white/15 text-white backdrop-blur-sm"
                        : tone === "night"
                          ? "bg-white/10 text-[#e8d0bb]"
                          : "bg-white/70 text-[#3a3530]",
                    ].join(" ")}
                  >
                    {PillIcon && (
                      <PillIcon
                        className="w-3 h-3 shrink-0"
                        style={pill.color ? { color: pill.color } : undefined}
                      />
                    )}
                    {pill.label}
                  </span>
                );
              })}
            </div>
          )}

          {cell.actions && cell.actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {cell.actions.map((action, i) => (
                <BentoActionButton
                  key={i}
                  action={action}
                  onDark={isDominant || tone === "night"}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
