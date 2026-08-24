"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView3D, type Map3DInstance } from "@/components/map/map-view-3d";
import { useBoardRoute } from "./board-route";
import { DEFAULT_CAMERA_LOCK, type PendingCamera } from "@/components/map/motor-camera";
import { useBoard, useActiveCategory, useActivePOI } from "./board-state";
import { useBoardPopupMode } from "./use-popup-mode";
import { BoardPOI3DMiniPopup } from "./BoardPOI3DMiniPopup";
import { BoardTravelChip3D } from "./BoardTravelChip3D";
import { type CameraMode } from "./BoardMapControls";
import { CameraCutOverlay } from "./CameraCutOverlay";
import { CameraWaypointAuthor } from "./CameraWaypointAuthor";
import { useBoard3DCamera } from "./use-board-3d-camera";
import { use3DViewportPublish } from "./use-3d-viewport-publish";
import { deriveCategoryCameraConfig } from "./board-category-camera";
import { readBoardUrlFlagsFromWindow } from "./board-url-flags";
import { getEstablishingShot } from "./board-establishing-shots";
import { useBoardMarkerSet } from "./use-board-marker-set";
import { watchOverheadDrift } from "./overhead-drift";
import { useMarker3DDeclutter } from "./use-3d-marker-declutter";
import {
  useBoardFlythrough,
  deriveIntroActive,
  type IntroFlyPhase,
} from "./board-flythrough-orchestrator";
import { getProjectPinThumbnail } from "@/lib/themes/project-brand";
import { useCurrentTrack, useAudioTourPhase } from "@/lib/stores/audio-tour-store";
import type { CategoryCameraConfig } from "@/lib/types";
import { useEngagement } from "@/lib/instrumentation/engagement-scope";

// RouteLayer3D lazy-loaded — samme bundling-strategi som ReportThemeSection
// (tunge Google Maps-imports holdes ute av 2D-bundlen).
const RouteLayer3D = dynamic(
  () =>
    import("@/components/map/route-layer-3d").then((mod) => ({
      default: mod.RouteLayer3D,
    })),
  { ssr: false },
);

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
  /** Når true: kategori-POI-ene rendres som kompakte farge-prikker (mobil
   *  story-mode-peek, sekundær flate) i stedet for fulle ikon-pins. Default false. */
  compactMarkers?: boolean;
  /**
   * Mobil nabolagsflate (R9/R12): publiser det ikke-okkluderte kartutsnittet
   * mens 3D er den FREMSTE motoren. Settes av `BoardMap` som
   * `publishViewport && view === "3d"` — i 2D-visning eier Mapbox kanalen og
   * denne instansen må tie, ellers ville to motorer skrevet samme state.
   * Default false. Se `use-3d-viewport-publish`.
   */
  publishViewport?: boolean;
  /**
   * 3D er den FREMSTE motoren. 3D-basen forblir montert under Mapbox-overlayet i
   * 2D-visning, så overlegg som finnes i begge motorer (tids-chipen) må vite
   * hvem som er synlig — ellers står to chips oppå hverandre. Default false.
   */
  isFront?: boolean;
  /** Høyden (px) sheeten dekker nederst. Brukes kun til viewport-publiseringen;
   *  den cinematiske kamera-føringen rammer inn på egne premisser. Default 0. */
  mapPaddingBottom?: number;
  /**
   * Gir `BoardMap` tilgang til den persistente 3D-instansen. Kalles med
   * instansen ved klar og `null` ved unmount. Finnes fordi Kart/3D-toggelen må
   * kunne LESE 3D-kameraet (og skrive det tilbake) for å bevare posisjonen
   * gjennom et motor-bytte.
   */
  onMapReady?: (map3d: Map3DInstance | null) => void;
  /**
   * Satelitt-modus (BoardMap: view === "sat"). Directoren produserer da kun
   * ovenfra-poser (tilt/heading 0) og eier kameraet også i fri kameramodus;
   * outro-uttrekket klampes; grab-takeoveren (auto→fri) undertrykkes — pan i
   * Satelitt skal ikke klobbe cameraMode (R8c/R8d). Default false.
   */
  overhead?: boolean;
  /**
   * Kalles når brukeren BRYTER ovenfra-posituren i Satelitt (to-finger-tilt /
   * ctrl-drag over terskelen, R8c): BoardMap flipper segmentet til «3D» + setter
   * fri kameramodus (speiler Auto→Fri-drag-takeoveren). Pan flipper aldri —
   * drift-vakten fyrer i det posituren faktisk brytes, ikke på grab.
   */
  onOverheadBreak?: () => void;
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
 *
 * Dekomponert (Unit 06.7): markørsett-seleksjon → `useBoardMarkerSet`,
 * flythrough-orkestrering → `useBoardFlythrough`. Denne filen orkestrerer dem
 * sammen og eier render-/interaksjons-skallet.
 */
