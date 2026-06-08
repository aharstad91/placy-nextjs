"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView3D, type Map3DInstance } from "@/components/map/map-view-3d";
import { useRouteData } from "@/lib/map/use-route-data";
import { DEFAULT_CAMERA_LOCK } from "@/components/variants/report/blocks/report-3d-config";
import { useBoard, useActiveCategory, useActivePOI } from "./board-state";
import { useBoardPopupMode } from "./use-popup-mode";
import { BoardPOI3DMiniPopup } from "./BoardPOI3DMiniPopup";
import { type CameraMode } from "./BoardMapControls";
import { CameraCutOverlay } from "./CameraCutOverlay";
import { CameraWaypointAuthor } from "./CameraWaypointAuthor";
import { useBoard3DCamera } from "./use-board-3d-camera";
import {
  deriveCategoryCamera,
  computeSpreadRadiusM,
  orbitRangeForSpread,
  ORBIT_RANGE,
  SUMMARY_RANGE,
  SUMMARY_TILT,
  SUMMARY_FLY_MS,
  type FlyCapableMap,
} from "./board-3d-camera-director";
import { getCategoryCamera } from "./camera-tours";
import { selectBlobPOIs } from "./blob-pois";
import { getBoardIntro } from "./board-intros";
import {
  runIntroFlythrough,
  buildBasicIntroPath,
  MIN_INTRO_FLY_MS,
  WELCOME_INTRO_SETTLE_MS,
  WELCOME_CALM_SWEEP_DEG,
  DEFAULT_INTRO_PATH,
  type CameraDrivableMap3D,
} from "./board-intro-flythrough";
import { getProjectPinThumbnail } from "@/lib/themes/project-brand";
import { getDistanceMeters } from "@/lib/map-utils";
import type { RevealItem } from "@/components/map/RevealLayer3D";
import { useCurrentTrack, useAudioTourPhase } from "@/lib/stores/audio-tour-store";
import type { POI, CategoryCameraConfig } from "@/lib/types";
import type { PendingCamera } from "@/components/map/UnifiedMapModal";

// RouteLayer3D lazy-loaded — samme bundling-strategi som ReportThemeSection
// (tunge Google Maps-imports holdes ute av 2D-bundlen).
const RouteLayer3D = dynamic(
  () =>
    import("@/components/map/route-layer-3d").then((mod) => ({
      default: mod.RouteLayer3D,
    })),
  { ssr: false },
);

/** Antall «blob»-prikker (nærmeste POI-er) som tegnes inn under velkommen-
 *  flyover-en. Mange små farge-prikker formidler bredden i nabolaget («se hvor
 *  mye som ligger rundt deg»); kaskaden komprimeres adaptivt så alle rekker inn
 *  innenfor velkommen-beaten (se RevealLayer3D). Slice-es mot antall tilgjengelige
 *  POI-er, så et høyt tall ≈ «hele nabolaget». */
const BLOB_LIMIT = 120;

/** Antall vanlige «legend»-pins per kategori på velkommen + oppsummering: de
 *  NÆRMESTE POI-ene per kategori vises med ikon + farge, som et lesbart holdepunkt
 *  for hva blob-prikkene representerer. Nærmeste (pois er distanse-sortert) så
 *  legend-pinnene ligger i blob-klyngen, ikke langt unna. */
const LEGEND_PER_CATEGORY = 3;

interface Props {
  /**
   * Camera-state arvet fra Mapbox-modus ved toggle. Brukes som initial
   * `defaultCenter` så toggle ikke nullstiller kart-posisjonen.
   */
  pendingCamera: PendingCamera | null;
  /**
   * Sidebar-okkludering på venstre side i piksler. Beholdt for grensesnitt-
   * paritet med 2D-varianten; den cinematiske drone-orbiten IGNORERER den og
   * sentrerer på prosjektet (se board-3d-camera-director) for stabil orbit.
   * Prosjektet lander i skjerm-senter, godt til høyre for sidebaren.
   */
  mapPaddingLeft?: number;
  /** Kameramodus (auto/fri), løftet til BoardMap så Auto/Fri-toggelen kan bo i
   *  den felles BoardMapControls-komponenten nederst-midt. */
  cameraMode: CameraMode;
  /** Kalles når brukeren tar over kameraet ved å DRA i 3D-kartet (auto → fri).
   *  BoardMap setter fri-modus + viser recovery-hinten. */
  onDragTakeover: () => void;
}

