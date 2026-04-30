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
import { BoardCategoryTabBar } from "./mobile/BoardCategoryTabBar";
import { BoardMobileSheet } from "./mobile/BoardMobileSheet";
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
 * - Mobil (<lg): kart fyller hele viewporten. BoardMobileSheet (multi-snap) +
 *   BoardCategoryTabBar (pinnet bunn) som søsken. Tab-bar er ALLTID synlig
 *   over sheeten via z-50; sheet kan dras ned uten å skjule navigasjonen
 *   (Google Maps-mønster).
 * - Desktop (>=lg): kart fyller alt til høyre for 480px-strip (rail + detalj-panel).
 *
 * BoardMap mountes ÉN gang. Conditional positioning via wrapper-div: `lg:left-[480px]`
 * forskyver kart-containeren på desktop. Mobile sheet (vaul) bruker portal og må
 * JS-gates — `useIsDesktop()` styrer mounting. Desktop-strip er gated `hidden lg:flex`
 * via CSS — bare ett tre vises av gangen.
 *
 * Bevisst valg: ingen map-padding-syncing per snap-stage. Vi har ingen
 * fitBounds-trigger på snap-endringer, og Mapbox `setPadding` panner kartet
 * automatisk for å holde center i padded-area — det skapte synlig "hopp" når
 * brukeren byttet kategori. Sheet er pinnet over kartet visuelt; markører som
 * havner under sheet er fortsatt navigerbare via Punkter-tab.
 *
 * NB: 480px = BoardDesktopShell-bredden. Endre begge i synk hvis justeres.
 */
function BoardScaffold({ has3dAddon }: { has3dAddon: boolean }) {
  const isDesktop = useIsDesktop();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-stone-100">
      {/* Kart-container — absolute. På desktop forskjøvet 480px fra venstre. */}
      <div className="absolute inset-0 lg:left-[480px]">
        <BoardMap has3dAddon={has3dAddon} />
      </div>

      {/* Mobile UI (< lg) — multi-snap sheet + pinnet tab-bar.
          Tab-bar mountes som søsken med z-50 (over sheet og kart) så
          primær-navigasjon er alltid tilgjengelig. */}
      {!isDesktop && (
        <>
          <BoardMobileSheet />
          <div className="fixed inset-x-0 bottom-0 z-50">
            <BoardCategoryTabBar />
          </div>
        </>
      )}

      {/* Desktop UI (>= lg) — venstre rail + detalj-panel som 504px-strip */}
      <BoardDesktopShell />
    </div>
  );
}
