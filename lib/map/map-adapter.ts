"use client";

/**
 * MapAdapter — minimal kart-agnostisk interface for camera-kontroll.
 *
 * Abstraherer forskjellen mellom Mapbox GL JS og Google Maps 3D
 * (Photorealistic Tiles) slik at `useInteractionController` kan fly kameraet
 * uten å vite hvilken motor som er aktiv.
 *
 * Design-prinsipper:
 * - **Minimalt interface**: kun `stop()` og `flyTo()`. Marker-rendering,
 *   popovers og events forblir slot-spesifikt — YAGNI.
 * - **Token-pattern** i useInteractionController er primær cancel-mekanisme;
 *   `stop()` er best-effort. Siste `flyTo` vinner uansett på begge motorer.
 * - **Pure-function-closures** (samme stil som `lib/utils/camera-map.ts`).
 *   Ingen klasser, ingen state — bare closures over map-instansen.
 */

import type { Map as MapboxMap } from "mapbox-gl";

/** Ett endringspunkt for fremtidig Google Maps 3D API-drift. */
export type GoogleMap3D = google.maps.maps3d.Map3DElement;

export type FlyToOptions = {
  /** Default true. false → instant (durationMs=0). */
  animate?: boolean;
  /** Override default duration. Default 400ms. */
  durationMs?: number;
};

export interface MapAdapter {
  /**
   * Best-effort imperativ cancel av pågående animasjon.
   * Mapbox: kaller `map.stop()`. Google 3D: feature-detection på
   * `stopCameraAnimation` (no-op hvis fraværende på `Map3DElement`).
   * Token-pattern i useInteractionController er primær cancel-mekanisme.
   */
  stop(): void;

  /**
   * Animér kamera til target. `altitude` brukes kun av 3D-adapter
   * (faller tilbake til eksisterende `map3d.center.altitude`).
   */
  flyTo(
    target: { lat: number; lng: number; altitude?: number },
    opts?: FlyToOptions,
  ): void;
}

export function mapboxAdapter(map: MapboxMap): MapAdapter {
  return {
    stop() {
      map.stop();
    },
    flyTo(target, opts) {
      map.flyTo({
        center: [target.lng, target.lat],
        duration: opts?.animate === false ? 0 : (opts?.durationMs ?? 400),
        essential: true,
      });
    },
  };
}

export function google3dAdapter(map3d: GoogleMap3D): MapAdapter {
  return {
    stop() {
      // Feature-detection: stopCameraAnimation finnes på Map3DRef fra @vis.gl,
      // men eksisterer ikke garantert på Map3DElement-instansen vår adapter
      // får. No-op hvis fraværende — siste flyCameraTo overskriver uansett.
      (map3d as { stopCameraAnimation?: () => void }).stopCameraAnimation?.();
    },
    flyTo(target, opts) {
      // Bevarer eksisterende tilt/heading/range — brukeren beholder sin
      // 3D-rotasjon. flyCameraTo flytter kun center.
      const currentCenter = map3d.center;
      const currentAltitude = currentCenter?.altitude ?? 0;
      map3d.flyCameraTo({
        endCamera: {
          center: {
            lat: target.lat,
            lng: target.lng,
            altitude: target.altitude ?? currentAltitude,
          },
          range: map3d.range,
          tilt: map3d.tilt,
          heading: map3d.heading,
        },
        durationMillis: opts?.animate === false ? 0 : (opts?.durationMs ?? 400),
      });
    },
  };
}
