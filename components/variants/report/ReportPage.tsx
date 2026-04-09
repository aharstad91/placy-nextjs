"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData, type ReportTheme } from "./report-data";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { useActiveSection } from "@/lib/hooks/useActiveSection";
import dynamic from "next/dynamic";
import ReportHero from "./ReportHero";
import ReportThemeSection from "./ReportThemeSection";
import ReportExplorerCTA from "./ReportExplorerCTA";
import { SkeletonReportMap } from "@/components/ui/SkeletonReportMap";
import { getIcon } from "@/lib/utils/map-icons";
import { MapPin } from "lucide-react";

const ReportStickyMap = dynamic(() => import("./ReportStickyMap"), {
  ssr: false,
  loading: () => <SkeletonReportMap className="fixed top-0 right-0 w-[40%] h-screen" />,
});
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

  // Initialize active section to first theme
  const initialThemeId = reportData.themes.length > 0 ? reportData.themes[0].id : null;
  const { activeSectionId, registerSectionRef } = useActiveSection(initialThemeId);

  // Parse activeSectionId: "mat-drikke" or "mat-drikke:restaurant"
  const activeThemeId = activeSectionId?.split(":")[0] ?? null;
  const activeSubSectionCategoryId = activeSectionId?.includes(":")
    ? activeSectionId.split(":")[1]
    : null;

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

      {/* Desktop: 60/40 split with sticky map */}
      <div className="hidden lg:flex">
        {/* Left: Scrollable narrative content */}
        <div className="w-[60%] px-16 min-w-0 overflow-hidden">
          {/* Primary themes */}
          {primaryThemes.map((theme, i) => (
            <div key={theme.id} ref={revealRef} className="report-section-reveal">
              {i > 0 && <ThemeSeparator icon={theme.icon} color={theme.color} />}
              <ReportThemeSection
                theme={theme}
                center={reportData.centerCoordinates}
                projectName={reportData.projectName}
                registerRef={registerSectionRef(theme.id)}
                useStickyMap={true}
                onPOIClick={handlePOIClick}
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
                    useStickyMap={true}
                    onPOIClick={handlePOIClick}
                    variant="secondary"
                  />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Right: Sticky map (40%) + metadata */}
        <div className="w-[40%] pt-16 pr-16 pb-16">
          <div className="sticky top-6">
            <div className="h-[60vh] rounded-2xl overflow-hidden">
              <ReportStickyMap
                themes={reportData.themes}
                activeThemeId={activeThemeId}
                activeSubSectionCategoryId={activeSubSectionCategoryId}
                activePOI={activePOI}
                hotelCoordinates={reportData.centerCoordinates}
                onMarkerClick={handleMarkerClick}
                onMapClick={handleMapClick}
                mapStyle={reportData.mapStyle}
                expandedThemes={new Set(reportData.themes.map((t) => t.id))}
                areaSlug={areaSlug}
              />
            </div>
            {/* Map metadata panel */}
            <MapMetadata
              themes={reportData.themes}
              activeThemeId={activeThemeId}
            />
          </div>
        </div>
      </div>

      {/* Mobile: Narrative content without sticky map */}
      <div className="lg:hidden px-16">
        <div className="grid grid-cols-12 gap-x-6">
          {/* Primary themes */}
          {primaryThemes.map((theme, i) => (
            <div key={theme.id} ref={revealRef} className="col-span-12 report-section-reveal">
              {i > 0 && <ThemeSeparator icon={theme.icon} color={theme.color} />}
              <ReportThemeSection
                theme={theme}
                center={reportData.centerCoordinates}
                projectName={reportData.projectName}
              />
            </div>
          ))}

          {/* Secondary themes */}
          {secondaryThemes.length > 0 && (
            <>
              <div className="col-span-12 py-8">
                <div className="h-px bg-[#e8e4df]" />
                <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mt-6 mb-2">
                  Andre kategorier
                </p>
              </div>
              {secondaryThemes.map((theme, i) => (
                <div key={theme.id} ref={revealRef} className="col-span-12 report-section-reveal">
                  {i > 0 && <ThemeSeparator icon={theme.icon} color={theme.color} />}
                  <ReportThemeSection
                    theme={theme}
                    center={reportData.centerCoordinates}
                    projectName={reportData.projectName}
                    variant="secondary"
                  />
                </div>
              ))}
            </>
          )}
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

// --- Map metadata panel below the sticky map ---

function MapMetadata({ themes, activeThemeId }: { themes: ReportTheme[]; activeThemeId: string | null }) {
  const activeTheme = themes.find((t) => t.id === activeThemeId);
  if (!activeTheme) return null;

  const Icon = getIcon(activeTheme.icon);
  const nearestPOI = activeTheme.allPOIs[0];
  const nearestWalkMin = nearestPOI?.travelTime?.walk
    ? Math.round(nearestPOI.travelTime.walk / 60)
    : null;

  return (
    <div className="mt-3 px-4 py-3 rounded-xl bg-[#faf9f7] border border-[#eae6e1]">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[#7a7062]" />
        <span className="text-sm font-medium text-[#1a1a1a]">{activeTheme.name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6a6a6a]">
        <span>{activeTheme.stats.totalPOIs} steder på kartet</span>
        {nearestWalkMin != null && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Nærmest: {nearestWalkMin} min gange
          </span>
        )}
        {activeTheme.stats.avgRating != null && (
          <span>Snitt ★ {activeTheme.stats.avgRating.toFixed(1)}</span>
        )}
      </div>
    </div>
  );
}
