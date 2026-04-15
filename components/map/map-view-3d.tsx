"use client";

import { useCallback, useEffect, useState } from "react";
import {
  APIProvider,
  Map3D,
  Marker3D,
  MapMode,
  AltitudeMode,
  useMap3D,
  GestureHandling,
} from "@vis.gl/react-google-maps";
import Map, { Marker as MapboxMarker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { POI } from "@/lib/types";
import { Marker3DPin } from "./Marker3DPin";
import { ProjectSitePin } from "./ProjectSitePin";
import { Map3DControls, type Map3DAny } from "./Map3DControls";
import { getIcon } from "@/lib/utils/map-icons";
import { useWebGLCheck } from "./Map3DFallback";

/** Type for map3d-instansen vi sender tilbake til foreldre. */
export type Map3DInstance = google.maps.maps3d.Map3DElement;

/**
 * MapView3D — tynn wrapper rundt Google Maps 3D.
 *
 * Bruker Googles native gesture-handling (drag = pan/rotate via modifiers,
 * scroll = zoom, shift+drag = tilt). Smørbløt som Google Maps 3D selv.
 *
 * WebGL-detection faller tilbake til Mapbox 2D-satellitt inline.
 */

export interface CameraLock {
  range: number;
  tilt: number;
  /** Nedre tilt-grense (Googles native min-prop) */
  minTilt?: number;
  /** Øvre tilt-grense (Googles native max-prop) */
  maxTilt?: number;
  /** Nedre altitude-grense for kamera (meter over havet). Begrenser zoom-inn. */
  minAltitude?: number;
  /** Øvre altitude-grense for kamera (meter over havet). Begrenser zoom-ut. */
  maxAltitude?: number;
  /**
   * Halv sidelengde i km for den firkantede pan-boksen rundt center.
   * Total side = 2× denne verdien. Default 5 → 10×10km firkant.
   */
  panHalfSideKm?: number;
}

export interface MapView3DProps {
  center: { lat: number; lng: number; altitude?: number };
  cameraLock: CameraLock;
  pois: POI[];
  activePOIId?: string | null;
  onPOIClick?: (poiId: string) => void;
  /** False = passiv preview (ingen interaksjon), True = full interaktivitet. Default true. */
  activated?: boolean;
  /** Callback som gir foreldre tilgang til map3d-instansen for imperative ops (fly-back etc). */
  onMapReady?: (map3d: Map3DInstance | null) => void;
  /** Unik id — nødvendig når flere Map3D er mountet samtidig (preview + modal). */
  mapId?: string;
  /**
   * Valgfri prosjektmarkør — en stor label-chip som vises over selve tomten.
   * Alltid synlig uavhengig av tab-filter. Brukes til å markere fremtidige bygg.
   */
  projectSite?: {
    lat: number;
    lng: number;
    name: string;
    subtitle?: string;
  };
}

/**
 * Beregner en firkantet bounding-box rundt et geosenter.
 * Firkanten er kvadratisk i fysisk avstand (meter), ikke i grader —
 * derfor cos(lat)-skalering på lng-delta. På breddegrad 63° gir dette
 * samme nord-sør- og øst-vest-utstrekning i meter.
 *
 * 1° lat ≈ 111 km. 1° lng ≈ 111 km × cos(lat).
 */
function squareBoundsAround(
  center: { lat: number; lng: number },
  halfSideKm: number,
) {
  const latDelta = halfSideKm / 111;
  const lngDelta = halfSideKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  return {
    south: center.lat - latDelta,
    north: center.lat + latDelta,
    west: center.lng - lngDelta,
    east: center.lng + lngDelta,
  };
}

/** Intern bro: bringer map3d-instansen opp til foreldre via callback. */
function MapReadyBridge({
  onReady,
}: {
  onReady?: (map3d: Map3DInstance | null) => void;
}) {
  const map3d = useMap3D();
  useEffect(() => {
    if (!onReady) return;
    onReady(map3d);
    return () => onReady(null);
  }, [map3d, onReady]);
  return null;
}

/**
 * Tidligere forsøk med å overstyre Googles gestures ga hakking —
 * deres WebGL-drevne gesture-håndtering er allerede optimalisert.
 * Vi bruker den native nå. Ingen capture-phase, ingen snap-back,
 * ingen rAF-batching. Smørbløt UX som Google Maps 3D selv.
 *
 * Brukeren kan pan/rotér/tilt/zoom fritt i modalen. Dette er akseptert
 * i bytte mot kvalitets-UX.
 */

function Map3DInner({
  center,
  cameraLock,
  pois,
  activePOIId,
  onPOIClick,
  onMapReady,
  activated = true,
  mapId,
  projectSite,
}: MapView3DProps) {
  const minTilt = cameraLock.minTilt;
  const maxTilt = cameraLock.maxTilt;
  const minAltitude = cameraLock.minAltitude;
  const maxAltitude = cameraLock.maxAltitude;
  const panHalfSideKm = cameraLock.panHalfSideKm ?? 5;
  const bounds = squareBoundsAround(center, panHalfSideKm);

  // Fanger map3d-instansen lokalt så Map3DControls (utenfor Map3D-treet)
  // kan bruke den direkte — useMap3D(mapId) er upålitelig utenfor Map3D.
  const [mapInstance, setMapInstance] = useState<Map3DInstance | null>(null);
  const handleReady = useCallback(
    (m: Map3DInstance | null) => {
      setMapInstance(m);
      onMapReady?.(m);
    },
    [onMapReady],
  );

  // Bruker Googles native gesture-handling. Bounds + altitude-grenser
  // håndheves av Google i WebGL → butter smooth, ingen JS-kamp.
  // Map3DControls må være SØSKEN til Map3D (ikke barn), ellers blir
  // div-ene absorbert i custom element sin shadow DOM.
  return (
    // touch-action: none er påkrevd for at Google Maps 3D (WebGL custom element)
    // skal motta touch-events på mobil. Uten dette fanger nettleseren touch som
    // scroll før kartet ser dem. Mapbox setter dette internt; gmp-map-3d gjør det ikke.
    <div className="relative w-full h-full touch-none">
      <Map3D
        id={mapId}
        mode={MapMode.SATELLITE}
        defaultCenter={{
          lat: center.lat,
          lng: center.lng,
          altitude: center.altitude ?? 0,
        }}
        defaultRange={cameraLock.range}
        defaultTilt={cameraLock.tilt}
        defaultHeading={0}
        bounds={bounds}
        minTilt={minTilt}
        maxTilt={maxTilt}
        minAltitude={minAltitude}
        maxAltitude={maxAltitude}
        defaultUIHidden
        gestureHandling={activated ? GestureHandling.GREEDY : GestureHandling.AUTO}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
      >
        <MapReadyBridge onReady={handleReady} />

        {/* Prosjektmarkør — alltid synlig, ikke del av tab-filter */}
        {projectSite && (
          <Marker3D
            position={{
              lat: projectSite.lat,
              lng: projectSite.lng,
              altitude: 30,
            }}
            altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
            title={projectSite.name}
          >
            <ProjectSitePin
              name={projectSite.name}
              subtitle={projectSite.subtitle}
            />
          </Marker3D>
        )}

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
      {activated && (
        <Map3DControls
          map3d={mapInstance as unknown as Map3DAny | null}
          minTilt={minTilt ?? 15}
          maxTilt={maxTilt ?? 75}
          minAltitude={minAltitude ?? 100}
          maxAltitude={maxAltitude ?? 5000}
        />
      )}
    </div>
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
