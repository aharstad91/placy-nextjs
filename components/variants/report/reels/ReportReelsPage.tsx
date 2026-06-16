"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-context";
import { applyTranslations } from "@/lib/i18n/apply-translations";
import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { transformToReportData } from "../report-data";
import { adaptBoardData } from "../board/board-data";
import { BoardProvider, useBoard } from "../board/board-state";
import { BoardMap } from "../board/BoardMap";
import {
  useEventBoardFilter,
  type EventBoardFilterResult,
} from "@/lib/event-board/useEventBoardFilter";
import {
  useBoardCollection,
  type BoardCollectionApi,
} from "@/lib/event-board/use-board-collection";
import { BoardCollectionDrawer } from "../board/event/BoardCollectionDrawer";
import { EventMobileSheet } from "../board/event/EventMobileSheet";
import { useKompassSelections } from "@/lib/kompass-store";
import { ReelsProvider, useReels } from "./reels-state";
import { ReelsTransport } from "./ReelsTransport";
import { MapTeaser } from "./MapTeaser";
import { DesktopStorySidebar } from "./DesktopStorySidebar";
import { DesktopReportSplash } from "./DesktopReportSplash";
import { MobileReportSplash } from "./MobileReportSplash";
import { IntroReel } from "./IntroReel";
import { CategoryReel } from "./CategoryReel";
import { MeglerReel } from "./MeglerReel";
import { SummaryReel } from "./SummaryReel";
import {
  buildReelsCards,
  cardIndexToAudioIndex,
  nextAudioBearingIndex,
  firstAudioBearingIndex,
  deriveSplashPrimaryLabel,
} from "./reels-data";
import {
  AudioElementProvider,
  useAudioElement,
} from "../board/audio-tour/use-audio-element";
import { useReelsAudioOrchestration } from "./use-reels-audio-orchestration";
import {
  useAudioTourActions,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";
import { getCategoryIllustrationSrc } from "@/lib/themes/category-illustrations";
import {
  getProjectLogoSrc,
  getProjectSplashImage,
  getProjectSplashVideo,
} from "@/lib/themes/project-brand";
import type { BoardData } from "../board/board-data";

/** Intro-video pr. prosjekt etter slug-konvensjon: `/reels/{slug}/intro.mp4`.
 *  Mangler filen (nytt prosjekt uten produsert intro) → tom src, og IntroReel
 *  faller tilbake til svart bakgrunn med start-knapp (videoen har ingen poster,
 *  så et 404 gir ikke ødelagt bilde — bare svart). */
function introVideoSrc(projectSlug: string | undefined): string {
  return projectSlug ? `/reels/${projectSlug}/intro.mp4` : "";
}

// Prosjekter med produsert reels-montasje (velkommen + nabolaget levende
// bakgrunner). I motsetning til intro-videoen bruker disse kortene posterForVideo
// (.mp4 → .jpg), så en 404-poster ville gitt et ødelagt bilde i sidebar/
// CategoryReel. Derfor gates de eksplisitt per slug (samme mønster som
// PIN_THUMBNAILS) — nytt prosjekt legges til her når montasjene er lastet opp
// under /reels/<slug>/. Uten montasje → undefined → kortet faller tilbake til
// illustrasjonsbildet.
const REELS_MONTAGE_PROJECTS = new Set<string>(["stasjonskvartalet"]);

// Velkommen-kortets levende bakgrunn (splash-montasjen, center-croppet til 9:16):
// `/reels/{slug}/welcome.mp4`. Undefined utenfor REELS_MONTAGE_PROJECTS.
function welcomeVideoSrc(projectSlug: string | undefined): string | undefined {
  return projectSlug && REELS_MONTAGE_PROJECTS.has(projectSlug)
    ? `/reels/${projectSlug}/welcome.mp4`
    : undefined;
}

// Nabolaget-kortets levende bakgrunn (Ken Burns + kryss-fade-loop, 9:16):
// `/reels/{slug}/nabolaget.mp4`. Undefined utenfor REELS_MONTAGE_PROJECTS.
function homeVideoSrc(projectSlug: string | undefined): string | undefined {
  return projectSlug && REELS_MONTAGE_PROJECTS.has(projectSlug)
    ? `/reels/${projectSlug}/nabolaget.mp4`
    : undefined;
}

interface Props {
  project: Project;
  enTranslations?: TranslationMap;
  /**
   * Event-rute (D2): ferdig-bygget BoardData fra `eventToBoardData`. Når satt
   * brukes den DIREKTE (report-pipelinen `transformToReportData`/`adaptBoardData`
   * hoppes over), og skallet går i event-modus (D3): ingen megler/eiendoms-chrome.
   * Når utelatt (report-rute) bygges BoardData via `adaptBoardData(reportData)`
   * som før — boligrapport-oppførselen er uendret.
   */
  boardData?: BoardData;
  /**
   * Unit 5: rehydrert "Min samling" fra en delt `?c=<slug>`-lenke (ruten kaller
   * `getCollectionBySlug` — eiendom-presedens). `undefined` når ingen delt lenke
   * eller ugyldig/utløpt slug (→ tom samling, ingen krasj). Kun event-modus.
   */
  collection?: { slug: string; poiIds: string[] };
}

export default function ReportReelsPage(props: Props) {
  return (
    <LocaleProvider>
      <Inner {...props} />
    </LocaleProvider>
  );
}

function Inner({
  project,
  enTranslations = {},
  boardData: inputBoardData,
  collection,
}: Props) {
  const { locale } = useLocale();

  // D3: event-modus er signalert av at boardData kommer inn som input (event-
  // rute). Da undertrykkes megler/eiendoms-chrome (footer + splash-copy).
  const eventMode = inputBoardData !== undefined;

  const effectiveProject = useMemo(
    () => applyTranslations(project, locale, enTranslations),
    [project, locale, enTranslations],
  );

  // D2: report-rute bygger BoardData via report-pipelinen; event-rute leverer
  // den ferdig (`inputBoardData`). useMemo-grenen unngår å kjøre report-
  // transformasjonen unødvendig i event-modus.
  const reportData = useMemo(
    () => (inputBoardData ? null : transformToReportData(effectiveProject, locale)),
    [inputBoardData, effectiveProject, locale],
  );

  const boardData = useMemo(
    () => inputBoardData ?? adaptBoardData(reportData!),
    [inputBoardData, reportData],
  );

  const cards = useMemo(
    () =>
      buildReelsCards(
        boardData,
        introVideoSrc(boardData.projectSlug),
        welcomeVideoSrc(boardData.projectSlug),
        homeVideoSrc(boardData.projectSlug),
      ),
    [boardData],
  );

  const has3dAddon = project.has3dAddon ?? false;

  // Event-board filter (Unit 4). D5: filteret kjører på `raw`-POIene — vi mater
  // `boardData.categories.flatMap(c => c.pois.map(p => p.raw))` inn i
  // `useEventBoardFilter` (som komponerer `useKompassFilter` uendret). Kun aktivt
  // i event-modus; boligrapporter får `undefined` visiblePoiIds (ingen
  // markør-begrensning). Resultatet trades inn i BoardProvider-konteksten så
  // BoardMap intersekter det inn i markør-synligheten, OG ned i sidebaren via
  // EventFilterPanel (liste + chips + tomtilstand).
  const rawPois = useMemo(
    () =>
      eventMode
        ? boardData.categories.flatMap((c) => c.pois.map((p) => p.raw))
        : [],
    [eventMode, boardData.categories],
  );
  const { selectedThemes, selectedDay, selectedTimeSlots } =
    useKompassSelections();
  const eventFilter = useEventBoardFilter(
    rawPois,
    selectedThemes,
    selectedDay,
    selectedTimeSlots,
  );
  // Når intet filter er aktivt sender vi `undefined` (ikke hele settet) så
  // markør-sømmen forblir helt no-op og kamera-fitten ikke kjører i ro-tilstand
  // — board-et viser da alle markører via den vanlige phase-/kategori-stien.
  const visiblePoiIds =
    eventMode && eventFilter.hasActiveFilter
      ? eventFilter.visiblePoiIds
      : undefined;

  // Unit 5: "Min samling". Hooken kalles ubetinget (hook-reglene) men er inert i
  // report-modus (`enabled=false`) så en aktiv Explorer-samling ikke clobbres.
  // Rehydrerer den delte `?c=`-samlingen (server → store) i event-modus, og gir
  // markør-highlight (collectionPoiIds) + lagre-toggle/del-drawer (collection).
  const collectionApi = useBoardCollection(
    project.id,
    eventMode,
    collection?.poiIds,
    collection?.slug,
  );
  const collectionPoiIds = eventMode ? collectionApi.collectionPoiIds : undefined;
  const [collectionDrawerOpen, setCollectionDrawerOpen] = useState(false);

  // Resolve lagrede collection-IDer → BoardPOI for drawer-visningen. Slår opp i
  // alle kategoriers POIer (samlingen kan spenne kategorier).
  const collectionBoardPois = useMemo(() => {
    if (!eventMode) return [];
    const all = boardData.categories.flatMap((c) => c.pois);
    const byId = new Map(all.map((p) => [String(p.id), p]));
    return collectionApi.collectionPoiList
      .map((id) => byId.get(id))
      .filter((p): p is (typeof all)[number] => p !== undefined);
  }, [eventMode, boardData.categories, collectionApi.collectionPoiList]);

  return (
    <ReelsProvider cards={cards}>
      <BoardProvider
        data={boardData}
        visiblePoiIds={visiblePoiIds}
        collectionPoiIds={collectionPoiIds}
      >
        <BoardReelsSync />
        <ReelsAudioShell>
          <ReelsOrchestrator>
            <ResponsiveLayout
              boardData={boardData}
              has3dAddon={has3dAddon}
              eventMode={eventMode}
              eventFilter={eventMode ? eventFilter : null}
              collection={eventMode ? collectionApi : null}
              onOpenCollection={() => setCollectionDrawerOpen(true)}
            />
          </ReelsOrchestrator>
        </ReelsAudioShell>
        {eventMode && (
          <BoardCollectionDrawer
            open={collectionDrawerOpen}
            onClose={() => setCollectionDrawerOpen(false)}
            collectionPois={collectionBoardPois}
            onRemove={collectionApi.remove}
            projectId={project.id}
          />
        )}
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

  // Reels-feeden driver kategori-valget KUN når den faktisk har kategori-kort
  // (prosjekt med reels-lyd). I empty-state (ingen reels-lyd → ingen kategori-
  // kort) driver sidebaren kategori-valget manuelt; da skal ikke denne synken
  // nullstille det (ellers undoes klikk umiddelbart).
  const reelsDriveCategories = reelsState.cards.some((c) => c.kind === "category");

  useEffect(() => {
    if (!reelsDriveCategories) return;
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
    reelsDriveCategories,
    reelsState.activeIndex,
    reelsState.cards,
    boardState.activeCategoryId,
    dispatch,
  ]);

  return null;
}

/** Pause (ms) mellom kategori-kapitler ved auto-advance — et lite pust så VO-en
 *  ikke hopper rett fra én kategori til neste. Justeres her. */
const CATEGORY_ADVANCE_PAUSE_MS = 1000;

/** Teaser-vindu (ms): hvor lenge kart-glimtet står ved kategori-VO-slutt FØR
 *  passiv auto-advance til neste kapittel (R8/R9). Lengre enn pusten over så
 *  brukeren rekker å lese «Utforsk på kart» og evt. tappe. Justeres mot
 *  mobil-emulering. */
const CATEGORY_TEASER_MS = 3500;

function ReelsAudioShell({ children }: { children: React.ReactNode }) {
  const { state, setActiveIndex, setTeaserArmed } = useReels();
  const { next: audioNext } = useAudioTourActions();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Liten pust mellom kategoriene: når en kategoris VO slutter, vent et beat
  // før vi auto-advancer til neste (= ny VO + kamera-cut). Uten den føltes
  // skiftet for brått; cream-cut-overlayet myknet det visuelt, dette gir også
  // audioen rom. Cancellerbar (ref) så manuell navigasjon i pausen ikke blir
  // overstyrt av en foreldet timer.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Avbryt en ventende auto-advance når activeIndex endrer seg på ANNEN måte
    // (manuelt thumbnail-klikk i pausen) og ved unmount.
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [state.activeIndex]);

  // Kart-entry (teaser-tapp / manuell «Kart →») kansellerer en ventende
  // kategori-teaser-advance: kart-åpning endrer ikke activeIndex, så cleanupen
  // over treffer den ikke. Mens brukeren er på kart-flaten skal touren stå.
  useEffect(() => {
    if (state.mapOpen && advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, [state.mapOpen]);

  // Når et spor slutter naturlig:
  // - Desktop: auto-advance til neste audio-bærende kapittel (etter en kort
  //   pause) slik at løpebåndet i sidebaren spiller kategoriene én etter én
  //   (som mobil-feeden, men uten swipe). Siste spor → terminal "ended"-fase.
  // - Mobil (to-flate): welcome/home auto-advancer videre; kategori-VO-slutt
  //   armer kart-teaser + et timet, passivt auto-advance (se kategori-grenen).
  const handleTrackEnded = () => {
    if (isDesktop) {
      const next = nextAudioBearingIndex(state.cards, state.activeIndex);
      if (next !== -1) {
        // Hold gjeldende kapittel et beat før skiftet (pust mellom kategoriene).
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          setActiveIndex(next);
        }, CATEGORY_ADVANCE_PAUSE_MS);
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
    // Mobil: kart-fremtunge beats (welcome/home) auto-advancer videre slik at
    // flythrough → nabolags-oversikt → første kategori henger sammen (som
    // desktop). Når home-sporet slutter lander vi på første kategori, kart-
    // sheeten kollapser til peek og kategori-reelen tar over fullskjerm — den
    // naturlige overgangen fra fly-in til innhold.
    const endedCard = state.cards[state.activeIndex];
    if (endedCard && (endedCard.kind === "welcome" || endedCard.kind === "home")) {
      const next = nextAudioBearingIndex(state.cards, state.activeIndex);
      if (next !== -1) {
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          setActiveIndex(next);
        }, CATEGORY_ADVANCE_PAUSE_MS);
      }
      return;
    }
    // Kategori-spor (to-flate-modell): arm kart-teaseren (glimt stiger opp på
    // historie-flaten) og start et timet, passivt auto-advance til neste
    // kapittel (R8/R9). Ignorerer bruker → touren går videre selv; tapper hen
    // teaseren / åpner kart → mapOpen-effekten over kansellerer timeren og
    // touren står. Erstatter den gamle map-quarter-parkeringen (manuell swipe).
    //
    // R9-race-vern: hvis VO-en slutter MENS brukeren allerede er på kart-flaten
    // (mapOpen=true), skal vi IKKE arme teaser/timer — da ville et auto-advance
    // rykket brukeren av kartet midt i utforskingen. Bruker styrer selv videre
    // via transporten (Fortsett/segment) når hen er tilbake på historie-flaten.
    // (Welcome/home over auto-chainer bevisst videre — de ER kart-primære.)
    if (endedCard?.kind === "category" && !state.mapOpen) {
      setTeaserArmed(true);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      const nextAudio = nextAudioBearingIndex(state.cards, state.activeIndex);
      const next = nextAudio !== -1 ? nextAudio : state.activeIndex + 1;
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        if (next < state.cards.length) setActiveIndex(next);
        else audioNext();
      }, CATEGORY_TEASER_MS);
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
  boardData,
  has3dAddon,
  eventMode,
  eventFilter,
  collection,
  onOpenCollection,
}: {
  boardData: BoardData;
  has3dAddon: boolean;
  /** D3: event-modus undertrykker megler/eiendoms-chrome (footer + splash-copy). */
  eventMode: boolean;
  /** Unit 4: event-board filter-resultat (liste/seksjoner/dag-state). Null for
   *  boligrapporter. Drives av kompass-store; brukes av EventFilterPanel. */
  eventFilter: EventBoardFilterResult | null;
  /** Unit 5: "Min samling"-søm (lagre-toggle/del-drawer). Null for boligrapporter. */
  collection: BoardCollectionApi | null;
  /** Unit 5: åpne samling-draweren. */
  onOpenCollection: () => void;
}) {
  const home = boardData.home;
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // --- Velkomst-splash (kun desktop) ---
  // Splash ligger som lag OPPÅ board-opplevelsen (fixed inset-0 z-50, opakt).
  // Kartet (én WebGL-instans) mountes UMIDDELBART ved sidelast — bak splashen —
  // så Google 3D-API + tiles rekker å varmes opp FØR velkommen-flyover-en starter
  // (ellers streamet tiles inn MIDT i introen → hakking og lav kvalitet). Splashen
  // dekker oppvarmingen; ved "play" fader den ut og avdekker det allerede varme
  // kartet. Bevares montert ved re-åpning så orbiten ikke re-initialiseres.
  const { state, setActiveIndex, setMapOpen, markAudioUnlocked, markMapMounted } =
    useReels();
  const { dispatch: boardDispatch } = useBoard();
  const { unlock } = useAudioElement();

  // Eager-mount kartet ved sidelast (mobil) så Google-3D-tiles varmes opp BAK
  // splashen — flythrough-en starter da på et varmt kart (ingen tile-streaming
  // midt i fly-in-en). MapLayer holder intro-beaten fullskjerm men opacity 0
  // bak splashen. Speiler desktop som mounter BoardMap umiddelbart. No-op på
  // desktop (MapLayer rendres ikke der).
  useEffect(() => {
    markMapMounted();
  }, [markMapMounted]);
  const phase = useAudioTourStore((s) => s.phase);
  const { pause, resume, goToTrack } = useAudioTourActions();
  const [splashVisible, setSplashVisible] = useState(true);
  const [boardRevealed, setBoardRevealed] = useState(false);

  const firstIdx = firstAudioBearingIndex(state.cards);
  const notStarted = !state.audioUnlocked || phase === "idle";

  const handlePlay = async () => {
    // Basic-tier (uten voice-over → "Utforsk nabolaget"): start intro-flythrough
    // SYNKRONT, FØR vi avdekker kartet. Da batches introPlaying=true sammen med
    // splash-skjul, så det avdekkede kartet aldri rekker å vise statiske pins før
    // flyturen — pins ville ellers blinke inn i noen frames og så "resettes" når
    // START_INTRO kom etter `await unlock()`. Fly-in FØRST, pins avsløres etter
    // landing (END_INTRO → reveal-kaskade). Krever 3D (flythrough er 3D-only).
    const willBasicIntro = notStarted && firstIdx === -1 && has3dAddon;
    if (willBasicIntro) boardDispatch({ type: "START_INTRO" });

    setSplashVisible(false);
    setBoardRevealed(true);
    if (notStarted) {
      if (!state.audioUnlocked) {
        await unlock();
        markAudioUnlocked();
      }
      if (firstIdx !== -1) {
        setActiveIndex(firstIdx);
      }
      // (Basic-intro er allerede startet synkront over.)
    } else if (phase === "ended") {
      // Restart fra første kapittel — speiler sidebarens "Spill av på nytt".
      if (firstIdx !== -1) setActiveIndex(firstIdx);
      goToTrack(0);
    } else if (phase === "paused" || phase === "error") {
      resume();
    }
  };

  const handleReopenSplash = () => {
    setSplashVisible(true);
    if (phase === "playing") pause("manual");
  };

  // D3: i event-modus finnes ingen audio-tur (firstIdx === -1) → boligrapportens
  // basic-label "Utforsk nærområdet" ville ellers stått på selve play-knappen
  // (det første brukeren ser). Forgrenes på eventMode (samme mønster som
  // splashIntro under) i en ren, enhetstestbar helper.
  const primaryLabel = deriveSplashPrimaryLabel({
    eventMode,
    notStarted,
    firstIdx,
    ended: phase === "ended",
  });

  // D3: event-modus har egen, megler/eiendoms-fri splash-copy (ingen "nærområdet
  // til hotellet"/"utenfor kontordøren"). Boligrapport-copyen er uendret.
  const splashIntro = eventMode
    ? "Utforsk programmet på kartet — se hva som skjer, hvor og når. Trykk play, og finn opplevelsene i nærheten."
    : boardData.venueType === "commercial"
      ? "Vi tar deg med på en guidet tur i nærområdet — restauranter, transport, trenings- og servicetilbud rett utenfor kontordøren. Trykk play, og se hva som ligger i gangavstand."
      : boardData.venueType === "hotel"
        ? "Utforsk nærområdet til hotellet — restauranter, severdigheter, transport og opplevelser rett utenfor lobbyen. Trykk play, og se hva som ligger i gangavstand."
        : undefined;

  // Lett-vekts kategori-oversikt for sidebarens empty state (prosjekt uten
  // reels-lyd) — med POI-antall + lead.
  const previewCategories = useMemo(
    () =>
      boardData.categories.map((c) => ({
        id: c.id,
        label: c.label,
        color: c.color,
        count: c.pois.length,
        lead: c.lead,
        image:
          getCategoryIllustrationSrc(boardData.projectSlug, c.id, boardData.assets) ??
          c.illustration?.src,
        // Nivå-2 (Bedre): kuratert detalj-innhold gjør temakortet til en drill-in.
        editorial: c.editorial,
      })),
    [boardData.categories, boardData.projectSlug, boardData.assets],
  );
  const logoSrc = getProjectLogoSrc(boardData.projectSlug, boardData.assets);
  const splashHero =
    getProjectSplashImage(boardData.projectSlug, boardData.assets) ?? home.heroImage;
  const splashVideo = getProjectSplashVideo(boardData.projectSlug, boardData.assets);
  const subline =
    [home.district, home.city].filter(Boolean).join(", ") || undefined;

  if (isDesktop) {
    // Adaptiv desktop: full-høyde storytelling-sidebar ved siden av kartet i
    // flex-flow. Sidebar + kart får en entré-animasjon (glir/skalerer inn) ved
    // "play" mens splash-laget fader ut → følelsen av at kartet "flyr inn".
    // Mobil-branchen under er urørt (bruker IntroReel-videoen som splash).
    return (
      <div className="relative flex h-[100dvh] w-full overflow-hidden bg-stone-100">
        <div
          className={cn(
            "h-full shrink-0 transition-all duration-700 ease-out",
            boardRevealed ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0",
          )}
        >
          <DesktopStorySidebar
            home={home}
            logoSrc={logoSrc}
            onLogoClick={handleReopenSplash}
            previewCategories={previewCategories}
            noBrokers={eventMode}
            eventFilter={eventFilter}
            categories={boardData.categories}
            collection={collection}
            onOpenCollection={onOpenCollection}
            renderActiveCard={(i) => <CardRouter cardIndex={i} desktopMode />}
          />
        </div>
        <div
          className={cn(
            "relative h-full flex-1 transition-transform duration-700 ease-out",
            boardRevealed ? "scale-100" : "scale-[1.04]",
          )}
        >
          {/* Alltid montert — også bak splashen — for tile-oppvarming (se kommentar
              over handlePlay). Opacity holdes 100 så WebGL faktisk rendrer/streamer
              under det opake splash-laget; entréen er kun en subtil scale-settle ved
              reveal. Splash-kryssfaden står for selve avdekkingen. */}
          <BoardMap has3dAddon={has3dAddon} mapPaddingLeft={16} eventMode={eventMode} />
        </div>
        <DesktopReportSplash
          visible={splashVisible}
          name={home.name}
          subline={subline}
          logoSrc={logoSrc}
          heroImage={splashHero}
          heroVideo={splashVideo}
          intro={splashIntro}
          primaryLabel={primaryLabel}
          onPlay={handlePlay}
        />
      </div>
    );
  }

  // Unit 7 (R7/R17): event-board er mobile-first via en bottom-sheet over et
  // persistent kart — IKKE den audio-drevne reels-stacken (events har ingen
  // audio/karaoke). Boligrapportenes mobil-sti (reels + splash) er urørt og
  // rendres uendret under. EventMobileSheet eier sin egen map-mount, så vi
  // hopper over MapLayer/ReelsStack/splash i event-modus.
  if (eventMode && eventFilter) {
    return (
      <EventMobileSheet
        has3dAddon={has3dAddon}
        eventFilter={eventFilter}
        categories={boardData.categories}
        collection={collection}
        onOpenCollection={onOpenCollection}
      />
    );
  }

  // --- Mobil: to-flate-modell (historie ↔ kart) + vedvarende transport ---
  const activeCardMobile = state.cards[state.activeIndex];
  const beatKindMobile = activeCardMobile?.kind;
  const isMapForwardBeatMobile =
    beatKindMobile === "welcome" ||
    beatKindMobile === "home" ||
    beatKindMobile === "outro";
  const isCategoryBeatMobile = beatKindMobile === "category";
  // R17: uten spillbar lyd faller mobil tilbake til splash + (basic) kart-
  // utforsking — da er kartet primær-flaten og transporten rendres ikke.
  const hasAudioMobile = firstIdx !== -1;
  const mapIsSurface = state.mapOpen || !hasAudioMobile;
  const teaserVisible =
    state.teaserArmed && !state.mapOpen && isCategoryBeatMobile;

  // Persistent kart-container-geometri:
  //  - kart-flate (mapIsSurface): fullskjerm, interaktivt, z-20 over historie.
  //  - teaser: bunn-stripe (~38%), ikke-interaktivt, z-20 (glir opp via height-
  //    transition — samme persistente instans avslørt).
  //  - ellers (historie): fullskjerm BAK historie (z-0), varmt + ikke-interaktivt.
  const mapStyle: CSSProperties = mapIsSurface
    ? { inset: 0, zIndex: 20 }
    : teaserVisible
      ? { left: 0, right: 0, bottom: 0, top: "auto", height: "38%", zIndex: 20 }
      : { inset: 0, zIndex: 0 };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {/* Persistent kart — alltid montert (varmt + teaser-glimt = samme instans).
          interactive kun på kart-flaten (R13); ellers pointer-events-skjold. */}
      <div
        className="absolute overflow-hidden transition-all duration-500 ease-out"
        style={mapStyle}
      >
        <BoardMap
          has3dAddon={has3dAddon}
          interactive={mapIsSurface}
          compactControls
          collapsedControls
        />

        {/* Teaser CTA-lag (B1) — over skjoldet; tapp åpner kart-flate (R9). */}
        {teaserVisible && <MapTeaser />}

        {/* Kart-flate-exit for kategori (R14): chevron topp-venstre + «← Tilbake»
            i transporten = to veier ut. */}
        {state.mapOpen && isCategoryBeatMobile && (
          <button
            type="button"
            onClick={() => setMapOpen(false)}
            aria-label="Lukk kart"
            className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-black shadow-lg active:scale-95"
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
        )}

        {/* Map-forward beat (welcome/home/outro): label-caption mens VO-en leses
            over kartet (kart er innholdet her — ingen kort-video, som før). */}
        {state.mapOpen && isMapForwardBeatMobile && activeCardMobile?.label && (
          <div className="pointer-events-none absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-30 flex justify-center">
            <span className="rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
              {activeCardMobile.label}
            </span>
          </div>
        )}
      </div>

      {/* Historie-flate — kun når kart ikke er aktiv flate. Rendrer det aktive
          kortet direkte (ingen scroll-feed; navigasjon via transport + auto-advance). */}
      {!mapIsSurface && (
        <div className="absolute inset-0 z-10">
          <CardRouter cardIndex={state.activeIndex} />
        </div>
      )}

      {/* Vedvarende transport — etter lyd-unlock (R18), kun med spillbar lyd (R17). */}
      {hasAudioMobile && state.audioUnlocked && <ReelsTransport />}

      <MobileReportSplash
        visible={splashVisible}
        name={home.name}
        subline={subline}
        logoSrc={logoSrc}
        heroImage={splashHero}
        heroVideo={splashVideo}
        intro={splashIntro}
        primaryLabel={primaryLabel}
        onPlay={handlePlay}
      />
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
    loading: () => <div className="h-[100dvh] w-full bg-[#f2e9dc]" />,
  },
);

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
  if (card.kind === "summary") {
    return <SummaryReel card={card} isActive={isActive} desktopMode={desktopMode} />;
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
