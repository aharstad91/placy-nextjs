"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView3D, type Map3DInstance } from "@/components/map/map-view-3d";
import { useBoardRoute } from "./board-route";
import {
  DEFAULT_CAMERA_LOCK,
  type PendingCamera,
} from "@/components/map/motor-camera";
import { useBoard, useActiveCategory, useActivePOI } from "./board-state";
import { useStoryTourOptional } from "./story/story-tour";
import {
  STORY_EMPHASIS_OPACITY,
  STORY_EMPHASIS_PIN_SCALE,
} from "./story/story-model";
import { useBoardPopupMode } from "./use-popup-mode";
import { BoardPOI3DMiniPopup } from "./BoardPOI3DMiniPopup";
import { BoardTravelChip3D } from "./BoardTravelChip3D";
import { type CameraMode } from "./BoardMapControls";
import { CameraCutOverlay } from "./CameraCutOverlay";
import { CameraWaypointAuthor } from "./CameraWaypointAuthor";
import { useBoard3DCamera } from "./use-board-3d-camera";
import type { FlyCapableMap } from "./board-3d-camera-director";
import { use3DViewportPublish } from "./use-3d-viewport-publish";
import { useMapPinClick } from "./use-map-pin-click";
import {
  DEFAULT_FOV_DEG,
  deriveFocusCamera3D,
  rectFromCamera,
} from "./board-camera-fit";
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
import { isMarker3DTarget } from "@/components/map/marker-3d-selectors";
import {
  useCurrentTrack,
  useAudioTourPhase,
} from "@/lib/stores/audio-tour-store";
import type { CategoryCameraConfig } from "@/lib/types";
import type { MapCameraApi } from "@/lib/board/board-types";

/**
 * Kamera-feltene vi LESER av Map3DElement. Alt er nullable: Google deriverer dem,
 * og de kan mangle før første scene er rendret. Samme minimale flate
 * `use-3d-viewport-publish` leser — de to må se samme kamera.
 */
interface Map3DPoseLike {
  center?: { lat: number; lng: number } | null;
  heading?: number | null;
  range?: number | null;
  tilt?: number | null;
  fov?: number | null;
}

/** Panoreringen ved et trykk i en stedsrad. Samme varighet som 2D-stiens
 *  `holdFrame`-easeTo, så de to motorene beveger seg i samme tempo. «Rolig» er
 *  hele poenget: bevegelsen skal leses som at kartet følger deg, ikke som et
 *  hopp du må orientere deg etter på nytt. */
const PAN_MS = 900;

/** Innramming av markørsettet. Speiler 2D-stiens `fitToVisiblePois`. */
const FIT_MS = 800;
/** Innramming av et gitt sett steder (omvisningens stopp). Speiler
 *  `fitCoordinates` i 2D-stien. */
