"use client";

import { useEffect } from "react";
import {
  APIProvider,
  Map3D,
  Marker3D,
  MapMode,
  AltitudeMode,
  useMap3D,
} from "@vis.gl/react-google-maps";
import Map, { Marker as MapboxMarker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { POI } from "@/lib/types";
import { Marker3DPin } from "./Marker3DPin";
import { getIcon } from "@/lib/utils/map-icons";
import { useWebGLCheck } from "./Map3DFallback";

/**
 * MapView3D — tynn wrapper rundt Google Maps 3D for rapport-flatene.
 *
 * Kamera er låst i "museum-modus":
 *   - center, range: låst via kontrollerte props + imperativ snap-back
 *   - heading: fri 360° rotasjon (horisontal drag)
 *   - tilt: bruker kan justere mellom minTilt og maxTilt (vertikal drag)
 *
 * WebGL-detection faller tilbake til Mapbox 2D-satellitt inline.
 */

export interface CameraLock {
  range: number;
  tilt: number;
  /** Nedre tilt-grense (default = samme som tilt, dvs. låst) */
  minTilt?: number;
  /** Øvre tilt-grense (default = samme som tilt, dvs. låst) */
  maxTilt?: number;
  bounds: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
}

export interface MapView3DProps {
  center: { lat: number; lng: number; altitude?: number };
  cameraLock: CameraLock;
  pois: POI[];
  activePOIId?: string | null;
  onPOIClick?: (poiId: string) => void;
  /** False = passiv preview (ingen interaksjon), True = full interaktivitet. Default true. */
  activated?: boolean;
}

/**
 * Indre komponent som har tilgang til Map3DElement via context.
 *
 * Gjør tre ting:
 * 1. Snap-back range og center (Google har ingen native minRange/maxRange)
 * 2. Vanlig drag (horisontal) = heading-endring (roter 360°)
 * 3. Vanlig drag (vertikal) = tilt-endring (opp/ned mellom min/max)
 */
function CameraController({
  center,
  range,
  minTilt,
  maxTilt,
  activated = true,
}: {
  center: { lat: number; lng: number; altitude?: number };
  range: number;
  minTilt: number;
  maxTilt: number;
  activated?: boolean;
}) {
  const map3d = useMap3D();

  useEffect(() => {
    if (!map3d) return;

    const anyMap = map3d as unknown as {
      range: number;
      heading: number;
      tilt: number;
      center: { lat: number; lng: number; altitude: number };
    };

    // ── Snap-back: range + center ────────────────────────────────────
    const onRangeChange = () => {
      if (anyMap.range !== range) anyMap.range = range;
    };

    const onCenterChange = () => {
      const c = anyMap.center;
      if (
        !c ||
        Math.abs(c.lat - center.lat) > 1e-6 ||
        Math.abs(c.lng - center.lng) > 1e-6
      ) {
        anyMap.center = {
          lat: center.lat,
          lng: center.lng,
          altitude: center.altitude ?? 0,
        };
      }
    };

    // Klemm tilt til [minTilt, maxTilt] — snap-back hvis utenfor.
    const onTiltChange = () => {
      const t = anyMap.tilt;
      if (typeof t !== "number") return;
      if (t < minTilt) anyMap.tilt = minTilt;
      else if (t > maxTilt) anyMap.tilt = maxTilt;
    };

    map3d.addEventListener("gmp-rangechange", onRangeChange);
    map3d.addEventListener("gmp-centerchange", onCenterChange);
    map3d.addEventListener("gmp-tiltchange", onTiltChange);

    // ── Drag-to-rotate/tilt: kun i aktivert modus ────────────────────
    // I preview-modus (activated=false) brukes overlay-knappen til å åpne modalen.
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startHeading = 0;
    let startTilt = 0;
    let pointerId: number | null = null;
    const DRAG_THRESHOLD = 3; // px — skill klikk fra drag

    const onPointerDown = (e: PointerEvent) => {
      if (!activated) return;
      // Primary-button only, ingen shift (la Google håndtere shift+drag)
      if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startHeading = typeof anyMap.heading === "number" ? anyMap.heading : 0;
      startTilt = typeof anyMap.tilt === "number" ? anyMap.tilt : minTilt;
      pointerId = e.pointerId;
      try {
        (map3d as unknown as Element).setPointerCapture?.(e.pointerId);
      } catch {
        // ignore — browser may not support
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const moved = Math.max(Math.abs(deltaX), Math.abs(deltaY));
      if (moved < DRAG_THRESHOLD) return;

      const rect = (map3d as unknown as Element).getBoundingClientRect();

      // Horisontalt: full map-bredde = 180° rotasjon
      const degreesPerPxX = 180 / (rect.width || 600);
      let newHeading = startHeading - deltaX * degreesPerPxX;
      newHeading = ((newHeading % 360) + 360) % 360;
      anyMap.heading = newHeading;

      // Vertikalt: full map-høyde = tilt-spennet. Dra opp → mindre tilt (mer ovenfra)
      const tiltSpan = maxTilt - minTilt;
      const degreesPerPxY = tiltSpan / (rect.height || 400);
      let newTilt = startTilt + deltaY * degreesPerPxY;
      if (newTilt < minTilt) newTilt = minTilt;
      if (newTilt > maxTilt) newTilt = maxTilt;
      anyMap.tilt = newTilt;

      e.preventDefault();
    };

    const onPointerEnd = () => {
      if (!dragging) return;
      dragging = false;
      if (pointerId != null) {
        try {
          (map3d as unknown as Element).releasePointerCapture?.(pointerId);
        } catch {
          // ignore
        }
      }
      pointerId = null;
    };

    map3d.addEventListener("pointerdown", onPointerDown);
    map3d.addEventListener("pointermove", onPointerMove);
    map3d.addEventListener("pointerup", onPointerEnd);
    map3d.addEventListener("pointercancel", onPointerEnd);

    return () => {
      map3d.removeEventListener("gmp-rangechange", onRangeChange);
      map3d.removeEventListener("gmp-centerchange", onCenterChange);
      map3d.removeEventListener("gmp-tiltchange", onTiltChange);
      map3d.removeEventListener("pointerdown", onPointerDown);
      map3d.removeEventListener("pointermove", onPointerMove);
      map3d.removeEventListener("pointerup", onPointerEnd);
      map3d.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [map3d, center, range, minTilt, maxTilt, activated]);

  return null;
}

function Map3DInner({
  center,
  cameraLock,
  pois,
  activePOIId,
  onPOIClick,
  activated = true,
}: MapView3DProps) {
  const minTilt = cameraLock.minTilt ?? cameraLock.tilt;
  const maxTilt = cameraLock.maxTilt ?? cameraLock.tilt;

  return (
    <Map3D
      mode={MapMode.SATELLITE}
      center={{
        lat: center.lat,
        lng: center.lng,
        altitude: center.altitude ?? 0,
      }}
      range={cameraLock.range}
      defaultTilt={cameraLock.tilt}
      defaultHeading={0}
      minTilt={minTilt}
      maxTilt={maxTilt}
      bounds={cameraLock.bounds}
      defaultUIHidden
      style={{ width: "100%", height: "100%" }}
    >
      <CameraController
        center={center}
        range={cameraLock.range}
        minTilt={minTilt}
        maxTilt={maxTilt}
        activated={activated}
      />
      {pois.map((poi) => {
        const Icon = getIcon(poi.category.icon);
        const isActive = activePOIId === poi.id;
        return (
          <Marker3D
            key={poi.id}
            position={{
              lat: poi.coordinates.lat,
              lng: poi.coordinates.lng,
              altitude: isActive ? 20 : 0,
            }}
            altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
            onClick={() => onPOIClick?.(poi.id)}
            title={poi.name}
          >
            <Marker3DPin
              color={poi.category.color}
              Icon={Icon}
              size={isActive ? 48 : 40}
            />
          </Marker3D>
        );
      })}
    </Map3D>
  );
}

/**
 * Mapbox 2D satellitt-fallback når WebGL ikke er tilgjengelig.
 * Bygget inline her (Map3DFallback er en tekst-liste, ikke kart).
 */
function MapboxFallback({
  center,
  pois,
  onPOIClick,
}: {
  center: { lat: number; lng: number };
  pois: POI[];
  onPOIClick?: (poiId: string) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 p-8 text-center">
        <p className="text-sm text-gray-500">
          Kart ikke tilgjengelig — mangler Mapbox-nøkkel.
        </p>
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={{
        longitude: center.lng,
        latitude: center.lat,
        zoom: 15,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
    >
      {pois.map((poi) => {
        const Icon = getIcon(poi.category.icon);
        return (
          <MapboxMarker
            key={poi.id}
            longitude={poi.coordinates.lng}
            latitude={poi.coordinates.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onPOIClick?.(poi.id);
            }}
          >
            <div style={{ cursor: "pointer" }}>
              <Marker3DPin color={poi.category.color} Icon={Icon} />
            </div>
          </MapboxMarker>
        );
      })}
    </Map>
  );
}

export function MapView3D(props: MapView3DProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isAvailable } = useWebGLCheck();

  if (!isAvailable) {
    return (
      <MapboxFallback
        center={props.center}
        pois={props.pois}
        onPOIClick={props.onPOIClick}
      />
    );
  }

  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 p-8 text-center">
        <p className="text-sm text-gray-500">
          Google Maps 3D er ikke konfigurert — mangler API-nøkkel.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["maps3d", "marker"]}>
      <Map3DInner {...props} />
    </APIProvider>
  );
}
