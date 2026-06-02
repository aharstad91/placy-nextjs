"use client";

import { useEffect, useRef, useState } from "react";
import {
  decideCameraIntent,
  type CameraIntent,
  type FlyCapableMap,
  type Hero3DCamera,
  ORBIT_ROUND_MS,
  REAIM_FLY_MS,
  POI_FLY_MS,
  CUT_FADE_MS,
  CUT_SETTLE_MS,
} from "./board-3d-camera-director";
import type { CategoryCameraConfig } from "@/lib/types";

interface Params {
  /** Map3DElement-instansen (cast til FlyCapableMap internt), eller null. */
  map3dInstance: unknown | null;
  cameraMode: "auto" | "free";
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
    home,
    activePOI,
    activeCategoryId,
    categoryConfig,
    audioDurationMs,
    audioPaused,
    reducedMotion,
  } = params;

  const tokenRef = useRef(0);
  const prevIntentRef = useRef<CameraIntent | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [cutVisible, setCutVisible] = useState(false);

  useEffect(() => {
    if (!map3dInstance) return;
    const map = map3dInstance as FlyCapableMap;

    const intent = decideCameraIntent({
      cameraMode,
      home,
      activePOI,
      activeCategoryId,
      categoryConfig,
      audioDurationMs,
      audioPaused,
      reducedMotion,
      prevIntent: prevIntentRef.current,
    });
    prevIntentRef.current = intent;

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
      case "free":
        return; // brukeren eier kameraet
      case "poi":
        map.flyCameraTo?.({ endCamera: intent.pose, durationMillis: POI_FLY_MS });
        return;
      case "orbit":
        flyInThenOrbit(intent.hero);
        return;
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
    home,
    activePOI,
    activeCategoryId,
    categoryConfig,
    audioDurationMs,
    audioPaused,
    reducedMotion,
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
