"use client";

import { useEffect, useRef } from "react";
import type { RouteData } from "@/lib/map/use-route-data";
import type { Map3DInstance } from "./map-view-3d";

/**
 * 3D-rute via Google Maps `Polyline3DElement`. Ruta følger boardets aktive
 * reisemodus — laget tegner bare koordinatene det får.
 *
 * Tidsmerket lå tidligere her som en inline-SVG i et
 * `Marker3DInteractiveElement`. Den markørtypens template MÅ inneholde `<img>`
 * eller `<svg>`, så et utvidbart modus-panel kunne ikke bo der. Merket er
 * flyttet til `BoardTravelChip3D`, som er et HTML-overlay. Dette laget tegner nå
 * bare linja.
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

  // Effect 1: opprett (hvis nødvendig) og oppdater polyline basert på
  // routeData. Én langlevet instans per map3d — path muteres i stedet for
  // remount for å unngå GPU-buffer-leak.
  //
  // NB: Slått sammen av tidligere "opprett"- og "sett-path"-effekter fordi
  // den asynkrone `importLibrary` gjorde at path-effekten kunne kjøre før
  // polylinen var klar — da ble path aldri satt ved 3D-remount (toggle 2D→3D).
  useEffect(() => {
    if (!map3d) return;

    let cancelled = false;

    // Ingen data → fjern fra DOM (behold instansen i ref for neste append).
    if (!routeData || routeData.coordinates.length === 0) {
      if (polylineRef.current?.parentNode) polylineRef.current.remove();
      return;
    }

    (async () => {
      try {
        // Lazy-opprett polyline (cachet i ref på tvers av routeData-endringer).
        if (!polylineRef.current) {
          const lib = (await google.maps.importLibrary(
            "maps3d",
          )) as google.maps.Maps3DLibrary;
          if (cancelled) return;
          // Double-check etter async pause (StrictMode-race).
          if (!polylineRef.current) {
            polylineRef.current = new lib.Polyline3DElement({
              strokeColor: STROKE_COLOR,
              outerColor: OUTER_COLOR,
              strokeWidth: STROKE_WIDTH,
              outerWidth: OUTER_WIDTH,
              altitudeMode: lib.AltitudeMode.RELATIVE_TO_GROUND,
              drawsOccludedSegments: true,
            });
          }
        }

        const polyline = polylineRef.current;
        if (!polyline || cancelled) return;

        // Sett path og append. path FØR append er viktig — append uten path
        // kan trigge "empty iterable"-feil i noen API-versjoner.
        (polyline as unknown as { path: { lat: number; lng: number; altitude: number }[] }).path =
          routeData.coordinates.map(({ lat, lng }) => ({
            lat,
            lng,
            altitude: ROUTE_ALTITUDE_M,
          }));
        if (!polyline.parentNode) {
          map3d.append(polyline);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[RouteLayer3D] polyline failed:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map3d, routeData]);

  // Cleanup ved full unmount av komponenten (map3d blir null / komponent
  // fjernes). Fjerner polyline fra DOM og nullstiller ref slik at neste
  // mount lager ny instans.
  useEffect(() => {
    return () => {
      if (polylineRef.current?.parentNode) polylineRef.current.remove();
      polylineRef.current = null;
    };
  }, []);

  return null;
}
