"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Map as MapIcon, X, Loader2, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import ModeToggle from "@/components/map/ModeToggle";
import ReportMapDrawer from "@/components/variants/report/ReportMapDrawer";
import { zoomToRange, rangeToZoom } from "@/lib/utils/camera-map";
import { useInteractionController } from "@/lib/map/use-interaction-controller";
import {
  type MapAdapter,
  mapboxAdapter,
  google3dAdapter,
} from "@/lib/map/map-adapter";
import { useRouteData, type RouteData } from "@/lib/map/use-route-data";
import type { ReactNode } from "react";
import type { POI } from "@/lib/types";
import type { MapRef } from "react-map-gl/mapbox";
import type { Map3DInstance } from "@/components/map/map-view-3d";

/**
 * Discriminator for the activation source.
 * Kept inline (per plan) — promote to `lib/types.ts` when a second consumer exists.
 *
 * - "card":   user clicked a carousel card → fly map, do NOT scroll carousel
 * - "marker": user clicked a map marker   → scroll carousel, do NOT fly map
 */
type ActivePOISource = "card" | "marker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * 4-state machine for safe WebGL context switching.
 *
 * - 'mapbox'          → Mapbox 2D is active, single WebGL context
 * - 'switching-to-3d' → Mapbox unmounting, 150ms delay for loseContext() cleanup
 * - 'google3d'        → Google 3D is active, single WebGL context
 * - 'switching-to-2d' → Google 3D unmounting, 350ms delay (no explicit cleanup)
 */
type MapMode = "mapbox" | "switching-to-3d" | "google3d" | "switching-to-2d";

/**
 * Camera state carried over between mode switches.
 * Stores enough info to initialize either engine at the position
 * where the other engine left off.
 */
export type PendingCamera = {
  lat: number;
  lng: number;
  /** Mapbox zoom level (set when coming from Mapbox, or converted from range) */
  zoom?: number;
  /** Google 3D range in meters (set when coming from 3D, or converted from zoom) */
  range?: number;
  /** Compass heading in degrees (0=north, clockwise) */
  heading?: number;
  /** Tilt from nadir in degrees (Mapbox pitch / Google tilt) */
  tilt?: number;
};

/** Context passed to render-slots so they can register engine refs and receive pendingCamera. */
export interface SlotContext {
  activePOI: string | null;
  /** Which interaction activated this POI — drives side-effects in handlers, not renders. */
  activePOISource: ActivePOISource | null;
  /**
   * Activate (or clear) the selected POI.
   *
   * Side-effects (flyTo/scroll) run directly in the caller's handler —
   * this setter only mutates render-state. Reason: state-driven useEffects
   * race against React batching during rapid clicks.
   *
   * Pass `source` when activating; omit on clear.
   */
  setActivePOI: (id: string | null, source?: ActivePOISource) => void;
  /** Register the Mapbox MapRef so UnifiedMapModal can read camera state on toggle. */
  registerMapboxMap: (ref: MapRef | null) => void;
  /** Register the Google 3D instance so UnifiedMapModal can read camera state on toggle. */
  registerGoogle3dMap: (map: Map3DInstance | null) => void;
  /** Camera to apply on mount after a mode switch. null = use default. */
  pendingCamera: PendingCamera | null;
  /** Shared interaction controller — handlers call flyTo/scroll directly, not via effects. */
  mapController: ReturnType<typeof useInteractionController>;
  /** Register a card DOM element so the controller can scroll to it by POI id. */
  registerCardElement: (poiId: string, el: HTMLElement | null) => void;
  /** Active map mode — slots use this to disable carousel interaction in 3D. */
  mapMode: "2d" | "3d";
  /**
   * Walking-rute fra prosjekt til aktiv POI. Cachet per activePOI.id +
   * projectCenter i `useRouteData`-hook. Null når ingen aktiv POI eller
   * fetch feiler (silent). Konsumeres av RouteLayer3D i 3D-modus; 2D-
   * `ReportThemeMap` har fortsatt sin egen interne fetch (V1 — 2D-konsolidering
   * er dokumentert som follow-up).
   */
  routeData: RouteData | null;
}

export interface UnifiedMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  has3dAddon: boolean;
  pois: POI[];
  center: { lat: number; lng: number };
  /** Render-slot for Mapbox 2D content. Receives the map state so slot can react. */
  mapboxSlot: (ctx: SlotContext) => ReactNode;
  /** Render-slot for Google 3D content. Only invoked when has3dAddon=true. */
  google3dSlot: (ctx: SlotContext) => ReactNode;
  /** Optional bottom bar (e.g., category pills, tab filter). Render-prop so slot can access ctx. */
  bottomSlot?: (ctx: SlotContext) => ReactNode;
  /** Optional area-slug pass-through for ReportMapDrawer */
  areaSlug?: string | null;
  /** Extra elements rendered in the header between the title and close button */
  headerExtras?: ReactNode;
  /** When provided, renders a "Tilbake til startpunkt" reset-camera button in the header.
   *  The callback should reset the active engine's camera to the initial viewport. */
  onResetCamera?: () => void;
}

