"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView3D, type Map3DInstance } from "@/components/map/map-view-3d";
import { useRouteData } from "@/lib/map/use-route-data";
import { DEFAULT_CAMERA_LOCK } from "@/components/variants/report/blocks/report-3d-config";
import { useBoard, useActiveCategory, useActivePOI } from "./board-state";
import { useBoardPopupMode } from "./use-popup-mode";
import { BoardPOI3DMiniPopup } from "./BoardPOI3DMiniPopup";
import { CameraModeToggle, type CameraMode } from "./CameraModeToggle";
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
   * sentrerer på prosjektet (se composeFixedHero) for stabil orbit. Prosjektet
   * lander i skjerm-senter, godt til høyre for sidebaren.
   */
  mapPaddingLeft?: number;
}

/** Et 3D-kamera klart for flyCameraTo. */
interface HeroCamera {
  center: { lat: number; lng: number; altitude: number };
  range: number;
  tilt: number;
  heading: number;
}

type FlyCapableMap = {
  flyCameraTo?: (opts: { endCamera: HeroCamera; durationMillis: number }) => void;
  /** Native Google Maps 3D drone-orbit: sirkler rundt camera.center, én
   *  revolusjon per `durationMillis`, gjentatt `repeatCount` ganger (Infinity =
   *  evig, sømløst loopet internt av Google). GPU-drevet og smooth. */
  flyCameraAround?: (opts: {
    camera: HeroCamera;
    durationMillis: number;
    repeatCount?: number;
  }) => void;
  /** Stopper enhver pågående fly/orbit-animasjon umiddelbart. */
  stopCameraAnimation?: () => void;
};

/** Fly-varighet ved POI-åpning / fly-back (ms). */
const POI_FLY_MS = 900;

// ── Drone-orbit ───────────────────────────────────────────────────────────
// Kameraet sirkler rolig rundt prosjektet på FAST avstand (som et helikopter),
// så scenen alltid lever. Det er ÉN kontinuerlig orbit: den re-aimes IKKE ved
// kategori-skifte (en ny vinkel per kategori bygger ikke oversikt — den
// desorienterer). Kategori-skifte bytter kun hvilke markører som vises; kameraet
// bare fortsetter å gå rundt. Bruker Googles native `flyCameraAround` (GPU-drevet
// og smooth — IKKE en rAF/flyCameraTo-loop, som denne kodebasen vet hakker).
/** FAST avstand (meter) fra prosjektet under orbit. Kameraet zoomer ALDRI ut for
 *  å ramme alle POI-er — en kategori spredt over byen ville da havne i orbit-
 *  høyde der man ikke relaterer til innholdet. I stedet står dronen på fast
 *  avstand. Juster for å komme nærmere/lengre fra bygget. */
const ORBIT_RANGE = 650;
/** Tilt under orbit (grader; høyere = mer skrått/dramatisk). */
const ORBIT_TILT = 60;
/** Start-heading for orbiten (grader, 0 = nord). Orbiten går 360°, så dette er
 *  bare hvor revolusjonen begynner — ikke en meningsbærende «retning». */
const ORBIT_HEADING = 0;
/** Varighet for én full revolusjon (ms). Høyere = roligere orbit. Orbiten
 *  looper evig (repeatCount: Infinity) til den stoppes. */
const ORBIT_ROUND_MS = 90000;
/** Varighet på inn-flyet til orbit-hero før orbiten (gjen)starter (ms). Brukt
 *  ved mount, ved POI-lukking, og når brukeren gir kontrollen tilbake til auto. */
const REAIM_FLY_MS = 1600;

/** Range ved åpnet POI. */
const POI_RANGE = 300;
/** Tilt ved åpnet POI — tett og skrått. */
const POI_TILT = 60;

/** Bearing (grader, 0 = nord) fra punkt A mot punkt B. */
function bearingBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Komponerer et hero-kamera på FAST avstand fra et senterpunkt (prosjektet).
 *
 * I motsetning til en fitBounds-sweep (som zoomer langt ut når en kategori er
 * spredt over hele byen) står kameraet alltid `range` meter fra `center` og
 * endrer kun heading/tilt. Det holder bygget i fokus på en avstand der man
 * faktisk relaterer til innholdet — brukeren kan zoome/panne fritt derfra.
 *
 * Senteret er prosjektet selv — IKKE sidebar-forskjøvet. Drone-orbiten sirkler
 * rundt camera.center, så center må være bygget for at det skal stå stabilt i
 * bildet mens kameraet går rundt. (En sidebar-forskyvning ville plassert bygget
 * utenfor orbit-senteret → bygget ville vandret i en sirkel under orbiten.) Med
 * venstre-sidebar lander prosjektet i skjerm-senter, godt til høyre for baren.
 */
