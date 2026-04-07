"use client";

import { memo, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import type { ChoiceOption } from "@/lib/story/types";

interface StoryChoicePromptProps {
  blockId: string;
  options: readonly ChoiceOption[];
  onChoose: (option: ChoiceOption) => void;
  staggerDelay?: number;
}

export default memo(function StoryChoicePrompt({
  blockId,
  options,
  onChoose,
  staggerDelay = 0,
}: StoryChoicePromptProps) {
  const revealRef = useScrollReveal();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const guardRef = useRef(false);

  const handleClick = useCallback(
    (option: ChoiceOption) => {
      // Synchronous double-click guard
      if (guardRef.current) return;
      guardRef.current = true;
      setChosenId(option.id);
      onChoose(option);
    },
    [onChoose],
  );

  const hasChosen = chosenId !== null;

  return (
    <div
      ref={revealRef}
      className="story-block flex justify-end"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <div className="flex flex-col items-end gap-2 max-w-[80%]">
        {options.map((option, i) => (
          <button
            key={option.id}
            type="button"
            onClick={() => handleClick(option)}
            disabled={hasChosen}
            className={cn(
              "story-choice px-4 py-2.5 rounded-2xl rounded-br-md text-sm font-medium transition-all duration-200",
              "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1a1a1a]",
              hasChosen && chosenId === option.id
                ? "bg-[#1a1a1a] text-white shadow-sm"
                : hasChosen
                  ? "bg-[#f0eeeb] text-[#b0a99f] cursor-default"
                  : "bg-[#1a1a1a] text-white hover:bg-[#2d2d2d] active:scale-[0.97] shadow-sm",
              "motion-reduce:transform-none motion-reduce:transition-none",
            )}
            style={{
              "--story-delay": `${staggerDelay + i * 80}ms`,
            } as React.CSSProperties}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
});
