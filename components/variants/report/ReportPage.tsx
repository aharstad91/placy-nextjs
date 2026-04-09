"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData, type ReportTheme } from "./report-data";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { useActiveSection } from "@/lib/hooks/useActiveSection";
import ReportHero from "./ReportHero";
import ReportThemeSection from "./ReportThemeSection";
import ReportExplorerCTA from "./ReportExplorerCTA";
import { getIcon } from "@/lib/utils/map-icons";
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

  // Active POI state — shared between inline-POI clicks and map markers
  const [activePOI, setActivePOI] = useState<ActivePOIState | null>(null);

  // Section tracking via IntersectionObserver (for registerSectionRef)
  const initialThemeId = reportData.themes.length > 0 ? reportData.themes[0].id : null;
  const { registerSectionRef } = useActiveSection(initialThemeId);

  // Handle inline-POI click → highlight marker + fly map to POI
  const handlePOIClick = useCallback((poiId: string) => {
    setActivePOI((prev) =>
      prev?.poiId === poiId ? null : { poiId, source: "card" }
    );
  }, []);

  // Handle map background click → deselect active POI
  const handleMapClick = useCallback(() => {
    setActivePOI(null);
  }, []);

  // Handle marker click → just show popup, no text highlight needed
  const handleMarkerClick = useCallback((poiId: string) => {
    setActivePOI((prev) =>
      prev?.poiId === poiId ? null : { poiId, source: "marker" }
    );
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
      {/* Hero — full width with padding */}
      <div className="px-16">
        <div className="grid grid-cols-12 gap-x-6">
          <ReportHero
            projectName={reportData.projectName}
            themes={reportData.themes}
            heroIntro={reportData.heroIntro}
          />
        </div>
      </div>

      {/* Theme sections — full width with per-category maps */}
      <div className="px-16">
        {/* Primary themes */}
        {primaryThemes.map((theme, i) => (
          <div key={theme.id} ref={revealRef} className="report-section-reveal">
            {i > 0 && <ThemeSeparator icon={theme.icon} color={theme.color} />}
            <ReportThemeSection
              theme={theme}
              center={reportData.centerCoordinates}
              projectName={reportData.projectName}
              registerRef={registerSectionRef(theme.id)}
              onPOIClick={handlePOIClick}
              activePOI={activePOI}
              onMarkerClick={handleMarkerClick}
              onMapClick={handleMapClick}
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
                {i > 0 && <ThemeSeparator icon={theme.icon} color={theme.color} />}
                <ReportThemeSection
                  theme={theme}
                  center={reportData.centerCoordinates}
                  projectName={reportData.projectName}
                  registerRef={registerSectionRef(theme.id)}
                  onPOIClick={handlePOIClick}
                  activePOI={activePOI}
                  onMarkerClick={handleMarkerClick}
                  onMapClick={handleMapClick}
                  mapStyle={reportData.mapStyle}
                  areaSlug={areaSlug}
                  variant="secondary"
                />
              </div>
            ))}
          </>
        )}
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

// --- Theme separator with icon ---

function ThemeSeparator({ icon, color }: { icon: string; color: string }) {
  const Icon = getIcon(icon);
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="h-px flex-1 bg-[#e0dcd6]" />
      <div
        className="flex items-center justify-center w-10 h-10 rounded-full"
        style={{ backgroundColor: color + "18" }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="h-px flex-1 bg-[#e0dcd6]" />
    </div>
  );
}
