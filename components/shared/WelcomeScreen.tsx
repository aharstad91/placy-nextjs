"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ThemeDefinition } from "@/lib/themes/theme-definitions";
import { getIcon } from "@/lib/utils/map-icons";

interface WelcomeScreenProps {
  projectName: string;
  tagline?: string;
  heroImage?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  defaultProductPath: string; // "report" | "explore" | "trip"
  basePath: string; // "/for/overvik/overvik-sorgenfri"
  themes: ThemeDefinition[];
  showThemeSelector: boolean; // false when defaultProduct === "guide"
}

export default function WelcomeScreen({
  projectName,
  tagline,
  heroImage,
  heroTitle,
  heroSubtitle,
  defaultProductPath,
  basePath,
  themes,
  showThemeSelector,
}: WelcomeScreenProps) {
  const [selectedThemeIds, setSelectedThemeIds] = useState<Set<string>>(
    () => new Set(themes.map((t) => t.id))
  );

  const selectedCount = selectedThemeIds.size;

  const toggleTheme = (themeId: string) => {
    setSelectedThemeIds((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) {
        next.delete(themeId);
      } else {
        next.add(themeId);
      }
      return next;
    });
  };

  const targetHref = useMemo(() => {
    if (!showThemeSelector || selectedCount === themes.length || selectedCount === 0) {
      return `${basePath}/${defaultProductPath}`;
    }
    const selected = themes.filter((t) => selectedThemeIds.has(t.id)).map((t) => t.id);
    return `${basePath}/${defaultProductPath}?themes=${selected.join(",")}`;
  }, [selectedThemeIds, selectedCount, themes, basePath, defaultProductPath, showThemeSelector]);

  const isDisabled = showThemeSelector && selectedCount === 0;

  return (
    <main className="-mt-12 bg-[#faf9f7]">
      {/* Desktop: side-by-side layout */}
      <div className="hidden lg:flex min-h-[100dvh]">
        {/* Left: Hero image + text overlay */}
        <div className="relative w-[55%] min-h-[100dvh]">
          {heroImage ? (
            <Image
              src={heroImage}
              alt={heroTitle ?? projectName}
              fill
              className="object-cover"
              priority
              sizes="55vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#e8e4df] to-[#d6d0c8]" />
          )}
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {/* Text overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-12 welcome-animate" style={{ animationDelay: "0ms" }}>
            <h1 className="text-4xl xl:text-5xl font-semibold text-white mb-3 leading-tight">
              {heroTitle ?? projectName}
            </h1>
            {(heroSubtitle ?? tagline) && (
              <p className="text-lg text-white/85 max-w-md leading-relaxed">
                {heroSubtitle ?? tagline}
              </p>
            )}
          </div>
        </div>

        {/* Right: Theme selector panel */}
        <div className="w-[45%] flex flex-col">
          <div className="flex-1 flex flex-col justify-center px-12 xl:px-16 py-12">
            <div className="w-full max-w-md">
              {/* Section header */}
              <header
                className="mb-8 welcome-animate"
                style={{ animationDelay: "200ms" }}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-2">
                  Utforsk nabolaget
                </p>
                {showThemeSelector && (
                  <p className="text-base text-[#6a6a6a]">
                    Velg hva du vil vite mer om — vi tilpasser rapporten etter dine interesser.
                  </p>
                )}
              </header>

              {/* Theme selector */}
              {showThemeSelector && (
                <fieldset
                  className="welcome-animate"
                  style={{ animationDelay: "280ms" }}
                >
                  <legend className="sr-only">Velg temaer</legend>

                  <div className="space-y-2">
                    {themes.map((theme, i) => {
                      const isSelected = selectedThemeIds.has(theme.id);
                      const Icon = getIcon(theme.icon);

                      return (
                        <label
                          key={theme.id}
                          className={`
                            welcome-animate group relative flex items-center gap-3 px-4 py-3 rounded-xl
                            cursor-pointer select-none transition-all duration-150
                            focus-within:ring-2 focus-within:ring-[#1a1a1a] focus-within:ring-offset-2
                            ${isSelected
                              ? "bg-white shadow-sm border border-[#eae6e1]"
                              : "bg-transparent border border-transparent opacity-50 hover:opacity-100 hover:border-[#eae6e1] hover:shadow-sm"
                            }
                          `}
                          style={{ animationDelay: `${320 + i * 55}ms` }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTheme(theme.id)}
                            className="sr-only"
                            aria-label={theme.name}
                          />

                          {/* Color dot */}
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{
                              backgroundColor: isSelected ? theme.color : "#d6d0c8",
                            }}
                            aria-hidden="true"
                          />

                          {/* Icon */}
                          <Icon
                            className={`w-4 h-4 shrink-0 ${isSelected ? "text-[#1a1a1a]" : "text-[#a0998f]"}`}
                            aria-hidden="true"
                          />

                          {/* Label */}
                          <span
                            className={`text-sm font-medium ${isSelected ? "text-[#1a1a1a]" : "text-[#a0998f]"}`}
                          >
                            {theme.name}
                          </span>

                          {/* Checkbox indicator */}
                          <span className="ml-auto shrink-0">
                            {isSelected ? (
                              <span className="w-5 h-5 rounded-md bg-[#1a1a1a] flex items-center justify-center">
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-md border-2 border-[#d6d0c8]" />
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          </div>

          {/* CTA at bottom of right panel */}
          <div
            className="px-12 xl:px-16 pb-12 welcome-animate"
            style={{ animationDelay: `${showThemeSelector ? 320 + themes.length * 55 + 80 : 360}ms` }}
          >
            <div className="w-full max-w-md">
              {/* Live region for screen readers */}
              <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {showThemeSelector && (
                  selectedCount === 0
                    ? "Ingen temaer valgt. Du må velge minst ett."
                    : `${selectedCount} ${selectedCount === 1 ? "tema" : "temaer"} valgt.`
                )}
              </div>

              {/* Validation hint */}
              <p
                id="cta-hint-desktop"
                className={`text-sm mb-2 transition-opacity ${
                  isDisabled ? "text-[#a0998f] opacity-100" : "opacity-0 sr-only"
                }`}
              >
                Velg minst ett tema for å fortsette.
              </p>

              {/* CTA button */}
              {isDisabled ? (
                <button
                  type="button"
                  aria-disabled="true"
                  aria-describedby="cta-hint-desktop"
                  className="w-full py-3.5 rounded-xl text-sm font-semibold bg-[#d6d0c8] text-[#a0998f] cursor-not-allowed"
                  onClick={(e) => e.preventDefault()}
                >
                  Utforsk nabolaget <span aria-hidden="true">→</span>
                </button>
              ) : (
                <Link
                  href={targetHref}
                  aria-describedby={showThemeSelector ? "cta-hint-desktop" : undefined}
                  className="block w-full py-3.5 rounded-xl text-sm font-semibold text-center bg-[#1a1a1a] text-white hover:bg-[#2a2a2a] active:scale-[0.99] shadow-md transition-all"
                >
                  Utforsk nabolaget <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: stacked layout */}
      <div className="lg:hidden flex flex-col min-h-[100dvh]">
        {/* Hero image */}
        {heroImage && (
          <div className="relative w-full h-[45vh] welcome-animate" style={{ animationDelay: "0ms" }}>
            <Image
              src={heroImage}
              alt={heroTitle ?? projectName}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#faf9f7] via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-1">
                {heroTitle ?? projectName}
              </h1>
              {(heroSubtitle ?? tagline) && (
                <p className="text-sm text-[#6a6a6a] leading-relaxed">
                  {heroSubtitle ?? tagline}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 flex flex-col items-center px-4 py-6">
          <div className="w-full max-w-lg">
            {/* Header — only show full header when no hero image */}
            {!heroImage && (
              <header
                className="text-center mb-8 welcome-animate"
                style={{ animationDelay: "0ms" }}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-3">
                  Utforsk nabolaget
                </p>
                <h1 className="text-3xl font-semibold text-[#1a1a1a] mb-2">
                  {projectName}
                </h1>
                {tagline && (
                  <p className="text-base text-[#6a6a6a]">{tagline}</p>
                )}
              </header>
            )}

            {/* Section label when hero image is present */}
            {heroImage && (
              <p
                className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-4 welcome-animate"
                style={{ animationDelay: "80ms" }}
              >
                Utforsk nabolaget
              </p>
            )}

            {/* Theme selector */}
            {showThemeSelector && (
              <fieldset
                className="welcome-animate"
                style={{ animationDelay: heroImage ? "120ms" : "80ms" }}
              >
                <legend className="text-sm font-medium text-[#1a1a1a] mb-3 text-center w-full">
                  Hva interesserer deg?
                </legend>

                <div className="space-y-2">
                  {themes.map((theme, i) => {
                    const isSelected = selectedThemeIds.has(theme.id);
                    const Icon = getIcon(theme.icon);

                    return (
                      <label
                        key={theme.id}
                        className={`
                          welcome-animate group relative flex items-center gap-3 px-4 py-3 rounded-xl
                          cursor-pointer select-none transition-all duration-150
                          focus-within:ring-2 focus-within:ring-[#1a1a1a] focus-within:ring-offset-2
                          ${isSelected
                            ? "bg-white shadow-sm border border-[#eae6e1]"
                            : "bg-transparent border border-transparent opacity-50 hover:opacity-100 hover:border-[#eae6e1] hover:shadow-sm"
                          }
                        `}
                        style={{ animationDelay: `${(heroImage ? 160 : 120) + i * 55}ms` }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTheme(theme.id)}
                          className="sr-only"
                          aria-label={theme.name}
                        />

                        {/* Color dot */}
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{
                            backgroundColor: isSelected ? theme.color : "#d6d0c8",
                          }}
                          aria-hidden="true"
                        />

                        {/* Icon */}
                        <Icon
                          className={`w-4 h-4 shrink-0 ${isSelected ? "text-[#1a1a1a]" : "text-[#a0998f]"}`}
                          aria-hidden="true"
                        />

                        {/* Label */}
                        <span
                          className={`text-sm font-medium ${isSelected ? "text-[#1a1a1a]" : "text-[#a0998f]"}`}
                        >
                          {theme.name}
                        </span>

                        {/* Checkbox indicator */}
                        <span className="ml-auto shrink-0">
                          {isSelected ? (
                            <span className="w-5 h-5 rounded-md bg-[#1a1a1a] flex items-center justify-center">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-md border-2 border-[#d6d0c8]" />
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>
        </div>

        {/* Sticky CTA area (mobile) */}
        <div
          className="sticky bottom-0 bg-[#faf9f7] border-t border-[#eae6e1] px-4 py-4 welcome-animate"
          style={{ animationDelay: `${showThemeSelector ? (heroImage ? 160 : 120) + themes.length * 55 + 80 : 160}ms` }}
        >
          <div className="max-w-lg mx-auto">
            {/* Live region for screen readers */}
            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {showThemeSelector && (
                selectedCount === 0
                  ? "Ingen temaer valgt. Du må velge minst ett."
                  : `${selectedCount} ${selectedCount === 1 ? "tema" : "temaer"} valgt.`
              )}
            </div>

            {/* Validation hint */}
            <p
              id="cta-hint"
              className={`text-center text-sm mb-2 transition-opacity ${
                isDisabled ? "text-[#a0998f] opacity-100" : "opacity-0 sr-only"
              }`}
            >
              Velg minst ett tema for å fortsette.
            </p>

            {/* CTA button */}
            {isDisabled ? (
              <button
                type="button"
                aria-disabled="true"
                aria-describedby="cta-hint"
                className="w-full py-3.5 rounded-xl text-sm font-semibold bg-[#d6d0c8] text-[#a0998f] cursor-not-allowed"
                onClick={(e) => e.preventDefault()}
              >
                Utforsk nabolaget <span aria-hidden="true">→</span>
              </button>
            ) : (
              <Link
                href={targetHref}
                aria-describedby={showThemeSelector ? "cta-hint" : undefined}
                className="block w-full py-3.5 rounded-xl text-sm font-semibold text-center bg-[#1a1a1a] text-white hover:bg-[#2a2a2a] active:scale-[0.99] shadow-md transition-all"
              >
                Utforsk nabolaget <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
