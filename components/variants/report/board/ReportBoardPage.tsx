"use client";

import { useMemo } from "react";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData } from "../report-data";
import { adaptBoardData } from "./board-data";
import { BoardProvider, useBoard } from "./board-state";
import { BoardMap } from "./BoardMap";
import { BoardCategoryGrid } from "./mobile/BoardCategoryGrid";
import { BoardPeekCard } from "./mobile/BoardPeekCard";
import { BoardReadingModal } from "./mobile/BoardReadingModal";

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

/** Board-shell: full-screen kart i bakgrunn. Mobil-UI (categories, peek, drawers) og desktop-UI legges på toppen i Unit 4+. */
function BoardScaffold() {
  const { state, data } = useBoard();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-stone-100">
      <BoardMap />

      {/* Mobile UI (< lg) — bottom-anchored sheet system */}
      <div className="lg:hidden absolute inset-x-0 bottom-0 z-10 pointer-events-none">
        <div className="relative">
          <BoardCategoryGrid />
          <BoardPeekCard />
        </div>
      </div>
      <div className="lg:hidden">
        <BoardReadingModal />
      </div>

      {/* Debug-overlay — fjernes når desktop-UI mountes i Unit 8 */}
      <div className="absolute top-4 right-4 z-30 bg-white/90 backdrop-blur rounded-lg shadow-md px-3 py-2 text-xs space-y-0.5 pointer-events-none">
        <div>
          <strong>{data.home.name}</strong>
        </div>
        <div className="text-muted-foreground">
          {data.categories.length} kat · {data.categories.reduce((s, c) => s + c.pois.length, 0)} POI · phase: <code>{state.phase}</code>
        </div>
      </div>
    </div>
  );
}
