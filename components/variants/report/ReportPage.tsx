"use client";

import { useMemo, useEffect, useRef, useCallback } from "react";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData, type ReportTheme } from "./report-data";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { useActiveSection } from "@/lib/hooks/useActiveSection";
import ReportHero from "./ReportHero";
import ReportSidebarNav from "./ReportSidebarNav";
import ReportThemeSection from "./ReportThemeSection";
import ReportExplorerCTA from "./ReportExplorerCTA";
import ReportClosing from "./ReportClosing";

const SCROLL_KEY_PREFIX = "placy-scroll:";

interface ReportPageProps {
  project: Project;
  explorerBaseUrl?: string | null;
  enTranslations?: TranslationMap;
  areaSlug?: string | null;
  /** Theme IDs from ?themes= param — themes not in this list are demoted to "Andre kategorier" */
  primaryThemeIds?: string[];
}

export default function ReportPage(props: ReportPageProps) {
  return (
    <LocaleProvider>
      <ReportPageInner {...props} />
    </LocaleProvider>
  );
}

function ReportPageInner({ project, explorerBaseUrl, enTranslations = {}, areaSlug, primaryThemeIds }: ReportPageProps) {
  const { locale } = useLocale();

  const effectiveProject = useMemo(
    () => applyTranslations(project, locale, enTranslations),
    [project, locale, enTranslations]
  );

  const reportData = useMemo(
    () => transformToReportData(effectiveProject, locale),
    [effectiveProject, locale]
  );

  // Split themes into primary (selected on welcome) and secondary (deselected)
  const { primaryThemes, secondaryThemes } = useMemo(() => {
    if (!primaryThemeIds || primaryThemeIds.length === 0) {
      return { primaryThemes: reportData.themes, secondaryThemes: [] as ReportTheme[] };
    }
    const validIds = new Set(reportData.themes.map((t) => t.id));
    const selectedIds = new Set(primaryThemeIds.filter((id) => validIds.has(id)));
    if (selectedIds.size === 0) {
      return { primaryThemes: reportData.themes, secondaryThemes: [] as ReportTheme[] };
    }
    return {
      primaryThemes: reportData.themes.filter((t) => selectedIds.has(t.id)),
      secondaryThemes: reportData.themes.filter((t) => !selectedIds.has(t.id)),
    };
  }, [reportData.themes, primaryThemeIds]);

  // Section tracking via IntersectionObserver (for registerSectionRef)
  const initialThemeId = reportData.themes.length > 0 ? reportData.themes[0].id : null;
  const { registerSectionRef, activeSectionId } = useActiveSection(initialThemeId);

  // Section reveal animation via IntersectionObserver
  const revealRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
  }, []);

  // Scroll preservation: restore on mount, save continuously
  const restoredRef = useRef(false);

  useEffect(() => {
    const key = SCROLL_KEY_PREFIX + window.location.pathname;

    if (!restoredRef.current) {
      restoredRef.current = true;
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const y = parseInt(saved, 10);
        if (!isNaN(y) && y > 0) {
          requestAnimationFrame(() => {
            window.scrollTo(0, y);
          });
        }
      }
    }

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
    <div className="min-h-screen bg-white">
      {/* Hero — full bleed, breaks out of centered container */}
      <ReportHero
        projectName={reportData.projectName}
        themes={reportData.themes}
        heroIntro={reportData.heroIntro}
        heroImage="/bekkeloep-dagtid.webp"
      />

      {/* Three-column layout: sidebar | content | balance */}
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,800px)_220px] lg:gap-16 lg:justify-center lg:px-8">
        {/* Left: sticky sidebar nav (grid item stretches → nav can stick within) */}
        <ReportSidebarNav
          themes={reportData.themes}
          activeSectionId={activeSectionId}
        />

        {/* Center: content column */}
        <div className="max-w-[800px] mx-auto lg:mx-0 w-full">
          {/* Theme sections */}
          <div className="px-8 lg:px-0">
            {/* Primary themes */}
            {primaryThemes.map((theme, i) => (
              <div key={theme.id} ref={revealRef} className="report-section-reveal">
                {i > 0 && <ThemeSeparator />}
                <ReportThemeSection
                  theme={theme}
                  center={reportData.centerCoordinates}
                  projectName={reportData.projectName}
                  registerRef={registerSectionRef(theme.id)}
                  mapStyle={reportData.mapStyle}
                  areaSlug={areaSlug}
                />
              </div>
            ))}

            {/* Secondary themes — demoted from welcome screen */}
            {secondaryThemes.length > 0 && (
              <>
                <div className="py-8">
                  <div className="h-px bg-[#e8e4df]" />
                  <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mt-6 mb-2">
                    Andre kategorier
                  </p>
                </div>
                {secondaryThemes.map((theme, i) => (
                  <div key={theme.id} ref={revealRef} className="report-section-reveal">
                    {i > 0 && <ThemeSeparator />}
                    <ReportThemeSection
                      theme={theme}
                      center={reportData.centerCoordinates}
                      projectName={reportData.projectName}
                      registerRef={registerSectionRef(theme.id)}
                      mapStyle={reportData.mapStyle}
                      areaSlug={areaSlug}
                      variant="secondary"
                    />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer sections */}
          <div className="px-8 lg:px-0">
            <div className="grid grid-cols-12 gap-x-6">
              {/* Explorer CTA */}
              {explorerBaseUrl && project.pois.length > 0 && (
                <ReportExplorerCTA
                  pois={project.pois}
                  center={reportData.centerCoordinates}
                  explorerBaseUrl={explorerBaseUrl}
                  totalPOIs={reportData.heroMetrics.totalPOIs}
                />
              )}

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
          </div>
        </div>

        {/* Right: balance column (keeps content visually centered) */}
        <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </div>
  );
}

// --- Theme separator with icon ---

function ThemeSeparator() {
  return (
    <div className="py-2">
      <div className="h-px bg-[#e0dcd6]" />
    </div>
  );
}
