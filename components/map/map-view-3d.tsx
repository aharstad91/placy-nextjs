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
import { BlobMarker3D } from "./BlobMarker3D";
import { RevealLayer3D, type RevealItem } from "./RevealLayer3D";
import { ProjectSitePin } from "./ProjectSitePin";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { hexLightTint } from "@/lib/utils/marker-color";
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
    /** Kvadratisk thumbnail (data-URI) for markøren. Undefined → bygnings-glyph. */
    imageSrc?: string;
  };
  /** Per-POI opacity — poi.id → opacity (0–1). Default 1 for alle. */
  opacities?: Record<string, number>;
  /**
   * Når true: `pois` rendres som kompakte farge-prikker (`BlobMarker3D`) i
   * stedet for fulle ikon-pins. Brukes i mobil story-mode-peek (sekundær flate)
   * der full pin-tegning blir for fargerikt/krevende på lite format — samme
   * lav-kognitiv-last-uttrykk som velkommen-beatens reveal-prikker. Default false
   * (desktop + fullskjerm-kart beholder fulle pins).
   */
  compactMarkers?: boolean;
  /**
   * Reveal-sett (blobs + legend-pins) som tegnes inn sekvensielt på velkommen +
   * oppsummering — etableringen av nærområdet. Vises KUN når `showReveal` er true;
   * rendres som et eget lag (RevealLayer3D), helt adskilt fra `pois`-pinnene så vi
   * ikke rører den vanlige marker-stien.
   */
  revealItems?: RevealItem[];
  /** Når true: vis reveal-laget. Default false. */
  showReveal?: boolean;
  /** Når false: vises uten stagger/bounce (prefers-reduced-motion). Default true. */
  animateReveal?: boolean;
  /** Tidsvindu reveal-kaskaden spenner over (ms). Settes ≈ flyturens varighet i
   *  establishing-modus (positional reveal) så punktene tegnes inn i fly-over-takt. */
  revealWindowMs?: number;
  /**
   * Når true: standard Google Maps 3D-gesture-modell — drag panner, ctrl+drag
   * roterer, scroll zoomer, ingen bounds eller altitude/tilt-grenser, ingen
   * orbit-as-default-hijack. Brukes i rapport-board hvor brukeren skal kunne
   * utforske fritt. Default false beholder dagens orbit-låste board-modus for
   * andre kontekster (overview, modal-versjoner).
   */
  freeMode?: boolean;
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
  opacity,
  onPOIClick,
}: {
  poi: POI;
  opacity: number;
  onPOIClick?: (id: string) => void;
}) {
  const Icon = getFilledIcon(poi.category.icon);
  return (
    <Marker3D
      position={{
        lat: poi.coordinates.lat,
        lng: poi.coordinates.lng,
        // Hev over taknivå (ikke 0) så bakke-markører ikke okkluderes av 3D-
        // byggene og blinker inn/ut når kameraet beveger seg.
        // (Hjem-markøren ligger på 30 av samme grunn.)
        altitude: 18,
      }}
      altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
      onClick={() => onPOIClick?.(poi.id)}
      title={poi.name}
      // Lav zIndex så POI-markører ALDRI tegnes oppå prosjektmarkøren
      // (som har zIndex 1_000_000). I 3D bestemmer ikke altitude tegne-
      // rekkefølgen alene — zIndex er den eksplisitte spaken.
      zIndex={1}
    >
      <Marker3DPin
        color={poi.category.color}
        backgroundColor={hexLightTint(poi.category.color)}
        Icon={Icon}
        size={40}
        opacity={opacity}
      />
    </Marker3D>
  );
});

/**
 * Kompakt markør — ren farge-prikk (`BlobMarker3D`) uten ikon/badge. Brukes når
 * `compactMarkers` er på (mobil story-mode-peek): mange POI-er på lite format
 * tegnes som lette prikker i stedet for fulle pins → mindre WebGL-raster, lavere
 * kognitiv last, mindre visuell støy. Memoizert som den fulle varianten.
 */
