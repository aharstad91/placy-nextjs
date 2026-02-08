"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData } from "./report-data";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { useActiveSection } from "@/lib/hooks/useActiveSection";
import ReportHero from "./ReportHero";
import ReportThemeSection from "./ReportThemeSection";
import ReportStickyMap from "./ReportStickyMap";
import ReportExplorerCTA from "./ReportExplorerCTA";
import ReportClosing from "./ReportClosing";

const SCROLL_KEY_PREFIX = "placy-scroll:";

export interface ActivePOIState {
  poiId: string;
}

interface ReportPageProps {
  project: Project;
  explorerBaseUrl?: string | null;
  enTranslations?: TranslationMap;
}

export default function ReportPage(props: ReportPageProps) {
  return (
    <LocaleProvider>
      <ReportPageInner {...props} />
    </LocaleProvider>
  );
}

function ReportPageInner({ project, explorerBaseUrl, enTranslations = {} }: ReportPageProps) {
  const { locale } = useLocale();

  const effectiveProject = useMemo(
    () => applyTranslations(project, locale, enTranslations),
    [project, locale, enTranslations]
  );

  const reportData = useMemo(
    () => transformToReportData(effectiveProject),
    [effectiveProject]
  );

  // Active POI state with source discriminator (shared between map and sections)
  const [activePOI, setActivePOI] = useState<ActivePOIState | null>(null);

  // Initialize active section to first theme
  const initialThemeId = reportData.themes.length > 0 ? reportData.themes[0].id : null;
  const { activeSectionId, registerSectionRef } = useActiveSection(initialThemeId);

  // Handle card click → highlight marker
  const handleCardClick = useCallback((poiId: string) => {
    setActivePOI((prev) =>
      prev?.poiId === poiId ? null : { poiId }
    );
  }, []);

  // Handle marker click → highlight card
  const handleMarkerClick = useCallback((poiId: string) => {
    setActivePOI((prev) =>
      prev?.poiId === poiId ? null : { poiId }
    );
  }, []);

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
      {/* Hero — full width with padding */}
      <div className="px-16">
        <div className="grid grid-cols-12 gap-x-6">
          <ReportHero
            projectName={reportData.projectName}
            metrics={reportData.heroMetrics}
            themes={reportData.themes}
            label={reportData.label}
            heroIntro={reportData.heroIntro}
          />
        </div>
      </div>

      {/* Desktop: 50/50 split with sticky map */}
      <div className="hidden lg:flex">
        {/* Left: Scrollable theme sections */}
        <div className="w-1/2 px-16">
          {reportData.themes.map((theme, i) => (
            <div key={theme.id}>
              {i > 0 && <div className="h-px bg-[#e8e4df]" />}
              <ReportThemeSection
                theme={theme}
                center={reportData.centerCoordinates}
                explorerBaseUrl={explorerBaseUrl}
                projectName={reportData.projectName}
                registerRef={registerSectionRef(theme.id)}
                useStickyMap={true}
                activePOIId={activePOI?.poiId ?? null}
                onPOIClick={handleCardClick}
              />
            </div>
          ))}
        </div>

        {/* Right: Sticky map */}
        <div className="w-1/2">
          <div className="sticky top-20 h-[calc(100vh-5rem)]">
            <ReportStickyMap
              themes={reportData.themes}
              activeThemeId={activeSectionId}
              activePOI={activePOI}
              hotelCoordinates={reportData.centerCoordinates}
              onMarkerClick={handleMarkerClick}
              mapStyle={reportData.mapStyle}
            />
          </div>
        </div>
      </div>

      {/* Mobile: Original per-section inline maps */}
      <div className="lg:hidden px-16">
        <div className="grid grid-cols-12 gap-x-6">
          {reportData.themes.map((theme, i) => (
            <div key={theme.id} className="col-span-12">
              {i > 0 && <div className="h-px bg-[#e8e4df]" />}
              <ReportThemeSection
                theme={theme}
                center={reportData.centerCoordinates}
                explorerBaseUrl={explorerBaseUrl}
                projectName={reportData.projectName}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Footer sections — full width with padding */}
      <div className="px-16">
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
  );
}
