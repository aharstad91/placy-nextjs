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
    <section className="bg-gradient-to-b from-[#faf9f7] via-[#faf9f7] to-white">
      {/* Two-column intro — full bleed */}
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-[480px]">
        {/* Left: text */}
        <div className="flex flex-col justify-center px-8 md:px-16 lg:px-24 py-14 md:py-20 relative">
          {/* Locale toggle */}
          <div className="absolute top-6 right-8 md:right-16">
            <ReportLocaleToggle />
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-[#1a1a1a] leading-tight mb-6">
            {projectName}
          </h1>

          {heroIntro && (
            <p className="text-lg md:text-xl text-[#6a6a6a] leading-relaxed max-w-xl mb-8">
              {heroIntro}
            </p>
          )}

          {/* Theme chips — in left column alongside intro */}
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

        {/* Right: image — stretches to match left column height */}
        {heroImage && (
          <div className="hidden md:block pt-10 pr-12 pb-10">
            <div className="relative h-full min-h-[360px] rounded-2xl overflow-hidden shadow-sm">
              <Image
                src={heroImage}
                alt={projectName}
                fill
                className="object-cover"
                priority
                sizes="50vw"
              />
            </div>
          </div>
        )}
      </div>

    </section>
  );
}
