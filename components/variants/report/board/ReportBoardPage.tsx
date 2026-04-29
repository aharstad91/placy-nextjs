"use client";

import { useMemo } from "react";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData } from "../report-data";
import { adaptBoardData } from "./board-data";
import { BoardProvider, useBoard } from "./board-state";

interface Props {
  project: Project;
  enTranslations?: TranslationMap;
  areaSlug?: string | null;
  primaryThemeIds?: string[];
}

export default function ReportBoardPage(props: Props) {
  return (
    <LocaleProvider>
      <Inner {...props} />
    </LocaleProvider>
  );
}

function Inner({ project, enTranslations = {} }: Props) {
  const { locale } = useLocale();

  const effectiveProject = useMemo(
    () => applyTranslations(project, locale, enTranslations),
    [project, locale, enTranslations],
  );

  const reportData = useMemo(
    () => transformToReportData(effectiveProject, locale),
    [effectiveProject, locale],
  );

  const boardData = useMemo(() => adaptBoardData(reportData), [reportData]);

  return (
    <BoardProvider data={boardData}>
      <BoardScaffold />
    </BoardProvider>
  );
}

/** Midlertidig shell — fylles inn av Unit 3+ med BoardMap, mobil-UI, og desktop-UI. */
function BoardScaffold() {
  const { state, data } = useBoard();

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-muted/20">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Board UX kommer</h1>
        <p className="text-muted-foreground">
          State-machine + data-adapter på plass. UI bygges i Unit 3+.
        </p>
        <div className="text-sm text-muted-foreground/80 pt-4 border-t border-border space-y-1">
          <p>
            Project: <strong>{data.home.name}</strong>
          </p>
          <p>Categories: {data.categories.length}</p>
          <p>POIs total: {data.categories.reduce((sum, c) => sum + c.pois.length, 0)}</p>
          <p>
            Phase: <code>{state.phase}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
