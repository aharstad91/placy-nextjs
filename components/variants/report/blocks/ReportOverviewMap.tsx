"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { MapView3D } from "@/components/map/map-view-3d";
import UnifiedMapModal, { type SlotContext } from "@/components/map/UnifiedMapModal";
import ReportThemeMap from "@/components/variants/report/ReportThemeMap";
import ReportMapPreviewCard from "@/components/variants/report/ReportMapPreviewCard";
import type { POI } from "@/lib/types";
import {
  DEFAULT_CAMERA_LOCK,
  MAP3D_TAB_IDS,
  MAP3D_TAB_LABELS,
  filterPoisByTab,
  type Map3DTabId,
} from "./report-3d-config";

/**
 * ReportOverviewMap — blokk for "Alt rundt [område]"-seksjonen.
 *
 * Dormant preview i rapporten → klikk åpner UnifiedMapModal med 2D default
 * og valgfri 3D-toggle (krever has3dAddon).
 */
interface ReportOverviewMapProps {
  areaSlug?: string | null;
  projectName?: string;
  /** Senter for prosjektet — brukes til distanseberegning og kamerasenter. */
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
    <section className="pt-8 md:pt-12 pb-4">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] mb-2">
          Alt rundt {projectName}
        </h2>
        <p className="text-[#5d5348] mb-6 leading-relaxed">
          Se nabolaget i ekte 3D — rotér 360° og tilt opp/ned for å utforske
          fra alle vinkler.
        </p>

        {/* Dormant preview — hele kortet (kart + info-stripe) er klikkbar.
            Unmountes når modal er åpen: iOS WebKit støtter kun én WebGL-kontekst. */}
        {!sheetOpen && (
          <ReportMapPreviewCard
            title="Vis på kart"
            count={pois.length}
            countLabel="steder i nabolaget"
            onClick={handleOpenSheet}
            ariaLabel={`Utforsk alle ${pois.length} steder rundt ${projectName} på kartet`}
          >
            <div className="absolute inset-0 pointer-events-none">
              <ReportThemeMap
                pois={pois}
                center={mapCenter2D}
                highlightedPOIId={null}
                onMarkerClick={() => {}}
                activated={false}
                previewMode
                projectName={projectName}
              />
            </div>
          </ReportMapPreviewCard>
        )}
      </div>

      {/* Modal — delegated to UnifiedMapModal (shared Shell, 2D default, optional 3D toggle) */}
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
