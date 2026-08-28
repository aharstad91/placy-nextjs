"use client";

import { useCallback, useEffect, useRef, useState, memo } from "react";
import {
  APIProvider,
  Map3D,
  MapMode,
  useMap3D,
  GestureHandling,
} from "@vis.gl/react-google-maps";
import type { POI } from "@/lib/types";
import type { LabelSide } from "@/lib/board/label-collision";
import { DomMarker3D } from "./DomMarker3D";
import { PoiMarkerContent } from "./PoiMarkerContent";
import { isAnchorPOI } from "@/lib/board/anchor-poi";
import { RevealLayer3D, type RevealItem } from "./RevealLayer3D";
import { ProjectSitePin } from "./ProjectSitePin";
import { scaleForRange, PIN_MAX_SCALE } from "./project-pin-scale";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { hexLightTint } from "@/lib/utils/marker-color";
import { useWebGLCheck } from "./use-webgl-check";

/** Type for map3d-instansen vi sender tilbake til foreldre. */
export type Map3DInstance = google.maps.maps3d.Map3DElement;

/**
 * MapView3D — tynn wrapper rundt Google Maps 3D.
 *
 * Bruker Googles native gesture-handling (drag = pan/rotate via modifiers,
 * scroll = zoom, shift+drag = tilt). Smørbløt som Google Maps 3D selv.
 *
 * Når WebGL ikke er tilgjengelig vises en statisk tekst-tilstand (ingen
 * Mapbox-fallback — motoren har 0 Mapbox i hot path).
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
  /**
   * Label-plassering per POI-id, avgjort av kollisjonskullingen hos konsumenten
   * (`use-3d-marker-declutter`). Er en id fraværende, tegnes pinnen uten navn —
   * enten fordi kamera-avstanden er over label-tieren, eller fordi begge sider
   * av markøren var opptatt. Pinnen står uansett; kun teksten forsvinner.
   *
   * Ikke en `Map`: oppslaget skjer i render-løkken og videresendes som
   * PRIMITIVER til den memoiserte `Marker3DItem`, ellers ville et ferskt objekt
   * per render defeatet memo for hver eneste markør.
   */
  markerLabels?: Record<string, { text: string; side: LabelSide }>;
  /**
   * POI-ider som skal tegnes som kompakt prikk i stedet for full ikon-pin, fordi
   * en viktigere pin allerede eier plassen på skjermen. Klikkflaten beholdes —
   * dette er utglisning, ikke skjuling. Se `lib/board/pin-declutter`.
   */
  demotedMarkerIds?: ReadonlySet<string>;
  /**
   * poi.id → CSS `z-index`, rangert etter kamera-avstand av
   * `use-3d-marker-declutter`.
   *
   * Nødvendig fordi Google IKKE depth-sorterer DOM-markører: alle får
   * `z-index: auto`, og rekkefølgen endres ikke når kameraet snus — så overlapp
   * ville avgjorts av mount-rekkefølge i stedet for av hva som står nærmest.
   * Samme Record-form som `markerLabels`, og av samme grunn (memo).
   */
  markerZIndexes?: Record<string, number>;
  /**
   * Markør-størrelse, 1 = `PIN_SIZE`. Kommer fra kollisjonskullingen
   * (`useMarker3DDeclutter().pinScale`) og ikke fra en egen kamera-lytter her:
   * kullingen har allerede kamera-avlesningen, og den som RESERVERER plass må
   * være den som bestemmer hvor stort det tegnes.
   */
  markerScale?: number;
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
  map3d,
  onPOIClick,
  label,
  labelSide,
  compact,
  scale,
  zIndex,
}: {
  poi: POI;
  /** Kartinstansen markøren appendes til. */
  map3d: Map3DInstance | null;
  onPOIClick?: (id: string) => void;
  /** POI-navn som ekte DOM-tekst. Undefined → ingen label (se `markerLabels`). */
  label?: string;
  labelSide?: LabelSide;
  /**
   * Tegn som ren farge-prikk i stedet for full ikon-pin. To kilder: mobil
   * story-mode-peek (`compactMarkers` for ALLE) og utglisningen
   * (`demotedMarkerIds` for de enkelte som taper plassen).
   */
  compact?: boolean;
  /** Zoom-avhengig størrelse (se `markerScale` på MapView3D). */
  scale?: number;
  /**
   * Tegne-rekkefølge fra kamera-avstand. Google depth-sorterer IKKE
   * DOM-markører — alle får `z-index: auto`, og rekkefølgen endres ikke når
   * kameraet snus, så overlapp ville avgjorts av mount-rekkefølge.
   */
  zIndex?: number;
}) {
  return (
    <DomMarker3D
      map3d={map3d}
      lat={poi.coordinates.lat}
      lng={poi.coordinates.lng}
      // Hev over taknivå (ikke 0) så markørene ikke ligger nede i bakkemeshet.
      // Merk at okklusjons-begrunnelsen falt bort med DOM-markørene: de har
      // ingen dybdetest og skjules aldri av bygg. Tallet står fordi det fortsatt
      // bestemmer HVOR markøren projiseres. (Prosjektpinnen ligger på 30.)
      altitude={18}
      onClick={() => onPOIClick?.(poi.id)}
      title={poi.name}
      zIndex={zIndex}
    >
      {/* Prikk og pin er SAMME markør-element, ikke to komponenter som bytter på
          å være mountet (2026-08-23). Et typebytte ville unmountet og remountet
          selve verts-elementet ved hver utglisning, og målt på Strindfjordvegen
          etterlot det spøkelser: Google fortsatte å tegne den fjernede markørens
          tekstur, så en klynge som skulle blitt to pins + seks prikker rendret
          som åtte fulle pins. Å bytte INNHOLDET beholder elementet. Samme grunn
          til at høyden er 18 i begge tilfeller: en altitude-flipp er en
          posisjonsendring på et element som skal stå stille. */}
      <PoiMarkerContent
        color={poi.category.color}
        backgroundColor={hexLightTint(poi.category.color)}
        Icon={getFilledIcon(poi.category.icon)}
        anchor={isAnchorPOI(poi)}
        label={label}
        labelSide={labelSide}
        compact={compact}
        scale={scale}
      />
    </DomMarker3D>
  );
});

