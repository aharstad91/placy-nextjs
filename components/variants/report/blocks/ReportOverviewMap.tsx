"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Map as MapIcon } from "lucide-react";
import { MapView3D } from "@/components/map/map-view-3d";
import UnifiedMapModal, { type SlotContext } from "@/components/map/UnifiedMapModal";
import ReportThemeMap from "@/components/variants/report/ReportThemeMap";
import { calculateDistance } from "@/lib/utils/geo";
import type { POI } from "@/lib/types";
import {
  DEFAULT_CAMERA_LOCK,
  MAP3D_TAB_IDS,
  MAP3D_TAB_LABELS,
  filterPoisByTab,
  type Map3DTabId,
} from "./report-3d-config";

const NEAR_THRESHOLD_M = 1200;
const FAR_OPACITY = 0.3;

/**
 * ReportOverviewMap — blokk for "Alt rundt [omr\u00e5de]"-seksjonen.
 *
 * Dormant preview i rapporten \u2192 klikk \u00e5pner UnifiedMapModal med 2D default
 * og valgfri 3D-toggle (krever has3dAddon).
 */
interface ReportOverviewMapProps {
  areaSlug?: string | null;
  projectName?: string;
  /** Senter for prosjektet \u2014 brukes til distanseberegning og kamerasenter. */
  center?: { lat: number; lng: number };
  /** Ekte POIs fra prosjektet. */
  pois: POI[];
  /** Whether this project has purchased the 3D map add-on */
  has3dAddon: boolean;
  /** Default heading for alle 3D-kart-instanser (0–359°). 0 = nord. */
  initialHeading?: number;
}

