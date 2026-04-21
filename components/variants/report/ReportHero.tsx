"use client";

import Image from "next/image";
import type { ReportTheme } from "./report-data";
import ThemeChip from "@/components/shared/ThemeChip";
import { renderEmphasizedText } from "@/lib/utils/render-emphasized-text";

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
    <section className="min-h-[66vh] flex flex-col bg-white">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2">
        {/* Left: text */}
        <div className="flex flex-col justify-center px-6 py-10 md:px-16 md:py-14">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-[#1a1a1a] leading-tight tracking-tight mb-6">
            {projectName}
          </h1>

          {heroIntro && (
            <p className="text-xl md:text-2xl text-[#6a6a6a] leading-snug tracking-tight mb-8">
              {renderEmphasizedText(heroIntro)}
            </p>
          )}

          {themes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

        {/* Right: illustration */}
        {heroImage && (
          <div className="relative hidden md:block">
            <Image
              src={heroImage}
              alt={projectName}
              fill
              className="object-contain object-center"
              priority
              sizes="50vw"
            />
          </div>
        )}
      </div>
    </section>
  );
}