// ---------------------------------------------------------------------------
// Timing constants — WebGL asymmetry between engines
// ---------------------------------------------------------------------------

/**
 * Mapbox → Google 3D: Mapbox calls WEBGL_lose_context.loseContext() synchronously
 * on map.remove(). 150ms is one GC-tick safety margin.
 */
const MAPBOX_TEARDOWN_MS = 150;

/**
 * Google 3D → Mapbox: Google has NO explicit WebGL cleanup. Context release
 * depends on browser GC, which is slow on iOS WebKit. 350ms gives enough room.
 */
const GOOGLE3D_TEARDOWN_MS = 350;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UnifiedMapModal({
  open,
  onOpenChange,
  title,
  has3dAddon,
  pois,
  center,
  mapboxSlot,
  google3dSlot,
  bottomSlot,
  areaSlug,
  headerExtras,
  onResetCamera,
}: UnifiedMapModalProps) {
  // ---- State machine ----
  const [mapMode, setMapMode] = useState<MapMode>("mapbox");

  // Modalen eier selection lokalt — synker IKKE til useStore.activePOI by design.
  // Se plan 2026-04-19-feat-map-modal-bunn-carousel-plan.md. Begrunnelse: modalen
  // er en selvstendig surface, Zustand-global state eies av siden utenfor.
  const [activePOIState, setActivePOIState] = useState<
    { id: string; source: ActivePOISource } | null
  >(null);
  const activePOI = activePOIState?.id ?? null;
  const activePOISource = activePOIState?.source ?? null;

  // Setter som samtidig tar source. Nullstilling ignorerer source.
  const setActivePOI = useCallback(
    (id: string | null, source?: ActivePOISource) => {
      if (id === null) {
        setActivePOIState(null);
        return;
      }
      setActivePOIState({ id, source: source ?? "card" });
    },
    [],
  );

  // Camera state carried over during mode switches
  const [pendingCamera, setPendingCamera] = useState<PendingCamera | null>(null);

  // Engine refs — registered by slots via context callbacks.
  // Only the active engine's ref is non-null at any time.
  const mapboxRef = useRef<MapRef | null>(null);
  const google3dRef = useRef<Map3DInstance | null>(null);

  const registerMapboxMap = useCallback((ref: MapRef | null) => {
    mapboxRef.current = ref;
  }, []);

  const registerGoogle3dMap = useCallback((map: Map3DInstance | null) => {
    google3dRef.current = map;
  }, []);

  // Registry for carousel card DOM elements. Keyed by POI id.
  const cardRefsRef = useRef<Map<string, HTMLElement>>(new Map());
  const registerCardElement = useCallback(
    (poiId: string, el: HTMLElement | null) => {
      if (el) cardRefsRef.current.set(poiId, el);
      else cardRefsRef.current.delete(poiId);
    },
    [],
  );

  // POI-lookup for controller. Uses a ref so closures always see fresh data.
  const poisRef = useRef<POI[]>(pois);
  poisRef.current = pois;
  const getPOICoords = useCallback((id: string) => {
    const p = poisRef.current.find((x) => x.id === id);
    return p ? { lat: p.coordinates.lat, lng: p.coordinates.lng } : null;
  }, []);
  const getCardElement = useCallback(
    (id: string) => cardRefsRef.current.get(id) ?? null,
    [],
  );
  // Adapter-velger: returnerer riktig MapAdapter basert på aktiv mapMode.
  // Returnerer null under switching-states — useInteractionController no-oper
  // silent når adapter mangler (mode-switch guard).
  const getAdapter = useCallback((): MapAdapter | null => {
    if (mapMode === "mapbox") {
      const m = mapboxRef.current?.getMap?.();
      return m ? mapboxAdapter(m) : null;
    }
    if (mapMode === "google3d") {
      const m3d = google3dRef.current;
      return m3d ? google3dAdapter(m3d) : null;
    }
    // switching-to-3d / switching-to-2d → no-op
    return null;
  }, [mapMode]);

  const mapController = useInteractionController(
    getAdapter,
    getCardElement,
    getPOICoords,
  );

  // Walking-rute-hook: fetches /api/directions med AbortController + debounce
  // + Zod-validering. Resultatet eksponeres via SlotContext så både 2D- og
  // 3D-slot kan konsumere. Se lib/map/use-route-data.ts.
  const activePOIObject = useMemo(
    () => (activePOI ? (pois.find((p) => p.id === activePOI) ?? null) : null),
    [activePOI, pois],
  );
  const { data: routeData } = useRouteData(activePOIObject, center);

  // Ref to the map body container — used for viewport dimensions in camera conversions
  const mapBodyRef = useRef<HTMLDivElement | null>(null);

  // Timer ref for switching delays
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Derived state ----
  const isSwitching =
    mapMode === "switching-to-3d" || mapMode === "switching-to-2d";

  const showMapbox =
    mapMode === "mapbox" || mapMode === "switching-to-3d";
  const showGoogle3d =
    mapMode === "google3d" || mapMode === "switching-to-2d";

  // Opacity classes for the brief overlap during switching
  const mapboxOpacity =
    mapMode === "switching-to-3d"
      ? "opacity-0 transition-opacity duration-150"
      : "opacity-100";
  const google3dOpacity =
    mapMode === "switching-to-2d"
      ? "opacity-0 transition-opacity duration-[350ms]"
      : "opacity-100";

  // ---- Mode toggle (ModeToggle speaks "2d"/"3d", we map to our state machine) ----
  const toggleValue: "2d" | "3d" =
    mapMode === "google3d" || mapMode === "switching-to-3d" ? "3d" : "2d";

  /** Read viewport dimensions from the map body container (or fallback). */
  const getViewportDims = useCallback((): { w: number; h: number } => {
    const el = mapBodyRef.current;
    if (el) return { w: el.clientWidth, h: el.clientHeight };
    return { w: 672, h: 504 }; // sensible desktop fallback
  }, []);

  const handleModeChange = useCallback(
    (mode: "2d" | "3d") => {
      // Spam-click guard: ignore clicks during transition
      if (isSwitching) return;

      if (mode === "3d" && mapMode === "mapbox") {
        // Read current Mapbox camera state before unmounting
        const map = mapboxRef.current?.getMap?.();
        if (map) {
          const mapCenter = map.getCenter();
          const zoom = map.getZoom();
          const bearing = map.getBearing();
          const { w, h } = getViewportDims();
          // Default tilt=60 for first 3D view (good perspective without losing overview)
          const tilt3d = 60;
          const range = zoomToRange(zoom, mapCenter.lat, tilt3d, w, h);
          setPendingCamera({
            lat: mapCenter.lat,
            lng: mapCenter.lng,
            zoom,
            range,
            heading: bearing,
            tilt: tilt3d,
          });
        }
        setMapMode("switching-to-3d");

        switchTimerRef.current = setTimeout(() => {
          setMapMode("google3d");
          switchTimerRef.current = null;
        }, MAPBOX_TEARDOWN_MS);
      } else if (mode === "2d" && mapMode === "google3d") {
        // Read current Google 3D camera state before unmounting
        const map3d = google3dRef.current;
        const gCenter = map3d?.center;
        if (map3d && gCenter) {
          const range = map3d.range ?? 900;
          const heading = map3d.heading ?? 0;
          const tilt = map3d.tilt ?? 45;
          const { w, h } = getViewportDims();
          // Convert range → zoom. Use tilt=0 for the Mapbox side since Mapbox pitch=0
          const zoom = rangeToZoom(range, gCenter.lat, tilt, w, h);
          setPendingCamera({
            lat: gCenter.lat,
            lng: gCenter.lng,
            zoom,
            range,
            heading,
            tilt: 0, // 2D lands flat (deliberate UX choice)
          });
        }
        setMapMode("switching-to-2d");

        switchTimerRef.current = setTimeout(() => {
          setMapMode("mapbox");
          switchTimerRef.current = null;
        }, GOOGLE3D_TEARDOWN_MS);
      }
    },
    [isSwitching, mapMode, getViewportDims],
  );

  // ---- Cleanup timer on unmount ----
  useEffect(() => {
    return () => {
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  // ---- Reset state when modal closes ----
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        // Clear any in-progress switch
        if (switchTimerRef.current) {
          clearTimeout(switchTimerRef.current);
          switchTimerRef.current = null;
        }
        // Cancel any pending flyTo / scrollIntoView before ripping out the map
        mapController.cancelAll();
        setMapMode("mapbox");
        setActivePOI(null);
        setPendingCamera(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, mapController, setActivePOI],
  );

  // Cancel any pending animations when the map mode flips — the underlying
  // Mapbox map unmounts during switching-to-3d, so any leftover rAF callback
  // would reach a dead ref and crash on flyTo.
  useEffect(() => {
    if (mapMode !== "mapbox") {
      mapController.cancelAll();
    }
  }, [mapMode, mapController]);

  // ---- Slot context ----
  const toggleMapMode: "2d" | "3d" =
    mapMode === "google3d" || mapMode === "switching-to-3d" ? "3d" : "2d";

  const slotCtx: SlotContext = useMemo(
    () => ({
      activePOI,
      activePOISource,
      setActivePOI,
      registerMapboxMap,
      registerGoogle3dMap,
      pendingCamera,
      mapController,
      registerCardElement,
      mapMode: toggleMapMode,
      routeData,
    }),
    [
      activePOI,
      activePOISource,
      setActivePOI,
      registerMapboxMap,
      registerGoogle3dMap,
      pendingCamera,
      mapController,
      registerCardElement,
      toggleMapMode,
      routeData,
    ],
  );

  // ---- Resolved active POI object for drawer ----
  const selectedPOI = useMemo(
    () => pois.find((p) => p.id === activePOI) ?? null,
    [pois, activePOI],
  );

  // Debounced aria-live announcement when a marker-source activation happens.
  // "politely" waits 150ms to avoid double-announcing during rapid clicks.
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (activePOISource !== "marker" || !activePOI) return;
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    announceTimerRef.current = setTimeout(() => {
      const poi = pois.find((p) => p.id === activePOI);
      const total = pois.length;
      const idx = pois.findIndex((p) => p.id === activePOI);
      if (poi && idx >= 0) {
        setLiveAnnouncement(`${idx + 1} av ${total}, ${poi.name}`);
      }
    }, 150);
    return () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    };
  }, [activePOI, activePOISource, pois]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          // Dobbel-ESC: første ESC deaktiverer POI hvis satt, andre lukker.
          if (activePOI) {
            e.preventDefault();
            setActivePOI(null);
            mapController.cancelAll();
          }
        }}
        className="flex flex-col p-0 overflow-hidden gap-0 bg-white !border-0
          !inset-0
          !rounded-none
          data-[state=open]:[animation-name:map-modal-slide-up]
          data-[state=open]:[animation-duration:400ms]
          data-[state=open]:[animation-timing-function:cubic-bezier(0.32,0.72,0,1)]
          data-[state=closed]:[animation-name:map-modal-slide-down]
          data-[state=closed]:[animation-duration:300ms]
          data-[state=closed]:[animation-timing-function:cubic-bezier(0.32,0.72,0,1)]"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>

        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-2 pb-0 md:hidden">
          <div className="w-8 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 md:px-5 md:py-3 border-b border-[#eae6e1] bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <MapIcon className="w-5 h-5 text-[#7a7062] shrink-0" />
            <span className="text-sm md:text-base font-semibold text-[#1a1a1a] truncate">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onResetCamera && (
              <button
                onClick={onResetCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-[#eae6e1] text-[#5d5348] hover:border-[#d4cfc8] hover:text-[#1a1a1a] transition-colors"
                aria-label="Tilbake til startpunkt"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tilbake</span>
              </button>
            )}
            {headerExtras}
            {has3dAddon && (
              <ModeToggle
                value={toggleValue}
                onChange={handleModeChange}
                disabled={isSwitching}
              />
            )}
            <button
              onClick={() => handleOpenChange(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5f3f0] transition-colors"
              aria-label="Lukk"
            >
              <X className="w-4 h-4 text-[#6a6a6a]" />
            </button>
          </div>
        </div>

        {/* Map body — render slots with overlap during switching */}
        <div ref={mapBodyRef} className="relative flex-1 min-h-0 touch-none">
          {/* Mapbox 2D slot */}
          {showMapbox && (
            <div className={`absolute inset-0 ${mapboxOpacity}`}>
              {mapboxSlot(slotCtx)}
            </div>
          )}

          {/* Google 3D slot */}
          {showGoogle3d && (
            <div className={`absolute inset-0 ${google3dOpacity}`}>
              {google3dSlot(slotCtx)}
            </div>
          )}

          {/* Spinner overlay during switching */}
          {isSwitching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40">
              <Loader2 className="w-6 h-6 text-[#7a7062] animate-spin" />
            </div>
          )}

          {/* POI drawer — mobile only. Desktop uses the bottom-carousel active
              card (rendered via bottomSlot) so we don't double up the UI. */}
          {selectedPOI && (
            <div className="md:hidden">
              <ReportMapDrawer
                poi={selectedPOI}
                onClose={() => setActivePOI(null)}
                areaSlug={areaSlug}
              />
            </div>
          )}

          {/* Bottom carousel — vises på alle størrelser. Rendered som overlay
              inne i kart-body slik at kortene sitter direkte på kartet (ingen
              hvit footer-stripe). pointer-events-none på wrapper lar kart-
              interaksjoner skje i mellomrommene; kortene selv har
              pointer-events-auto. */}
          {bottomSlot && (
            <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-3 pointer-events-none">
              <div className="pointer-events-auto">{bottomSlot(slotCtx)}</div>
            </div>
          )}
        </div>

        {/* Screen-reader announcement for marker-driven activations. React
            escapes the text, so no dangerouslySetInnerHTML is needed. */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {liveAnnouncement}
        </div>
      </SheetContent>
    </Sheet>
  );
}
