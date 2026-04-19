"use client";

import { useMemo, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData, type ReportTheme } from "./report-data";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import ReportHero from "./ReportHero";
import ReportThemeSection from "./ReportThemeSection";
import ReportSummarySection from "./ReportSummarySection";

// ReportOverviewMap krever WebGL og browser-API → må lastes kun på klient.
// Følger samme mønster som ReportThemeMap (SSR-safe).
const ReportOverviewMap = dynamic(() => import("./blocks/ReportOverviewMap"), {
  ssr: false,
});

const SCROLL_KEY_PREFIX = "placy-scroll:";

interface ReportPageProps {
  project: Project;
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

function ReportPageInner({ project, enTranslations = {}, areaSlug, primaryThemeIds }: ReportPageProps) {
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
        heroImage={reportData.heroImage}
      />

      {/* Centered single-column layout — sidebar navigation removed in favour of a different approach */}
      <div className="max-w-[800px] mx-auto w-full px-16">
        {/* Primary themes */}
        {primaryThemes.map((theme, i) => (
          <div key={theme.id} ref={revealRef} className="report-section-reveal">
            {i > 0 && <ThemeSeparator />}
            <ReportThemeSection
              theme={theme}
              center={reportData.centerCoordinates}
              projectName={reportData.projectName}
              mapStyle={reportData.mapStyle}
              areaSlug={areaSlug}
              has3dAddon={effectiveProject.has3dAddon ?? false}
              allProjectPOIs={reportData.allProjectPOIs}
            />
          </div>
        ))}

        {/* 3D-kart — "Alt rundt [område]". Vises for alle rapporter med POIs. */}
        {effectiveProject.pois.length > 0 && (
          <ReportOverviewMap
            areaSlug={areaSlug}
            projectName={reportData.projectName}
            center={reportData.centerCoordinates}
            pois={effectiveProject.pois}
            has3dAddon={effectiveProject.has3dAddon ?? false}
            initialHeading={reportData.initialHeading}
          />
        )}

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
                  mapStyle={reportData.mapStyle}
                  areaSlug={areaSlug}
                  variant="secondary"
                  has3dAddon={effectiveProject.has3dAddon ?? false}
                  allProjectPOIs={reportData.allProjectPOIs}
                />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Summary section — full-bleed hero-style layout mirroring ReportHero.
          Sidebar exits naturally above since we're outside the 3-col grid. */}
      <ReportSummarySection
        summary={reportData.summary}
        brokers={reportData.brokers}
        cta={reportData.cta}
        projectTitle={reportData.projectName}
        themesCount={reportData.themes.length}
        heroImage={reportData.heroImage}
      />
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
