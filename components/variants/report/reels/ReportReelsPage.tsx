"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { transformToReportData } from "../report-data";
import { adaptBoardData } from "../board/board-data";
import { BoardProvider, useBoard } from "../board/board-state";
import { BoardMap } from "../board/BoardMap";
import { ReelsProvider, useReels } from "./reels-state";
import { ReelsStack } from "./ReelsStack";
import { DesktopStorySidebar } from "./DesktopStorySidebar";
import { IntroReel } from "./IntroReel";
import { CategoryReel } from "./CategoryReel";
import { MeglerReel } from "./MeglerReel";
import { ReelsMap } from "./ReelsMap";
import {
  buildReelsCards,
  cardIndexToAudioIndex,
  nextAudioBearingIndex,
} from "./reels-data";
import { AudioElementProvider } from "../board/audio-tour/use-audio-element";
import { useReelsAudioOrchestration } from "./use-reels-audio-orchestration";
import { useAudioTourActions } from "@/lib/stores/audio-tour-store";
import type { BoardHome } from "../board/board-data";

const INTRO_VIDEO_SRC = "/reels/stasjonskvartalet/intro.mp4";

interface Props {
  project: Project;
  enTranslations?: TranslationMap;
}

export default function ReportReelsPage(props: Props) {
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

  const cards = useMemo(
    () => buildReelsCards(boardData, INTRO_VIDEO_SRC),
    [boardData],
  );

  const has3dAddon = project.has3dAddon ?? false;

  return (
    <ReelsProvider cards={cards}>
      <BoardProvider data={boardData}>
        <BoardReelsSync />
        <ReelsAudioShell>
          <ReelsOrchestrator>
            <ResponsiveLayout home={boardData.home} has3dAddon={has3dAddon} />
          </ReelsOrchestrator>
        </ReelsAudioShell>
      </BoardProvider>
    </ReelsProvider>
  );
}

/**
 * Speiler aktiv Reels-card til BoardContext. Når brukeren swiper til en
 * kategori-reel, dispatcher vi SELECT_CATEGORY (source: "audio") så
 * BoardMap kan fade markører til den kategoriens POI-er. Source="audio"
 * holder BoardContext i "default"-phase — vi vil ikke trigge legacy
 * mobile "active"-overgangen.
 *
 * Intro-cardet resetter BoardContext til default → BoardMap viser alle
 * POI-er på tvers av kategorier som overblikks-tilstand.
 */
function BoardReelsSync() {
  const { state: reelsState } = useReels();
  const { state: boardState, dispatch } = useBoard();

  useEffect(() => {
    const card = reelsState.cards[reelsState.activeIndex];
    if (!card) return;
    if (card.kind === "category") {
      if (boardState.activeCategoryId !== card.categoryId) {
        dispatch({
          type: "SELECT_CATEGORY",
          id: card.categoryId,
          source: "audio",
        });
      }
    } else {
      // intro, home, outro, megler — vis alle POI-er som overblikk
      if (boardState.activeCategoryId !== null) {
        dispatch({ type: "RESET_TO_DEFAULT" });
      }
    }
  }, [
    reelsState.activeIndex,
    reelsState.cards,
    boardState.activeCategoryId,
    dispatch,
  ]);

  return null;
}

function ReelsAudioShell({ children }: { children: React.ReactNode }) {
  const { state, setPhase, setActiveIndex } = useReels();
  const { next: audioNext } = useAudioTourActions();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // Når et spor slutter naturlig:
  // - Desktop: auto-advance til neste audio-bærende kapittel slik at
  //   løpebåndet i sidebaren spiller kategoriene én etter én (som mobil-
  //   feeden, men uten swipe). Siste spor → terminal "ended"-fase.
  // - Mobil: hev sheet til 20% (map-quarter). Bruker må aktivt tappe for å
  //   gå videre — sheet "våkner" men ekspander ikke uten gesture.
  const handleTrackEnded = () => {
    if (isDesktop) {
      const next = nextAudioBearingIndex(state.cards, state.activeIndex);
      if (next !== -1) {
        setActiveIndex(next);
      } else {
        // Siste audio-bærende kapittel ferdig. autoAdvance=false betyr at
        // store.next() — den eneste veien til phase "ended" — aldri ble kalt
        // (onended pauset bare). Vi kaller den eksplisitt så touren når
        // terminal "ended"; da viser sidebar-knappen "Spill av på nytt" og
        // restart fungerer rent (i stedet for å henge på "Fortsett").
        audioNext();
      }
      return;
    }
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

/**
 * Adaptiv layout:
 * - Mobil (<lg): full-screen reels-stack med bottom-anchored MapLayer-sheet
 *   (10% peek → 100% full). Phase styrer sheet-høyde. Som dagens reels-route.
 * - Desktop (>=lg): 2-kolonner. 400px reels-feed venstre, BoardMap fyller
 *   resten høyre, alltid synlig. Sheet-mekanikken er off; kartet er ikke en
 *   sheet men en permanent panel. Phase styrer fortsatt marker-visibility
 *   og audio.
 */
function ResponsiveLayoutInner({
  home,
  has3dAddon,
}: {
  home: BoardHome;
  has3dAddon: boolean;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (isDesktop) {
    // Adaptiv desktop: full-høyde storytelling-sidebar (300px) ved siden av
    // kartet i flex-flow — IKKE mobil-reelen tvunget inn i en flytende 9:16-
    // ramme. Kartet fyller resten (flex-1). Sidebaren ligger ved siden av,
    // ikke over, så mapPaddingLeft trenger bare en liten gutter (16).
    // Mobil-branchen under er urørt.
    return (
      <div className="flex h-[100dvh] w-full overflow-hidden bg-stone-100">
        <DesktopStorySidebar
          home={home}
          renderActiveCard={(i) => <CardRouter cardIndex={i} desktopMode />}
        />
        <div className="relative h-full flex-1">
          <BoardMap has3dAddon={has3dAddon} mapPaddingLeft={16} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full bg-black overflow-hidden">
      <MapLayer home={home} />
      <ReelsStack renderCard={(i) => <CardRouter cardIndex={i} />} />
    </div>
  );
}

// SSR vs client mismatch på desktop/mobil-treet (useMediaQuery returnerer
// false på SSR uansett viewport). Bypass-er hele hydration-fasen ved å
// laste layouten kun på klient — placeholderen rendres på server og første
// client-tick, så swappes til ekte tree.
const ResponsiveLayout = dynamic(
  () => Promise.resolve(ResponsiveLayoutInner),
  {
    ssr: false,
    loading: () => <div className="h-[100dvh] w-full bg-black" />,
  },
);

function MapLayer({ home }: { home: BoardHome }) {
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

function CardRouter({
  cardIndex,
  desktopMode = false,
}: {
  cardIndex: number;
  desktopMode?: boolean;
}) {
  const { state } = useReels();
  const card = state.cards[cardIndex];
  const isActive = state.activeIndex === cardIndex;

  if (!card) return null;
  if (card.kind === "intro") {
    return <IntroReel card={card} isActive={isActive} />;
  }
  if (card.kind === "megler") {
    return <MeglerReel card={card} isActive={isActive} desktopMode={desktopMode} />;
  }
  const audioIndex = cardIndexToAudioIndex(state.cards, cardIndex);
  return (
    <CategoryReel
      card={card}
      audioIndex={audioIndex}
      isActive={isActive}
      desktopMode={desktopMode}
    />
  );
}
