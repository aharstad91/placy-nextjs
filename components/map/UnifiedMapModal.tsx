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
import type { ReactNode } from "react";
import type { POI } from "@/lib/types";
import type { MapRef } from "react-map-gl/mapbox";
import type { Map3DInstance } from "@/components/map/map-view-3d";

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
  setActivePOI: (id: string | null) => void;
  /** Register the Mapbox MapRef so UnifiedMapModal can read camera state on toggle. */
  registerMapboxMap: (ref: MapRef | null) => void;
  /** Register the Google 3D instance so UnifiedMapModal can read camera state on toggle. */
  registerGoogle3dMap: (map: Map3DInstance | null) => void;
  /** Camera to apply on mount after a mode switch. null = use default. */
  pendingCamera: PendingCamera | null;
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
  /** Optional bottom bar (e.g., category pills, tab filter) */
  bottomSlot?: ReactNode;
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
  center: _center,
  mapboxSlot,
  google3dSlot,
  bottomSlot,
  areaSlug,
  headerExtras,
  onResetCamera,
}: UnifiedMapModalProps) {
  // ---- State machine ----
  const [mapMode, setMapMode] = useState<MapMode>("mapbox");
  const [activePOI, setActivePOI] = useState<string | null>(null);

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
        setMapMode("mapbox");
        setActivePOI(null);
        setPendingCamera(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  // ---- Slot context ----
  const slotCtx: SlotContext = useMemo(
    () => ({
      activePOI,
      setActivePOI,
      registerMapboxMap,
      registerGoogle3dMap,
      pendingCamera,
    }),
    [activePOI, registerMapboxMap, registerGoogle3dMap, pendingCamera],
  );

  // ---- Resolved active POI object for drawer ----
  const selectedPOI = useMemo(
    () => pois.find((p) => p.id === activePOI) ?? null,
    [pois, activePOI],
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex flex-col p-0 overflow-hidden gap-0 bg-white !border-0
          !inset-x-0 !bottom-0 !top-[4vh]
          md:!inset-x-[14vw] md:!top-[5vh] md:!bottom-[10vh]
          rounded-t-2xl
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

          {/* POI drawer — motor-agnostic, rendered regardless of active engine */}
          {selectedPOI && (
            <ReportMapDrawer
              poi={selectedPOI}
              onClose={() => setActivePOI(null)}
              areaSlug={areaSlug}
            />
          )}
        </div>

        {/* Footer slot (category pills, tabs, etc.) */}
        {bottomSlot && (
          <div className="shrink-0 border-t border-[#eae6e1] bg-white px-4 py-3 safe-area-bottom">
            {bottomSlot}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
