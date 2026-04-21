"use client";

import { useMemo, useEffect, useRef, useCallback } from "react";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData, type ReportTheme } from "./report-data";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import ReportHero from "./ReportHero";
import ReportThemeSection from "./ReportThemeSection";
import ReportSummarySection from "./ReportSummarySection";
import TabbedAerialMap from "./blocks/TabbedAerialMap";
import type { AerialCategory, DirectionalImages } from "./blocks/TabbedAerialMap";

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

        {/* Aerial map with tabbed category markers */}
        <div className="py-16 md:py-24">
          <TabbedAerialMap
            sectionKicker="Nabolaget fra luften"
            sectionTitle="Alt rundt Wesselsløkka"
            directions={DEMO_DIRECTIONS}
            imageWidth={1792}
            imageHeight={1024}
            defaultDirection="S"
            categories={DEMO_AERIAL_CATEGORIES}
          />
        </div>

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
                  mapStyle={reportData.mapStyle}
                  areaSlug={areaSlug}
                  variant="secondary"
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

// --- Demo directional images (same image for all 4 — replace with real per-direction images) ---

const DEMO_DIRECTIONS: DirectionalImages = {
  N: "/illustrations/wesselslokka-nord.png",
  E: "/illustrations/wesselslokka-ost.png",
  S: "/illustrations/wesselslokka-sor.png",
  W: "/illustrations/wesselslokka-vest.png",
};

// --- Demo aerial categories (dummy positions — replace with real data) ---

const DEMO_AERIAL_CATEGORIES: AerialCategory[] = [
  {
    id: "oppvekst",
    label: "Oppvekst",
    color: "#5b8a3c",
    markers: [
      { number: 1, top: "45%", left: "40%", title: "Brøset skole", subtitle: "4 min gange", description: "Barneskole med stort uteområde" },
      { number: 2, top: "35%", left: "55%", title: "Nidarvoll skole", subtitle: "8 min gange", description: "Ungdomsskole" },
      { number: 3, top: "55%", left: "30%", title: "Brøset barnehage", subtitle: "3 min gange" },
      { number: 4, top: "60%", left: "60%", title: "Lekeplass Valentinlyst", subtitle: "6 min gange" },
    ],
  },
  {
    id: "mat-drikke",
    label: "Mat & Drikke",
    color: "#c2553a",
    markers: [
      { number: 1, top: "38%", left: "52%", title: "Rema 1000 Valentinlyst", subtitle: "5 min gange" },
      { number: 2, top: "42%", left: "62%", title: "Coop Extra", subtitle: "7 min gange" },
      { number: 3, top: "30%", left: "45%", title: "Baker Nordby", subtitle: "9 min gange" },
    ],
  },
  {
    id: "natur",
    label: "Natur & Friluftsliv",
    color: "#3a7d5c",
    markers: [
      { number: 1, top: "25%", left: "25%", title: "Brøsetløkka park", subtitle: "2 min gange", description: "Stort grøntområde med tursti" },
      { number: 2, top: "50%", left: "15%", title: "Kobberdammen", subtitle: "8 min gange" },
      { number: 3, top: "20%", left: "65%", title: "Estenstadmarka", subtitle: "15 min gange", description: "Inngang til marka med skiløyper" },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    color: "#4a6fa5",
    markers: [
      { number: 1, top: "48%", left: "48%", title: "Valentinlyst busstopp", subtitle: "3 min gange", description: "Linje 5, 22 — mot sentrum" },
      { number: 2, top: "32%", left: "70%", title: "Brøset busstopp", subtitle: "6 min gange" },
      { number: 3, top: "55%", left: "72%", title: "Bysykkel Valentinlyst", subtitle: "5 min gange" },
    ],
  },
  {
    id: "trening",
    label: "Trening",
    color: "#7c5cbf",
    markers: [
      { number: 1, top: "40%", left: "35%", title: "3T Valentinlyst", subtitle: "5 min gange" },
      { number: 2, top: "28%", left: "50%", title: "Brøset Treningspark", subtitle: "3 min gange", description: "Utendørs kalisthenics-utstyr" },
    ],
  },
];

// --- Theme separator with icon ---

function ThemeSeparator() {
  return (
    <div className="py-2">
      <div className="h-px bg-[#e0dcd6]" />
    </div>
  );
}