// ── Prosjektmarkør: range-avhengig skala ──────────────────────────────────
// Selve rampen bor i `project-pin-scale` — kollisjonskullingen trenger den
// også, for å vite hvor stor chip-en er som hindring.
/** ms kameraet må stå i ro før prosjekt-pinnen justerer størrelse. */
const PIN_SETTLE_MS = 220;

/**
 * Prosjektpinnens lag. Godt over dybdesorteringens verdier
 * (`use-3d-marker-declutter` deler ut rangeringer fra 1, og den aktive POI-en
 * får 100 000), så prosjektet aldri dekkes av en POI.
 */
const Z_PROJECT_PIN = 1_000_000;

/**
 * Range-avhengig skala for prosjektmarkøren — DEBOUNCED.
 *
 * Debouncen fantes opprinnelig fordi hver størrelse var en ny rasterisering, og
 * en endring under bevegelse ga synlige re-raster-hopp. Med DOM-markøren er
 * skalaen ren CSS, så den grunnen er borte — men debouncen BEHOLDES, av en annen
 * grunn som fortsatt gjelder: en pinne som krymper og vokser kontinuerlig mens
 * man drar i kartet er urolig å se på. Å fryse skalaen under bevegelse og justere
 * rent én gang ved ro er en visuell beslutning, ikke en ytelses-beslutning.
 *
 * Merk at posisjonen ALDRI var problemet her: Google skriver `transform` på
 * markøren selv, så den er eksakt forankret uansett — i motsetning til
 * HTML-overlayene (mini-popup, tids-chip) som regner sin egen posisjon per frame.
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
  revealItems,
  showReveal = false,
  animateReveal = true,
  revealWindowMs,
  freeMode = false,
  compactMarkers = false,
  markerLabels,
  demotedMarkerIds,
  markerZIndexes,
  markerScale,
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

  // Container-ref for touch-action-containeren (touch-action:none-divet under).
  // Boardet kjører alltid freeMode → Googles native gesture-modell (drag=pan,
  // ctrl+drag=rotate, scroll=zoom, pinch/2-finger på touch). Den gamle orbit-
  // hijack-en (ctrlKey-spoof + zoom/dblclick-blokk) var no-op i freeMode og er
  // derfor fjernet (CARRY-OVER «dropp orbit-hijack»).
  const containerRef = useRef<HTMLDivElement | null>(null);

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
          <DomMarker3D
            map3d={mapInstance}
            lat={projectSite.lat}
            lng={projectSite.lng}
            altitude={30}
            title={projectSite.name}
            // Over POI-ene. Tidligere var dette Googles zIndex 1_000_000 mot
            // POI-enes 1, men den spaken gjelder bare markør-mot-markør INNE i
            // scenen. Nå ligger alle markørene i samme DOM-stablingskontekst, så
            // CSS z-index er spaken — og den er dessuten finere: `Z_PROJECT_PIN`
            // ligger trygt over dybdesorteringens rangeringer.
            zIndex={Z_PROJECT_PIN}
            // Bevisst IKKE interaktiv: et tapp på prosjektpinnen har alltid lest
            // som kart-bakgrunn og lukket POI-popupen. Å gi den onClick her ville
            // endret den atferden stille.
          >
            <ProjectSitePin
              name={projectSite.name}
              subtitle={projectSite.subtitle}
              imageSrc={projectSite.imageSrc}
              scale={projectPinScale}
            />
          </DomMarker3D>
        )}

        {pois.map((poi) => {
          // Oppslagene gjøres HER og sendes videre som primitiver — se
          // `markerLabels`-doc: et objekt per markør ville defeatet memo.
          const placement = markerLabels?.[poi.id];
          const compact = compactMarkers || (demotedMarkerIds?.has(poi.id) ?? false);
          return (
            <Marker3DItem
              key={poi.id}
              poi={poi}
              map3d={mapInstance}
              onPOIClick={onPOIClick}
              label={compact ? undefined : placement?.text}
              labelSide={placement?.side}
              compact={compact}
              zIndex={markerZIndexes?.[poi.id]}
              scale={markerScale}
            />
          );
        })}

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

export function MapView3D(props: MapView3DProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isAvailable } = useWebGLCheck();

  if (!isAvailable) {
    // Ingen Mapbox-fallback (0 Mapbox i motorens hot path). gmp-map-3d krever
    // WebGL → statisk tekst-tilstand når nettleseren ikke støtter det.
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 p-8 text-center">
        <p className="text-sm text-gray-500">
          3D-kart er ikke tilgjengelig i denne nettleseren.
        </p>
      </div>
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
