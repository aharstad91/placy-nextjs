"use client";

import type { LucideIcon } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";

/**
 * TimelineRow — fjerde blokk-type. Horisontal progression med noder forbundet
 * av en linje. Perfekt for iboende sekvensielle narrativer:
 *   - Skole-løp: barneskole → ungdomsskole → VGS
 *   - Mobility-trinn: gang 5m → sykkel 15m → buss 30m
 *   - Bydelutvikling: år 2020 → 2025 → 2030
 *
 * Komplementerer Bento (zoom-in på ETT), Carousel (likeverdige enheter),
 * StatRow (tall er poenget). Timeline er "veien videre".
 */

export interface TimelineNode {
  /** Small UPPERCASE kicker (grade range, year, phase label) */
  kicker: string;
  /** The node title — school name, phase name */
  title: string;
  /** Optional subtitle / context line */
  subtitle?: string;
  /** Big stat next to title (e.g. walk time) */
  stat?: { value: string; unit?: string };
  /** Icon name from map-icons */
  iconName?: string;
  /** Accent color for icon (hex) */
  iconColor?: string;
  /** Mark current/highlighted step */
  active?: boolean;
}

export interface TimelineRowProps {
  sectionKicker?: string;
  sectionTitle?: string;
  footer?: string;
  nodes: TimelineNode[];
}

export default function TimelineRow({
  sectionKicker,
  sectionTitle,
  footer,
  nodes,
}: TimelineRowProps) {
  return (
    <div className="my-12">
      {(sectionKicker || sectionTitle) && (
        <div className="mb-8 text-center">
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

      {/* Timeline track — horizontal with connecting line behind nodes. */}
      <div className="relative">
        {/* Connecting line — absolute, behind nodes. Hidden on mobile (stacked). */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute left-[8%] right-[8%] top-[38px] h-px bg-[#d4cfc8]"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-2">
          {nodes.map((node, i) => (
            <TimelineNodeCard key={i} node={node} index={i} total={nodes.length} />
          ))}
        </div>
      </div>

      {footer && (
        <p className="text-center text-sm text-[#8a8279] mt-6">{footer}</p>
      )}
    </div>
  );
}

function TimelineNodeCard({
  node,
  index,
  total,
}: {
  node: TimelineNode;
  index: number;
  total: number;
}) {
  const Icon = node.iconName ? (getIcon(node.iconName) as LucideIcon) : null;
  const color = node.iconColor ?? "#a0937d";

  return (
    <div className="flex flex-col items-center text-center px-3">
      {/* Dot + icon node */}
      <div className="relative z-10 mb-4">
        <div
          className={[
            "w-[76px] h-[76px] rounded-full flex items-center justify-center border-4 border-white shadow-sm",
            node.active ? "ring-2 ring-offset-2 ring-offset-white" : "",
          ].join(" ")}
          style={{
            backgroundColor: `${color}14`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(node.active ? ({ "--tw-ring-color": color } as any) : {}),
          }}
        >
          {Icon && (
            <Icon className="w-8 h-8" style={{ color }} />
          )}
        </div>

        {/* Step index bubble (1/3, 2/3, 3/3) */}
        <div
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border border-[#e0dcd6] flex items-center justify-center text-[10px] font-semibold text-[#7a7062] shadow-sm"
          aria-hidden="true"
        >
          {index + 1}/{total}
        </div>
      </div>

      {/* Kicker — grade range or phase label */}
      <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-[#8b7e6b] mb-1.5">
        {node.kicker}
      </p>

      {/* Title */}
      <h4 className="font-semibold text-base md:text-lg leading-tight text-[#1a1a1a] tracking-tight mb-1">
        {node.title}
      </h4>

      {/* Subtitle */}
      {node.subtitle && (
        <p className="text-xs text-[#6a6a6a] leading-snug mb-2 max-w-[180px]">
          {node.subtitle}
        </p>
      )}

      {/* Stat */}
      {node.stat && (
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1a1a1a]">
            {node.stat.value}
          </span>
          {node.stat.unit && (
            <span className="text-xs md:text-sm font-medium text-[#7a7062]">
              {node.stat.unit}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
