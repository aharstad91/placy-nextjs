"use client";

import { memo } from "react";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { getIcon } from "@/lib/utils/map-icons";

interface StoryThemeBridgeProps {
  themeName: string;
  themeIcon: string;
  themeColor: string;
  bridgeText: string;
  staggerDelay?: number;
}

export default memo(function StoryThemeBridge({
  themeName,
  themeIcon,
  themeColor,
  bridgeText,
  staggerDelay = 0,
}: StoryThemeBridgeProps) {
  const revealRef = useScrollReveal();
  const Icon = getIcon(themeIcon);

  return (
    <div
      ref={revealRef}
      className="story-block py-8 flex flex-col items-center gap-4"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <div className="flex items-center gap-4 w-full">
        <div className="flex-1 h-px bg-[#e8e4df]" />
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: themeColor + "18" }}
        >
          {Icon && (
            <Icon className="w-5 h-5" style={{ color: themeColor }} strokeWidth={2} />
          )}
        </div>
        <div className="flex-1 h-px bg-[#e8e4df]" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-[#1a1a1a] tracking-tight">
          {themeName}
        </h2>
        <p className="text-sm text-[#6a6a6a] mt-1">{bridgeText}</p>
      </div>
    </div>
  );
});