function composeFixedHero(opts: {
  center: { lat: number; lng: number };
  range: number;
  tilt: number;
  heading: number;
}): HeroCamera {
  const { center, range, tilt, heading } = opts;
  return {
    center: { lat: center.lat, lng: center.lng, altitude: 0 },
    range,
    tilt,
    heading,
  };
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

  // ── Kamera-director: drone-orbit + POI-fokus + auto/fri ─────────────────
  // Modellen: i auto-modus sirkler kameraet rolig rundt prosjektet på fast
  // avstand (flyCameraAround, repeatCount: Infinity). Kategori-skifte rører IKKE
  // kameraet — orbiten går uavbrutt videre, kun markørene byttes. Drar/zoomer
  // brukeren settes modus til «fri» og orbiten stopper (ingen auto-reset). Åpnet
  // POI stopper orbiten og flyr tett inn; lukking gjenopptar orbiten i auto-modus.
  // Markørene er statiske (full opacity) — ingen opacity-reveal, som ville churnet
  // Google 3D's SVG-rasterisering og eksplodert WebGL-kontekster.

  // Orbit-hero: fast avstand, fast start-heading. Avhenger KUN av prosjektets
  // koordinater — IKKE av aktiv kategori (derfor re-aimes orbiten aldri).
  const composeOrbitHero = useCallback(
    (): HeroCamera =>
      composeFixedHero({
        center: data.home.coordinates,
        range: ORBIT_RANGE,
        tilt: ORBIT_TILT,
        heading: ORBIT_HEADING,
      }),
    [data.home.coordinates],
  );

  const orbitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sann når orbiten SKAL gå (auto-modus + ingen POI åpen). Guarder den utsatte
  // startOrbit mot å fyre etter at brukeren har byttet til fri / åpnet en POI.
  const orbitDesiredRef = useRef(false);

  const clearCameraTimers = useCallback(() => {
    if (orbitTimerRef.current) {
      clearTimeout(orbitTimerRef.current);
      orbitTimerRef.current = null;
    }
  }, []);

  // Starter den kontinuerlige drone-orbiten. repeatCount: Infinity lar Google
  // loope internt → sømløst, ingen seam mellom revolusjoner. Stoppes med
  // stopCameraAnimation (ved fri-modus eller POI-fokus).
  const startOrbit = useCallback(() => {
    if (!orbitDesiredRef.current) return;
    const map = map3dInstance as unknown as FlyCapableMap | null;
    if (!map?.flyCameraAround) return;
    map.flyCameraAround({
      camera: composeOrbitHero(),
      durationMillis: ORBIT_ROUND_MS,
      repeatCount: Infinity,
    });
  }, [map3dInstance, composeOrbitHero]);

  // Flyr rolig inn til orbit-hero og starter så orbiten. Brukt ved mount, ved
  // POI-lukking og når brukeren gir kontrollen tilbake til auto. orbitTimerRef
  // holder kun inn-fly→orbit-overleveringen (orbiten selv looper i Google).
  const flyToHeroThenOrbit = useCallback(() => {
    const map = map3dInstance as unknown as FlyCapableMap | null;
    if (!map?.flyCameraTo) return;
    clearCameraTimers();
    orbitDesiredRef.current = true;
    map.stopCameraAnimation?.();
    map.flyCameraTo({ endCamera: composeOrbitHero(), durationMillis: REAIM_FLY_MS });
    orbitTimerRef.current = setTimeout(startOrbit, REAIM_FLY_MS);
  }, [map3dInstance, clearCameraTimers, startOrbit, composeOrbitHero]);

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

  // Director: reagerer på POI-skifte og modus-skifte — IKKE på kategori-skifte
  // (orbiten skal gå uavbrutt videre når man bytter kategori).
  // - POI åpen → stopp orbit, fly tett inn (range 300, tilt 60).
  // - Ingen POI + auto → fly inn til orbit-hero + start orbit.
  // - Ingen POI + fri → stopp animasjon, brukeren eier kameraet.
  useEffect(() => {
    if (!map3dInstance) return;
    const map = map3dInstance as unknown as FlyCapableMap;
    clearCameraTimers();

    if (activePOI) {
      orbitDesiredRef.current = false;
      map.stopCameraAnimation?.();
      const home = data.home.coordinates;
      map.flyCameraTo?.({
        endCamera: {
          center: {
            lat: activePOI.raw.coordinates.lat,
            lng: activePOI.raw.coordinates.lng,
            altitude: 0,
          },
          range: POI_RANGE,
          tilt: POI_TILT,
          heading: bearingBetween(home, activePOI.raw.coordinates),
        },
        durationMillis: POI_FLY_MS,
      });
      return;
    }

    if (cameraMode === "auto") {
      flyToHeroThenOrbit();
    } else {
      orbitDesiredRef.current = false;
      map.stopCameraAnimation?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, activePOI?.id, map3dInstance, flyToHeroThenOrbit]);

  // Rydd timere + stopp animasjon ved unmount.
  useEffect(() => {
    return () => {
      clearCameraTimers();
      const map = map3dInstance as unknown as FlyCapableMap | null;
      map?.stopCameraAnimation?.();
    };
  }, [map3dInstance, clearCameraTimers]);

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
