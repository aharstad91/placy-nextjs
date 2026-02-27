"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { ThemeDefinition } from "@/lib/themes/theme-definitions";
import { getIcon } from "@/lib/utils/map-icons";

interface WelcomeScreenProps {
  projectName: string;
  tagline?: string;
  defaultProductPath: string; // "report" | "explore" | "trip"
  basePath: string; // "/for/overvik/overvik-sorgenfri"
  themes: ThemeDefinition[];
  showThemeSelector: boolean; // false when defaultProduct === "guide"
}

export default function WelcomeScreen({
  projectName,
  tagline,
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
    <main className="min-h-[100dvh] bg-[#faf9f7] flex flex-col">
      {/* Content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Header */}
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

          {/* Theme selector */}
          {showThemeSelector && (
            <fieldset
              className="welcome-animate"
              style={{ animationDelay: "80ms" }}
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
                      style={{ animationDelay: `${120 + i * 55}ms` }}
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

      {/* Sticky CTA area */}
      <div
        className="sticky bottom-0 bg-[#faf9f7] border-t border-[#eae6e1] px-4 py-4 welcome-animate"
        style={{ animationDelay: `${showThemeSelector ? 120 + themes.length * 55 + 80 : 160}ms` }}
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
    </main>
  );
}
