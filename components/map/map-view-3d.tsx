"use client";

import { useCallback, useEffect, useRef, useState, memo } from "react";
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
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
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
  /** Default heading (bearing) i grader ved innlasting og reset. 0 = nord. */
  heading?: number;
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
  /** Per-POI opacity — poi.id → opacity (0–1). Default 1 for alle. */
  opacities?: Record<string, number>;
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
 * Memoized markør-komponent — hindrer full re-render av alle markørene
 * ved hvert POI-klikk (kun den aktive markøren trenger å oppdatere seg).
 */
const Marker3DItem = memo(function Marker3DItem({
  poi,
  isActive,
  opacity,
  onPOIClick,
}: {
  poi: POI;
  isActive: boolean;
  opacity: number;
  onPOIClick?: (id: string) => void;
}) {
  const Icon = getFilledIcon(poi.category.icon);
  return (
    <Marker3D
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
        opacity={opacity}
      />
    </Marker3D>
  );
});

/**
 * Orbit-as-default: Hijacker pointer/mouse-events på wrapper-divens capture-phase
 * og tvinger `ctrlKey=true` på mus-drags. Google's interne gesture-handler
 * tolker da alle drags som ROTATE (det som normalt krever Ctrl+drag) —
 * brukeren spinner rundt center-punktet uten å kunne panne bort.
 *
 * Hvorfor event-hijacking og ikke JS-basert kamera-styring:
 * - Tidligere forsøk med rAF + flyCameraTo + manuell mouse-tracking ga hakking
 * - Google's native ROTATE-gesture er allerede smørbløt (WebGL-drevet)
 * - Ved å la Google kjøre sin egen gesture med fakes Ctrl, får vi smoothness gratis
 *
 * Scroll (zoom) og shift+drag (tilt) er uendret — Googles default. Vi rører kun
 * mus-drags uten modifier for å konvertere PAN → ROTATE.
 *
 * Touch: touch-events har ikke ctrlKey-felt, så denne hijack-en treffer kun
 * mus. For touch bruker vi Google's default gesture-handling (GestureHandling.GREEDY).
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
  opacities,
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

  // Container-ref for orbit-hijack (capture-phase event-listener).
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Orbit-as-default: override ctrlKey=true på mus-drags, så Google ser ROTATE.
  // Kun venstre musetast; scroll/touch/shift forblir uberørt.
  useEffect(() => {
    if (!activated) return;
    const container = containerRef.current;
    if (!container) return;

    const forceOrbitGesture = (e: PointerEvent | MouseEvent) => {
      // Kun venstre musetast, kun når Ctrl ikke allerede holdes.
      // Touch (pointerType === 'touch') skipper vi — de har ikke ctrlKey.
      if ((e as PointerEvent).pointerType === "touch") return;
      if (e.button !== undefined && e.button !== 0) return;
      if (e.ctrlKey) return;
      try {
        Object.defineProperty(e, "ctrlKey", {
          get: () => true,
          configurable: true,
        });
      } catch {
        // Ignorer — noen eventer kan være non-configurable.
      }
    };

    // Zoom er deaktivert: blokker scroll-wheel før Google ser eventen.
    // Touch-pinch håndteres ikke her — bruk evt. `touch-action` eller en
    // pointercount-guard hvis pinch-zoom begynner å sniffe seg inn.
    const blockZoomWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Capture-phase så vi treffer før Google's shadow-DOM-listenere.
    // Dekker både pointer- og mouse-events for bred browser-støtte.
    const captureOpts = { capture: true, passive: true } as AddEventListenerOptions;
    // Wheel må være non-passive for at preventDefault skal fungere.
    const wheelOpts = { capture: true, passive: false } as AddEventListenerOptions;

    container.addEventListener("pointerdown", forceOrbitGesture, captureOpts);
    container.addEventListener("pointermove", forceOrbitGesture, captureOpts);
    container.addEventListener("mousedown", forceOrbitGesture, captureOpts);
    container.addEventListener("mousemove", forceOrbitGesture, captureOpts);
    container.addEventListener("wheel", blockZoomWheel, wheelOpts);

    return () => {
      container.removeEventListener("pointerdown", forceOrbitGesture, captureOpts);
      container.removeEventListener("pointermove", forceOrbitGesture, captureOpts);
      container.removeEventListener("mousedown", forceOrbitGesture, captureOpts);
      container.removeEventListener("mousemove", forceOrbitGesture, captureOpts);
      container.removeEventListener("wheel", blockZoomWheel, wheelOpts);
    };
  }, [activated]);


  // Bruker Googles native gesture-handling. Bounds + altitude-grenser
  // håndheves av Google i WebGL → butter smooth, ingen JS-kamp.
  // Map3DControls må være SØSKEN til Map3D (ikke barn), ellers blir
  // div-ene absorbert i custom element sin shadow DOM.
  return (
    // touch-action: none er påkrevd for at Google Maps 3D (WebGL custom element)
    // skal motta touch-events på mobil. Uten dette fanger nettleseren touch som
    // scroll før kartet ser dem. Mapbox setter dette internt; gmp-map-3d gjør det ikke.
    <div ref={containerRef} className="relative w-full h-full touch-none">
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
        defaultHeading={cameraLock.heading ?? 0}
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

        {pois.map((poi) => (
          <Marker3DItem
            key={poi.id}
            poi={poi}
            isActive={activePOIId === poi.id}
            opacity={opacities?.[poi.id] ?? 1}
            onPOIClick={onPOIClick}
          />
        ))}
      </Map3D>
      {activated && (
        <Map3DControls
          map3d={mapInstance as unknown as Map3DAny | null}
          minTilt={minTilt ?? 15}
          maxTilt={maxTilt ?? 75}
          minAltitude={minAltitude ?? 100}
          maxAltitude={maxAltitude ?? 5000}
          showZoom={false}
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
        const Icon = getFilledIcon(poi.category.icon);
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
