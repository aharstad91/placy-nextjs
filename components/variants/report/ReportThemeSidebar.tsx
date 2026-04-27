"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ReportTheme } from "./report-data";

interface ReportThemeSidebarProps {
  themes: ReportTheme[];
}

const THEME_ICON_SRC: Record<string, string> = {
  hverdagsliv: "/illustrations/icons/hverdagsliv-icon.png",
  "barn-oppvekst": "/illustrations/icons/barn-aktivitet-icon.png",
  "mat-drikke": "/illustrations/icons/mat-drikke-icon.png",
  opplevelser: "/illustrations/icons/opplevelser-icon.png",
  "natur-friluftsliv": "/illustrations/icons/natur-friluftsliv-icon.png",
  transport: "/illustrations/icons/transport-mobilitet-icon.png",
  "trening-aktivitet": "/illustrations/icons/trening-aktivitet-icon.png",
};

/**
 * Sticky navigasjon for tema-seksjoner. Highlightar aktivt tema basert på
 * scroll-posisjon (IntersectionObserver). Klikk = smooth-scroll til seksjonen.
 */
export default function ReportThemeSidebar({ themes }: ReportThemeSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(themes[0]?.id ?? null);

  useEffect(() => {
    if (themes.length === 0) return;

    const elements = themes
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-30% 0px -50% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [themes]);

  const handleClick = (themeId: string) => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(themeId)?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <nav className="flex flex-col gap-1" aria-label="Kategorier">
      <p className="text-xs uppercase tracking-[0.18em] text-[#a0937d] mb-3 px-3">
        Kategorier
      </p>
      {themes.map((theme) => {
        const iconSrc = THEME_ICON_SRC[theme.id];
        const isActive = activeId === theme.id;
        return (
          <button
            key={theme.id}
            onClick={() => handleClick(theme.id)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
              isActive
                ? "bg-[#f5f1ec] text-[#1a1a1a]"
                : "text-[#6a6a6a] hover:bg-[#faf9f7] hover:text-[#1a1a1a]",
            )}
          >
            {iconSrc && (
              <div className="relative w-8 h-8 shrink-0">
                <Image
                  src={iconSrc}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
            )}
            <span className="text-sm font-medium leading-tight">{theme.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
