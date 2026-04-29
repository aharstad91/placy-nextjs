"use client";

import { useEffect, useMemo, useState } from "react";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData } from "../report-data";
import { adaptBoardData } from "./board-data";
import { BoardProvider } from "./board-state";
import { BoardMap } from "./BoardMap";
import { BoardCategoryGrid } from "./mobile/BoardCategoryGrid";
import { BoardPeekCard } from "./mobile/BoardPeekCard";
import { BoardReadingModal } from "./mobile/BoardReadingModal";
import { BoardPOISheet } from "./mobile/BoardPOISheet";
import { BoardDesktopShell } from "./desktop/BoardDesktopShell";

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
      <BoardScaffold has3dAddon={effectiveProject.has3dAddon ?? false} />
    </BoardProvider>
  );
}

/** Tailwind `lg`-breakpoint (1024px). Brukes for å avgjøre om mobile drawers skal mountes,
 * siden vaul-Drawer portaler til document.body og ikke respekterer `lg:hidden`-wrapper. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/**
 * Board-shell: full-screen kart i bakgrunn. Adaptiv layout:
 * - Mobil (<lg): kart fyller hele viewporten. Bottom-anchored sheets på toppen.
 * - Desktop (>=lg): kart fyller alt til høyre for 504px-strip (rail + detalj-panel).
 *
 * BoardMap mountes ÉN gang. Conditional positioning via wrapper-div: `lg:left-[504px]`
 * forskyver kart-containeren på desktop. Mobil-bottom-sheets (vaul) bruker portal
 * og må JS-gates — `useIsDesktop()` styrer mounting. Desktop-strip er gated
 * `hidden lg:flex` via CSS — bare ett tre vises av gangen.
 */
function BoardScaffold({ has3dAddon }: { has3dAddon: boolean }) {
  const isDesktop = useIsDesktop();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-stone-100">
      {/* Kart-container — absolute. På desktop forskjøvet 504px fra venstre. */}
      <div className="absolute inset-0 lg:left-[504px]">
        <BoardMap has3dAddon={has3dAddon} />
      </div>

      {/* Mobile UI (< lg) — bottom-anchored sheet system. Drawers portaler til body, så vi gates JS-side. */}
      {!isDesktop && (
        <>
          <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none">
            <div className="relative">
              <BoardCategoryGrid />
              <BoardPeekCard />
            </div>
          </div>
          <BoardReadingModal />
          <BoardPOISheet />
        </>
      )}

      {/* Desktop UI (>= lg) — venstre rail + detalj-panel som 504px-strip */}
      <BoardDesktopShell />
    </div>
  );
}