const CompactMarker3DItem = memo(function CompactMarker3DItem({
  poi,
  opacity,
  onPOIClick,
}: {
  poi: POI;
  opacity: number;
  onPOIClick?: (id: string) => void;
}) {
  return (
    <Marker3D
      position={{
        lat: poi.coordinates.lat,
        lng: poi.coordinates.lng,
        altitude: 16,
      }}
      altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
      onClick={() => onPOIClick?.(poi.id)}
      title={poi.name}
      zIndex={1}
    >
      <BlobMarker3D color={poi.category.color} opacity={opacity} />
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

// ── Prosjektmarkør: range-avhengig skala ──────────────────────────────────
// Google 3D-markører er skjerm-forankret (konstant px uansett zoom), så uten
// dette dominerer chip-en både tett innpå (dekker nabo-POI-er) og uttrukket
// (blokkerer oversikten). Vi holder en moderat størrelse fra default-range og
// innover, og krymper jevnt mot oversikt. Alle fire tall + steget er ment å
// finjusteres på følelse.
const PIN_NEAR_RANGE = 700; // ≤ dette (zoomet inn) → PIN_MAX_SCALE (flatt)
const PIN_FAR_RANGE = 3000; // ≥ dette (zoomet ut) → PIN_MIN_SCALE (flatt)
const PIN_MAX_SCALE = 0.85;
const PIN_MIN_SCALE = 0.5;
/** ms kameraet må stå i ro før prosjekt-pinnen justerer størrelse. */
const PIN_SETTLE_MS = 220;

function scaleForRange(range: number): number {
  const span = PIN_FAR_RANGE - PIN_NEAR_RANGE;
  const t = Math.min(1, Math.max(0, (range - PIN_NEAR_RANGE) / span));
  return PIN_MAX_SCALE + t * (PIN_MIN_SCALE - PIN_MAX_SCALE);
}

/**
 * Range-avhengig skala for prosjektmarkøren (Marker3D) — DEBOUNCED.
 *
 * Marker3D rasteriserer SVG-en til en 3D-tekstur, så hver størrelse er en ny
 * raster. Endrer vi størrelsen UNDER bevegelse (drag/zoom/fly) får vi enten
 * synlige re-raster-hopp (linjene runder ulikt pr. trinn) eller — om vi flytter
 * pinnen til et HTML-overlay for jevn CSS-skala — posisjons-jitter fordi
 * overlayet ikke kan synke 100 % med Googles GPU-render hver frame.
 *
 * Løsning: FRYS skalaen mens kameraet beveger seg (range endrer seg) → ingen
 * re-raster, ingen hopp, ingen jitter. Når kameraet har stått i ro i
 * PIN_SETTLE_MS justeres størrelsen rent ÉN gang (begge tekstlinjer sammen, så
 * ingen pr-linje-hopping). Marker3D = alltid eksakt forankret (Google-native).
 */
function useProjectPinScale(map: Map3DInstance | null): number {
  const [scale, setScale] = useState(PIN_MAX_SCALE);
  useEffect(() => {
    if (!map) return;
    const m = map as unknown as { range?: number };
    let raf = 0;
    let prevRange = -1;
    let stableSince = 0;
    let applied = -1;
    const tick = (ts: number) => {
      const r = m.range ?? 0;
      if (r > 0) {
        if (Math.abs(r - prevRange) > 0.5) {
          // Kamera i bevegelse → frys skala, nullstill ro-timer.
          prevRange = r;
          stableSince = ts;
        } else if (ts - stableSince >= PIN_SETTLE_MS) {
          // I ro lenge nok → juster størrelse én gang.
          const s = scaleForRange(r);
          if (Math.abs(s - applied) > 0.001) {
            applied = s;
            setScale(s);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [map]);
  return scale;
}

function Map3DInner({
  center,
  cameraLock,
  pois,
  onPOIClick,
  onMapReady,
  activated = true,
  mapId,
  projectSite,
  opacities,
  revealItems,
  showReveal = false,
  animateReveal = true,
  revealWindowMs,
  freeMode = false,
  compactMarkers = false,
}: MapView3DProps) {
  // freeMode dropper alle camera-låser så brukeren får standard Google Maps
  // 3D-feel. Andre kontekster (overview, modal) beholder dagens lock for
  // estetisk fokus på prosjekt-tomten.
  const minTilt = freeMode ? undefined : cameraLock.minTilt;
  const maxTilt = freeMode ? undefined : cameraLock.maxTilt;
  const minAltitude = freeMode ? undefined : cameraLock.minAltitude;
  const maxAltitude = freeMode ? undefined : cameraLock.maxAltitude;
  const panHalfSideKm = cameraLock.panHalfSideKm ?? 5;
  const bounds = freeMode ? undefined : squareBoundsAround(center, panHalfSideKm);

  const [mapInstance, setMapInstance] = useState<Map3DInstance | null>(null);
  // Range-avhengig skala på prosjektmarkøren (krymper når man trekker ut).
  const projectPinScale = useProjectPinScale(mapInstance);
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
  // I freeMode skipper vi hele hijack-en — brukeren får standard Google Maps
  // gesture-modell (drag=pan, ctrl+drag=rotate, scroll=zoom, dblclick=zoom).
  useEffect(() => {
    if (!activated) return;
    if (freeMode) return;
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
    const blockZoomWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // EKSPERIMENT (plan 005): touch-blokking helt fjernet — vi prøver Googles
    // native touch-gesture-handling (1-finger pan, pinch zoom, 2-finger rotate/
    // tilt) i håp om at den glatte native-følelsen vinner over en låst statisk
    // opplevelse. bounds + minAltitude/maxAltitude håndheves natively, så
    // brukeren kan ikke skli helt vekk eller zoome ut av orbit-radien.
    // Behold mus-hijack på desktop (ctrlKey-spoof) — den fungerer som forventet.

    // Dobbeltklikk-zoom er deaktivert: kameraet skal forbli forankret rundt
    // boligen. Google's WebGL-handler oppdager dobbeltklikk via egen pointer-
    // tids-tracking, så DOM `dblclick`-eventet alene treffer ikke. Vi teller
    // pointerdown selv og blokkerer den andre raske klikket.
    const DBL_CLICK_THRESHOLD_MS = 300;
    const DBL_CLICK_THRESHOLD_PX = 10;
    let lastPointerDownTime = 0;
    let lastPointerDownX = 0;
    let lastPointerDownY = 0;

    const blockDblClickFromPointer = (e: PointerEvent | MouseEvent) => {
      if ((e as PointerEvent).pointerType === "touch") return;
      if (e.button !== undefined && e.button !== 0) return;

      const now = performance.now();
      const dt = now - lastPointerDownTime;
      const dx = Math.abs(e.clientX - lastPointerDownX);
      const dy = Math.abs(e.clientY - lastPointerDownY);

      if (
        dt < DBL_CLICK_THRESHOLD_MS &&
        dx < DBL_CLICK_THRESHOLD_PX &&
        dy < DBL_CLICK_THRESHOLD_PX
      ) {
        // Dette er det andre klikket i en dobbeltklikk-sekvens. Stopp før
        // Google ser den — stopImmediatePropagation hindrer også vår egen
        // forceOrbitGesture-handler i å fyre på en zoom-klikk.
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        lastPointerDownTime = 0;
        return;
      }
      lastPointerDownTime = now;
      lastPointerDownX = e.clientX;
      lastPointerDownY = e.clientY;
    };

    // Backup: blokkér også DOM-eventene `dblclick` og `click` med detail >= 2
    // i tilfelle Google har en handler på dem.
    const blockDblClickEvent = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const blockMultiClick = (e: MouseEvent) => {
      if (e.detail >= 2) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    // Capture-phase så vi treffer før Google's shadow-DOM-listenere.
    // Dekker både pointer- og mouse-events for bred browser-støtte.
    const captureOpts = { capture: true, passive: true } as AddEventListenerOptions;
    // Wheel og dblclick-blokk må være non-passive for at preventDefault skal fungere.
    const wheelOpts = { capture: true, passive: false } as AddEventListenerOptions;
    const dblOpts = { capture: true, passive: false } as AddEventListenerOptions;

    // VIKTIG: blockDblClickFromPointer registreres FØR forceOrbitGesture så
    // stopImmediatePropagation på den andre klikket også stopper orbit-overstyringen.
    // Kun pointerdown — mousedown fyrer for samme fysiske klikk og ville feilaktig
    // bli tolket som "andre klikk" (lastPointerDownTime nettopp satt av pointerdown).
    container.addEventListener("pointerdown", blockDblClickFromPointer, dblOpts);
    container.addEventListener("pointerdown", forceOrbitGesture, captureOpts);
    container.addEventListener("pointermove", forceOrbitGesture, captureOpts);
    container.addEventListener("mousedown", forceOrbitGesture, captureOpts);
    container.addEventListener("mousemove", forceOrbitGesture, captureOpts);
    container.addEventListener("wheel", blockZoomWheel, wheelOpts);
    container.addEventListener("dblclick", blockDblClickEvent, dblOpts);
    container.addEventListener("click", blockMultiClick, dblOpts);
    return () => {
      container.removeEventListener("pointerdown", blockDblClickFromPointer, dblOpts);
      container.removeEventListener("pointerdown", forceOrbitGesture, captureOpts);
      container.removeEventListener("pointermove", forceOrbitGesture, captureOpts);
      container.removeEventListener("mousedown", forceOrbitGesture, captureOpts);
      container.removeEventListener("mousemove", forceOrbitGesture, captureOpts);
      container.removeEventListener("wheel", blockZoomWheel, wheelOpts);
      container.removeEventListener("dblclick", blockDblClickEvent, dblOpts);
      container.removeEventListener("click", blockMultiClick, dblOpts);
    };
  }, [activated, freeMode]);


  // Bruker Googles native gesture-handling. Bounds + altitude-grenser
  // håndheves av Google i WebGL → butter smooth, ingen JS-kamp.
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
            // Alltid øverst — ingen POI-markør skal okkludere prosjekt-
            // pinnen (POI-markører har zIndex 1).
            zIndex={1_000_000}
          >
            <ProjectSitePin
              name={projectSite.name}
              subtitle={projectSite.subtitle}
              imageSrc={projectSite.imageSrc}
              scale={projectPinScale}
            />
          </Marker3D>
        )}

        {pois.map((poi) =>
          compactMarkers ? (
            <CompactMarker3DItem
              key={poi.id}
              poi={poi}
              opacity={opacities?.[poi.id] ?? 1}
              onPOIClick={onPOIClick}
            />
          ) : (
            <Marker3DItem
              key={poi.id}
              poi={poi}
              opacity={opacities?.[poi.id] ?? 1}
              onPOIClick={onPOIClick}
            />
          ),
        )}

        {/* Reveal-lag (velkommen + oppsummering) — eget marker-sett (blobs +
            legend-pins), adskilt fra pinnene over. Vises kun når showReveal. */}
        {showReveal && revealItems && revealItems.length > 0 && (
          <RevealLayer3D
            items={revealItems}
            animate={animateReveal}
            windowMs={revealWindowMs}
          />
        )}
      </Map3D>
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
              <Marker3DPin
                color={poi.category.color}
                backgroundColor={hexLightTint(poi.category.color)}
                Icon={Icon}
              />
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
