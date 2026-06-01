// @ts-nocheck — Google Maps 3D-typer er løse; følger samme pragma som Map3DActionButtons.tsx
"use client";

import { useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import { useBoard, useActivePOI } from "./board-state";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { markerCircleStyle } from "./marker-style";
import type { Map3DInstance } from "@/components/map/map-view-3d";
// merknad: hide-during-motion ble tidligere brukt for å skjule popup under
// kamera-bevegelse fordi den gamle approksimasjonen drifted. Med korrekt
// perspektiv-projeksjon tracker popupen markøren smooth — fjernet.

interface Props {
  map3d: Map3DInstance | null;
}

/**
 * 3D-variant av BoardPOIMiniPopup. Google Maps 3D eksponerer ingen
 * native `latLngToScreen`, så vi projiserer manuelt fra kameraets center,
 * heading, tilt og range hver frame (samme tilnærming som Map3DActionButtons).
 *
 * Drift-håndtering: ved POI-åpning fly-er vi kameraet inn til en tilt≈30°
 * (nær-top-down) hvor projeksjonen er nær eksakt. Brukeren kan fortsatt
 * tilte etterpå — popupen følger med, men drift øker proporsjonalt.
 */

/**
 * Full 3D perspective-projeksjon fra (lat, lng, altitude) til skjerm-koord.
 *
 * Trinn:
 *   1. World-delta i meter (lokal flat-approks med cos(lat) for lng)
 *   2. Rotér til kamera-frame med heading (azimuth fra nord, med klokken)
 *   3. Tilt + altitude → kamera-frame (right, up_on_screen, depth)
 *   4. Perspektiv-divisjon med depth, multipliser med focal length fra FOV
 *
 * Konvensjon:
 *   - heading=0 → kamera ser nord; forward-aksen = +north
 *   - heading=90 → kamera ser øst; forward-aksen = +east
 *   - tilt=0 → top-down; tilt=90 → horisontal
 *   - active markør har altitude=20m (matcher Marker3D-rendering i map-view-3d.tsx)
 *
 * Den tidligere approksimasjonen brukte fast `scale * 1000` uten perspektiv-
 * divisjon, så punkter langt fra sentrum projiserte feil — særlig ved høy tilt.
 * Dette er ekte perspektiv-math og treffer Google's egne markører.
 */
const FOV_Y_RAD = (35 * Math.PI) / 180; // estimat — Google Maps 3D eksponerer ikke FOV
const ALTITUDE_M = 20; // matcher Marker3D `altitude: isActive ? 20 : 0`
const METERS_PER_DEG_LAT = 111320;

function calculateScreenPosition(
  map3d: Map3DInstance,
  lat: number,
  lng: number,
): { x: number; y: number } | null {
  try {
    const rect = (map3d as unknown as HTMLElement).getBoundingClientRect();
    const center = (map3d as { center?: { lat: number; lng: number } }).center;
    if (!center) return null;
    const heading = (map3d as { heading?: number }).heading ?? 0;
    const tilt = (map3d as { tilt?: number }).tilt ?? 0;
    const range = (map3d as { range?: number }).range ?? 1200;

    // 1. World-delta → meter
    const metersPerDegLng =
      METERS_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180);
    const dxEast = (lng - center.lng) * metersPerDegLng;
    const dyNorth = (lat - center.lat) * METERS_PER_DEG_LAT;

    // 2. Roter til kamera-frame: (east, north) → (right, forward)
    const h = (heading * Math.PI) / 180;
    const cosH = Math.cos(h);
    const sinH = Math.sin(h);
    const right = dxEast * cosH - dyNorth * sinH;
    const forward = dxEast * sinH + dyNorth * cosH;

    // 3. Tilt + altitude → kamera-frame koordinater
    //   x_cam = right
    //   y_cam = forward*cos(t) + altitude*sin(t)   (positiv = oppover på skjerm)
    //   z_cam = range + forward*sin(t) - altitude*cos(t)   (depth)
    const t = (tilt * Math.PI) / 180;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const xCam = right;
    const yCam = forward * cosT + ALTITUDE_M * sinT;
    const zCam = range + forward * sinT - ALTITUDE_M * cosT;
    if (zCam <= 1) return null; // bak kameraet, hopp over

    // 4. Perspektiv-projeksjon
    const focal = rect.height / (2 * Math.tan(FOV_Y_RAD / 2));
    const screenX = rect.width / 2 + (focal * xCam) / zCam;
    const screenY = rect.height / 2 - (focal * yCam) / zCam;
    return { x: rect.left + screenX, y: rect.top + screenY };
  } catch {
    return null;
  }
}