/**
 * 3D-modus av board-kartet — VARIANT B (cinematic drone-orbit).
 *
 * - Bruker `MapView3D` fra components/map (Google Photorealistic 3D Tiles).
 * - Kameraet sirkler rolig rundt prosjektet på FAST avstand (drone/helikopter),
 *   så scenen alltid lever. Det er ÉN kontinuerlig orbit — den re-aimes IKKE ved
 *   kategori-skifte (det bytter bare hvilke markører som vises). Kameraet zoomer
 *   ALDRI ut for å ramme alle pins.
 * - To kamera-moduser (auto ⇄ fri), styrt av Auto/Fri-toggelen i den felles
 *   `BoardMapControls` (rendret av BoardMap). cameraMode kommer inn som prop:
 *     • auto → kontinuerlig drone-orbit.
 *     • fri  → orbiten stopper, brukeren styrer vinkelen selv.
 *   Drar/zoomer brukeren i kartet varsles BoardMap via onDragTakeover, som
 *   setter «fri» + viser recovery-hint (ingen auto-reset — ett klikk gir
 *   kontrollen tilbake til dronen).
 * - Åpnet POI stopper orbiten og flyr tett inn; lukking gjenopptar orbiten hvis
 *   modus er auto, ellers blir kameraet stående (fri modus eier vinkelen).
 * - Markørene monteres på full opacity (ingen opacity-reveal — den churnet
 *   Google 3D's SVG-rasterisering og eksploderte WebGL-kontekster).
 * - Kun de relevante markørene mountes: aktiv kategoris POI-er under avspilling,
 *   et kuratert top-3/kategori-ankersett i oversikt.
 * - Tegner walking-rute fra Home → aktiv POI via `RouteLayer3D`.
 */
