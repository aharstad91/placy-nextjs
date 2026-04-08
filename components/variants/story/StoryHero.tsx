"use client";

import type { StoryTheme } from "./story-data";
import { getIcon } from "@/lib/utils/map-icons";

interface StoryHeroProps {
  projectName: string;
  heroIntro: string;
  themes: StoryTheme[];
}

export default function StoryHero({ projectName, heroIntro, themes }: StoryHeroProps) {
  const handleThemeClick = (themeId: string) => {
    document.getElementById(themeId)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };

  return (
    <header className="mb-16 md:mb-24">
      {/* Project name */}
      <h1 className="text-4xl md:text-5xl font-semibold text-[#1a1a1a] tracking-tight mb-6"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {projectName}
      </h1>

      {/* Hero intro — S&J-style editorial opening */}
      <p className="text-xl md:text-2xl text-[#4a4a4a] leading-relaxed mb-10 max-w-xl">
        {heroIntro}
      </p>

      {/* Theme navigation chips */}
      <nav className="flex flex-wrap gap-2" aria-label="Tema-navigasjon">
        {themes.map((theme) => {
          const Icon = getIcon(theme.icon);
          return (
            <button
              key={theme.id}
              onClick={() => handleThemeClick(theme.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#e0dcd6] bg-white text-sm text-[#4a4a4a] hover:bg-[#f5f3f0] hover:border-[#c8c3bc] transition-colors"
            >
              <Icon className="w-3.5 h-3.5" style={{ color: theme.color }} />
              <span>{theme.name}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
