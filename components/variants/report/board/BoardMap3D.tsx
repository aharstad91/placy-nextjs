"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapView3D, type Map3DInstance } from "@/components/map/map-view-3d";
import { useRouteData } from "@/lib/map/use-route-data";
import { DEFAULT_CAMERA_LOCK } from "@/components/variants/report/blocks/report-3d-config";
import { useBoard, useActiveCategory, useActivePOI } from "./board-state";
import { useBoardPopupMode } from "./use-popup-mode";
import { BoardPOI3DMiniPopup } from "./BoardPOI3DMiniPopup";
import { CameraModeToggle, type CameraMode } from "./CameraModeToggle";
import { CameraCutOverlay } from "./CameraCutOverlay";
import { useBoard3DCamera } from "./use-board-3d-camera";
import { useCurrentTrack, useAudioTourPhase } from "@/lib/stores/audio-tour-store";
import type { POI } from "@/lib/types";
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
}

/**
 * 3D-modus av board-kartet — VARIANT B (cinematic drone-orbit).
 *
 * - Bruker `MapView3D` fra components/map (Google Photorealistic 3D Tiles).
 * - Kameraet sirkler rolig rundt prosjektet på FAST avstand (drone/helikopter),
 *   så scenen alltid lever. Det er ÉN kontinuerlig orbit — den re-aimes IKKE ved
 *   kategori-skifte (det bytter bare hvilke markører som vises). Kameraet zoomer
 *   ALDRI ut for å ramme alle pins.
 * - To kamera-moduser, styrt av `CameraModeToggle` (auto ⇄ fri):
 *     • auto → kontinuerlig drone-orbit.
 *     • fri  → orbiten stopper, brukeren styrer vinkelen selv.
 *   Drar/zoomer brukeren i kartet settes modus til «fri» automatisk (ingen
 *   auto-reset etter X sekunder — brukeren gir kontrollen tilbake med ett klikk).
 * - Åpnet POI stopper orbiten og flyr tett inn; lukking gjenopptar orbiten hvis
 *   modus er auto, ellers blir kameraet stående (fri modus eier vinkelen).
 * - Markørene monteres på full opacity (ingen opacity-reveal — den churnet
 *   Google 3D's SVG-rasterisering og eksploderte WebGL-kontekster).
 * - Kun de relevante markørene mountes: aktiv kategoris POI-er under avspilling,
 *   et kuratert top-3/kategori-ankersett i oversikt.
 * - Tegner walking-rute fra Home → aktiv POI via `RouteLayer3D`.
 */
export function BoardMap3D({ pendingCamera }: Props) {
  const { state, data, dispatch, subFilter } = useBoard();
  const activeCategory = useActiveCategory();
  const activePOI = useActivePOI();
  const popupMode = useBoardPopupMode();

  // Walking-rute for RouteLayer3D — samme hook som BoardPathLayer (2D).
  const poiForRoute = state.phase === "poi" && activePOI ? activePOI.raw : null;
  const { data: routeData } = useRouteData(poiForRoute, data.home.coordinates);

  // Lokal state for map3d-instansen så RouteLayer3D rerenderer når den blir klar.
  const [map3dInstance, setMap3dInstance] = useState<Map3DInstance | null>(null);

  // Kameramodus: auto (drone-orbit) eller fri (brukeren styrer). Default auto.
  const [cameraMode, setCameraMode] = useState<CameraMode>("auto");

  // Narrativ-synk-kilder (begge stabile — endrer kun ved track-/fase-skifte,
  // IKKE ~4 Hz som useAudioElement; holder marker-treet utenfor re-render-flommen).
  const currentTrack = useCurrentTrack();
  const audioPhase = useAudioTourPhase();
  const audioDurationMs =
    currentTrack?.durationSec != null
      ? Math.round(currentTrack.durationSec * 1000)
      : undefined;
  const audioPaused = audioPhase === "paused";

  // prefers-reduced-motion: statisk hold på A i stedet for A→B-drift (KD-10).
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Oversikts-ankersett: top-3 score-rangerte POI-er per kategori (~18–21 stk).
  // Brukes når ingen kategori spiller (intro/home/outro/megler). Score-rangert
  // via topRankedPois, IKKE distanse-sortert.
  const overviewPOIs = useMemo(
    () => data.categories.flatMap((c) => c.topRankedPois.slice(0, 3).map((p) => p.raw)),
    [data.categories],
  );

  // Markørsettet som faktisk mountes. Når en kategori spiller: kun den
  // kategoriens POI-er (sub-filtrert). Ellers: det kuraterte ankersettet.
  const markerPOIs = useMemo<POI[]>(() => {
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
  }, [activeCategory, state.phase, subFilter.hiddenIds, overviewPOIs]);

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

  // ── Kamera-director ─────────────────────────────────────────────────────
  // Drone-orbit + POI-fokus + (kommende) cinematic A→B, styrt av en eksplisitt
  // state-maskin med token-kansellering (use-board-3d-camera). Kategori-skifte
  // uten waypoints rører IKKE kameraet (orbiten går uavbrutt videre). Markørene
  // er statiske (full opacity) — ingen opacity-reveal (WebGL-kontekst-churn).
  const { cutVisible } = useBoard3DCamera({
    map3dInstance,
    cameraMode,
    home: data.home.coordinates,
    activePOI: activePOICoords,
    projectSlug: data.projectSlug,
    activeCategoryId: activeCategory?.id ?? null,
    audioDurationMs,
    audioPaused,
    reducedMotion,
  });

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
      setCameraMode((m) => (m === "auto" ? "free" : m));
    };
    el.addEventListener("pointerdown", onGrab);
    el.addEventListener("wheel", onGrab, { passive: true });
    el.addEventListener("touchstart", onGrab, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onGrab);
      el.removeEventListener("wheel", onGrab);
      el.removeEventListener("touchstart", onGrab);
    };
  }, [map3dInstance]);

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
        }}
      />
      <RouteLayer3D map3d={map3dInstance} routeData={routeData} />
      <CameraCutOverlay
        visible={cutVisible}
        label={activeCategory?.label}
        color={activeCategory?.color}
      />
      <CameraModeToggle
        mode={cameraMode}
        onModeChange={setCameraMode}
        className="absolute left-3 top-3 z-10"
      />
      {popupMode === "mini" && state.activePOIId && (
        <BoardPOI3DMiniPopup map3d={map3dInstance} />
      )}
    </div>
  );
}
