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

// SVG-basert gangtid-badge. Google Maps 3D `Marker3DInteractiveElement`
// slotter kun <img> eller <svg>. Emoji rendres ikke pålitelig i SVG, så
// vi bruker en inline SVG-figur av en gående person (Material-ikon-stil).
// Design speiler 2D-badge i components/map/route-layer.tsx:124.
function buildBadgeSVG(minutes: number): string {
  const label = `${minutes} min`;
  // Estimat: 28px venstre (ikon + padding) + ~10px per tegn + 14px høyre
  const textWidth = label.length * 10;
  const width = Math.max(96, 48 + textWidth);
  const height = 42;
  const radius = (height - 4) / 2;
  // Material Symbols "directions_walk" (forenklet) — enkelt strektegnet piktogram
  const walker = `
    <g transform="translate(14, 9) scale(0.85)" fill="#3B82F6">
      <circle cx="10" cy="3.5" r="2.2"/>
      <path d="M 7 22 L 8.5 14 L 6 11 L 8 7 L 12 7 L 15 11 L 13 14 L 14.5 22 L 12.5 22 L 11 15.5 L 9.5 22 Z"/>
    </g>
  `;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <filter id="rl3d-shadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.22"/>
      </filter>
    </defs>
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${radius}"
      fill="#ffffff" stroke="#eae6e1" stroke-width="1" filter="url(#rl3d-shadow)"/>
    ${walker}
    <text x="${38}" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
      font-size="15" font-weight="600" fill="#1a1a1a">${label}</text>
  </svg>`;
}

export function RouteLayer3D({ map3d, routeData }: RouteLayer3DProps) {
  const polylineRef = useRef<google.maps.maps3d.Polyline3DElement | null>(null);
  const badgeRef = useRef<google.maps.maps3d.Marker3DInteractiveElement | null>(
    null,
  );

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

  // Effect 3: gangtid-badge på rute-endepunktet. Match 2D-badge-stilen for
  // visuell kontinuitet mellom modusene (se components/map/route-layer.tsx:124).
  // Bruker Marker3DInteractiveElement fordi den lar oss appende HTML-children
  // (ren Marker3DElement tar kun `label`-string).
  useEffect(() => {
    if (!map3d) return;

    let cancelled = false;

    if (!routeData || routeData.coordinates.length === 0) {
      if (badgeRef.current?.parentNode) badgeRef.current.remove();
      badgeRef.current = null;
      return;
    }

    const endCoord = routeData.coordinates[routeData.coordinates.length - 1];
    const minutes = Math.round(routeData.travelMinutes);

    (async () => {
      try {
        const lib = (await google.maps.importLibrary(
          "maps3d",
        )) as google.maps.Maps3DLibrary;
        if (cancelled) return;

        // Fjern gammel badge før ny opprettes (posisjon-property er read-only
        // på Marker3D* etter construction — vi må rebygge ved endring).
        if (badgeRef.current?.parentNode) badgeRef.current.remove();

        const marker = new lib.Marker3DInteractiveElement({
          position: {
            lat: endCoord.lat,
            lng: endCoord.lng,
            altitude: 12, // litt høyere enn polyline (3m) for lesbarhet
          },
          altitudeMode: lib.AltitudeMode.RELATIVE_TO_GROUND,
        });

        // Marker3DInteractiveElement slotter <template> og templaten må
        // inneholde <img> eller <svg>. Vi bygger en inline SVG-badge.
        const template = document.createElement("template");
        template.innerHTML = buildBadgeSVG(minutes);
        marker.append(template);

        if (cancelled) return;
        map3d.append(marker);
        badgeRef.current = marker;
      } catch (err) {
        if (!cancelled) {
          console.warn("[RouteLayer3D] badge marker failed:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeData, map3d]);

  // Felles cleanup ved full unmount — fanger badge som kan bli igjen hvis
  // effect 3 resolver etter at polyline-effect allerede har cleanupet.
  useEffect(() => {
    return () => {
      if (badgeRef.current?.parentNode) badgeRef.current.remove();
      badgeRef.current = null;
    };
  }, []);

  return null;
}