export function BoardMap3D({ pendingCamera, cameraMode, onDragTakeover }: Props) {
  const { state, data, dispatch, subFilter } = useBoard();
  const activeCategory = useActiveCategory();
  const activePOI = useActivePOI();
  const popupMode = useBoardPopupMode();

  // Walking-rute for RouteLayer3D — samme hook som BoardPathLayer (2D).
  const poiForRoute = state.phase === "poi" && activePOI ? activePOI.raw : null;
  const { data: routeData } = useRouteData(poiForRoute, data.home.coordinates);

  // Lokal state for map3d-instansen så RouteLayer3D rerenderer når den blir klar.
  const [map3dInstance, setMap3dInstance] = useState<Map3DInstance | null>(null);

  // Dev-only authoring-modus (?author=1) for å fange kamera-waypoints. Lest én
  // gang ved mount; aldri eksponert i produksjon med mindre flagget settes.
  const [authorMode] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("author") === "1",
  );

  // Film/capture-modus (?film=1): dropp kategori-POI-pins for en ren cinematisk
  // flythrough-fangst. Pins re-monteres per zoom-tier, så å fjerne dem via DOM
  // utenfra krasjer React (removeChild-race på en node React fortsatt eier) —
  // vi dropper dem heller på render-nivå her (markerPOIs → []). Prosjekt-labelen
  // (projectSite) er en egen prop og påvirkes ikke.
  const [filmMode] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("film") === "1",
  );

  // Fly-modus (?fly=1): spill intro-flythrough (oval-spiral låst på objektet)
  // live i kartet. Impliserer film-modus (pins skjult) + "free" cameraMode (over),
  // og kjøres av effekten lenger ned når map3d-instansen er klar.
  const [flyMode] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("fly") === "1",
  );

  // Narrativ-synk-kilder (begge stabile — endrer kun ved track-/fase-skifte,
  // IKKE ~4 Hz som useAudioElement; holder marker-treet utenfor re-render-flommen).
  const currentTrack = useCurrentTrack();
  const audioPhase = useAudioTourPhase();
  const audioDurationMs =
    currentTrack?.durationSec != null
      ? Math.round(currentTrack.durationSec * 1000)
      : undefined;
  const audioPaused = audioPhase === "paused";

  // Velkommen-beaten driver intro-flythrough-en (innflyvningen som introduserer
  // området). Velkommen-sporet bærer categoryId "welcome" (buildCategoryTracks),
  // og «Start opplevelsen» hopper nettopp dit (firstAudioBearingIndex). Sammen med
  // ?fly=1-capture er dette de to tilfellene der innflyvningen EIER kameraet:
  // director-en yield-er (introActive) og kategori-pins skjules for en ren
  // etablering av nærområdet. Selve flyturen kjøres av effekten lenger ned.
  const isWelcomeBeat = currentTrack?.categoryId === "welcome";

  // Basic-tier (uten voice-over): «Utforsk nabolaget» setter board-state-flagget
  // introPlaying → den auto-genererte intro-flythrough-en spilles ÉN gang som
  // initial-tilstand. Ingen welcome-beat finnes å henge den på her (krever audio),
  // så dette er den tredje måten innflyvningen kan eie kameraet på (i tillegg til
  // welcome-beaten og ?fly=1-capture).
  const basicIntroActive = state.introPlaying;
  const introActive = flyMode || isWelcomeBeat || basicIntroActive;

  // Basic-intro flythrough-fase, satt fra flyturens onPhase. Styrer markør-
  // koreografien (basic-tier, uten voice-over):
  //   "idle"     → ved load / før klikk: INGEN markører på kartet (rent).
  //   "settling" → kamera holder vid positur mens tiles streamer: fortsatt rent.
  //   "running"  → kamera flyr inn: reveal-kaskaden starter (markører tegnes inn
  //                PARALLELT med flyturen, ~0,9s etter at bevegelsen begynner).
  //   "done"     → landet: kaskaden ferdig, faller til statiske oversiktspins.
  const [introFlyPhase, setIntroFlyPhase] = useState<
    "idle" | "settling" | "running" | "done"
  >("idle");

  // Nabolaget-beaten (home-sporet bærer categoryId "home" — se buildCategoryTracks)
  // viser HELE nabolaget: alle POI-er på tvers av kategoriene som VANLIGE pins,
  // i stedet for det kuraterte top-3/kategori-ankersettet. Det er etableringen av
  // «se hvor mye som ligger rundt deg» i pin-format (velkommen-beaten viser det
  // tilsvarende som animerte blobs).
  const isHomeBeat = currentTrack?.categoryId === "home";

  // Oppsummerings-beaten ("Oppsummert"). BoardMap setter fri-modus + viser hinten
  // når denne spiller; her trekker vi kameraet litt ut til et oversiktsbilde.
  const isOutroBeat = currentTrack?.categoryId === "outro";

  // prefers-reduced-motion: statisk hold på A i stedet for A→B-drift (KD-10).
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Har prosjektet voice-over (reels-lyd)? Da finnes en guidet tur som driller
  // inn per kategori, og overblikket holdes rent med et kuratert anker-sett
  // (top-3 score-rangert per kategori, ~18–21 stk). UTEN voice-over finnes ingen
  // tur å drille med, så hele nabolaget vises samtidig (alle POI-er) — kartet
  // blir da selve verdien i overblikks-state.
  const hasVoiceOver = useMemo(
    () =>
      data.categories.some((c) => !!c.audio || !!c.reelsAudio) ||
      !!data.welcome ||
      !!data.home.audio ||
      !!data.outro,
    [data.categories, data.welcome, data.home.audio, data.outro],
  );

  // Oversikts-sett. Brukes når ingen kategori spiller (intro/home/outro/megler).
  // Med voice-over: kuratert ankersett (top-3 score-rangert per kategori, ~18–21
  // stk, IKKE distanse-sortert). Uten voice-over: hele nabolaget. Nabolaget- og
  // Oppsummert-beatene viser uansett hele nabolaget (allPOIs). Kategoriene er
  // disjunkte, så ingen duplikater.

  const overviewPOIs = useMemo(
    () =>
      hasVoiceOver
        ? data.categories.flatMap((c) => c.topRankedPois.slice(0, 3).map((p) => p.raw))
        : data.categories.flatMap((c) => c.pois.map((p) => p.raw)),
    [data.categories, hasVoiceOver],
  );

  // Hele nabolaget: alle POI-er på tvers av kategoriene, deduplikert (samme sted
  // kan ligge i flere kategorier — beholder første forekomst). Brukt på Nabolaget-
  // beaten (isHomeBeat) så kartet viser ALT vi har, ikke bare ankersettet.
  const allPOIs = useMemo<POI[]>(() => {
    const seen = new Set<string>();
    const result: POI[] = [];
    for (const c of data.categories) {
      for (const p of c.pois) {
        if (seen.has(p.raw.id)) continue;
        seen.add(p.raw.id);
        result.push(p.raw);
      }
    }
    return result;
  }, [data.categories]);

  // Nabolags-spredning → hvile-/intro-range. Måler hvor spredt punktene faktisk
  // ligger rundt objektet og skalerer zoom-en deretter: få spredte punkter
  // (forstad) → trekk kameraet ut, mange tette (urbant) → zoom inn. Kun i basic-
  // tier (uten voice-over); voice-over-prosjekter beholder den tunede 650-orbiten.
  const spreadRadiusM = useMemo(
    () =>
      computeSpreadRadiusM(
        data.home.coordinates,
        allPOIs.map((p) => p.coordinates),
      ),
    [data.home.coordinates, allPOIs],
  );
  const orbitRange = useMemo(
    () => (hasVoiceOver ? ORBIT_RANGE : orbitRangeForSpread(spreadRadiusM)),
    [hasVoiceOver, spreadRadiusM],
  );

  // Legend-pins: nærmeste POI per kategori (pois er distanse-sortert → [0] er
  // nærmest). Vises som vanlige pins (ikon + farge) på velkommen + oppsummering
  // så blob-prikkene får et lesbart holdepunkt. Ligger i blob-klyngen nær hjemmet.
  const legendPOIs = useMemo<POI[]>(
    () =>
      data.categories.flatMap((c) =>
        c.pois.slice(0, LEGEND_PER_CATEGORY).map((p) => p.raw),
      ),
    [data.categories],
  );
  const legendIds = useMemo(
    () => new Set(legendPOIs.map((p) => p.id)),
    [legendPOIs],
  );

  // Markørsettet som faktisk mountes. Når en kategori spiller: kun den
  // kategoriens POI-er (sub-filtrert). Ellers: det kuraterte ankersettet.
  const markerPOIs = useMemo<POI[]>(() => {
    // Capture (?film=1 / ?fly=1): helt rent kart, ingen pins.
    if (filmMode || flyMode) return [];
    // Kategori-valg vinner alltid (også hvis et reveal-vindu fortsatt teller ned).
    if (activeCategory) {
      const useFilter = state.phase !== "default" && subFilter.hiddenIds.size > 0;
      const result: POI[] = [];
      for (const p of activeCategory.pois) {
        if (useFilter && subFilter.hiddenIds.has(p.raw.category.id)) continue;
        result.push(p.raw);
      }
      return result;
    }
    // Velkommen-beat (audio): reveal-kaskaden eier markørene → ingen statiske.
    if (isWelcomeBeat) return [];
    // Nabolaget + Oppsummering → hele nabolaget (alle POI, fulle markører).
    if (isHomeBeat || isOutroBeat) return allPOIs;
    // Basic-tier (uten voice-over): markør-koreografi gated på OM intro-en
    // faktisk kjører NÅ (basicIntroActive) — ikke på den lokale introFlyPhase.
    // MENS basic-intro-en flyr holdes kartet rent (reveal-kaskaden eier markørene
    // og tegner dem inn under "running"). Når intro-en IKKE er aktiv — ferdig,
    // AVBRUTT ved navigasjon (klikk på kategori/"Hele nabolaget" midt i flyturen),
    // eller aldri kjørt — vises HELE overblikket umiddelbart som vanlige markører,
    // uten noen intro. (Den gamle `introFlyPhase === "done"`-gaten etterlot kartet
    // tomt + reveal-kaskaden hengende hvis en avbrutt fly frøs fasen på "running".)
    if (!hasVoiceOver) {
      return basicIntroActive ? [] : overviewPOIs;
    }
    // Audio-tier idle / megler → ankersettet.
    return overviewPOIs;
  }, [filmMode, flyMode, isWelcomeBeat, isOutroBeat, basicIntroActive, hasVoiceOver, activeCategory, state.phase, subFilter.hiddenIds, overviewPOIs, isHomeBeat, allPOIs]);

  // Reveal-sett (velkommen + oppsummering): legend-pins (nærmeste per kategori,
  // vist som fulle pins) + blobs (de nærmeste POI-ene som farge-prikker, legend
  // ekskludert så vi ikke får prikk-under-ikon). Slått sammen og DISTANSE-sortert
  // (nærmest først) så pins og prikker animeres inn på lik linje i én kaskade.
  // Vises på den LIVE velkommen-/oppsummerings-beaten — ikke i ?film=1/?fly=1.
  const revealItems = useMemo<RevealItem[]>(() => {
    const home = data.home.coordinates;
    const blobs = selectBlobPOIs(home, data.categories, BLOB_LIMIT, legendIds);
    const items: { item: RevealItem; dist: number }[] = [
      ...legendPOIs.map((poi) => ({
        item: { kind: "pin" as const, poi },
        dist: getDistanceMeters(home, poi.coordinates),
      })),
      ...blobs.map((poi) => ({
        item: { kind: "blob" as const, poi },
        dist: getDistanceMeters(home, poi.coordinates),
      })),
    ];
    items.sort((a, b) => a.dist - b.dist);
    return items.map((i) => i.item);
  }, [data.home.coordinates, data.categories, legendPOIs, legendIds]);
  // Reveal-kaskaden (blobs + legend-pins som animeres inn):
  //  • velkommen-beat (audio-tier): synket til VO-en, som før.
  //  • basic-intro: kjører PARALLELT med flyturen, men starter FØRST når kameraet
  //    er i bevegelse ("running") — ikke under settle. RevealLayer3D sin egen
  //    START_DELAY (~0,9s) gir markørene et lite forsprang etter at flyturen
  //    begynner, så de tegnes inn samtidig som innflyvningen i stedet for før den.
  // Ikke over et valgt kategori-kart (da eier kategori-pinsene visningen).
  // basicIntroActive-garden: reveal-kaskaden skal KUN vises mens basic-intro-en
  // faktisk flyr. Avbrytes flyturen (navigasjon midt i) fryser introFlyPhase på
  // "running" — uten denne garden ble kaskaden hengende oppå de vanlige markørene.
  const showReveal =
    (isWelcomeBeat ||
      (!hasVoiceOver && basicIntroActive && introFlyPhase === "running")) &&
    !filmMode &&
    !activeCategory;

  // Default-camera: bruk pendingCamera hvis tilgjengelig (fra toggle), ellers
  // prosjektets home-koordinater + default 3D-tilt.
  const initialCenter = useMemo(
    () =>
      pendingCamera
        ? { lat: pendingCamera.lat, lng: pendingCamera.lng, altitude: 0 }
        : {
            lat: data.home.coordinates.lat,
            lng: data.home.coordinates.lng,
            altitude: 0,
          },
    [pendingCamera, data.home.coordinates.lat, data.home.coordinates.lng],
  );

  // Bruk pendingCamera.range/tilt hvis tilgjengelig, ellers default fra
  // report-3d-config (range=900, tilt=45).
  const cameraLock = useMemo(() => {
    if (pendingCamera) {
      return {
        ...DEFAULT_CAMERA_LOCK,
        range: pendingCamera.range ?? DEFAULT_CAMERA_LOCK.range,
        tilt: pendingCamera.tilt ?? DEFAULT_CAMERA_LOCK.tilt,
        heading: pendingCamera.heading ?? 0,
      };
    }
    return DEFAULT_CAMERA_LOCK;
  }, [pendingCamera]);

  const handleMapReady = useCallback((m: Map3DInstance | null) => {
    setMap3dInstance(m);
  }, []);

  // Stabil click-handler — sitter i Marker3DItems memo-props, så en fersk inline
  // arrow per render ville defeate memo for HVER markør. useCallback bevarer
  // referansen så memo holder (S1).
  const handlePOIClick = useCallback(
    (poiId: string) => {
      for (const cat of data.categories) {
        const found = cat.pois.find((p) => p.id === poiId);
        if (found) {
          dispatch({ type: "OPEN_POI", id: found.id, categoryId: cat.id });
          return;
        }
      }
    },
    [data.categories, dispatch],
  );

  // Klikk på kart-bakgrunn (ikke markør) → lukk POI-popup. Speiler 2D-mappens
  // onClick på <Map>. gmp-click fyrer for alle klikk i map-elementet inkludert
  // marker-klikk (bubbler), så vi filtrerer på e.target.closest for å unngå at
  // marker-klikk lukker popupen før den åpnes for ny POI.
  useEffect(() => {
    if (!map3dInstance) return;
    const el = map3dInstance as unknown as HTMLElement;
    const onMapClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("gmp-marker-3d-interactive")) return;
      if (state.activePOIId) dispatch({ type: "BACK_TO_DEFAULT" });
    };
    el.addEventListener("gmp-click", onMapClick);
    return () => el.removeEventListener("gmp-click", onMapClick);
  }, [map3dInstance, state.activePOIId, dispatch]);

  // Aktiv POIs koordinater for kamera-directoren (memoisert så hook-deps holdes
  // stabile på primitiver).
  const activePOICoords = useMemo(
    () =>
      activePOI
        ? { lat: activePOI.raw.coordinates.lat, lng: activePOI.raw.coordinates.lng }
        : null,
    [activePOI],
  );

  // Kamera-config for aktiv kategori: eksplisitt autorert (camera-tours) har
  // forrang; ellers utledes A→B-buen fra kategoriens topp-POI-er + hjemmet
  // (deriveCategoryCamera) så cinematic-bevegelsen fungerer uten hand-autoring.
  const categoryConfig = useMemo<CategoryCameraConfig | undefined>(() => {
    if (!activeCategory) return undefined;
    const explicit = getCategoryCamera(data.projectSlug ?? "", activeCategory.id);
    if (explicit) return explicit;
    const src =
      activeCategory.topRankedPois.length > 0
        ? activeCategory.topRankedPois
        : activeCategory.pois;
    const coords = src.map((p) => p.coordinates);
    return deriveCategoryCamera(data.home.coordinates, coords) ?? undefined;
  }, [activeCategory, data.projectSlug, data.home.coordinates]);

  // ── Kamera-director ─────────────────────────────────────────────────────
  // Drone-orbit + POI-fokus + (kommende) cinematic A→B, styrt av en eksplisitt
  // state-maskin med token-kansellering (use-board-3d-camera). Kategori-skifte
  // uten waypoints rører IKKE kameraet (orbiten går uavbrutt videre). Markørene
  // er statiske (full opacity) — ingen opacity-reveal (WebGL-kontekst-churn).
  const { cutVisible } = useBoard3DCamera({
    map3dInstance,
    cameraMode,
    introActive,
    home: data.home.coordinates,
    activePOI: activePOICoords,
    activeCategoryId: activeCategory?.id ?? null,
    categoryConfig,
    audioDurationMs,
    audioPaused,
    reducedMotion,
    orbitRange,
    // Basic-tier (uten voice-over): ingen idle-orbit. Etter intro-flythrough-en
    // HOLDER kameraet der flyturen landet i stedet for å re-aime til orbit-
    // vinkelen. Voice-over-prosjekter beholder drone-orbiten.
    autoOrbit: hasVoiceOver,
  });

  // ── Intro-flythrough (velkommen-beat + ?fly=1) ───────────────────────────
  // Den regisserte oval-spiralen (board-intro-flythrough) er selve introduksjonen
  // av området: åpner vidt på nærområdet og flyr inn på objektet. Den eier
  // kameraet — director-en yield-er via introActive — og kjører i to tilfeller:
  //  • PRODUKT: velkommen-beaten. Trigges når brukeren trykker «Start
  //    opplevelsen» (→ welcome-kortet aktivt → welcome-sporet spiller). Flytur-
  //    varigheten skaleres til velkommen-VO-en (settle + flytur = VO-lengde) så de
  //    lander sammen, og fryses (uten restart) hvis VO-en pauses (audioPausedRef).
  //    prefers-reduced-motion → statisk vidt nærområde, ingen flytur.
  //  • CAPTURE: ?fly=1 (ingen audio) — uendret, driver capture-scriptet med
  //    default-varighet uavhengig av reduced-motion.
  // window.__placyIntroFly eksponerer fasen (settling→running→done) for capture.
  const homeLat = data.home.coordinates.lat;
  const homeLng = data.home.coordinates.lng;
  // Per-prosjekt intro-tuning (innflyvnings-retning etc.); ukjent slug → {} → ren
  // standard-intro. Stabil ref via slug-dep så effekten ikke restarter.
  const introPath = useMemo(
    () => getBoardIntro(data.projectSlug ?? ""),
    [data.projectSlug],
  );
  // Pause leses via ref hver frame (ikke effekt-dep) så pause/resume fryser
  // flyturen der den slapp i stedet for å restarte den.
  const audioPausedRef = useRef(audioPaused);
  audioPausedRef.current = audioPaused;
  useEffect(() => {
    if (!introActive || !map3dInstance) return;
    const map = map3dInstance as unknown as CameraDrivableMap3D;

    // BASIC-TIER (uten voice-over): «Utforsk nabolaget» → skalert auto-intro som
    // LANDER på hvile-rangen (orbitRange), så director-en overtar sømløst med en
    // orbit på samme avstand. Fast varighet (ingen audio å skalere mot). Når
    // flyturen lander dispatcher vi END_INTRO → introActive=false → orbit + pins.
    // prefers-reduced-motion → statisk vidt nærområde (runIntroFlythrough fyrer
    // «done» umiddelbart → END_INTRO → director-ens reduced-motion-orbit).
    if (basicIntroActive && !isWelcomeBeat && !flyMode) {
      return runIntroFlythrough(map, {
        target: { lat: homeLat, lng: homeLng },
        path: buildBasicIntroPath(orbitRange),
        staticOnly: reducedMotion,
        onPhase: (phase) => {
          (window as unknown as { __placyIntroFly?: string }).__placyIntroFly = phase;
          // Driv markør-koreografien: settling/running/done styrer når reveal-
          // kaskaden og de statiske oversiktspinsene vises (se markerPOIs/showReveal).
          setIntroFlyPhase(phase);
          if (phase === "done") dispatch({ type: "END_INTRO" });
        },
      });
    }

    // Produkt-velkommen-beaten (ikke capture) får KORT settle så innflyvningen
    // ikke føles treg (default 3,5s ga en død pause etter splash før bevegelse),
    // og skalerer flyturen til VO-en. Capture (?fly=1) beholder default-settlen
    // (skarpe tiles i opptak) og default-varigheten.
    const isProductWelcome = isWelcomeBeat && !flyMode;
    const settleMs = isProductWelcome
      ? WELCOME_INTRO_SETTLE_MS
      : introPath.settleMs ?? DEFAULT_INTRO_PATH.settleMs;
    const flyDurationMs =
      isProductWelcome && audioDurationMs
        ? Math.max(MIN_INTRO_FLY_MS, audioDurationMs - settleMs)
        : undefined;
    // Live-velkommen får en roligere PUSH-IN: vi demper heading-sveipen så
    // blob-prikkene ikke svinger rundt skjermen, men bevarer landings-framingen
    // ved å skyve startHeading tilsvarende opp (end = start + sweep holdes likt).
    // Capture (?fly=1) beholder banens fulle sveip for det cinematiske opptaket.
    const baseSweep = introPath.sweepDeg ?? DEFAULT_INTRO_PATH.sweepDeg;
    const baseStart = introPath.startHeading ?? DEFAULT_INTRO_PATH.startHeading;
    const calmSweep = Math.min(WELCOME_CALM_SWEEP_DEG, baseSweep);
    const calmOverride = isProductWelcome
      ? {
          startHeading: baseStart + (baseSweep - calmSweep),
          sweepDeg: calmSweep,
          ovalEccentricity: 0,
        }
      : {};
    return runIntroFlythrough(map, {
      target: { lat: homeLat, lng: homeLng },
      path: {
        ...introPath,
        ...calmOverride,
        settleMs,
        ...(flyDurationMs ? { durationMs: flyDurationMs } : {}),
      },
      // Redusert bevegelse gjelder kun produkt-beaten; capture skal alltid fly.
      staticOnly: isProductWelcome && reducedMotion,
      isPaused: () => audioPausedRef.current,
      onPhase: (phase) => {
        (window as unknown as { __placyIntroFly?: string }).__placyIntroFly = phase;
      },
    });
  }, [
    introActive,
    isWelcomeBeat,
    flyMode,
    basicIntroActive,
    orbitRange,
    dispatch,
    map3dInstance,
    homeLat,
    homeLng,
    introPath,
    audioDurationMs,
    reducedMotion,
  ]);

  // ── Oppsummering: trekk kameraet ut til oversikt (én gang) ───────────────
  // Når outro-beaten spiller setter BoardMap modus til "free" (+ hint). Director-
  // en er da no-op (free) og stopper enhver orbit, så denne imperative fly-en
  // holder seg uforstyrret. Effekten er registrert ETTER useBoard3DCamera, så i
  // commit-en der modus blir "free" kjører director-ens stopp FØR denne fly-en.
  // Avhenger av (isOutroBeat, cameraMode) → fyrer én gang når begge er sanne, og
  // re-flyr ikke på stabile deps. Trykker brukeren Auto (modus≠free) overtar
  // director-en med orbit igjen (matcher hintens «trykk Auto»).
  useEffect(() => {
    if (!isOutroBeat || cameraMode !== "free" || !map3dInstance) return;
    const map = map3dInstance as unknown as FlyCapableMap;
    map.flyCameraTo?.({
      endCamera: {
        center: { lat: homeLat, lng: homeLng, altitude: 0 },
        range: SUMMARY_RANGE,
        tilt: SUMMARY_TILT,
        heading: 0,
      },
      durationMillis: SUMMARY_FLY_MS,
    });
  }, [isOutroBeat, cameraMode, map3dInstance, homeLat, homeLng]);

  // cameraMode styres nå av BoardMap (felles BoardMapControls). Vi speiler den i
  // en ref så drag-lytteren kan lese gjeldende modus uten å re-subscribe.
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  // Intro-flythrough-en eier kameraet → drag skal ikke kapre det midt i
  // innflyvningen (ellers kjemper bruker-drag mot den frame-drevne flyturen).
  const introActiveRef = useRef(introActive);
  introActiveRef.current = introActive;

  // Interaksjons-lyttere: drag/scroll/touch på kart-bakgrunnen → fri modus. I
  // freeMode hijacker ikke MapView3D pekeren, så vi lytter direkte. Marker-tap er
  // content-interaksjon (åpner POI), ikke kamera-grep — derfor filtreres de ut.
  // Programmatiske fly/orbit trigger ikke disse — kun ekte bruker-input.
  useEffect(() => {
    if (!map3dInstance) return;
    const el = map3dInstance as unknown as HTMLElement;
    const onGrab = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("gmp-marker-3d-interactive")) return;
      // Under intro-flythrough eier innflyvningen kameraet — ikke kapre det.
      if (introActiveRef.current) return;
      // Kun implisitt takeover (auto → fri) varsler BoardMap, som setter fri-modus
      // + viser recovery-hinten.
      if (cameraModeRef.current === "auto") {
        onDragTakeover();
      }
    };
    el.addEventListener("pointerdown", onGrab);
    el.addEventListener("wheel", onGrab, { passive: true });
    el.addEventListener("touchstart", onGrab, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onGrab);
      el.removeEventListener("wheel", onGrab);
      el.removeEventListener("touchstart", onGrab);
    };
  }, [map3dInstance, onDragTakeover]);

  return (
    <div className="absolute inset-0">
      <MapView3D
        mapId="board-3d-map"
        center={initialCenter}
        cameraLock={cameraLock}
        freeMode
        pois={markerPOIs}
        revealItems={revealItems}
        showReveal={showReveal}
        animateReveal={!reducedMotion}
        onPOIClick={handlePOIClick}
        onMapReady={handleMapReady}
        activated
        projectSite={{
          lat: data.home.coordinates.lat,
          lng: data.home.coordinates.lng,
          name: data.home.name,
          imageSrc: getProjectPinThumbnail(data.projectSlug, data.assets),
        }}
      />
      <RouteLayer3D map3d={map3dInstance} routeData={routeData} />
      <CameraCutOverlay
        visible={cutVisible}
        // Kategorier bruker sin egen label; Nabolaget/Oppsummert har ingen
        // activeCategory, men skal også få kapittel-tekst på cream-cuten —
        // speiler reels-kortenes labels. Farge faller tilbake til nøytral.
        label={
          activeCategory?.label ??
          (isHomeBeat ? "Nabolaget" : isOutroBeat ? "Oppsummert" : undefined)
        }
        color={activeCategory?.color}
      />
      {/* Auto/Fri + Kart/3D-kontrollene bor nå i den felles BoardMapControls
          (rendret av BoardMap, sentrert nederst-midt). Drag-takeover-lytteren
          over varsler BoardMap via onDragTakeover. */}
      {popupMode === "mini" && state.activePOIId && (
        <BoardPOI3DMiniPopup map3d={map3dInstance} />
      )}
      {authorMode && (
        <CameraWaypointAuthor
          map3dInstance={map3dInstance}
          activeCategoryId={activeCategory?.id ?? null}
          className="absolute bottom-3 left-3 z-20"
        />
      )}
    </div>
  );
}
