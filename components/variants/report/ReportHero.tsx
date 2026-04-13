"use client";

import Image from "next/image";
import type { ReportTheme } from "./report-data";
import ReportLocaleToggle from "./ReportLocaleToggle";
import ThemeChip from "@/components/shared/ThemeChip";

interface ReportHeroProps {
  projectName: string;
  themes: ReportTheme[];
  heroIntro?: string;
  heroImage?: string;
}

export default function ReportHero({ projectName, themes, heroIntro, heroImage }: ReportHeroProps) {
  const handleThemeClick = (themeId: string) => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(themeId)?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <section className="min-h-screen flex flex-col bg-white">
      {/* Text — top, centered */}
      <div className="relative px-8 pt-12 pb-8 max-w-xl mx-auto w-full text-center">
        <div className="absolute top-4 right-4">
          <ReportLocaleToggle />
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-[#1a1a1a] leading-tight mb-6">
          {projectName}
        </h1>

        {heroIntro && (
          <p className="text-lg md:text-xl text-[#6a6a6a] leading-relaxed mb-8">
            {heroIntro}
          </p>
        )}

        {themes.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
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
      </div>

      {/* Image — fills remaining height of 100vh section */}
      {heroImage && (
        <div className="relative flex-1">
          <Image
            src={heroImage}
            alt={projectName}
            fill
            className="object-contain object-bottom"
            priority
            sizes="100vw"
          />
        </div>
      )}
    </section>
  );
}
