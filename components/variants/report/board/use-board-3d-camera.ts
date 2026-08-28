"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  decideCameraIntent,
  type CameraIntent,
  type FlyCapableMap,
  type Hero3DCamera,
  ORBIT_ROUND_MS,
  ORBIT_TILT,
  REAIM_FLY_MS,
  POI_FLY_MS,
  SAT_TRANSITION_MS,
  CUT_FADE_MS,
  CUT_SETTLE_MS,
} from "./board-3d-camera-director";
import type { CategoryCameraConfig } from "@/lib/types";

interface Params {
  /** Map3DElement-instansen (cast til FlyCapableMap internt), eller null. */
  map3dInstance: unknown | null;
  cameraMode: "auto" | "free";
  /** Intro-flythrough eier kameraet → director-en yield-er (ingen orbit/cinematic). */
  introActive: boolean;
  home: { lat: number; lng: number };
  /** Aktiv POIs koordinater, eller null. Bør være memoisert av kalleren så
   *  effekt-deps holder seg stabile. */
  activePOI: { lat: number; lng: number } | null;
  activeCategoryId: string | null;
  /** Aktiv kategoris kamera-config (eksplisitt eller utledet), løst av kalleren.
   *  Bør være memoisert så effekt-deps holder seg stabile. */
  categoryConfig: CategoryCameraConfig | undefined;
  /** Voice-over-lengde (ms) for aktiv kategori, eller undefined. */
  audioDurationMs: number | undefined;
  audioPaused: boolean;
  reducedMotion: boolean;
  /** Hvile-/orbit-range (m), skalert til nabolags-spredningen (basic-tier).
   *  Udefinert → ORBIT_RANGE. */
  orbitRange?: number;
  /** Skal idle-tilstanden orbitere? `false` (basic-tier) → kameraet holder der
   *  det er etter intro-flythrough-en i stedet for å fly inn i en orbit. */
  autoOrbit?: boolean;
  /** Satelitt-modus (view === "sat") — directoren produserer kun ovenfra-poser
   *  og eier kameraet også i fri kameramodus. Se decideCameraIntent. */
  overhead?: boolean;
  /** Outro-beaten spiller → overhead-directoren yield-er (orkestratorens
   *  klampede summary-uttrekk eier kameraet). */
  outroActive?: boolean;
  /** Omvisningen kjører → et åpnet punkt flytter ikke kameraet. Se
   *  decideCameraIntent. */
  storyActive?: boolean;
  /** Settes true av drift-flippen (Unit 4: bruker tiltet manuelt i Satelitt →
   *  segmentet flipper til 3D). Da skal sat→3d-overgangen IKKE fly kameraet til
   *  skrå — gesten eier alt posituren. Leses og nullstilles her. */
  skipSkraaReentryRef?: MutableRefObject<boolean>;
}

/** Toleranse (grader) for «kameraet står alt ovenfra» — flyCameraTo lander på
 *  brøkdels-grader fra målet, så eksakt 0-sjekk ville re-flydd i det uendelige. */
const OVERHEAD_EPS_DEG = 2;

/** Korteste vinkelavstand mellom to headinger (0/360-wraparound). */
function headingDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/** Les gjeldende kamera fra den rå Map3DElement-instansen. LatLngAltitude
 *  eksponerer feltene som getters — kopier eksplisitt, aldri spread på center. */
function readCamera(map3dInstance: unknown): Hero3DCamera | null {
  const m = map3dInstance as {
    center?: { lat?: number; lng?: number } | null;
    range?: number;
    tilt?: number;
    heading?: number;
  };
  const c = m.center;
  if (!c || typeof c.lat !== "number" || typeof c.lng !== "number") return null;
  if (typeof m.range !== "number") return null;
  return {
    center: { lat: c.lat, lng: c.lng, altitude: 0 },
    range: m.range,
    tilt: m.tilt ?? 0,
    heading: m.heading ?? 0,
  };
}

export interface Board3DCameraState {
  /** Sann mens en cut-transition holder kartet svart. Driver CameraCutOverlay. */
  cutVisible: boolean;
}

/**
 * Imperativ kamera-director for 3D-board-kartet. Beslutter HVA via den rene
 * `decideCameraIntent` og utfører resultatet med flyCameraTo/flyCameraAround.
 *
 * Kansellering går via en `tokenRef` (KD-2): hver effekt-kjøring bumper token,
 * og ALLE utsatte callbacks (orbit-/cut-/A→B-overlevering) sjekker token før de
 * kjører. "Siste vinner" — en foreldet setTimeout fra forrige intent no-op'er.
 * Dette fjerner StrictMode-timer-racet som fikk `Fri` til å ikke stoppe orbiten,
 * OG sikrer at en cut avbrutt midt i ikke fader ut feil frame.
 *
 * Cut-transition (intent.cut): fade til svart → instant hopp (durationMillis 0)
 * til neste kategoris A → kort settle for tile-load → fade tilbake + start A→B.
 * Returnerer `cutVisible` så kalleren kan rendre CameraCutOverlay.
 */
