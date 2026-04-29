"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Map, { type MapRef } from "react-map-gl/mapbox";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";
import ModeToggle from "@/components/map/ModeToggle";
import {
  zoomToRange,
  rangeToZoom,
} from "@/lib/utils/camera-map";
import { useBoard, useActiveCategory } from "./board-state";
import { BoardMarker } from "./BoardMarker";
import { HomeMarker } from "./HomeMarker";
import { BoardPathLayer } from "./BoardPathLayer";
import { BoardPOILabel } from "./BoardPOILabel";
import { BoardTravelChip } from "./BoardTravelChip";
import { BoardMap3D } from "./BoardMap3D";
import type { PendingCamera } from "@/components/map/UnifiedMapModal";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * 4-state machine for safe WebGL context-switching mellom Mapbox 2D og
 * Google Photorealistic 3D Tiles. Mønsteret er kopiert fra
 * `UnifiedMapModal` — se docs/solutions/architecture-patterns/
 * unified-map-modal-2d-3d-toggle-20260415.md for rationale.
 *
 * - 'mapbox'          → kun Mapbox aktiv
 * - 'switching-to-3d' → Mapbox unmount + 150ms teardown for loseContext()
 * - 'google3d'        → kun Google 3D aktiv
 * - 'switching-to-2d' → Google 3D unmount + 350ms GC-vindu
 */
type MapMode = "mapbox" | "switching-to-3d" | "google3d" | "switching-to-2d";

const MAPBOX_TEARDOWN_MS = 150;
const GOOGLE3D_TEARDOWN_MS = 350;

interface Props {
  /**
   * Når true: vis 2D/3D-toggle som overlay øverst til høyre. Kobles fra
   * `Project.has3dAddon` via ReportBoardPage. Defaultes til false så
   * toggle aldri lekker til prosjekter uten add-on.
   */
  has3dAddon?: boolean;
}

