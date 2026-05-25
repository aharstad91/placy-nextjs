"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useMemo } from "react";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { transformToReportData } from "../report-data";
import { adaptBoardData } from "../board/board-data";
import { DesktopGate } from "./DesktopGate";
import { ReelsProvider, useReels } from "./reels-state";
import { ReelsStack } from "./ReelsStack";
import { IntroReel } from "./IntroReel";
import { CategoryReel } from "./CategoryReel";
import { ReelsMap } from "./ReelsMap";
import { buildReelsCards } from "./reels-data";
import { AudioElementProvider } from "../board/audio-tour/use-audio-element";
import { useReelsAudioOrchestration } from "./use-reels-audio-orchestration";
import { useAudioTourActions } from "@/lib/stores/audio-tour-store";

const INTRO_VIDEO_SRC = "/reels/stasjonskvartalet/intro.mp4";

interface Props {
  project: Project;
  enTranslations?: TranslationMap;
  customer: string;
  projectSlug: string;
}

export default function ReportReelsPage(props: Props) {
  return (
    <LocaleProvider>
      <Inner {...props} />
    </LocaleProvider>
  );
}

function Inner({ project, enTranslations = {}, customer, projectSlug }: Props) {
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

  const cards = useMemo(
    () => buildReelsCards(boardData, INTRO_VIDEO_SRC),
    [boardData],
  );

  return (
    <DesktopGate fallbackHref={`/eiendom/${customer}/${projectSlug}/rapport-board`}>
      <ReelsProvider cards={cards}>
        <ReelsAudioShell>
          <ReelsOrchestrator>
            <div className="relative h-[100dvh] w-full bg-black overflow-hidden">
              <MapLayer home={boardData.home} />
              <ReelsStack renderCard={(i) => <CardRouter cardIndex={i} />} />
            </div>
          </ReelsOrchestrator>
        </ReelsAudioShell>
      </ReelsProvider>
    </DesktopGate>
  );
}

function ReelsAudioShell({ children }: { children: React.ReactNode }) {
  const { state, setPhase } = useReels();
  // Når et spor slutter naturlig: hev sheet til 20% (map-quarter). Bruker
  // må aktivt tappe for å gå videre — sheet "våkner" men ekspander ikke
  // til halv/full uten gesture.
  const handleTrackEnded = () => {
    if (state.currentPhase === "reel") {
      setPhase("map-quarter");
    }
  };
  return (
    <AudioElementProvider autoAdvance={false} onTrackEnded={handleTrackEnded}>
      {children}
    </AudioElementProvider>
  );
}

function ReelsOrchestrator({ children }: { children: React.ReactNode }) {
  useReelsAudioOrchestration();
  return <>{children}</>;
}

