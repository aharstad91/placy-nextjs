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
import { deriveCategoryCamera } from "./board-3d-camera-director";
import { getCategoryCamera } from "./camera-tours";
import { getBoardModel } from "./board-models";
import { getBoardIntro } from "./board-intros";
import {
  runIntroFlythrough,
  MIN_INTRO_FLY_MS,
  DEFAULT_INTRO_PATH,
  type CameraDrivableMap3D,
} from "./board-intro-flythrough";
import { getProjectPinThumbnail } from "@/lib/themes/project-brand";
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

// ModelLayer3D lazy-loaded — samme bundling-strategi som RouteLayer3D.
const ModelLayer3D = dynamic(
  () =>
    import("@/components/map/model-layer-3d").then((mod) => ({
      default: mod.ModelLayer3D,
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

  // 3D-bygningsmodell for prosjektet (prototype-lokal config, mirror
  // camera-tours). Ukjent slug → null (kart uten modell, graceful).
  const boardModel = useMemo(
    () => getBoardModel(data.projectSlug ?? "") ?? null,
    [data.projectSlug],
  );

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
  // (projectSite) + 3D-modellen er egne props og påvirkes ikke.
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
  const introActive = flyMode || isWelcomeBeat;

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
  // Kategoriene er disjunkte, så ingen duplikater.
  const overviewPOIs = useMemo(
    () =>
      hasVoiceOver
        ? data.categories.flatMap((c) => c.topRankedPois.slice(0, 3).map((p) => p.raw))
        : data.categories.flatMap((c) => c.pois.map((p) => p.raw)),
    [data.categories, hasVoiceOver],
  );

  // Markørsettet som faktisk mountes. Når en kategori spiller: kun den
  // kategoriens POI-er (sub-filtrert). Ellers: det kuraterte ankersettet.
  const markerPOIs = useMemo<POI[]>(() => {
    // Ren etablering: ingen kategori-pins under intro-flythrough (velkommen-beat
    // / ?fly=1) eller ?film=1-capture — kun nærområdet (se filmMode-kommentar).
    if (filmMode || introActive) return [];
    if (activeCategory) {
      const useFilter = state.phase !== "default" && subFilter.hiddenIds.size > 0;
      const result: POI[] = [];
      for (const p of activeCategory.pois) {
        if (useFilter && subFilter.hiddenIds.has(p.raw.category.id)) continue;
        result.push(p.raw);
      }
      return result;
    }
    return overviewPOIs;
  }, [filmMode, introActive, activeCategory, state.phase, subFilter.hiddenIds, overviewPOIs]);

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
    // Velkommen-beaten (ikke capture) skalerer flyturen til VO-en; capture bruker
    // default-varigheten fra DEFAULT_INTRO_PATH.
    const settleMs = introPath.settleMs ?? DEFAULT_INTRO_PATH.settleMs;
    const flyDurationMs =
      isWelcomeBeat && !flyMode && audioDurationMs
        ? Math.max(MIN_INTRO_FLY_MS, audioDurationMs - settleMs)
        : undefined;
    return runIntroFlythrough(map, {
      target: { lat: homeLat, lng: homeLng },
      path: { ...introPath, ...(flyDurationMs ? { durationMs: flyDurationMs } : {}) },
      // Redusert bevegelse gjelder kun produkt-beaten; capture skal alltid fly.
      staticOnly: isWelcomeBeat && !flyMode && reducedMotion,
      isPaused: () => audioPausedRef.current,
      onPhase: (phase) => {
        (window as unknown as { __placyIntroFly?: string }).__placyIntroFly = phase;
      },
    });
  }, [
    introActive,
    isWelcomeBeat,
    flyMode,
    map3dInstance,
    homeLat,
    homeLng,
    introPath,
    audioDurationMs,
    reducedMotion,
  ]);

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
        activePOIId={activePOI?.id ?? null}
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
      <ModelLayer3D
        map3d={map3dInstance}
        model={boardModel}
        fallbackPosition={data.home.coordinates}
      />
      <CameraCutOverlay
        visible={cutVisible}
        label={activeCategory?.label}
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