export function BoardMap3D({
  pendingCamera,
  cameraMode,
  onDragTakeover,
  compactMarkers = false,
  publishViewport = false,
  isFront = false,
  mapPaddingBottom = 0,
  onMapReady,
  overhead = false,
  onOverheadBreak,
}: Props) {
  const { state, data, dispatch, subFilter } = useBoard();
  const engagement = useEngagement();
  const activeCategory = useActiveCategory();
  const activePOI = useActivePOI();
  const popupMode = useBoardPopupMode();

  // Rute for RouteLayer3D — samme delte kilde som rutelinja og chipen i 2D,
  // i aktiv reisemodus (BoardRouteProvider).
  const { data: routeData } = useBoardRoute();

  // Lokal state for map3d-instansen så RouteLayer3D rerenderer når den blir klar.
  const [map3dInstance, setMap3dInstance] = useState<Map3DInstance | null>(null);

  // URL-flagg-state lest ÉN gang ved mount (board-url-flags hjemler kontrakten:
  // hvilke flagg finnes + semantikk — AC1/AC6). Semantikk i korthet:
  //   ?author=1       → CameraWaypointAuthor-mount (dev-only kamera-autoring).
  //   ?film=1         → rent kart for capture: kategori-pins droppes på RENDER-nivå
  //                     (markerPOIs → [] i useBoardMarkerSet) — ALDRI via DOM-fjerning
  //                     (removeChild-race). projectSite-labelen er egen prop, upåvirket.
  //   ?fly=1          → live intro-flythrough; impliserer film-modus (pins skjult) +
  //                     'free' cameraMode (BoardMap.tsx, PRD 9 — én av to free-triggere).
  //   ?establishing=1 → multi-waypoint strøk-flythrough uten voice-over; blir
  //                     establishingMode kun hvis strøket har en bane (getEstablishingShot).
  const [{ authorMode, filmMode, flyMode, establishingFlag }] = useState(
    readBoardUrlFlagsFromWindow,
  );
  const establishingShot = useMemo(
    () =>
      establishingFlag ? getEstablishingShot(data.projectSlug ?? "") : undefined,
    [establishingFlag, data.projectSlug],
  );
  const establishingMode = !!establishingShot;

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
  // etablering av nærområdet. Selve flyturen kjøres av useBoardFlythrough.
  const isWelcomeBeat = currentTrack?.categoryId === "welcome";

  // Basic-tier (uten voice-over): «Utforsk nabolaget» setter board-state-flagget
  // introPlaying → den auto-genererte intro-flythrough-en spilles ÉN gang som
  // initial-tilstand. Ingen welcome-beat finnes å henge den på her (krever audio),
  // så dette er den tredje måten innflyvningen kan eie kameraet på (i tillegg til
  // welcome-beaten og ?fly=1-capture).
  const basicIntroActive = state.introPlaying;
  // Establishing-shot-modus AND-er bort welcome/basic-introen: når ?establishing=1
  // er på eier den multi-waypoint-flythrough-en kameraet alene (egen effekt i
  // useBoardFlythrough), så vi unngår at to animatorer kjemper om kamera-posituren.
  const introActive = deriveIntroActive({
    flyMode,
    isWelcomeBeat,
    basicIntroActive,
    establishingMode,
  });

  // Basic-intro flythrough-fase, satt fra flyturens onPhase (via useBoardFlythrough).
  // Styrer markør-koreografien (basic-tier, uten voice-over):
  //   "idle"     → ved load / før klikk: INGEN markører på kartet (rent).
  //   "settling" → kamera holder vid positur mens tiles streamer: fortsatt rent.
  //   "running"  → kamera flyr inn: reveal-kaskaden starter (markører tegnes inn
  //                PARALLELT med flyturen, ~0,9s etter at bevegelsen begynner).
  //   "done"     → landet: kaskaden ferdig, faller til statiske oversiktspins.
  // Eies her (parent) så markørsett-seleksjonen kan lese den FØR flythrough-hooken
  // (som setter den) registrerer effektene sine.
  const [introFlyPhase, setIntroFlyPhase] = useState<IntroFlyPhase>("idle");

  // Establishing-shot reveal-gate: flippes true når flythrough-en passerer
  // bloomAtProgress (kameraet stiger over platået) → reveal-kaskaden (blobs + pins)
  // fyrer da, ikke under de vide etablerings-beatene (rent fjord-blikk i åpningen).
  const [bloomStarted, setBloomStarted] = useState(false);

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

  // ── Markørsett-seleksjon ──────────────────────────────────────────────────
  // Hvilke POI-er som mountes (markerPOIs), reveal-kaskaden (revealItems/window),
  // og de avledede signalene hasVoiceOver (data-drevet, IKKE tier — PRD 6 §9 #5)
  // + orbitRange. hasVoiceOver styrer BÅDE markørsettet OG autoOrbit nedenfor.
  const { markerPOIs, revealItems, revealWindowMs, hasVoiceOver, orbitRange } =
    useBoardMarkerSet({
      data,
      statePhase: state.phase,
      hiddenIds: subFilter.hiddenIds,
      activeCategory,
      filmMode,
      flyMode,
      establishingMode,
      establishingShot,
      isWelcomeBeat,
      isHomeBeat,
      isOutroBeat,
      basicIntroActive,
    });

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
      (!hasVoiceOver && basicIntroActive && introFlyPhase === "running") ||
      (establishingMode && bloomStarted)) &&
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
  // motor-camera (range=900, tilt=45).
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

  const handleMapReady = useCallback(
    (m: Map3DInstance | null) => {
      setMap3dInstance(m);
      onMapReady?.(m);
    },
    [onMapReady],
  );

  // Viewport-publisering (mobil nabolagsflate, R9/R12). Gated på at 3D er den
  // fremste motoren — se propen. Alt nedstrøms er delt med 2D-stien.
  use3DViewportPublish({
    map3d: map3dInstance,
    enabled: publishViewport,
    occludedBottomPx: mapPaddingBottom,
  });

  // Stabil click-handler — sitter i Marker3DItems memo-props, så en fersk inline
  // arrow per render ville defeate memo for HVER markør. useCallback bevarer
  // referansen så memo holder (S1).
  const handlePOIClick = useCallback(
    (poiId: string) => {
      for (const cat of data.categories) {
        const found = cat.pois.find((p) => p.id === poiId);
        if (found) {
          // Ingen `categoryId` i actionen: markørklikk skal ikke kapre
          // kategorien (2026-08-13). Kategori-oppslaget beholdes fordi
          // analytics-signalet fortsatt bærer `category_id`.
          dispatch({ type: "OPEN_POI", id: found.id });
          engagement.emit("poi_clicked", {
            poiId: found.id,
            payload: { category_id: cat.id },
          });
          return;
        }
      }
    },
    [data.categories, dispatch, engagement],
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
  // Forrangs-logikken bor som ren funksjon (deriveCategoryCameraConfig, Unit 4 AC1)
  // — PRD 10 komponerer PRD 6-mekanismen + PRD 9-DATAen, re-hjemler ingen (AC3).
  const categoryConfig = useMemo<CategoryCameraConfig | undefined>(
    () =>
      deriveCategoryCameraConfig(
        activeCategory,
        data.projectSlug ?? "",
        data.home.coordinates,
      ),
    [activeCategory, data.projectSlug, data.home.coordinates],
  );

  // ── Kamera-director ─────────────────────────────────────────────────────
  // Drone-orbit + POI-fokus + (kommende) cinematic A→B, styrt av en eksplisitt
  // state-maskin med token-kansellering (use-board-3d-camera). Kategori-skifte
  // uten waypoints rører IKKE kameraet (orbiten går uavbrutt videre). Markørene
  // er statiske (full opacity) — ingen opacity-reveal (WebGL-kontekst-churn).
  // Drift-flippen (gesten som bryter ovenfra-posituren og flipper segmentet til
  // 3D) setter denne FØR view-byttet: sat→3d-overgangen i directoren skal da
  // ikke fly kameraet til skrå — brukerens gest eier alt posituren.
  const skipSkraaReentryRef = useRef(false);

  const { cutVisible } = useBoard3DCamera({
    map3dInstance,
    cameraMode,
    introActive: introActive || establishingMode,
    home: data.home.coordinates,
    activePOI: activePOICoords,
    activeCategoryId: activeCategory?.id ?? null,
    categoryConfig,
    audioDurationMs,
    audioPaused,
    reducedMotion,
    overhead,
    outroActive: isOutroBeat,
    skipSkraaReentryRef,
    orbitRange,
    // Basic-tier (uten voice-over): ingen idle-orbit. Etter intro-flythrough-en
    // HOLDER kameraet der flyturen landet i stedet for å re-aime til orbit-
    // vinkelen. Voice-over-prosjekter beholder drone-orbiten. Samme hasVoiceOver-
    // signal som styrer markørsettet over (data-drevet, ikke tier).
    autoOrbit: hasVoiceOver,
  });

  // ── Flythrough-orkestrering ───────────────────────────────────────────────
  // Intro-flythrough (velkommen-beat + ?fly=1 + basic-intro), establishing-shot
  // (?establishing=1), og oppsummerings-uttrekket (outro). Registreres ETTER
  // useBoard3DCamera så outroens imperative fly kjører i commit-en der director-en
  // har stoppet orbiten. Setter introFlyPhase/bloomStarted (eies av denne filen)
  // som showReveal/markørsettet leser.
  useBoardFlythrough({
    map3dInstance,
    introActive,
    basicIntroActive,
    isWelcomeBeat,
    flyMode,
    establishingMode,
    establishingShot,
    isOutroBeat,
    cameraMode,
    overhead,
    orbitRange,
    reducedMotion,
    audioDurationMs,
    audioPaused,
    projectSlug: data.projectSlug,
    home: data.home.coordinates,
    dispatch,
    setIntroFlyPhase,
    setBloomStarted,
  });

  // ── Markør-utglisning + labels ────────────────────────────────────────────
  // 3D-halvdelen av 2D-kartets zoom-baserte markør-logikk: hvilke pins som
  // beholder ikonet når de krasjer i hverandre, og hvilke som får navnet sitt
  // tegnet ved siden av seg. Regnes når kameraet faller til ro — se hooken.
  // Av under compact-markører (alt er allerede prikker) og når markørsettet er
  // tomt (capture/intro eier kartet da).
  const declutter = useMarker3DDeclutter({
    map3d: map3dInstance,
    pois: markerPOIs,
    home: data.home.coordinates,
    homeName: data.home.name,
    activePOIId: state.activePOIId,
    // Mini-popupen viser navnet — da skal ikke pinnen vise det også.
    suppressActiveLabel: popupMode === "mini",
    enabled: !compactMarkers && markerPOIs.length > 0,
  });

  // cameraMode styres nå av BoardMap (felles BoardMapControls). Vi speiler den i
  // en ref så drag-lytteren kan lese gjeldende modus uten å re-subscribe.
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  // Samme ref-speiling for Satelitt-modus (drag-lytteren skiller sat fra 3d).
  const overheadRef = useRef(overhead);
  overheadRef.current = overhead;
  // Intro-flythrough-en eier kameraet → drag skal ikke kapre det midt i
  // innflyvningen (ellers kjemper bruker-drag mot den frame-drevne flyturen).
  const introActiveRef = useRef(introActive);
  introActiveRef.current = introActive || establishingMode;

  // Interaksjons-lyttere: drag/scroll/touch på kart-bakgrunnen → fri modus. I
  // freeMode hijacker ikke MapView3D pekeren, så vi lytter direkte. Marker-tap er
  // content-interaksjon (åpner POI), ikke kamera-grep — derfor filtreres de ut.
  // Programmatiske fly/orbit trigger ikke disse — kun ekte bruker-input.
  const onOverheadBreakRef = useRef(onOverheadBreak);
  onOverheadBreakRef.current = onOverheadBreak;

  useEffect(() => {
    if (!map3dInstance) return;
    const el = map3dInstance as unknown as HTMLElement;

    // Drift-vakt-tilstand for Satelitt (R8c): startes på pointer-grab, stoppes
    // ved brudd eller kort etter pointerup (liten grace for gest-inertia).
    let stopDriftWatch: (() => void) | null = null;
    let releaseTimer: ReturnType<typeof setTimeout> | null = null;
    const endDriftWatch = () => {
      stopDriftWatch?.();
      stopDriftWatch = null;
    };

    const onGrab = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("gmp-marker-3d-interactive")) return;
      // Under intro-flythrough eier innflyvningen kameraet — ikke kapre det.
      if (introActiveRef.current) return;
      // Satelitt: pan er en fullverdig gest som IKKE skal klobbe cameraMode
      // (grab-takeoveren undertrykkes — ellers ville én pan satt fri-modus på
      // VO-boards, og retur til 3D gjenopprettet feil modus, R8d). I stedet
      // observeres faktisk tilt-/heading-drift: brytes ovenfra-posituren over
      // terskelen, flipper segmentet til «3D» i det bruddet skjer (R8c).
      if (overheadRef.current) {
        if (e.type !== "pointerdown" && e.type !== "touchstart") return; // wheel = zoom, tilter aldri
        endDriftWatch();
        if (releaseTimer) clearTimeout(releaseTimer);
        stopDriftWatch = watchOverheadDrift(
          map3dInstance as { tilt?: number; heading?: number },
          () => {
            stopDriftWatch = null;
            // Gesten eier posituren: sat→3d-overgangen i directoren skal ikke
            // fly kameraet til skrå oppå brukerens pågående bevegelse.
            skipSkraaReentryRef.current = true;
            onOverheadBreakRef.current?.();
          },
        );
        return;
      }
      // Kun implisitt takeover (auto → fri) varsler BoardMap, som setter fri-modus
      // + viser recovery-hinten.
      if (cameraModeRef.current === "auto") {
        onDragTakeover();
      }
    };
    const onRelease = () => {
      if (!stopDriftWatch) return;
      // Grace: Google easer gesten ferdig etter slipp — la vakten se inertia-halen.
      if (releaseTimer) clearTimeout(releaseTimer);
      releaseTimer = setTimeout(endDriftWatch, 600);
    };
    el.addEventListener("pointerdown", onGrab);
    el.addEventListener("wheel", onGrab, { passive: true });
    el.addEventListener("touchstart", onGrab, { passive: true });
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    return () => {
      el.removeEventListener("pointerdown", onGrab);
      el.removeEventListener("wheel", onGrab);
      el.removeEventListener("touchstart", onGrab);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      if (releaseTimer) clearTimeout(releaseTimer);
      endDriftWatch();
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
        compactMarkers={compactMarkers}
        markerLabels={declutter.labels}
        demotedMarkerIds={declutter.demotedIds}
        revealItems={revealItems}
        showReveal={showReveal}
        animateReveal={!reducedMotion}
        revealWindowMs={revealWindowMs}
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
      {/* Tids-chipen. Lå tidligere som en inline-SVG inne i RouteLayer3D, men
          `Marker3DInteractiveElement` kan ikke bære et utvidbart panel — se
          BoardTravelChip3D. Rendres bare når 3D er den fremste motoren, ellers
          ville begge motorenes chip stått samtidig. */}
      {isFront && <BoardTravelChip3D map3d={map3dInstance} />}
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
