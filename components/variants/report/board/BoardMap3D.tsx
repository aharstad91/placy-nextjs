"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapView3D, type Map3DInstance } from "@/components/map/map-view-3d";
import { google3dAdapter } from "@/lib/map/map-adapter";
import { useRouteData } from "@/lib/map/use-route-data";
import { DEFAULT_CAMERA_LOCK } from "@/components/variants/report/blocks/report-3d-config";
import { useBoard, useActiveCategory, useActivePOI } from "./board-state";
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
export function BoardMap3D({ pendingCamera }: Props) {
  const { state, data, dispatch } = useBoard();
  const activeCategory = useActiveCategory();
  const activePOI = useActivePOI();

  // Walking-rute for RouteLayer3D — samme hook som BoardPathLayer (2D).
  const poiForRoute = state.phase === "poi" && activePOI ? activePOI.raw : null;
  const { data: routeData } = useRouteData(poiForRoute, data.home.coordinates);

  // Lokal state for map3d-instansen så RouteLayer3D rerenderer når den blir klar.
  const [map3dInstance, setMap3dInstance] = useState<Map3DInstance | null>(null);

  // Synlige POIer matcher 2D-logikken: alle i default-phase, kun aktiv kategori
  // ellers. Bruker `raw` siden MapView3D forventer POI fra lib/types.
  const visiblePOIs = useMemo(() => {
    if (state.phase === "default") {
      return data.categories.flatMap((c) => c.pois.map((p) => p.raw));
    }
    if (!activeCategory) return [];
    return activeCategory.pois.map((p) => p.raw);
  }, [state.phase, data.categories, activeCategory]);

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

  // Phase-driven camera moves. flyCameraTo via google3dAdapter — bevarer
  // tilt/heading/range, kun center endres. For poi-phase setter vi en
  // tettere range så POI'en faktisk fyller mer av synsfeltet.
  useEffect(() => {
    if (!map3dInstance) return;
    const adapter = google3dAdapter(map3dInstance);

    if (state.phase === "default") {
      adapter.flyTo({
        lat: data.home.coordinates.lat,
        lng: data.home.coordinates.lng,
      });
      return;
    }

    if (state.phase === "poi" && activePOI) {
      // For POI: pre-sett range strammere så vi havner nær. flyCameraTo
      // bruker eksisterende range hvis vi ikke skriver ny — derfor mutere
      // direkte før adapter-call.
      try {
        map3dInstance.range = 600;
      } catch {
        // Read-only på enkelte API-versjoner; no-op er trygt.
      }
      adapter.flyTo({
        lat: activePOI.coordinates.lat,
        lng: activePOI.coordinates.lng,
      });
      return;
    }

    // active / reading: sentrér på prosjektet med litt videre range så hele
    // kategoriens POI-er typisk er innenfor synsfeltet (sensible default
    // siden Map3DElement ikke har en fitBounds-primitiv).
    if (state.phase === "active" || state.phase === "reading") {
      try {
        map3dInstance.range = 1500;
      } catch {
        // No-op.
      }
      adapter.flyTo({
        lat: data.home.coordinates.lat,
        lng: data.home.coordinates.lng,
      });
    }
  }, [
    map3dInstance,
    state.phase,
    activePOI,
    data.home.coordinates.lat,
    data.home.coordinates.lng,
  ]);

  return (
    <div className="absolute inset-0">
      <MapView3D
        mapId="board-3d-map"
        center={initialCenter}
        cameraLock={cameraLock}
        pois={visiblePOIs}
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
    </div>
  );
}
