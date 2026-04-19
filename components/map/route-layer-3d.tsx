"use client";

import { useEffect, useRef } from "react";
import type { RouteData } from "@/lib/map/use-route-data";
import type { Map3DInstance } from "./map-view-3d";

/**
 * 3D walking-rute via Google Maps `Polyline3DElement`.
 *
 * Design-prinsipp: **én langlevet polyline-instans per map3d.** Ved POI-bytte
 * muterer vi `coordinates` — ingen mount/unmount. Forhindrer GPU-buffer-leak
 * på iOS/Android (Photorealistic Tiles har langsom WebGL-cleanup) og forenkler
 * StrictMode-race.
 *
 * Styling: native `outerColor`/`outerWidth` for outline (blå linje + hvit
 * kantlinje). 4px outline (40% av 10px strokeWidth). RELATIVE_TO_GROUND med
 * 3m altitude gir konstant clearance over bakkemesh — unngår z-fighting og
 * klatrer ikke på hustak (som RELATIVE_TO_MESH ville gjort).
 *
 * `drawsOccludedSegments: true` tegner ruta semi-transparent der bygninger
 * blokkerer — demo-vennlig, viser POI-relasjon selv i tett bebyggelse.
 *
 * Referanser:
 * - https://developers.google.com/maps/documentation/javascript/3d/shapes-lines
 * - docs/solutions/ui-bugs/google-maps-3d-popover-not-rendering.md (StrictMode-pattern)
 */

interface RouteLayer3DProps {
  map3d: Map3DInstance | null;
  routeData: RouteData | null;
}

// Constants — se brainstorm for rationale.
const ROUTE_ALTITUDE_M = 3;
const STROKE_COLOR = "#3B82F6"; // blue-500
const OUTER_COLOR = "#FFFFFF";
const STROKE_WIDTH = 10; // pixels
const OUTER_WIDTH = 0.4; // 40% → 4px outline

export function RouteLayer3D({ map3d, routeData }: RouteLayer3DProps) {
  const polylineRef = useRef<google.maps.maps3d.Polyline3DElement | null>(null);

  // Effect 1: opprett polyline NÅR map3d blir klar. Én langlevet instans.
  // NB: `coordinates` er deprecated — bruk `path` (Google Maps 3D API). Vi
  // appender ikke før vi har data (append uten path gir "empty iterable"-feil).
  useEffect(() => {
    if (!map3d) return;

    let cancelled = false;

    (async () => {
      try {
        const lib = (await google.maps.importLibrary(
          "maps3d",
        )) as google.maps.Maps3DLibrary;

        // StrictMode-guard: hvis komponenten er unmountet før importLibrary
        // resolver, skal vi ikke appende til detached map3d.
        if (cancelled) return;
        if (polylineRef.current) return; // allerede opprettet

        const polyline = new lib.Polyline3DElement({
          strokeColor: STROKE_COLOR,
          outerColor: OUTER_COLOR,
          strokeWidth: STROKE_WIDTH,
          outerWidth: OUTER_WIDTH,
          altitudeMode: lib.AltitudeMode.RELATIVE_TO_GROUND,
          drawsOccludedSegments: true,
        });
        // Ikke sett path/coordinates her — API kaster på empty iterable.
        // Polyline appendes først ved første ikke-tom routeData (Effect 2).
        if (cancelled) return;
        polylineRef.current = polyline;
      } catch (err) {
        if (!cancelled) {
          console.warn("[RouteLayer3D] importLibrary failed:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      const p = polylineRef.current;
      if (p && p.parentNode) p.remove();
      polylineRef.current = null;
    };
  }, [map3d]);

  // Effect 2: muter path når routeData endres. Appender/fjerner fra DOM
  // basert på om vi har data. Ingen remount — samme instans gjenbrukes.
  useEffect(() => {
    const polyline = polylineRef.current;
    if (!polyline || !map3d) return;

    if (!routeData || routeData.coordinates.length === 0) {
      if (polyline.parentNode) polyline.remove();
      return;
    }

    // Mutér path, deretter append hvis ikke allerede i DOM.
    (polyline as unknown as { path: { lat: number; lng: number; altitude: number }[] }).path =
      routeData.coordinates.map(({ lat, lng }) => ({
        lat,
        lng,
        altitude: ROUTE_ALTITUDE_M,
      }));
    if (!polyline.parentNode) {
      map3d.append(polyline);
    }
  }, [routeData, map3d]);

  return null;
}
