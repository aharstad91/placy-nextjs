"use client";

import type { ReportTheme } from "./report-data";
import { getIcon } from "@/lib/utils/map-icons";

interface ReportSidebarNavProps {
  themes: ReportTheme[];
  /** Composite active section ID, e.g. "hverdagsliv" or "mat-drikke:restaurant" */
  activeSectionId: string | null;
}

export default function ReportSidebarNav({
  themes,
  activeSectionId,
}: ReportSidebarNavProps) {
  const handleClick = (themeId: string) => {
    const el = document.getElementById(themeId);
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  // Active theme = first segment of activeSectionId (before ":")
  const activeThemeId = activeSectionId?.split(":")[0] ?? null;

  return (
    <aside className="hidden lg:block lg:pl-4 lg:pt-[5.875rem]">
      <nav
        className="sticky top-10 self-start"
        aria-label="Kategori-navigasjon"
      >
        <ul className="flex flex-col gap-0.5">
          {themes.map((theme) => {
            const Icon = getIcon(theme.icon);
            const isActive = theme.id === activeThemeId;
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  onClick={() => handleClick(theme.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    isActive
                      ? "bg-[#f5f3f0] text-[#1a1a1a]"
                      : "text-[#6a6a6a] hover:bg-[#faf9f7] hover:text-[#1a1a1a]"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-[#1a1a1a]" : "text-[#a0937d]"
                    }`}
                  />
                  <span className="truncate">{theme.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
