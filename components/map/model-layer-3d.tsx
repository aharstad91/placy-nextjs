"use client";

import { useEffect, useRef } from "react";
import type { Map3DInstance } from "./map-view-3d";
import type { Board3DModel } from "@/lib/types";

/**
 * 3D-bygningsmodell (glTF/`.glb`) på Google Photorealistic 3D Tiles via
 * `Model3DElement`.
 *
 * Design-prinsipp: **ÉN langlevet model-instans per map3d** (samme mønster som
 * RouteLayer3D). Ved config-endring MUTERES props (src/position/orientation/
 * scale) — aldri remount — for å unngå GPU-buffer-leak på Photorealistic Tiles
 * (langsom WebGL-cleanup) og StrictMode-double-mount. gmp-map-3d unmountes
 * aldri; modellen appendes/fjernes mot den persistente instansen.
 *
 * Model3DElement-krav: kun `.glb` (binær glTF, kjerne-PBR, ingen extensions).
 * BÅDE `src` OG `position` MÅ settes ellers rendres ingenting (stille no-op).
 * `CLAMP_TO_GROUND` (default) lar basen følge terrenget (modell-origo i y=0).
 *
 * Referanser:
 * - components/map/route-layer-3d.tsx (samme imperative append/cleanup-mønster)
 * - https://developers.google.com/maps/documentation/javascript/3d/3d-models
 */

interface ModelLayer3DProps {
  map3d: Map3DInstance | null;
  /** Modell-config; `null` = ingen modell (fjernes fra DOM, ref beholdes). */
  model: Board3DModel | null;
  /** Prosjektets home-koordinat — brukt når `model.position` er utelatt. */
  fallbackPosition: { lat: number; lng: number };
}

export function ModelLayer3D({
  map3d,
  model,
  fallbackPosition,
}: ModelLayer3DProps) {
  const modelRef = useRef<google.maps.maps3d.Model3DElement | null>(null);

  // Opprett (hvis nødvendig) og oppdater modellen. Én langlevet instans per
  // map3d — props muteres i stedet for remount for å unngå GPU-buffer-leak.
  useEffect(() => {
    if (!map3d) return;

    let cancelled = false;

    // Ingen modell → fjern fra DOM (behold instansen i ref for neste append).
    if (!model) {
      if (modelRef.current?.parentNode) modelRef.current.remove();
      return;
    }

    const position = {
      lat: model.position?.lat ?? fallbackPosition.lat,
      lng: model.position?.lng ?? fallbackPosition.lng,
      altitude: model.position?.altitude ?? 0,
    };
    const orientation = model.orientation ?? { heading: 0, tilt: 0, roll: 0 };
    const scale = model.scale ?? 1;
    const altitudeMode = model.altitudeMode ?? "CLAMP_TO_GROUND";

    (async () => {
      try {
        // Lazy-opprett modellen (cachet i ref på tvers av config-endringer).
        if (!modelRef.current) {
          const lib = (await google.maps.importLibrary(
            "maps3d",
          )) as google.maps.Maps3DLibrary;
          if (cancelled) return;
          // Double-check etter async pause (StrictMode-race).
          if (!modelRef.current) {
            modelRef.current = new lib.Model3DElement({
              src: model.src,
              position,
              orientation,
              scale,
              altitudeMode,
            });
          }
        }

        const el = modelRef.current;
        if (!el || cancelled) return;

        // MUTÉR props i stedet for remount. Setterne tar literals (se
        // @types/google.maps Model3DElement). `position` + `src` er påkrevd.
        el.src = model.src;
        el.position = position;
        el.orientation = orientation;
        el.scale = scale;
        el.altitudeMode = altitudeMode;

        if (!el.parentNode) {
          map3d.append(el);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[ModelLayer3D] model failed:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map3d, model, fallbackPosition.lat, fallbackPosition.lng]);

  // Cleanup ved full unmount: fjern fra DOM og nullstill ref slik at neste
  // mount lager ny instans.
  useEffect(() => {
    return () => {
      if (modelRef.current?.parentNode) modelRef.current.remove();
      modelRef.current = null;
    };
  }, []);

  return null;
}
