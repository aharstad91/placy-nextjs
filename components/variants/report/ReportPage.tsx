"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData } from "./report-data";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { useActiveSection } from "@/lib/hooks/useActiveSection";
import dynamic from "next/dynamic";
import ReportHero from "./ReportHero";
import ReportThemeSection from "./ReportThemeSection";
import ReportExplorerCTA from "./ReportExplorerCTA";
import { SkeletonReportMap } from "@/components/ui/SkeletonReportMap";

const ReportStickyMap = dynamic(() => import("./ReportStickyMap"), {
  ssr: false,
  loading: () => <SkeletonReportMap className="fixed top-0 right-0 w-1/2 h-screen" />,
});
import ReportFloatingNav from "./ReportFloatingNav";
import ReportClosing from "./ReportClosing";

const SCROLL_KEY_PREFIX = "placy-scroll:";

export interface ActivePOIState {
  poiId: string;
  /** Where the selection originated — controls whether the map flies to the POI */
  source: "card" | "marker";
}

interface ReportPageProps {
  project: Project;
  explorerBaseUrl?: string | null;
  enTranslations?: TranslationMap;
  areaSlug?: string | null;
}

export default function ReportPage(props: ReportPageProps) {
  return (
    <LocaleProvider>
      <ReportPageInner {...props} />
    </LocaleProvider>
  );
}

function ReportPageInner({ project, explorerBaseUrl, enTranslations = {}, areaSlug }: ReportPageProps) {
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

  // Track which themes/sub-sections have been expanded via "Vis meg mer"
  // Keys: "themeId" for themes, "themeId:categoryId" for sub-sections
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());

  const handleExpand = useCallback((key: string) => {
    setExpandedThemes((prev) => new Set(prev).add(key));
  }, []);

  // Initialize active section to first theme
  const initialThemeId = reportData.themes.length > 0 ? reportData.themes[0].id : null;
  const { activeSectionId, registerSectionRef } = useActiveSection(initialThemeId);

  // Parse activeSectionId: "mat-drikke" or "mat-drikke:restaurant"
  const activeThemeId = activeSectionId?.split(":")[0] ?? null;
  const activeSubSectionCategoryId = activeSectionId?.includes(":")
    ? activeSectionId.split(":")[1]
    : null;

  // Handle card click → highlight marker + fly map to POI
  const handleCardClick = useCallback((poiId: string) => {
    setActivePOI((prev) =>
      prev?.poiId === poiId ? null : { poiId, source: "card" }
    );
  }, []);

  // Handle map background click → deselect active POI
  const handleMapClick = useCallback(() => {
    setActivePOI(null);
  }, []);

  // Handle marker click → highlight card + scroll to it (no map movement)
  const handleMarkerClick = useCallback((poiId: string) => {
    setActivePOI((prev) => {
      const next: ActivePOIState | null = prev?.poiId === poiId ? null : { poiId, source: "marker" };
      // Scroll to the card after state update
      if (next) {
        requestAnimationFrame(() => {
          const card = document.querySelector(`[data-poi-id="${CSS.escape(poiId)}"]`);
          card?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      return next;
    });
  }, []);

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
    <div className="min-h-screen bg-white">
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

      {/* Floating theme navigation */}
      <ReportFloatingNav
        themes={reportData.themes}
        activeThemeId={activeThemeId}
        activeSectionId={activeSectionId}
      />

      {/* Desktop: 60/40 split with sticky map */}
      <div className="hidden lg:flex">
        {/* Left: Scrollable theme sections */}
        <div className="w-[50%] px-16 min-w-0 overflow-hidden">
          {reportData.themes.map((theme, i) => (
            <div key={theme.id} ref={revealRef} className="report-section-reveal">
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
                isExpanded={expandedThemes.has(theme.id)}
                onExpand={handleExpand}
                registerSubSectionRef={registerSectionRef}
                expandedKeys={expandedThemes}
                onExpandKey={handleExpand}
              />
            </div>
          ))}
        </div>

        {/* Right: Sticky map */}
        <div className="w-[50%] pt-16 pr-16 pb-16">
          <div className="sticky top-20 h-[calc(100vh-5rem-4rem)] rounded-2xl overflow-hidden">
            <ReportStickyMap
              themes={reportData.themes}
              activeThemeId={activeThemeId}
              activeSubSectionCategoryId={activeSubSectionCategoryId}
              activePOI={activePOI}
              hotelCoordinates={reportData.centerCoordinates}
              onMarkerClick={handleMarkerClick}
              onMapClick={handleMapClick}
              mapStyle={reportData.mapStyle}
              expandedThemes={expandedThemes}
              areaSlug={areaSlug}
            />
          </div>
        </div>
      </div>

      {/* Mobile: Original per-section inline maps */}
      <div className="lg:hidden px-16">
        <div className="grid grid-cols-12 gap-x-6">
          {reportData.themes.map((theme, i) => (
            <div key={theme.id} ref={revealRef} className="col-span-12 report-section-reveal">
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
