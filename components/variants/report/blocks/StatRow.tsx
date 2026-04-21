"use client";

import type { LucideIcon } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";

/**
 * StatRow — Apple-stil fact-strip av punchy tall-kort.
 *
 * Den tredje blokk-typen. BentoShowcase er storytelling om ett subjekt,
 * FeatureCarousel er likeverdige enheter, StatRow er punchy data-points
 * som avslører kategoriens styrke i få sekunder.
 *
 * Perfekt for: Transport (live avganger, bysykkel-count), Barn (skolevalg
 * i tall), Natur (antall parker + gjennomsnittsavstand).
 */

export interface StatItem {
  /** Small UPPERCASE label on top */
  kicker: string;
  /** The big number or short phrase (max 4-5 chars ideally) */
  value: string;
  /** Optional unit shown small next to value */
  unit?: string;
  /** Optional subtitle line below value */
  subtitle?: string;
  /** Optional Lucide icon name */
  iconName?: string;
  /** Accent color for icon */
  iconColor?: string;
  /** Live-data indicator (pulse dot) */
  live?: boolean;
  /** Tone variant */
  tone?: "cream" | "sage" | "terracotta" | "stone";
}

export interface StatRowProps {
  sectionKicker?: string;
  sectionTitle?: string;
  footer?: string;
  items: StatItem[];
  /** Grid columns on desktop — defaults to auto based on item count */
  cols?: 2 | 3 | 4;
}

const TONE_CLASSES: Record<NonNullable<StatItem["tone"]>, { bg: string; kicker: string; value: string; unit: string; sub: string }> = {
  cream:      { bg: "bg-[#f5f1ec]", kicker: "text-[#8b7e6b]", value: "text-[#1a1a1a]", unit: "text-[#7a7062]", sub: "text-[#5a5147]" },
  sage:       { bg: "bg-[#dde5d6]", kicker: "text-[#5a6a52]", value: "text-[#1f2a20]", unit: "text-[#3f5138]", sub: "text-[#3f5138]" },
  terracotta: { bg: "bg-[#e8d0bb]", kicker: "text-[#8a6a50]", value: "text-[#2a1d14]", unit: "text-[#5e3f2a]", sub: "text-[#5e3f2a]" },
  stone:      { bg: "bg-[#e8e4df]", kicker: "text-[#7a7062]", value: "text-[#1a1a1a]", unit: "text-[#5a5147]", sub: "text-[#5a5147]" },
};

const COL_CLASSES: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

export default function StatRow({
  sectionKicker,
  sectionTitle,
  footer,
  items,
  cols,
}: StatRowProps) {
  // Auto-pick cols based on count if not specified
  const autoCol: 2 | 3 | 4 = cols ?? (items.length <= 2 ? 2 : items.length === 3 ? 3 : 4);

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

      <div className={`grid grid-cols-2 ${COL_CLASSES[autoCol]} gap-3 md:gap-4`}>
        {items.map((item, i) => (
          <StatCard key={i} item={item} />
        ))}
      </div>

      {footer && (
        <p className="text-center text-xs text-[#8a8279] mt-4 leading-relaxed">
          {footer}
        </p>
      )}
    </div>
  );
}

function StatCard({ item }: { item: StatItem }) {
  const tone = TONE_CLASSES[item.tone ?? "cream"];
  const Icon = item.iconName ? (getIcon(item.iconName) as LucideIcon) : null;

  return (
    <div
      className={[
        "rounded-2xl p-5 md:p-6 h-[150px] md:h-[160px] flex flex-col",
        tone.bg,
      ].join(" ")}
    >
      {/* Top row: kicker + live/icon */}
      <div className="flex items-start justify-between gap-2">
        <p
          className={[
            "text-[11px] uppercase tracking-[0.18em] font-medium flex items-center gap-1.5",
            tone.kicker,
          ].join(" ")}
        >
          {item.live && (
            <span className="relative inline-flex items-center justify-center w-2 h-2 shrink-0">
              <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-60" />
              <span className="relative rounded-full bg-green-600 w-1.5 h-1.5" />
            </span>
          )}
          {item.kicker}
        </p>
        {Icon && (
          <Icon
            className="w-4 h-4 shrink-0 opacity-60"
            style={item.iconColor ? { color: item.iconColor } : undefined}
          />
        )}
      </div>

      {/* Main number + unit, anchored to bottom */}
      <div className="mt-auto">
        <div className="flex items-baseline gap-1.5">
          <span
            className={[
              "font-semibold tracking-tight leading-none",
              // Scale down if value is long (e.g. "Linje 12")
              item.value.length > 4 ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl",
              tone.value,
            ].join(" ")}
          >
            {item.value}
          </span>
          {item.unit && (
            <span className={`text-sm md:text-base font-medium ${tone.unit}`}>
              {item.unit}
            </span>
          )}
        </div>
        {item.subtitle && (
          <p className={`mt-1.5 text-xs md:text-sm leading-snug ${tone.sub}`}>
            {item.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