export function useBoard3DCamera(params: Params): Board3DCameraState {
  const {
    map3dInstance,
    cameraMode,
    introActive,
    home,
    activePOI,
    activeCategoryId,
    categoryConfig,
    audioDurationMs,
    audioPaused,
    reducedMotion,
    orbitRange,
    autoOrbit,
    overhead = false,
    outroActive = false,
    storyActive = false,
    skipSkraaReentryRef,
  } = params;

  const tokenRef = useRef(0);
  const prevIntentRef = useRef<CameraIntent | null>(null);
  const prevOverheadRef = useRef(overhead);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [cutVisible, setCutVisible] = useState(false);

  useEffect(() => {
    if (!map3dInstance) return;
    const map = map3dInstance as FlyCapableMap;

    const prevIntent = prevIntentRef.current;
    const intent = decideCameraIntent({
      cameraMode,
      introActive,
      home,
      activePOI,
      activeCategoryId,
      categoryConfig,
      audioDurationMs,
      audioPaused,
      reducedMotion,
      orbitRange,
      autoOrbit,
      overhead,
      outroActive,
      storyActive,
      prevIntent,
    });
    prevIntentRef.current = intent;

    // Satelitt-kantene: gikk vi INN i eller UT av overhead siden forrige kjøring?
    // (view-byttet sat↔3d er en dep — kantene sees nøyaktig én effekt-kjøring.)
    const overheadEntered = overhead && !prevOverheadRef.current;
    const overheadLeft = !overhead && prevOverheadRef.current;
    prevOverheadRef.current = overhead;

    // Bump token → enhver utsatt callback fra forrige kjøring blir stale.
    const token = ++tokenRef.current;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const isCurrent = () => token === tokenRef.current;
    /** Token-guardet setTimeout — no-op'er hvis en ny intent har kommet. */
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        if (isCurrent()) fn();
      }, ms);
      timersRef.current.push(id);
    };

    // Default: ingen cut-overlay. Cut-grenen slår den på. (No-op når allerede false.)
    setCutVisible(false);

    // Best-effort stopp; token er den egentlige garden (stopCameraAnimation er
    // ikke pålitelig på rå Map3DElement).
    map.stopCameraAnimation?.();

    const flyInThenOrbit = (hero: Hero3DCamera) => {
      map.flyCameraTo?.({ endCamera: hero, durationMillis: REAIM_FLY_MS });
      later(() => {
        map.flyCameraAround?.({
          camera: hero,
          durationMillis: ORBIT_ROUND_MS,
          repeatCount: Infinity,
        });
      }, REAIM_FLY_MS);
    };

    switch (intent.kind) {
      case "free": {
        // Satelitt→3D uten noen intent som skriver skrå-posituren (basic-boards
        // i fri, og VO-boards der brukeren sto i Fri): overgangen eies her —
        // behold brukerens senter/range (aldri hjem-teleport), løft tilt til
        // ORBIT_TILT. Hoppes over etter drift-flippen (Unit 4): da brøt brukeren
        // posituren manuelt og gesten eier kameraet.
        if (overheadLeft) {
          // Mid-intro-flip (basic-introen kjører): flyturen eier kameraet og
          // restartes i skrå-varianten av orkestratoren — ikke fly oppå rAF-en.
          if (introActive) return;
          if (skipSkraaReentryRef?.current) {
            skipSkraaReentryRef.current = false;
            return;
          }
          const cur = readCamera(map3dInstance);
          if (cur && Math.abs(cur.tilt - ORBIT_TILT) > OVERHEAD_EPS_DEG) {
            map.flyCameraTo?.({
              endCamera: { ...cur, tilt: ORBIT_TILT },
              durationMillis: SAT_TRANSITION_MS,
            });
          }
        }
        return; // brukeren eier kameraet
      }
      case "poi":
        map.flyCameraTo?.({ endCamera: intent.pose, durationMillis: POI_FLY_MS });
        return;
      case "overheadCategory": {
        // Samme kategori som sist (re-render / pause-skifte): ikke re-fly — posen
        // er alt etablert, og brukeren kan ha panorert innen kategorien.
        if (
          prevIntent?.kind === "overheadCategory" &&
          prevIntent.categoryId === intent.categoryId
        ) {
          return;
        }
        map.flyCameraTo?.({ endCamera: intent.pose, durationMillis: POI_FLY_MS });
        return;
      }
      case "overheadRest": {
        const cur = readCamera(map3dInstance);
        if (!cur) {
          // Kameraet kan ikke leses (bør ikke skje etter mount) → etabler hvile.
          map.flyCameraTo?.({ endCamera: intent.rest, durationMillis: SAT_TRANSITION_MS });
          return;
        }
        const alreadyOverhead =
          cur.tilt <= OVERHEAD_EPS_DEG &&
          headingDistance(cur.heading, 0) <= OVERHEAD_EPS_DEG;
        if (overheadEntered) {
          // 3D→Satelitt: ÉN myk flyvning som beholder brukerens senter/range og
          // legger kameraet ned (R2). Alt ovenfra (2D→sat-broen skrev tilt 0,
          // eller intro landet ovenfra) → hold helt stille.
          if (!alreadyOverhead) {
            map.flyCameraTo?.({
              endCamera: { ...cur, tilt: 0, heading: 0 },
              durationMillis: SAT_TRANSITION_MS,
            });
          }
          return;
        }
        if (alreadyOverhead) return; // hvile: pan/zoom flytter ALDRI kameraet tilbake
        // Skrå positur mens Satelitt står valgt og view ikke nettopp byttet: en
        // VO-beat (welcome) har sluppet kameraet skrått (R8b) — fly tilbake til
        // overhead-hvileposituren.
        map.flyCameraTo?.({ endCamera: intent.rest, durationMillis: REAIM_FLY_MS });
        return;
      }
      case "orbit": {
        // Orbit→orbit (uavbrutt), kald første-mount, eller retur fra POI: myk
        // fly-inn til orbit-hero, ingen cut.
        if (!intent.cut) {
          flyInThenOrbit(intent.hero);
          return;
        }
        // Redusert bevegelse: instant hopp til orbit-hero, ingen fade.
        if (reducedMotion) {
          map.flyCameraTo?.({ endCamera: intent.hero, durationMillis: 0 });
          map.flyCameraAround?.({
            camera: intent.hero,
            durationMillis: ORBIT_ROUND_MS,
            repeatCount: Infinity,
          });
          return;
        }
        // Cut INN i orbit (velkommen-innflyvning → nabolaget): fade til cream →
        // instant hopp til orbit-hero (skjult bak laget) → settle for tile-load →
        // fade ut + start orbit. Samme mekanikk som cinematic-cut; maskerer den
        // meningsløse fly-overen fra innflyvnings-landingen til orbit-startpunktet.
        setCutVisible(true);
        later(() => {
          map.flyCameraTo?.({ endCamera: intent.hero, durationMillis: 0 });
          later(() => {
            setCutVisible(false);
            map.flyCameraAround?.({
              camera: intent.hero,
              durationMillis: ORBIT_ROUND_MS,
              repeatCount: Infinity,
            });
          }, CUT_SETTLE_MS);
        }, CUT_FADE_MS);
        return;
      }
      case "cinematic": {
        if (intent.paused) return; // frys: ikke (re)start bevegelse mens VO er pauset

        // Selve A→B-bevegelsen (eller rolig orbit ved A når B mangler).
        const startMove = () => {
          if (intent.b) {
            map.flyCameraTo?.({ endCamera: intent.b, durationMillis: intent.durationMs });
          } else {
            map.flyCameraAround?.({
              camera: intent.a,
              durationMillis: ORBIT_ROUND_MS,
              repeatCount: Infinity,
            });
          }
        };

        // Redusert bevegelse: instant hopp til A, ingen fade, ingen drift.
        if (intent.reducedMotion) {
          map.flyCameraTo?.({ endCamera: intent.a, durationMillis: 0 });
          return;
        }

        // Samme kategori (re-render, ikke kategori-skifte): fortsett uten cut.
        if (!intent.cut) {
          startMove();
          return;
        }

        // Cut-transition: fade til svart → instant hopp til A → settle → fade ut + A→B.
        setCutVisible(true);
        later(() => {
          map.flyCameraTo?.({ endCamera: intent.a, durationMillis: 0 }); // instant, skjult bak svart
          later(() => {
            setCutVisible(false); // fade tilbake (CSS)
            startMove();
          }, CUT_SETTLE_MS);
        }, CUT_FADE_MS);
        return;
      }
    }
  }, [
    map3dInstance,
    cameraMode,
    introActive,
    home,
    activePOI,
    activeCategoryId,
    categoryConfig,
    audioDurationMs,
    audioPaused,
    reducedMotion,
    orbitRange,
    autoOrbit,
    overhead,
    outroActive,
    storyActive,
    skipSkraaReentryRef,
  ]);

  // Rydd timere + stopp animasjon ved unmount / map-bytte.
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      const map = map3dInstance as FlyCapableMap | null;
      map?.stopCameraAnimation?.();
    };
  }, [map3dInstance]);

  return { cutVisible };
}
