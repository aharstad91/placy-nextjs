"use client";

import { memo } from "react";
import { ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { getIcon } from "@/lib/utils/map-icons";
import type { ThemeDefinition } from "@/lib/themes/theme-definitions";

interface StoryThemeSelectorProps {
  themes: readonly ThemeDefinition[];
  visitedThemeIds: Set<string>;
  onSelect: (themeId: string) => void;
}

export default memo(function StoryThemeSelector({
  themes,
  visitedThemeIds,
  onSelect,
}: StoryThemeSelectorProps) {
  const revealRef = useScrollReveal();

  return (
    <div
      ref={revealRef}
      className="w-full"
    >
      <div className="mb-5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a0937d] block mb-2">
          Velg et tema
        </span>
        <p className="text-base text-[#6a6a6a] leading-relaxed">
          Hva vil du vite mer om?
        </p>
      </div>

      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label="Velg tema"
      >
        {themes.map((theme, i) => {
          const ThemeIcon = getIcon(theme.icon);
          const isVisited = visitedThemeIds.has(theme.id);

          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => !isVisited && onSelect(theme.id)}
              disabled={isVisited}
              className={cn(
                "group flex items-center gap-3.5 w-full px-4 py-3.5 rounded-xl border transition-all duration-150",
                "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1a1a1a]",
                "active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none",
                isVisited
                  ? "bg-[#faf9f7] border-[#e8e4de] opacity-50 cursor-default"
                  : "bg-white border-[#eae6e1] hover:border-[#cdc8c0] hover:shadow-sm",
              )}
              style={{
                animationDelay: `${120 + i * 55}ms`,
              }}
            >
              <span
                className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-150"
                style={{
                  backgroundColor: isVisited
                    ? "#d6d0c8"
                    : theme.color + "18",
                }}
              >
                {ThemeIcon && (
                  <ThemeIcon
                    className="w-4 h-4 transition-colors duration-150"
                    style={{
                      color: isVisited ? "#fff" : theme.color,
                    }}
                    strokeWidth={2}
                  />
                )}
              </span>

              <div className="flex-1 text-left">
                <span
                  className={cn(
                    "text-sm font-medium transition-colors duration-150",
                    isVisited ? "text-[#a0998f]" : "text-[#1a1a1a]",
                  )}
                >
                  {theme.name}
                </span>
              </div>

              {isVisited ? (
                <Check className="w-4 h-4 text-[#a0998f] flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#a0998f] flex-shrink-0 group-hover:translate-x-0.5 transition-transform motion-reduce:transform-none" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
