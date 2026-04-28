"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ReportTheme } from "../report-data";

interface Props {
  themes: ReportTheme[];
}

export default function ParaformThemeSidebar({ themes }: Props) {
  const [activeId, setActiveId] = useState<string | null>(themes[0]?.id ?? null);

  useEffect(() => {
    if (themes.length === 0) return;
    const elements = themes
      .map((t) => document.getElementById(`paraform-${t.id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^paraform-/, "");
          setActiveId(id);
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
    document.getElementById(`paraform-${themeId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <nav aria-label="Kategorier">
      <p className="text-xs uppercase tracking-[0.22em] text-[#8a8275] mb-6">
        Innhold
      </p>
      <ul className="flex flex-col">
        {themes.map((theme, i) => {
          const isActive = activeId === theme.id;
          return (
            <li key={theme.id}>
              <button
                onClick={() => handleClick(theme.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "w-full flex items-center justify-between gap-4 py-4 text-left transition-colors duration-150 border-t border-[#e8e3d8]",
                  isActive ? "text-[#1a1a1a]" : "text-[#6a6a6a] hover:text-[#1a1a1a]",
                )}
              >
                <span className="font-[family-name:var(--font-serif)] text-lg leading-tight">
                  {theme.name}
                </span>
                <span className="text-xs tabular-nums text-[#a89f8c]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
