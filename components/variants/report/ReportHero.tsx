"use client";

import type { ReportTheme } from "./report-data";
import ReportLocaleToggle from "./ReportLocaleToggle";
import ThemeChip from "@/components/shared/ThemeChip";

interface ReportHeroProps {
  projectName: string;
  themes: ReportTheme[];
  heroIntro?: string;
}

export default function ReportHero({ projectName, themes, heroIntro }: ReportHeroProps) {
  const handleThemeClick = (themeId: string) => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(themeId)?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <section className="col-span-12 -mx-8 px-8 md:-mx-16 md:px-16 pt-8 pb-14 md:pt-14 md:pb-20 bg-gradient-to-b from-[#faf9f7] via-[#faf9f7] to-white">
      <div className="md:max-w-4xl relative">
        {/* Locale toggle — top right */}
        <div className="absolute top-0 right-0">
          <ReportLocaleToggle />
        </div>

        {/* Project name */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-[#1a1a1a] leading-tight mb-6">
          {projectName}
        </h1>

        {/* Emosjonell intro */}
        {heroIntro && (
          <p className="text-lg md:text-xl text-[#6a6a6a] max-w-2xl leading-relaxed">
            {heroIntro}
          </p>
        )}
      </div>

      {/* Spørsmåls-chips */}
      {themes.length > 0 && (
        <div className="flex flex-col md:flex-row md:flex-wrap gap-2 mt-8">
          {themes.map((theme) => (
            <ThemeChip
              key={theme.id}
              theme={theme}
              variant="scroll"
              onScrollTo={() => handleThemeClick(theme.id)}
            />
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="mt-14 h-px bg-[#e8e4df]" />
    </section>
  );
}
