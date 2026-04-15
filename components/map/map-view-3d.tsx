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
 *   - center, range, tilt: låst via kontrollerte props + imperativ snap-back
 *   - heading: fri 360° rotasjon (uncontrolled)
 *
 * WebGL-detection faller tilbake til Mapbox 2D-satellitt inline.
 */

export interface CameraLock {
  range: number;
  tilt: number;
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
}

/**
 * Indre komponent som har tilgang til Map3DElement via context.
 * Attacher imperative snap-back-lyttere for range/center (ingen native lock).
 */
function CameraSnapBack({
  center,
  range,
}: {
  center: { lat: number; lng: number; altitude?: number };
  range: number;
}) {
  const map3d = useMap3D();

  useEffect(() => {
    if (!map3d) return;

    const onRangeChange = () => {
      const current = (map3d as unknown as { range: number }).range;
      if (current !== range) {
        (map3d as unknown as { range: number }).range = range;
      }
    };

    const onCenterChange = () => {
      // Sammenlign grunt — hvis den drifter bytt tilbake
      const c = (
        map3d as unknown as { center: { lat: number; lng: number } }
      ).center;
      if (
        !c ||
        Math.abs(c.lat - center.lat) > 1e-6 ||
        Math.abs(c.lng - center.lng) > 1e-6
      ) {
        (
          map3d as unknown as {
            center: { lat: number; lng: number; altitude: number };
          }
        ).center = {
          lat: center.lat,
          lng: center.lng,
          altitude: center.altitude ?? 0,
        };
      }
    };

    map3d.addEventListener("gmp-rangechange", onRangeChange);
    map3d.addEventListener("gmp-centerchange", onCenterChange);

    return () => {
      map3d.removeEventListener("gmp-rangechange", onRangeChange);
      map3d.removeEventListener("gmp-centerchange", onCenterChange);
    };
  }, [map3d, center, range]);

  return null;
}

function Map3DInner({
  center,
  cameraLock,
  pois,
  activePOIId,
  onPOIClick,
}: MapView3DProps) {
  return (
    <Map3D
      mode={MapMode.SATELLITE}
      center={{
        lat: center.lat,
        lng: center.lng,
        altitude: center.altitude ?? 0,
      }}
      range={cameraLock.range}
      tilt={cameraLock.tilt}
      defaultHeading={0}
      minTilt={cameraLock.tilt}
      maxTilt={cameraLock.tilt}
      bounds={cameraLock.bounds}
      defaultUIHidden
      style={{ width: "100%", height: "100%" }}
    >
      <CameraSnapBack center={center} range={cameraLock.range} />
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