export function BoardPOI3DMiniPopup({ map3d }: Props) {
  const { dispatch } = useBoard();
  const poi = useActivePOI();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  // Per-frame projeksjon. Skriver direkte til DOM (`transform: translate3d`)
  // istedenfor å gå via React setState — setState hver frame trigger React-
  // reconciliation som ikke alltid synkroniseres med browser paint, og under
  // tung zoom-animasjon (når Google også driver GPU-en hardt) får man dropped
  // frames som ser ut som "hopping". translate3d går rett til compositoren,
  // ingen layout/paint, ingen React-overhead.
  useEffect(() => {
    if (!map3d || !poi) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
      return;
    }
    const update = () => {
      const el = wrapperRef.current;
      if (el) {
        const p = calculateScreenPosition(
          map3d,
          poi.coordinates.lat,
          poi.coordinates.lng,
        );
        if (p) {
          // −28: matcher Mapbox 2D-popupens offset slik at bunn-kanten lander
          // like over markørens visuelle topp. translate(-50%, -100%) sentrerer
          // horisontalt og forankrer bunn-kant til pos.
          el.style.transform = `translate3d(${p.x}px, ${p.y - 28}px, 0) translate(-50%, -100%)`;
          el.style.opacity = "1";
        } else {
          // Bak kameraet eller utenfor projeksjonsdomene — skjul.
          el.style.opacity = "0";
        }
      }
      rafRef.current = requestAnimationFrame(update);
    };
    update();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    };
  }, [poi?.id, map3d]);

  if (!poi) return null;

  const Icon = getFilledIcon(poi.raw.category.icon);
  const color = poi.raw.category.color;
  const circle = markerCircleStyle(color);
  const exploreQuery = poi.address
    ? `${poi.name} ${poi.address}`
    : poi.name;
  const exploreUrl = `https://www.google.com/search?udm=50&q=${encodeURIComponent(exploreQuery)}`;

  return (
    <div
      ref={wrapperRef}
      className="fixed left-0 top-0 z-30 pointer-events-none"
      style={{ willChange: "transform", opacity: 0 }}
    >
      <div
        className="pointer-events-auto w-[260px] rounded-2xl bg-white shadow-[0_12px_32px_rgba(15,29,68,0.22)] border border-stone-200/80"
      >
        <div className="flex items-start gap-2.5 px-3 pt-3">
          <div
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-2"
            style={{
              borderColor: circle.borderColor,
              backgroundColor: circle.backgroundColor,
              color: circle.borderColor,
            }}
          >
            <Icon className="h-4 w-4" weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-stone-900">
              {poi.name}
            </div>
            {poi.address && (
              <div className="truncate text-xs text-stone-500">
                {poi.address}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "BACK_TO_DEFAULT" })}
            aria-label="Lukk"
            className="-mr-1 -mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {poi.body && (
          <p className="mt-1.5 px-3 line-clamp-2 text-[13px] leading-snug text-stone-700">
            {poi.body}
          </p>
        )}

        <div className="mt-2.5 px-3 pb-3">
          <a
            href={exploreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Utforsk
          </a>
        </div>
      </div>
    </div>
  );
}
