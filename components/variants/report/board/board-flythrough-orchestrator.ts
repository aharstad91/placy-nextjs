import { useEffect, useMemo, useRef, type Dispatch } from "react";
import type { Map3DInstance } from "@/components/map/map-view-3d";
import type { CameraMode } from "./BoardMapControls";
import type { BoardAction } from "./board-state";
import {
  SUMMARY_RANGE,
  SUMMARY_TILT,
  SUMMARY_FLY_MS,
  type FlyCapableMap,
} from "./board-3d-camera-director";
import {
  runIntroFlythrough,
  buildBasicIntroPath,
  MIN_INTRO_FLY_MS,
  WELCOME_INTRO_SETTLE_MS,
  WELCOME_CALM_SWEEP_DEG,
  DEFAULT_INTRO_PATH,
  type CameraDrivableMap3D,
} from "./board-intro-flythrough";
import {
  runEstablishingFlythrough,
  type EstablishingPhase,
  type EstablishingPathConfig,
} from "./board-establishing-flythrough";
import { getBoardIntro } from "./board-intros";

/**
 * Flythrough-orkestrering for det 3D-baserte board-kartet (ekstrahert fra
 * `BoardMap3D` i Unit 06.7). Samler de tre imperative kamera-flyturene —
 * intro-flythrough (velkommen-beat + `?fly=1` + basic-intro), establishing-shot
 * (`?establishing=1`), og oppsummerings-uttrekket (outro-beat) — i én hook.
 *
 * Hooken eier IKKE markørsettets state; den driver fase-callbackene
 * (`setIntroFlyPhase`/`setBloomStarted`) som orchestratoren leser for å koreografere
 * reveal-kaskaden. Effektene MÅ registreres ETTER `useBoard3DCamera` (outroen
 * stoler på at director-ens stopp kjører før den imperative fly-en) — kall derfor
 * denne hooken etter director-hooken i `BoardMap3D`.
 */

export type IntroFlyPhase = "idle" | "settling" | "running" | "done";

/**
 * De tre intro-eierne (`flyMode`/`isWelcomeBeat`/`basicIntroActive`) AND-es bort
 * av `establishingMode`: når `?establishing=1` er på eier den multi-waypoint-
 * flythrough-en kameraet alene, så vi unngår at to animatorer kjemper om posituren.
 * Ren funksjon — eksportert for enhetstesting (AC2).
 */
export function deriveIntroActive(args: {
  flyMode: boolean;
  isWelcomeBeat: boolean;
  basicIntroActive: boolean;
  establishingMode: boolean;
}): boolean {
  const { flyMode, isWelcomeBeat, basicIntroActive, establishingMode } = args;
  return (flyMode || isWelcomeBeat || basicIntroActive) && !establishingMode;
}

export interface UseBoardFlythroughParams {
  map3dInstance: Map3DInstance | null;
  /** Den AND-ede intro-flagget (se `deriveIntroActive`). */
  introActive: boolean;
  basicIntroActive: boolean;
  isWelcomeBeat: boolean;
  flyMode: boolean;
  establishingMode: boolean;
  establishingShot: EstablishingPathConfig | undefined;
  isOutroBeat: boolean;
  cameraMode: CameraMode;
  orbitRange: number;
  reducedMotion: boolean;
  audioDurationMs: number | undefined;
  audioPaused: boolean;
  /** Per-prosjekt intro-tuning hentes via slug (`getBoardIntro`). */
  projectSlug: string | undefined;
  home: { lat: number; lng: number };
  dispatch: Dispatch<BoardAction>;
  setIntroFlyPhase: (phase: IntroFlyPhase) => void;
  setBloomStarted: (started: boolean) => void;
}

export function useBoardFlythrough({
  map3dInstance,
  introActive,
  basicIntroActive,
  isWelcomeBeat,
  flyMode,
  establishingMode,
  establishingShot,
  isOutroBeat,
  cameraMode,
  orbitRange,
  reducedMotion,
  audioDurationMs,
  audioPaused,
  projectSlug,
  home,
  dispatch,
  setIntroFlyPhase,
  setBloomStarted,
}: UseBoardFlythroughParams): void {
  const homeLat = home.lat;
  const homeLng = home.lng;

  // Per-prosjekt intro-tuning (innflyvnings-retning etc.); ukjent slug → {} → ren
  // standard-intro. Stabil ref via slug-dep så effekten ikke restarter.
  const introPath = useMemo(() => getBoardIntro(projectSlug ?? ""), [projectSlug]);

  // Pause leses via ref hver frame (ikke effekt-dep) så pause/resume fryser
  // flyturen der den slapp i stedet for å restarte den.
  const audioPausedRef = useRef(audioPaused);
  audioPausedRef.current = audioPaused;

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
    setIntroFlyPhase,
  ]);

  // ── Establishing-shot-flythrough (?establishing=1) ───────────────────────
  // Multi-waypoint strøk-sveip (board-establishing-shots), uten audio. Egen flate
  // fra welcome/basic-introen: den eier kameraet (introActive||establishingMode →
  // director yield-er), og fyrer reveal-kaskaden (blobs + pins) når banen passerer
  // bloomAtProgress — kameraet stiger over platået idet prikkene tegnes inn.
  // prefers-reduced-motion → hold første waypoint + vis reveal statisk (ingen
  // flytur). Egne deps (ikke audio): restarter ikke på narrativ-synk.
  useEffect(() => {
    if (!establishingMode || !establishingShot || !map3dInstance) return;
    const map = map3dInstance as unknown as CameraDrivableMap3D;
    setBloomStarted(false);
    const bloomAt = establishingShot.bloomAtProgress;
    return runEstablishingFlythrough(map, {
      path: establishingShot,
      staticOnly: reducedMotion,
      onProgress: (s) => {
        if (s >= bloomAt) setBloomStarted(true);
      },
      onPhase: (phase: EstablishingPhase) => {
        (window as unknown as { __placyEstablishing?: string }).__placyEstablishing =
          phase;
        // Reduced-motion: ingen flytur → vis reveal med en gang så strøket ikke
        // står tomt på den statiske åpnings-posituren.
        if (phase === "done" && reducedMotion) setBloomStarted(true);
      },
    });
  }, [establishingMode, establishingShot, map3dInstance, reducedMotion, setBloomStarted]);

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
}