const FIT_COORDS_MS = 1100;

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
   * Sidekolonnens okkludering på venstre side i piksler.
   *
   * KAMERAET ignorerer den fortsatt: den cinematiske drone-orbiten sentrerer på
   * prosjektet (se board-3d-camera-director) for stabil orbit, og prosjektet
   * lander i skjerm-senter — godt til høyre for panelet.
   *
   * UTSNITTET gjør det ikke. Kartelementet dekker hele flaten på desktop, også
   * bak panelet (2026-08-27), så det publiserte rektangelet må trekke fra det
   * panelet skjuler — ellers lister nabolagsflaten steder ingen kan se.
   */
  mapPaddingLeft?: number;
  /**
   * Bredden (px) kart-elementet stikker ut TIL HØYRE for det synlige vinduet.
   *
   * Elementet strekkes forbi vindukanten for å få sikte­punktet i midten av det
   * SYNLIGE kartet (se kommentaren over `BoardMap3D`-monteringen i BoardMap).
   * Stripen er rendret, men ingen ser den — så alt som regner i elementets
   * piksler må trekke den fra. Default 0.
   */
  overhangRightPx?: number;
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
  mapPaddingLeft = 0,
  overhangRightPx = 0,
  onMapReady,
  overhead = false,
  onOverheadBreak,
}: Props) {
  const { state, data, dispatch, subFilter, setMapCamera } = useBoard();
  const activeCategory = useActiveCategory();
  const activePOI = useActivePOI();
  const popupMode = useBoardPopupMode();

  // Rute for RouteLayer3D — samme delte kilde som rutelinja og chipen i 2D,
  // i aktiv reisemodus (BoardRouteProvider).
  const { data: routeData } = useBoardRoute();

  // Lokal state for map3d-instansen så RouteLayer3D rerenderer når den blir klar.
  const [map3dInstance, setMap3dInstance] = useState<Map3DInstance | null>(
    null,
  );

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
      establishingFlag
        ? getEstablishingShot(data.projectSlug ?? "")
        : undefined,
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
  // Omvisningen (`board/story`) når den kjører. `Optional`-varianten fordi
  // BoardMap3D også monteres utenfor board-treet — der er den null og
  // markørsettet velges som før.
  const story = useStoryTourOptional();
  const storyStop = useMemo(
    () =>
      story?.on && story.stop
        ? { category: story.stop, activePoiId: state.activePOIId }
        : null,
    [story?.on, story?.stop, state.activePOIId],
  );
  const { markerPOIs, revealItems, revealWindowMs, hasVoiceOver, orbitRange } =
    useBoardMarkerSet({
      data,
      statePhase: state.phase,
      hiddenIds: subFilter.hiddenIds,
      activeCategory,
      storyStop,
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

  // ── Kamera-kanalen: den FREMSTE motoren eier den ────────────────────────────
  // `mapCamera` på BoardContext er ÉN slot, og den ble skrevet av Mapbox-stien
  // alene. I 3D-visning er Mapbox unmountet, så `mapRef.current` var null og hele
  // API-et en stille no-op: et trykk i en stedsrad flyttet ingenting på
  // Google-motoren, som er default på rapport-boards.
  //
  // Her registreres derfor 3D-halvdelen, gated på `isFront` slik at de to aldri
  // skriver samtidig.
  //
  // Innrammingen (`fitVisible`/`fitCoordinates`) sto lenge som eksplisitte
  // no-ops fordi `gmp-map-3d` ikke har noen `fitBounds`, og fordi den inversen
  // Mapbox får gratis — fra en ramme til en avstand — måtte regnes for hånd.
  // `deriveFocusCamera3D` er den utregningen, og den bruker NØYAKTIG samme
  // geometri som `rectFromCamera` leser utsnittet med. Innrammingen og
  // avlesningen er derfor én modell, ikke to som må holdes i takt.
  const paddingBottomRef = useRef(mapPaddingBottom);
  paddingBottomRef.current = mapPaddingBottom;
  const paddingLeftRef = useRef(mapPaddingLeft);
  paddingLeftRef.current = mapPaddingLeft;
  const overhangRightRef = useRef(overhangRightPx);
  overhangRightRef.current = overhangRightPx;
  const mapInstanceRef = useRef<Map3DInstance | null>(null);
  mapInstanceRef.current = map3dInstance;
  // Markørsettet og boligen bak samme ref-triks som 2D-stien bruker: `fitVisible`
  // rammer «det som står på kartet nå», og det endrer seg med hvert kategori- og
  // stoppbytte.
  const markerPOIsRef = useRef(markerPOIs);
  markerPOIsRef.current = markerPOIs;
  const homeRef = useRef(data.home.coordinates);
  homeRef.current = data.home.coordinates;

  /** Felles innramming for de to fit-metodene: regn posituren, og fly dit.
   *  Ligger utenfor `cameraApi` så begge kan dele den uten å bli ustabile. */
  const flyToFrame = useCallback(
    (points: readonly { lng: number; lat: number }[], durationMs: number) => {
      const map = mapInstanceRef.current as
        | (FlyCapableMap & Map3DPoseLike)
        | null;
      if (!map?.flyCameraTo) return;
      const el = map as unknown as HTMLElement;
      const box = el.getBoundingClientRect();
      // Boligen er alltid med, som i 2D-stien: uten den kollapser rammen til ett
      // punkt når settet er lite, og leseren mister forankringen til hvor hun bor.
      const camera = deriveFocusCamera3D({
        points: [...points, homeRef.current],
        viewport: {
          widthPx: box.width,
          heightPx: box.height,
          occludedBottomPx: paddingBottomRef.current,
          occludedLeftPx: paddingLeftRef.current,
          overhangRightPx: overhangRightRef.current,
        },
        fovDeg: map.fov ?? DEFAULT_FOV_DEG,
        // Rammen regnes i den retningen kameraet FAKTISK ser. Regnet vi den mot
        // nord ville en roterende drone-orbit fått stedene til å gli ut av
        // bildet i det innrammingen landet.
        headingDeg: map.heading ?? 0,
      });
      // null = degenerert flate (sheeten dekker alt, eller ingen punkter).
      // Kameraet skal da stå — en gjetning her er verre enn ingen bevegelse.
      if (!camera) return;
      map.flyCameraTo({
        endCamera: {
          center: { lat: camera.lat, lng: camera.lng, altitude: 0 },
          range: camera.rangeM,
          // Tilt og heading bæres videre: innrammingen er en RAMME, ikke en ny
          // positur. Bytter vi blikkvinkelen samtidig, leser det som at kartet
          // hoppet til et annet sted.
          tilt: map.tilt ?? 0,
          heading: map.heading ?? 0,
        },
        durationMillis: durationMs,
      });
    },
    [],
  );

  const cameraApi = useMemo<MapCameraApi>(
    () => ({
      snapshot: () => {
        const map = mapInstanceRef.current as Map3DPoseLike | null;
        const center = map?.center;
        const range = map?.range;
        // `> 0`: Google deriverer feltene, og rett etter en umiddelbar flytur er
        // `range` målt som 0 i en kort periode. En positur uten avstand er ikke
        // lest ennå — og et utsnitt vi ikke kan gjenopprette er verre enn ingen.
        if (!center || typeof range !== "number" || !(range > 0)) return null;
        return {
          engine: "3d" as const,
          lng: center.lng,
          lat: center.lat,
          rangeM: range,
          headingDeg: map?.heading ?? 0,
          tiltDeg: map?.tilt ?? 0,
        };
      },
      restore: (snapshot) => {
        // Utsnittet ble tatt på Mapbox-stien (motoren ble byttet mens
        // kategorisiden sto åpen). Tallene betyr noe annet der — se
        // `CameraSnapshot` — så kameraet skal stå.
        if (snapshot.engine !== "3d") return;
        const map = mapInstanceRef.current as
          | (FlyCapableMap & Map3DPoseLike)
          | null;
        if (!map?.flyCameraTo) return;
        // `durationMillis: 0`, ikke en animasjon: gjenopprettingen må være
        // SYNKRON av samme grunn som `jumpTo` er det i 2D-stien — nabolagslista
        // remonteres i neste commit og publiserer et utsnitt fra der kameraet
        // står. Leste den en halvferdig flytur, ble lista scopet til et utsnitt
        // brukeren aldri så.
        map.flyCameraTo({
          endCamera: {
            center: { lat: snapshot.lat, lng: snapshot.lng, altitude: 0 },
            range: snapshot.rangeM,
            tilt: snapshot.tiltDeg,
            heading: snapshot.headingDeg,
          },
          durationMillis: 0,
        });
      },
      fitVisible: () => {
        flyToFrame(
          markerPOIsRef.current.map((p) => p.coordinates),
          FIT_MS,
        );
      },
      fitCoordinates: (coords, opts) => {
        flyToFrame(coords, opts?.durationMs ?? FIT_COORDS_MS);
      },
      flyToPoint: (coord, opts) => {
        const map = mapInstanceRef.current as
          | (FlyCapableMap & Map3DPoseLike)
          | null;
        if (!map?.flyCameraTo) return;
        const center = map.center;
        const range = map.range;
        // `> 0` og ikke `!= null`: Google deriverer feltene, og etter en
        // umiddelbar flytur (durationMillis 0) er `range` målt som 0 i en kort
        // periode. En panorering med avstand 0 er ikke en bevegelse — den er en
        // ulest positur, og da skal kameraet stå.
        if (!center || typeof range !== "number" || !(range > 0)) return;
        // `holdFrame`: ingen endring i avstand, og ingen bevegelse i det hele
        // tatt hvis punktet alt ligger i det brukeren ser. Samme regel som
        // 2D-stien, men målt i geografi framfor i piksler — Google-motoren har
        // ingen `project()`.
        //
        // Rektangelet er ALT en underestimering av det synlige (`rectFromCamera`
        // regner ikke med tilt), så det trengs ingen egen margin: et punkt som
        // ligger så vidt utenfor det, ligger nær kanten av bildet — og skal
        // hentes inn.
        if (opts?.holdFrame) {
          const box = (map as unknown as HTMLElement).getBoundingClientRect();
          const rect = rectFromCamera(
            {
              lat: center.lat,
              lng: center.lng,
              rangeM: range,
              headingDeg: map.heading ?? 0,
              fovDeg: map.fov ?? DEFAULT_FOV_DEG,
            },
            {
              widthPx: box.width,
              heightPx: box.height,
              occludedBottomPx: paddingBottomRef.current,
              occludedLeftPx: paddingLeftRef.current,
              overhangRightPx: overhangRightRef.current,
            },
          );
          if (
            rect &&
            coord.lng >= rect.west &&
            coord.lng <= rect.east &&
            coord.lat >= rect.south &&
            coord.lat <= rect.north
          ) {
            return;
          }
        }
        // Bare SIKTEPUNKTET flyttes. Avstand, tilt og heading bæres videre, så
        // bevegelsen er en panorering og ikke en ny positur.
        map.flyCameraTo({
          endCamera: {
            center: { lat: coord.lat, lng: coord.lng, altitude: 0 },
            range,
            tilt: map.tilt ?? 0,
            heading: map.heading ?? 0,
          },
          durationMillis: opts?.durationMs ?? PAN_MS,
        });
      },
    }),
    [],
  );

  useEffect(() => {
    if (!isFront || !map3dInstance) return;
    setMapCamera(cameraApi);
    return () => setMapCamera(null);
  }, [isFront, map3dInstance, cameraApi, setMapCamera]);

  const handleMapReady = useCallback(
    (m: Map3DInstance | null) => {
      setMap3dInstance(m);
      onMapReady?.(m);
    },
    [onMapReady],
  );

  // Viewport-publisering (nabolagsflaten, R9/R12). Gated på at 3D er den
  // fremste motoren — se propen. Alt nedstrøms er delt med 2D-stien.
  //
  // Begge okklusjonene sendes inn: sheeten nedenfra på mobil, sidekolonnen fra
  // venstre på desktop. Kartelementet dekker hele flaten der, også bak panelet,
  // så uten venstre-leddet ville lista tatt med steder ingen kan se.
  use3DViewportPublish({
    map3d: map3dInstance,
    enabled: publishViewport,
    occludedBottomPx: mapPaddingBottom,
    occludedLeftPx: mapPaddingLeft,
    overhangRightPx,
  });

  // Trykk på en pinne: punkt + måling + flatens oppfølging, delt med 2D-stien.
  // Callbacken er referanse-stabil (S1) — se hooken.
  const handlePOIClick = useMapPinClick();

  // Klikk på kart-bakgrunn (ikke markør) → lukk POI-popup. Speiler 2D-mappens
  // onClick på <Map>. gmp-click fyrer for alle klikk i map-elementet inkludert
  // marker-klikk (bubbler), så vi filtrerer på e.target.closest for å unngå at
  // marker-klikk lukker popupen før den åpnes for ny POI.
  useEffect(() => {
    if (!map3dInstance) return;
    const el = map3dInstance as unknown as HTMLElement;
    const onMapClick = (e: Event) => {
      if (isMarker3DTarget(e.target)) return;
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
        ? {
            lat: activePOI.raw.coordinates.lat,
            lng: activePOI.raw.coordinates.lng,
          }
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
    // Omvisningen eier kameraet SÅ LENGE DEN KJØRER — også på områdestoppet
    // (2026-08-28). Directorens POI-intent rykker inn til 300 m og sentrerer
    // punktet; det er nøyaktig det et trykk i kartet IKKE skal gjøre, og et
    // trykk i en rad skal panorere rolig i stedet. Omvisningen gjør begge selv
    // (se `flyToPoint` over), så directoren må holde fingrene av kameraet.
    // Gaten sto på temastoppet alene, og på områdestoppet fløy den derfor.
    storyActive: !!story?.on,
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

  // Omvisningens tekstur: nabolaget rundt stoppet, tegnet svakere.
  //
  // Markørsettet under et stopp er stoppets kategori PLUSS oversikts-settet (se
  // `selectMarkerPOIs`), slik at ingen pinne forsvinner når du bytter stopp. De
  // som ikke er stoppets egne er kontekst, og dempes med samme tall Mapbox-
  // markøren bruker (`STORY_EMPHASIS_OPACITY.texture`) — samme ikon, samme
  // størrelse, samme navn, bare svakere. Det punktet du har ÅPNET er aldri
  // kontekst: popupen står over det.
  const storyTextureIds = useMemo(() => {
    const stopPois = story?.on ? story.stop?.pois : undefined;
    if (!stopPois) return undefined;
    const scene = new Set(stopPois.map((p) => String(p.id)));
    const openId = state.activePOIId ? String(state.activePOIId) : null;
    const texture = new Set<string>();
    for (const poi of markerPOIs) {
      if (scene.has(poi.id) || poi.id === openId) continue;
      texture.add(poi.id);
    }
    return texture;
  }, [markerPOIs, state.activePOIId, story?.on, story?.stop]);

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
    textureIds: storyTextureIds,
    // Mini-popupen viser navnet — da skal ikke pinnen vise det også.
    suppressActiveLabel: popupMode === "mini",
    enabled: !compactMarkers && markerPOIs.length > 0,
    // Kollisjonen skal avgjøres blant de synlige: elementet er både bredere enn
    // vinduet og delvis dekket av panelet, og uten disse ville et navn ingen ser
    // kunnet vinne plassen fra et navn som står midt i bildet.
    visibleLeftPx: mapPaddingLeft,
    overhangRightPx,
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
      if (isMarker3DTarget(e.target)) return;
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
        markerZIndexes={declutter.zIndexes}
        markerScale={declutter.pinScale}
        dimmedMarkerIds={storyTextureIds}
        dimmedOpacity={STORY_EMPHASIS_OPACITY.texture}
        dimmedPinScale={STORY_EMPHASIS_PIN_SCALE.texture}
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
        <BoardPOI3DMiniPopup
          map3d={map3dInstance}
          pinScale={declutter.pinScale}
        />
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