function MapLayer({ home }: { home: ReturnType<typeof adaptBoardData>["home"] }) {
  const { state, setPhase } = useReels();
  const { pause } = useAudioTourActions();
  if (!state.mapMounted) return null;

  const isIntro = state.currentPhase === "intro";
  const isPeek = state.currentPhase === "reel";
  const isQuarter = state.currentPhase === "map-quarter";
  const isHalf = state.currentPhase === "map-half";
  const isFull = state.currentPhase === "map-full";

  const heightPct = isIntro
    ? 0
    : isPeek
      ? 10
      : isQuarter
        ? 20
        : isHalf
          ? 50
          : 100;
  // Peek-fasen er den eneste med margin. Quarter+half+full er full bredde.
  const widthPct = isPeek ? 90 : 100;
  const insetXPct = isPeek ? 5 : 0;
  const radiusClass = isFull ? "rounded-none" : "rounded-t-3xl";

  // Sheet-tap:
  //   peek (10%)    → pause + go map-half (skip VO)
  //   quarter (20%) → go map-half (VO allerede ferdig)
  //   half (50%)    → go map-full
  const handleSheetTap = () => {
    if (isPeek) {
      pause("manual");
      setPhase("map-half");
    } else if (isQuarter) {
      setPhase("map-half");
    } else if (isHalf) {
      setPhase("map-full");
    }
  };

  // Header-area = lys "ramme" på toppen av sheet (handle + label). Tar
  // fixed pixel-høyde så kartet alltid sitter i en lys panel-look, ikke
  // som transparent overlay.
  const headerPx = 56;

  return (
    <div
      className={`absolute bottom-0 z-[15] transition-all duration-500 ease-out overflow-hidden shadow-2xl bg-stone-900 ${radiusClass}`}
      style={{
        height: `${heightPct}%`,
        width: `${widthPct}%`,
        left: `${insetXPct}%`,
        opacity: isIntro ? 0 : 1,
      }}
    >
      {/* Kart-area — sitter under header (når ikke full). I map-full
          trekker den helt til viewport-edges. Padding gir sheet-rammen
          synlig rundt kartet i peek/quarter/half (kun topp + sider; bunn
          går helt til sheet-edge). Topp-padding er mindre i peek så CTA
          passer i den smale kart-stripen. */}
      <div
        className="absolute transition-all duration-500 ease-out overflow-hidden"
        style={{
          top: isFull ? 0 : headerPx + (isPeek ? 0 : 16),
          bottom: 0,
          left: isFull ? 0 : 8,
          right: isFull ? 0 : 8,
          borderRadius: isFull ? 0 : "16px 16px 0 0",
        }}
      >
        <ReelsMap home={home} />

        {/* Mørk overlay + CTA — synlig i peek (deaktivert) og map-quarter
            (når VO er ferdig men sheet venter på tap). pointer-events:none
            så tap propagerer til header-button under. */}
        {(isPeek || isQuarter) && (
          <div
            className="absolute inset-0 transition-opacity duration-500 ease-out pointer-events-none flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/55" />
            <div className="relative flex items-center gap-1.5 rounded-full bg-white text-stone-900 px-3 py-1.5 text-xs font-semibold shadow-2xl whitespace-nowrap">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stone-700 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-stone-900" />
              </span>
              Klikk for å åpne kart
            </div>
          </div>
        )}
      </div>

      {/* Header-area (handle + label) — lys panel-look på toppen av sheet.
          Skjult i map-full (chevron-button overtar i corner). */}
      {!isFull && (
        <button
          onClick={handleSheetTap}
          aria-label={isPeek ? "Vis kart" : "Utvid kart"}
          className="absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-center bg-stone-900"
          style={{ pointerEvents: "auto", height: headerPx }}
        >
          <div className="h-1.5 w-12 rounded-full bg-white/40" />
          <span
            className={`mt-2 text-white/90 font-medium ${
              isPeek ? "text-sm" : "text-xs uppercase tracking-widest"
            }`}
          >
            {isPeek ? "Trykk for å se kart" : "Trykk for å utforske"}
          </span>
        </button>
      )}

      {/* Map-full kontroller — chevron-collapse helt tilbake til peek
          (opprinnelig 10% sheet over video) + swipe-hint. */}
      {isFull && (
        <>
          <button
            onClick={() => setPhase("reel")}
            style={{ pointerEvents: "auto" }}
            className="absolute top-6 left-6 z-20 rounded-full bg-white/95 text-black h-10 w-10 flex items-center justify-center shadow-lg"
            aria-label="Lukk kart"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div className="absolute top-6 right-6 z-20 text-white text-xs pointer-events-none bg-black/60 rounded-full px-3 py-1.5 backdrop-blur-sm select-none">
            Swipe opp for neste
          </div>
        </>
      )}
    </div>
  );
}

function CardRouter({ cardIndex }: { cardIndex: number }) {
  const { state } = useReels();
  const card = state.cards[cardIndex];
  const isActive = state.activeIndex === cardIndex;

  if (!card) return null;
  if (card.kind === "intro") {
    return <IntroReel card={card} isActive={isActive} />;
  }
  return <CategoryReel card={card} cardIndex={cardIndex} isActive={isActive} />;
}
