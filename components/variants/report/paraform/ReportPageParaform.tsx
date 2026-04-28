"use client";

import { useMemo } from "react";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData, type ReportTheme } from "../report-data";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import ParaformHero from "./ParaformHero";
import ParaformThemeSidebar from "./ParaformThemeSidebar";
import ParaformThemeSection from "./ParaformThemeSection";

interface Props {
  project: Project;
  enTranslations?: TranslationMap;
  areaSlug?: string | null;
  primaryThemeIds?: string[];
}

export default function ReportPageParaform(props: Props) {
  return (
    <LocaleProvider>
      <Inner {...props} />
    </LocaleProvider>
  );
}

function Inner({ project, enTranslations = {}, primaryThemeIds }: Props) {
  const { locale } = useLocale();

  const effectiveProject = useMemo(
    () => applyTranslations(project, locale, enTranslations),
    [project, locale, enTranslations]
  );

  const reportData = useMemo(
    () => transformToReportData(effectiveProject, locale),
    [effectiveProject, locale]
  );

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

  const allThemes = [...primaryThemes, ...secondaryThemes];

  return (
    <div className="font-[family-name:var(--font-inter)] text-[#1a1a1a]">
      <ParaformHero
        projectName={reportData.projectName}
        heroIntro={reportData.heroIntro}
        themesCount={allThemes.length}
        poiCount={effectiveProject.pois.length}
      />

      {/* Tema-seksjoner med sidebar */}
      <div className="max-w-[1080px] mx-auto w-full px-6 md:px-12 py-16 md:py-24">
        <div className="flex gap-16 items-start">
          <aside className="w-[260px] shrink-0 hidden lg:block sticky top-12 self-start">
            <ParaformThemeSidebar themes={allThemes} />
          </aside>

          <div className="flex-1 min-w-0 max-w-[720px]">
            {allThemes.map((theme, i) => (
              <ParaformThemeSection
                key={theme.id}
                theme={theme}
                index={i}
                isLast={i === allThemes.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
