"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView3D, type Map3DInstance } from "@/components/map/map-view-3d";
import { useRouteData } from "@/lib/map/use-route-data";
import { DEFAULT_CAMERA_LOCK } from "@/components/variants/report/blocks/report-3d-config";
import { useBoard, useActiveCategory, useActivePOI } from "./board-state";
import { useBoardPopupMode } from "./use-popup-mode";
import { BoardPOI3DMiniPopup } from "./BoardPOI3DMiniPopup";
import { useAudioTourPhase } from "@/lib/stores/audio-tour-store";
import { useTweenedOpacities } from "./use-tweened-opacities";
import type { PendingCamera } from "@/components/map/UnifiedMapModal";

// RouteLayer3D lazy-loaded — samme bundling-strategi som ReportThemeSection
// (tunge Google Maps-imports holdes ute av 2D-bundlen).
const RouteLayer3D = dynamic(
  () =>
    import("@/components/map/route-layer-3d").then((mod) => ({
      default: mod.RouteLayer3D,
    })),
  { ssr: false },
);

interface Props {
  /**
   * Camera-state arvet fra Mapbox-modus ved toggle. Brukes som initial
   * `defaultCenter` så toggle ikke nullstiller kart-posisjonen.
   */
  pendingCamera: PendingCamera | null;
  /**
   * Sidebar-okkludering på venstre side i piksler. Bounds-fit i tour-mode
   * skalerer range opp og forskyver center.lng østover slik at alle markører
   * lander til høyre for sidebar (speiler 2D-padding-mønsteret).
   */
  mapPaddingLeft?: number;
}

/**
 * 3D-modus av board-kartet.
 *
 * - Bruker `MapView3D` fra components/map (Google Photorealistic 3D Tiles).
 * - Lytter på board-state phases og flyer kameraet via `google3dAdapter`.
 * - Tegner walking-rute fra Home → aktiv POI via `RouteLayer3D`.
 *
 * Bevisste forenklinger sammenlignet med 2D-versjonen:
 * - Default-phase: ingen fitBounds (Google 3D har ikke en native fitBounds-API
 *   for `Map3DElement`), men `defaultCenter` + `cameraLock.range` gir oversikt.
 * - active-phase: fly til prosjektets center med default range. (Bounds-fit
 *   over POI-er er en dokumentert begrensning — se nederst.)
 * - poi-phase: fly til POI med en tettere range (1500 m → ~POI-nær zoom).
 */
