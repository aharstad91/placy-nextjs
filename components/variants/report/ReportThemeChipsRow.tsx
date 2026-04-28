"use client";

import Image from "next/image";
import type { ReportTheme } from "./report-data";

interface ReportThemeChipsRowProps {
  themes: ReportTheme[];
}

/**
 * Watercolor-illustrasjoner generert via Gemini. Filnavn matcher tema-id, med
 * legacy-overrides for tema som har skiftet id (barn-oppvekst → barn-aktivitet,
 * transport → transport-mobilitet).
 */
const THEME_ICON_SRC: Record<string, string> = {
  hverdagsliv: "/illustrations/icons/hverdagsliv-icon.png",
  "barn-oppvekst": "/illustrations/icons/barn-aktivitet-icon.png",
  "mat-drikke": "/illustrations/icons/mat-drikke-icon.png",
  opplevelser: "/illustrations/icons/opplevelser-icon.png",
  "natur-friluftsliv": "/illustrations/icons/natur-friluftsliv-icon.png",
  transport: "/illustrations/icons/transport-mobilitet-icon.png",
  "trening-aktivitet": "/illustrations/icons/trening-aktivitet-icon.png",
};

export default function ReportThemeChipsRow({ themes }: ReportThemeChipsRowProps) {
  if (themes.length === 0) return null;

  const handleThemeClick = (themeId: string) => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(themeId)?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="max-w-[1080px] mx-auto w-full px-6 md:px-12 py-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {themes.map((theme) => {
          const iconSrc = THEME_ICON_SRC[theme.id];
          const label = theme.question ?? theme.name;
          return (
            <button
              key={theme.id}
              onClick={() => handleThemeClick(theme.id)}
              className="group flex flex-col items-stretch gap-3 p-4 rounded-2xl border bg-white border-[#eae6e1] hover:bg-[#faf9f7] hover:border-[#c0b9ad] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none text-left"
            >
              {iconSrc && (
                <div className="relative w-full aspect-square">
                  <Image
                    src={iconSrc}
                    alt=""
                    fill
                    sizes="(max-width: 1280px) 20vw, 180px"
                    className="object-contain"
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
