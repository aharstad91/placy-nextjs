"use client";

import { useEffect, useRef } from "react";
import {
  decideCameraIntent,
  type CameraIntent,
  type FlyCapableMap,
  type Hero3DCamera,
  ORBIT_ROUND_MS,
  REAIM_FLY_MS,
  POI_FLY_MS,
} from "./board-3d-camera-director";
import { getCategoryCamera } from "./camera-tours";

interface Params {
  /** Map3DElement-instansen (cast til FlyCapableMap internt), eller null. */
  map3dInstance: unknown | null;
  cameraMode: "auto" | "free";
  home: { lat: number; lng: number };
  /** Aktiv POIs koordinater, eller null. Bør være memoisert av kalleren så
   *  effekt-deps holder seg stabile. */
  activePOI: { lat: number; lng: number } | null;
  projectSlug: string | undefined;
  activeCategoryId: string | null;
  /** Voice-over-lengde (ms) for aktiv kategori, eller undefined. */
  audioDurationMs: number | undefined;
  audioPaused: boolean;
  reducedMotion: boolean;
}

/**
 * Imperativ kamera-director for 3D-board-kartet. Beslutter HVA via den rene
 * `decideCameraIntent` og utfører resultatet med flyCameraTo/flyCameraAround.
 *
 * Kansellering går via en `tokenRef` (KD-2): hver effekt-kjøring bumper token,
 * og ALLE utsatte callbacks (orbit-/A→B-overlevering) sjekker token før de
 * kjører. "Siste vinner" — en foreldet setTimeout fra forrige intent no-op'er.
 * Dette fjerner StrictMode-timer-racet som fikk `Fri` til å ikke stoppe orbiten.
 *
 * Cut-overlay-orkestreringen (intent.cut) legges på i et senere steg; her flyr
 * cinematic ganske enkelt inn til A og deretter A→B.
 */
export function useBoard3DCamera(params: Params) {
  const {
    map3dInstance,
    cameraMode,
    home,
    activePOI,
    projectSlug,
    activeCategoryId,
    audioDurationMs,
    audioPaused,
    reducedMotion,
  } = params;

  const tokenRef = useRef(0);
  const prevIntentRef = useRef<CameraIntent | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!map3dInstance) return;
    const map = map3dInstance as FlyCapableMap;

    const categoryConfig =
      activeCategoryId && projectSlug
        ? getCategoryCamera(projectSlug, activeCategoryId)
        : undefined;

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
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const isCurrent = () => token === tokenRef.current;

    // Best-effort stopp; token er den egentlige garden (stopCameraAnimation er
    // ikke pålitelig på rå Map3DElement).
    map.stopCameraAnimation?.();

    const flyInThenOrbit = (hero: Hero3DCamera) => {
      map.flyCameraTo?.({ endCamera: hero, durationMillis: REAIM_FLY_MS });
      timerRef.current = setTimeout(() => {
        if (!isCurrent()) return; // RACE-FIX: ny intent → ikke (re)start orbit
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
        const flyInMs = intent.reducedMotion ? 0 : REAIM_FLY_MS;
        map.flyCameraTo?.({ endCamera: intent.a, durationMillis: flyInMs });
        if (intent.reducedMotion) return; // statisk hold på A
        if (!intent.b) {
          // A-only: rolig orbit ved A (alltid litt bevegelse)
          timerRef.current = setTimeout(() => {
            if (!isCurrent()) return;
            map.flyCameraAround?.({
              camera: intent.a,
              durationMillis: ORBIT_ROUND_MS,
              repeatCount: Infinity,
            });
          }, REAIM_FLY_MS);
          return;
        }
        // A→B: rolig drift over voice-over-lengden.
        timerRef.current = setTimeout(() => {
          if (!isCurrent()) return;
          map.flyCameraTo?.({ endCamera: intent.b!, durationMillis: intent.durationMs });
        }, REAIM_FLY_MS);
        return;
      }
    }
  }, [
    map3dInstance,
    cameraMode,
    home,
    activePOI,
    projectSlug,
    activeCategoryId,
    audioDurationMs,
    audioPaused,
    reducedMotion,
  ]);

  // Rydd timer + stopp animasjon ved unmount / map-bytte.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const map = map3dInstance as FlyCapableMap | null;
      map?.stopCameraAnimation?.();
    };
  }, [map3dInstance]);
}
