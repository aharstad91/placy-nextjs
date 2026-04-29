"use client";

import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";

interface Props {
  project: Project;
  enTranslations?: TranslationMap;
  areaSlug?: string | null;
  primaryThemeIds?: string[];
}

export default function ReportBoardPage({ project }: Props) {
  const themeCount = project.reportConfig?.themes?.length ?? 0;
  const poiCount = project.pois.length;

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-muted/20">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Board UX kommer</h1>
        <p className="text-muted-foreground">
          Ny rapport-variant under utvikling. Plan: <code className="text-sm">docs/plans/2026-04-29-001-feat-board-ux-rapport-variant-plan.md</code>
        </p>
        <div className="text-sm text-muted-foreground/80 pt-4 border-t border-border">
          <p>Project: <strong>{project.name}</strong></p>
          <p>Themes: {themeCount} · POIs: {poiCount}</p>
        </div>
      </div>
    </div>
  );
}
