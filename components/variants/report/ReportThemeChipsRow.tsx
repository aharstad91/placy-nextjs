"use client";

import Image from "next/image";
import type { ReportTheme } from "./report-data";
import { THEME_SCENE_SRC } from "./theme-icons";

interface ReportThemeChipsRowProps {
  themes: ReportTheme[];
}

export default function ReportThemeChipsRow({ themes }: ReportThemeChipsRowProps) {
  if (themes.length === 0) return null;

  const handleThemeClick = (themeId: string) => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(themeId)?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="max-w-[1080px] mx-auto w-full px-6 md:px-12 pt-2 pb-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {themes.map((theme) => {
          const sceneSrc = THEME_SCENE_SRC[theme.id];
          const label = theme.question ?? theme.name;
          return (
            <button
              key={theme.id}
              onClick={() => handleThemeClick(theme.id)}
              className="group flex flex-col items-stretch gap-3 p-4 rounded-2xl border bg-white border-[#eae6e1] hover:bg-[#faf9f7] hover:border-[#c0b9ad] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none text-left"
            >
              {sceneSrc && (
                <div className="relative w-full aspect-square rounded-xl overflow-hidden">
                  <Image
                    src={sceneSrc}
                    alt=""
                    fill
                    sizes="(max-width: 1280px) 20vw, 180px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-sm text-[#1a1a1a] leading-snug">
                  {label}
                </span>
                {theme.question && (
                  <span className="text-xs text-[#a0998f] leading-snug">{theme.name}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