export function BoardMap({ has3dAddon = false }: Props) {
  const { state, data, dispatch } = useBoard();
  const activeCategory = useActiveCategory();
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // ---- 2D/3D-state-maskin ----
  const [mapMode, setMapMode] = useState<MapMode>("mapbox");
  const [pendingCamera, setPendingCamera] = useState<PendingCamera | null>(
    null,
  );
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapBodyRef = useRef<HTMLDivElement | null>(null);

  const isSwitching =
    mapMode === "switching-to-3d" || mapMode === "switching-to-2d";
  const showMapbox =
    mapMode === "mapbox" || mapMode === "switching-to-3d";
  const showGoogle3d =
    mapMode === "google3d" || mapMode === "switching-to-2d";

  const toggleValue: "2d" | "3d" =
    mapMode === "google3d" || mapMode === "switching-to-3d" ? "3d" : "2d";

  const mapboxOpacity =
    mapMode === "switching-to-3d"
      ? "opacity-0 transition-opacity duration-150"
      : "opacity-100";
  const google3dOpacity =
    mapMode === "switching-to-2d"
      ? "opacity-0 transition-opacity duration-[350ms]"
      : "opacity-100";

  // Markører som vises avhenger av phase:
  // - default: alle kategorier, alle POI-er (oversiktsmodus)
  // - active|reading|poi: kun aktiv kategoris POI-er
  const visiblePOIs = useMemo(() => {
    if (state.phase === "default") {
      return data.categories.flatMap((c) =>
        c.pois.map((p) => ({ poi: p, color: c.color, icon: c.icon })),
      );
    }
    if (!activeCategory) return [];
    return activeCategory.pois.map((p) => ({
      poi: p,
      color: activeCategory.color,
      icon: activeCategory.icon,
    }));
  }, [state.phase, data.categories, activeCategory]);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (!mapRef.current) return;
    applyIllustratedTheme(mapRef.current.getMap());
  }, []);

  // Bevisst valg: ingen phase-drevne camera-moves. Kartet holder posisjonen
  // sin når kategori velges eller POI klikkes. Brukeren panner/zoomer manuelt.
  // Initial view settes via initialViewState på <Map>.

  // ---- Toggle-handler: lese kamera, sette pendingCamera, schedulere swap ----
  const getViewportDims = useCallback(
    (): { w: number; h: number } => {
      const el = mapBodyRef.current;
      if (el) return { w: el.clientWidth, h: el.clientHeight };
      return { w: 800, h: 600 };
    },
    [],
  );

  const handleModeChange = useCallback(
    (mode: "2d" | "3d") => {
      // Spam-click guard: ignorer klikk under transition.
      if (isSwitching) return;

      if (mode === "3d" && mapMode === "mapbox") {
        const map = mapRef.current?.getMap?.();
        if (map) {
          const c = map.getCenter();
          const zoom = map.getZoom();
          const bearing = map.getBearing();
          const { w, h } = getViewportDims();
          const tilt3d = 60;
          const range = zoomToRange(zoom, c.lat, tilt3d, w, h);
          setPendingCamera({
            lat: c.lat,
            lng: c.lng,
            zoom,
            range,
            heading: bearing,
            tilt: tilt3d,
          });
        } else {
          // Fallback hvis kart-ref ikke er klar (sjelden):
          setPendingCamera({
            lat: data.home.coordinates.lat,
            lng: data.home.coordinates.lng,
          });
        }
        setMapMode("switching-to-3d");
        switchTimerRef.current = setTimeout(() => {
          setMapMode("google3d");
          switchTimerRef.current = null;
        }, MAPBOX_TEARDOWN_MS);
      } else if (mode === "2d" && mapMode === "google3d") {
        // Vi har ikke en lokal Map3DInstance-ref her (BoardMap3D eier den
        // internt). For 3D→2D-toggle bruker vi prosjektets center som
        // fallback-camera så Mapbox havner i en kjent posisjon. Dette er en
        // bevisst forenkling for board-varianten — å trekke ref-en opp ville
        // krevd prop-drilling som er enklere unngått siden Mapbox-defaulten
        // (initialViewState rundt home) er en helt brukbar landing.
        const { w, h } = getViewportDims();
        const fallbackZoom = rangeToZoom(900, data.home.coordinates.lat, 0, w, h);
        setPendingCamera({
          lat: data.home.coordinates.lat,
          lng: data.home.coordinates.lng,
          zoom: fallbackZoom,
          range: 900,
          heading: 0,
          tilt: 0,
        });
        setMapMode("switching-to-2d");
        switchTimerRef.current = setTimeout(() => {
          setMapMode("mapbox");
          switchTimerRef.current = null;
        }, GOOGLE3D_TEARDOWN_MS);
      }
    },
    [
      isSwitching,
      mapMode,
      getViewportDims,
      data.home.coordinates.lat,
      data.home.coordinates.lng,
    ],
  );

  // Cleanup timer ved unmount
  useEffect(() => {
    return () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    };
  }, []);

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground p-8 text-center text-sm">
        Mapbox-token mangler — sett NEXT_PUBLIC_MAPBOX_TOKEN i .env.local.
      </div>
    );
  }

  return (
    <div ref={mapBodyRef} className="absolute inset-0">
      {!mapLoaded && mapMode === "mapbox" && (
        <div className="absolute inset-0 z-20 bg-[#f0ece6] animate-pulse" />
      )}

      {/* Mapbox 2D-lag */}
      {showMapbox && (
        <div className={`absolute inset-0 ${mapboxOpacity}`}>
          <Map
            ref={mapRef}
            mapboxAccessToken={TOKEN}
            initialViewState={{
              longitude:
                pendingCamera?.lng ?? data.home.coordinates.lng,
              latitude:
                pendingCamera?.lat ?? data.home.coordinates.lat,
              zoom: pendingCamera?.zoom ?? 13.5,
              bearing: pendingCamera?.heading ?? 0,
              pitch: pendingCamera?.tilt ?? 0,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={MAP_STYLE_STANDARD}
            onLoad={handleMapLoad}
          >
            <HomeMarker
              coordinates={data.home.coordinates}
              name={data.home.name}
              onClick={() => dispatch({ type: "RESET_TO_DEFAULT" })}
            />

            {visiblePOIs.map(({ poi, color, icon }) => (
              <BoardMarker
                key={poi.id}
                poi={poi}
                color={color}
                icon={icon}
                isActive={state.activePOIId === poi.id}
                isDimmed={state.phase === "default"}
                onClick={() =>
                  dispatch({
                    type: "OPEN_POI",
                    id: poi.id,
                    categoryId: poi.categoryId,
                  })
                }
              />
            ))}

            <BoardPathLayer />
            <BoardPOILabel />
          </Map>
        </div>
      )}

      {/* Google 3D-lag */}
      {showGoogle3d && (
        <div className={`absolute inset-0 ${google3dOpacity}`}>
          <BoardMap3D pendingCamera={pendingCamera} />
        </div>
      )}

      {/* Spinner under switching */}
      {isSwitching && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/30 pointer-events-none">
          <Loader2 className="w-6 h-6 text-[#7a7062] animate-spin" />
        </div>
      )}

      {/* HTML-overlay (utenfor Map): travel-chip plassert over POI-sheet */}
      <BoardTravelChip />

      {/* 2D/3D-toggle øverst til høyre — kun synlig når 3D-add-on er kjøpt */}
      {has3dAddon && (
        <div className="absolute top-3 right-3 z-30">
          <ModeToggle
            value={toggleValue}
            onChange={handleModeChange}
            disabled={isSwitching}
          />
        </div>
      )}
    </div>
  );
}