export default function ReportOverviewMap({
  areaSlug = null,
  projectName = "prosjektet",
  center,
  pois,
  has3dAddon,
  initialHeading,
}: ReportOverviewMapProps) {
  const effectiveCameraLock = useMemo(
    () => ({ ...DEFAULT_CAMERA_LOCK, heading: initialHeading ?? 0 }),
    [initialHeading],
  );

  const mapCenter = useMemo(() => {
    if (center) return { lat: center.lat, lng: center.lng, altitude: 0 };
    if (pois.length > 0) {
      const avgLat =
        pois.reduce((s, p) => s + p.coordinates.lat, 0) / pois.length;
      const avgLng =
        pois.reduce((s, p) => s + p.coordinates.lng, 0) / pois.length;
      return { lat: avgLat, lng: avgLng, altitude: 0 };
    }
    return { lat: 63.422, lng: 10.45, altitude: 0 };
  }, [center, pois]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Map3DTabId>("alle");

  // Local ref copies — needed by handleResetCamera (defined outside slot render-prop).
  // The slots also register these refs UP into UnifiedMapModal via ctx.registerMapboxMap / ctx.registerGoogle3dMap
  // so the modal's toggle handler can read camera state for sync.
  const localMapboxRef = useRef<Parameters<SlotContext["registerMapboxMap"]>[0]>(null);
  const localGoogle3dRef = useRef<Parameters<SlotContext["registerGoogle3dMap"]>[0]>(null);

  /** Reset camera — dispatches to whichever engine is currently mounted.
   *  The unmounted engine's ref is null, so the other branch is a safe no-op. */
  const handleResetCamera = useCallback(() => {
    // Mapbox 2D reset
    if (localMapboxRef.current) {
      localMapboxRef.current.flyTo({
        center: [mapCenter.lng, mapCenter.lat],
        zoom: 14,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    }
    // Google 3D reset
    const map3d = localGoogle3dRef.current;
    if (map3d) {
      (
        map3d as unknown as {
          flyCameraTo: (opts: {
            endCamera: {
              center: { lat: number; lng: number; altitude: number };
              range: number;
              tilt: number;
              heading: number;
            };
            durationMillis: number;
          }) => void;
        }
      ).flyCameraTo({
        endCamera: {
          center: {
            lat: mapCenter.lat,
            lng: mapCenter.lng,
            altitude: 0,
          },
          range: effectiveCameraLock.range,
          tilt: effectiveCameraLock.tilt,
          heading: effectiveCameraLock.heading,
        },
        durationMillis: 1500,
      });
    }
  }, [mapCenter]);

  /** Alle POIs med distansebasert opacity (n\u00e6r \u22641200m = 1, fjern = 0.3). */
  const poisWithOpacity = useMemo(() => {
    return pois.map((poi) => {
      const dist = center
        ? calculateDistance(
            center.lat,
            center.lng,
            poi.coordinates.lat,
            poi.coordinates.lng,
          )
        : 0;
      return { ...poi, opacity: dist <= NEAR_THRESHOLD_M ? 1 : FAR_OPACITY };
    });
  }, [pois, center]);

  /** Record for rask opacity-oppslag i MapView3D. */
  const opacities = useMemo(
    () => Object.fromEntries(poisWithOpacity.map((p) => [p.id, p.opacity])),
    [poisWithOpacity],
  );

  const visiblePois = useMemo(
    () => filterPoisByTab(pois, activeTab),
    [pois, activeTab],
  );

  const handleTabChange = (tabId: Map3DTabId) => {
    setActiveTab(tabId);
  };

  const handleOpenSheet = () => {
    setSheetOpen(true);
  };

  const handleSheetChange = (open: boolean) => {
    setSheetOpen(open);
  };

  /** 2D center without altitude — matches Coordinates type for ReportThemeMap */
  const mapCenter2D = useMemo(
    () => ({ lat: mapCenter.lat, lng: mapCenter.lng }),
    [mapCenter.lat, mapCenter.lng],
  );

  return (
    <section className="py-12 md:py-16">
      <div className="md:max-w-4xl">
        <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] mb-2">
          Alt rundt {projectName}
        </h2>
        <p className="text-[#5d5348] mb-6 leading-relaxed">
          Se nabolaget i ekte 3D — rot\u00e9r 360\u00b0 og tilt opp/ned for \u00e5 utforske
          fra alle vinkler.
        </p>

        {/* Dormant preview \u2014 hele flaten er klikkbar */}
        <button
          onClick={handleOpenSheet}
          className="mt-2 md:max-w-4xl h-[320px] md:h-[440px] rounded-2xl overflow-hidden border border-[#eae6e1] relative w-full block cursor-pointer hover:border-[#d4cfc8] transition-colors group"
        >
          {/* TODO(2na.16): Dormant preview switched from MapView3D to ReportThemeMap (Mapbox 2D).
              Update CTA text and description copy to reflect 2D default. */}
          {/* Unmount preview when modal is open \u2014 iOS WebKit only supports one WebGL context.
              pointer-events-none on wrapper: all touch events are caught by the button,
              not by the WebGL element (which would otherwise block click on touch devices). */}
          {!sheetOpen && (
            <div className="absolute inset-0 pointer-events-none">
              <ReportThemeMap
                pois={pois}
                center={mapCenter2D}
                highlightedPOIId={null}
                onMarkerClick={() => {}}
                activated={false}
                projectName={projectName}
              />
            </div>
          )}

          {/* Gradient-overlay som skiller CTA fra kartet */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f5f1ec]/90 via-[#f5f1ec]/10 to-transparent pointer-events-none z-10" />

          {/* CTA sentralt */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center translate-y-[25%] pointer-events-none">
            <p className="text-sm text-[#2a2a2a] font-semibold mb-3">
              {pois.length} steder i 3D
            </p>
            <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-full shadow-lg border border-[#eae6e1] text-sm font-medium text-[#1a1a1a] group-hover:shadow-xl group-hover:border-[#d4cfc8] transition-all">
              <MapIcon className="w-4 h-4 text-[#7a7062]" />
              Utforsk i 3D
            </div>
          </div>
        </button>
      </div>

      {/* Modal \u2014 delegated to UnifiedMapModal (shared Shell, 2D default, optional 3D toggle) */}
      <UnifiedMapModal
        open={sheetOpen}
        onOpenChange={handleSheetChange}
        title={`Alt rundt ${projectName}`}
        has3dAddon={has3dAddon}
        pois={pois}
        center={mapCenter2D}
        areaSlug={areaSlug}
        onResetCamera={handleResetCamera}
        mapboxSlot={(ctx) => (
          <ReportThemeMap
            pois={visiblePois}
            center={mapCenter2D}
            highlightedPOIId={ctx.activePOI}
            onMarkerClick={(id) =>
              ctx.setActivePOI(ctx.activePOI === id ? null : id)
            }
            onMapReady={(ref) => {
              localMapboxRef.current = ref;
              ctx.registerMapboxMap(ref);
            }}
            activated
            projectName={projectName}
          />
        )}
        google3dSlot={(ctx) => (
          <MapView3D
            mapId="report-3d-modal"
            center={mapCenter}
            cameraLock={effectiveCameraLock}
            pois={visiblePois}
            opacities={opacities}
            activePOIId={ctx.activePOI}
            onPOIClick={(id) =>
              ctx.setActivePOI(ctx.activePOI === id ? null : id)
            }
            onMapReady={(map) => {
              localGoogle3dRef.current = map;
              ctx.registerGoogle3dMap(map);
            }}
            activated
            projectSite={{
              lat: mapCenter.lat,
              lng: mapCenter.lng,
              name: projectName,
              subtitle: "Nybygg 2028",
            }}
          />
        )}
        bottomSlot={() => (
          <div
            role="tablist"
            aria-label="Filtrer kategorier"
            className="flex gap-2 overflow-x-auto scrollbar-none"
          >
            {MAP3D_TAB_IDS.map((tabId) => {
              const isActive = tabId === activeTab;
              return (
                <button
                  key={tabId}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tabId)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#1a1a1a] text-white"
                      : "bg-white text-[#5d5348] border border-[#eae6e1] hover:border-[#d4cfc8]"
                  }`}
                >
                  {MAP3D_TAB_LABELS[tabId]}
                </button>
              );
            })}
          </div>
        )}
      />
    </section>
  );
}
