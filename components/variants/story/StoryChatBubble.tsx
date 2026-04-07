"use client";

import { memo } from "react";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";

interface StoryChatBubbleProps {
  text: string;
  showAvatar?: boolean;
  staggerDelay?: number;
}

export default memo(function StoryChatBubble({
  text,
  showAvatar = false,
  staggerDelay = 0,
}: StoryChatBubbleProps) {
  const revealRef = useScrollReveal();

  return (
    <div
      ref={revealRef}
      className="story-block flex items-start gap-3 max-w-[85%]"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      {showAvatar && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center">
          <span className="text-[10px] font-bold text-white tracking-wider select-none">
            P
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {showAvatar && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a0937d] select-none ml-1">
            Placy
          </span>
        )}
        <div className="bg-white border border-[#eae6e1] rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[15px] leading-relaxed text-[#1a1a1a]">{text}</p>
        </div>
      </div>
    </div>
  );
});
