"use client";

import { useEffect, useRef, useState } from "react";
import type { ReportTheme } from "./report-data";
import { getIcon } from "@/lib/utils/map-icons";

interface ReportFloatingNavProps {
  themes: ReportTheme[];
  activeThemeId: string | null;
  /** Composite active section ID, e.g. "mat-drikke" or "mat-drikke:restaurant" */
  activeSectionId: string | null;
}

export default function ReportFloatingNav({
  themes,
  activeThemeId,
  activeSectionId,
}: ReportFloatingNavProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Scroll active pill into view when active theme changes
  useEffect(() => {
    if (activeRef.current && navRef.current) {
      const pill = activeRef.current;
      const navRect = navRef.current.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();

      if (pillRect.left < navRect.left || pillRect.right > navRect.right) {
        pill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [activeThemeId]);

  // Sentinel observer — show floating nav when sentinel scrolls out of viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { rootMargin: "-56px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll progress calculation — RAF-throttled
  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (!activeThemeId) return;

        const el = document.getElementById(activeThemeId);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const sectionHeight = rect.height;
        if (sectionHeight <= 0) return;

        const scrolledPast = -rect.top + 112;
        const pct = Math.min(1, Math.max(0, scrolledPast / sectionHeight));
        setProgress(pct);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [activeThemeId]);

  const handleClick = (themeId: string) => {
    const el = document.getElementById(themeId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      {/* Sentinel — triggers floating nav visibility */}
      <div ref={sentinelRef} className="h-0" aria-hidden="true" />

      {/* Floating nav bar */}
      <div
        className={`fixed z-40 top-[56px] left-0 right-0 transition-all duration-300 ${
          visible
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-white/95 backdrop-blur-sm border-b border-[#eae6e1] shadow-sm">
          <div
            ref={navRef}
            className="flex items-center gap-1.5 px-4 lg:px-16 py-2.5 overflow-x-auto scrollbar-hide"
          >
            {themes.map((theme) => {
              const Icon = getIcon(theme.icon);
              const isActive = theme.id === activeThemeId;

              return (
                <button
                  key={theme.id}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => handleClick(theme.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    isActive
                      ? "bg-[#1a1a1a] text-white"
                      : "text-[#6a6a6a] hover:bg-[#f5f3f0] hover:text-[#1a1a1a]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {theme.name}
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-[#f0ece7]">
            <div
              className="h-full bg-[#a0937d] transition-[width] duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