export function BoardMap3D({ pendingCamera, mapPaddingLeft = 0 }: Props) {
  const { state, data, dispatch, subFilter } = useBoard();
  const activeCategory = useActiveCategory();
  const activePOI = useActivePOI();
  const popupMode = useBoardPopupMode();

  // Walking-rute for RouteLayer3D — samme hook som BoardPathLayer (2D).
  const poiForRoute = state.phase === "poi" && activePOI ? activePOI.raw : null;
  const { data: routeData } = useRouteData(poiForRoute, data.home.coordinates);

  // Lokal state for map3d-instansen så RouteLayer3D rerenderer når den blir klar.
  const [map3dInstance, setMap3dInstance] = useState<Map3DInstance | null>(null);

  // For å fade markører ved kategori-skifte rendres ALLE POI-er alltid med
  // stabil DOM-identitet, og synlighet styres via `opacities`-map som
  // useTweenedOpacities animerer per rAF (Google rasteriserer SVG per render,
  // så CSS-transitions virker ikke — opacity må drives som React-state).
  //
  // - default + ingen aktiv kategori (Hjem): alle POIs synlige (opacity 1).
  // - default/active + aktiv kategori: kun den kategoriens POIs synlige.
  // - active|poi: kun aktiv kategoris POIs, med sub-filter applisert.
  const allPOIs = useMemo(
    () => data.categories.flatMap((c) => c.pois.map((p) => p.raw)),
    [data.categories],
  );

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    if (state.phase === "default" && !activeCategory) {
      for (const cat of data.categories) {
        for (const p of cat.pois) ids.add(p.id);
      }
    } else if (activeCategory) {
      const useFilter =
        state.phase !== "default" && subFilter.hiddenIds.size > 0;
      for (const p of activeCategory.pois) {
        if (useFilter && subFilter.hiddenIds.has(p.raw.category.id)) continue;
        ids.add(p.id);
      }
    }
    return ids;
  }, [state.phase, data.categories, activeCategory, subFilter.hiddenIds]);

  const allIds = useMemo(() => allPOIs.map((p) => p.id), [allPOIs]);
  const opacities = useTweenedOpacities(allIds, visibleIds, 300);

  // Faktisk-synlige POI-er (target=1) brukt av kamera-fit. Markører som er
  // mid-fade-out ekskluderes så kameraet følger målet, ikke DOM-mengden.
  const visiblePOIs = useMemo(
    () => allPOIs.filter((p) => visibleIds.has(p.id)),
    [allPOIs, visibleIds],
  );

  // Default-camera: bruk pendingCamera hvis tilgjengelig (fra toggle), ellers
  // prosjektets home-koordinater + default 3D-tilt.
  const initialCenter = useMemo(
    () =>
      pendingCamera
        ? { lat: pendingCamera.lat, lng: pendingCamera.lng, altitude: 0 }
        : {
            lat: data.home.coordinates.lat,
            lng: data.home.coordinates.lng,
            altitude: 0,
          },
    [pendingCamera, data.home.coordinates.lat, data.home.coordinates.lng],
  );

  // Bruk pendingCamera.range/tilt hvis tilgjengelig, ellers default fra
  // report-3d-config (range=900, tilt=45).
  const cameraLock = useMemo(() => {
    if (pendingCamera) {
      return {
        ...DEFAULT_CAMERA_LOCK,
        range: pendingCamera.range ?? DEFAULT_CAMERA_LOCK.range,
        tilt: pendingCamera.tilt ?? DEFAULT_CAMERA_LOCK.tilt,
        heading: pendingCamera.heading ?? 0,
      };
    }
    return DEFAULT_CAMERA_LOCK;
  }, [pendingCamera]);

  const handleMapReady = useCallback((m: Map3DInstance | null) => {
    setMap3dInstance(m);
  }, []);

  // Klikk på kart-bakgrunn (ikke markør) → lukk POI-popup. Speiler 2D-mappens
  // onClick på <Map>. gmp-click fyrer for alle klikk i map-elementet inkludert
  // marker-klikk (bubbler), så vi filtrerer på e.target.closest for å unngå at
  // marker-klikk lukker popupen før den åpnes for ny POI.
  useEffect(() => {
    if (!map3dInstance) return;
    const el = map3dInstance as unknown as HTMLElement;
    const onMapClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("gmp-marker-3d-interactive")) return;
      if (state.activePOIId) dispatch({ type: "BACK_TO_DEFAULT" });
    };
    el.addEventListener("gmp-click", onMapClick);
    return () => el.removeEventListener("gmp-click", onMapClick);
  }, [map3dInstance, state.activePOIId, dispatch]);

  // Tour-mode bounding-box-fit (speiler BoardMap.tsx 2D-logikken): når
  // audio-tour kjører, rekalkuler kameraet for hvert kategori-skifte slik at
  // alle synlige markører + home får plass. Gir samme "view changes"-feedback
  // per spor som 2D. Utenfor tour-mode holder kartet posisjonen sin.
  //
  // Google Maps 3D mangler en native `fitBounds`, så vi konverterer bbox til
  // (center, range): center = midtpunkt, range = halvdiagonal / tan(FOV/2)
  // med padding-faktor. FOV=35° matcher det Google faktisk bruker (confirmed
  // via attribution-URL parameters).
  const tourPhase = useAudioTourPhase();
  const tourActive = tourPhase === "playing" || tourPhase === "paused";

  // visiblePOIs er en ny array-referanse hver gang state.phase endres (default
  // ↔ poi) selv om innholdet er likt. Med visiblePOIs i dep-arrayen ville
  // bounds-fit fyrt på hvert marker-klikk (phase=default→poi) — som gir uønsket
  // auto-zoom/drag. Lest via ref slik at effekten kun re-fyrer på reelle
  // kategori-skifter (activeCategory.id) eller tour-state-endringer.
  const visiblePOIsRef = useRef(visiblePOIs);
  visiblePOIsRef.current = visiblePOIs;

  useEffect(() => {
    if (!tourActive) return;
    if (!map3dInstance) return;
    const pois = visiblePOIsRef.current;
    if (pois.length === 0) return;
    let west = data.home.coordinates.lng;
    let east = data.home.coordinates.lng;
    let south = data.home.coordinates.lat;
    let north = data.home.coordinates.lat;
    for (const poi of pois) {
      const { lng, lat } = poi.coordinates;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;
    const metersPerDegLat = 111320;
    const metersPerDegLng =
      111320 * Math.cos((centerLat * Math.PI) / 180);
    const widthM = (east - west) * metersPerDegLng;
    const heightM = (north - south) * metersPerDegLat;
    // Bruk horisontal FOV (avledet fra vertikal FOV + viewport-aspect) som
    // begrensende dimensjon — for 16:9-viewport er horisontal FOV ~59°, mye
    // bredere enn 35° vertikal. Naive «vertikal FOV på diagonal» ga ~1.8×
    // for stor range. Beregn range separat for width og height, ta max.
    const rect = (map3dInstance as unknown as HTMLElement).getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const FOV_V = (35 * Math.PI) / 180;
    const FOV_H = 2 * Math.atan(Math.tan(FOV_V / 2) * aspect);
    const rangeForWidth = widthM / 2 / Math.tan(FOV_H / 2);
    const rangeForHeight = heightM / 2 / Math.tan(FOV_V / 2);
    // Sidebar-kompensasjon: når mapPaddingLeft > 0 okkluderer sidebar venstre
    // del av viewportet. Vi må (1) skalere widthM-range opp 1/visibleFraction
    // så innholdet får plass i smalere synlig region, (2) flytte center.lng
    // østover så bounds-midten lander midt i synlig region.
    const visibleFraction = Math.max(
      0.1,
      (rect.width - mapPaddingLeft) / Math.max(1, rect.width),
    );
    const adjustedRangeForWidth = rangeForWidth / visibleFraction;
    // 1.1× padding-faktor: ~10 % margin. Floor på 200m unngår ekstrem
    // zoom-inn ved single-POI-bounds.
    const range = Math.max(
      200,
      Math.max(adjustedRangeForWidth, rangeForHeight) * 1.1,
    );
    // Shift center østover: i pixel-rom skal center lande på
    // (W + padding_left)/2, dvs forskyvning padding_left/2 piksler. Konverter
    // til meter ved ny range (full viewport-bredde = 2·range·tan(FOV_H/2)).
    const metersPerPixel =
      (2 * range * Math.tan(FOV_H / 2)) / Math.max(1, rect.width);
    const shiftMeters = (mapPaddingLeft / 2) * metersPerPixel;
    const shiftedCenterLng = centerLng + shiftMeters / metersPerDegLng;
    (map3dInstance as {
      flyCameraTo?: (opts: {
        endCamera: {
          center: { lat: number; lng: number; altitude: number };
          tilt: number;
          range: number;
          heading: number;
        };
        durationMillis: number;
      }) => void;
    }).flyCameraTo?.({
      endCamera: {
        center: { lat: centerLat, lng: shiftedCenterLng, altitude: 0 },
        tilt: DEFAULT_CAMERA_LOCK.tilt,
        range,
        heading: 0,
      },
      durationMillis: 800,
    });
  }, [
    tourActive,
    activeCategory?.id,
    map3dInstance,
    data.home.coordinates.lng,
    data.home.coordinates.lat,
    mapPaddingLeft,
  ]);

  return (
    <div className="absolute inset-0">
      <MapView3D
        mapId="board-3d-map"
        center={initialCenter}
        cameraLock={cameraLock}
        freeMode
        pois={allPOIs}
        opacities={opacities}
        activePOIId={activePOI?.id ?? null}
        onPOIClick={(poiId) => {
          // Slå opp kategori-id fra board-data så OPEN_POI vet hvor
          // POI'en hører hjemme (matcher 2D-marker-click semantikk i
          // BoardMap → BoardMarker.onClick → dispatch).
          for (const cat of data.categories) {
            const found = cat.pois.find((p) => p.id === poiId);
            if (found) {
              dispatch({
                type: "OPEN_POI",
                id: found.id,
                categoryId: cat.id,
              });
              return;
            }
          }
        }}
        onMapReady={handleMapReady}
        activated
        projectSite={{
          lat: data.home.coordinates.lat,
          lng: data.home.coordinates.lng,
          name: data.home.name,
        }}
      />
      <RouteLayer3D map3d={map3dInstance} routeData={routeData} />
      {popupMode === "mini" && state.activePOIId && (
        <BoardPOI3DMiniPopup map3d={map3dInstance} />
      )}
    </div>
  );
}
