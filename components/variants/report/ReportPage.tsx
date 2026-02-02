"use client";

import { useMemo, useEffect, useRef } from "react";
import type { Project } from "@/lib/types";
import { transformToReportData } from "./report-data";
import ReportHero from "./ReportHero";
import ReportThemeIndex from "./ReportThemeIndex";
import ReportThemeSection from "./ReportThemeSection";
import ReportClosing from "./ReportClosing";

const SCROLL_KEY_PREFIX = "placy-scroll:";

interface ReportPageProps {
  project: Project;
  explorerBaseUrl?: string | null;
}

export default function ReportPage({ project, explorerBaseUrl }: ReportPageProps) {
  const reportData = useMemo(
    () => transformToReportData(project),
    [project]
  );

  // Scroll preservation: restore on mount, save continuously
  const restoredRef = useRef(false);

  useEffect(() => {
    const key = SCROLL_KEY_PREFIX + window.location.pathname;

    // Restore scroll position once on mount
    if (!restoredRef.current) {
      restoredRef.current = true;
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const y = parseInt(saved, 10);
        if (!isNaN(y) && y > 0) {
          // Small delay to let the layout render
          requestAnimationFrame(() => {
            window.scrollTo(0, y);
          });
        }
      }
    }

    // Save scroll position on scroll (throttled)
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          sessionStorage.setItem(key, String(window.scrollY));
          ticking = false;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero */}
      <ReportHero
        projectName={reportData.projectName}
        metrics={reportData.heroMetrics}
        label={reportData.label}
        heroIntro={reportData.heroIntro}
      />

      {/* Theme index tags */}
      <ReportThemeIndex themes={reportData.themes} />

      {/* Theme sections */}
      {reportData.themes.map((theme, i) => {
        const themeCategories = theme.allPOIs.length > 0
          ? Array.from(new Set(theme.allPOIs.map((p) => p.category.id)))
          : [];
        return (
          <div key={theme.id}>
            {i > 0 && (
              <div className="max-w-3xl mx-auto px-6">
                <div className="h-px bg-[#e8e4df]" />
              </div>
            )}
            <ReportThemeSection
              theme={theme}
              center={reportData.centerCoordinates}
              explorerBaseUrl={explorerBaseUrl}
              themeCategories={themeCategories}
              mapStyle={reportData.mapStyle}
            />
          </div>
        );
      })}

      {/* Closing */}
      <ReportClosing
        projectName={reportData.projectName}
        totalPOIs={reportData.heroMetrics.totalPOIs}
        avgRating={reportData.heroMetrics.avgRating}
        closingTitle={reportData.closingTitle}
        closingText={reportData.closingText}
        label={reportData.label}
      />
    </div>
  );
}
