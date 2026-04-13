"use client";

import { memo } from "react";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { getIcon } from "@/lib/utils/map-icons";

interface StoryFactBubbleProps {
  icon: string;
  number: number;
  label: string;
  themeColor: string;
  staggerDelay?: number;
}

export default memo(function StoryFactBubble({
  icon,
  number,
  label,
  themeColor,
  staggerDelay = 0,
}: StoryFactBubbleProps) {
  const revealRef = useScrollReveal();
  const Icon = getIcon(icon);

  return (
    <div
      ref={revealRef}
      className="flex items-start gap-3 max-w-[75%]"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ backgroundColor: themeColor + "18" }}
      >
        {Icon && (
          <Icon className="w-4 h-4" style={{ color: themeColor }} strokeWidth={2} />
        )}
      </div>
      <div className="bg-white border border-[#eae6e1] rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#1a1a1a] tabular-nums tracking-tight">
            {number}
          </span>
          <span className="text-sm text-[#6a6a6a] leading-snug">{label}</span>
        </div>
      </div>
    </div>
  );
});
