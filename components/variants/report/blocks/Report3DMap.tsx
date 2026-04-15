"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Map as MapIcon, X, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { MapView3D, type Map3DInstance } from "@/components/map/map-view-3d";
import ReportMapDrawer from "../ReportMapDrawer";
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
 * Report3DMap — blokk for "Alt rundt [område]"-seksjonen.
 *
 * Dormant preview i rapporten → klikk åpner modal med full 3D-interaksjon.
 * Matcher mønstret fra ReportThemeSection (per-kategori-kart).
 */
interface Report3DMapProps {
  areaSlug?: string | null;
  projectName?: string;
  /** Senter for prosjektet — brukes til distanseberegning og kamerasenter. */
  center?: { lat: number; lng: number };
  /** Ekte POIs fra prosjektet. */
  pois: POI[];
}

export default function Report3DMap({
  areaSlug = null,
  projectName = "prosjektet",
  center,
  pois,
}: Report3DMapProps) {
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
  const [selectedPOIId, setSelectedPOIId] = useState<string | null>(null);
  const mapRef = useRef<Map3DInstance | null>(null);

  const handleMapReady = useCallback((map3d: Map3DInstance | null) => {
    mapRef.current = map3d;
  }, []);

  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    // Googles native flyCameraTo gir smooth tilbake-animasjon
    (
      map as unknown as {
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
          altitude: mapCenter.altitude,
        },
        range: DEFAULT_CAMERA_LOCK.range,
        tilt: DEFAULT_CAMERA_LOCK.tilt,
        heading: 0,
      },
      durationMillis: 1500,
    });
  }, [mapCenter]);

  /** Alle POIs med distansebasert opacity (nær ≤1200m = 1, fjern = 0.3). */
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

  const selectedPOI = useMemo(
    () => pois.find((p) => p.id === selectedPOIId) ?? null,
    [pois, selectedPOIId],
  );

  const handleTabChange = (tabId: Map3DTabId) => {
    setActiveTab(tabId);
    setSelectedPOIId(null);
  };

  const handlePOIClick = (poiId: string) => {
    setSelectedPOIId((prev) => (prev === poiId ? null : poiId));
  };

  const handleOpenSheet = () => {
    setSelectedPOIId(null);
    setSheetOpen(true);
  };

  const handleSheetChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) setSelectedPOIId(null);
  };

  return (
    <section className="py-12 md:py-16">
      <div className="md:max-w-4xl">
        <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] mb-2">
          Alt rundt {projectName}
        </h2>
        <p className="text-[#5d5348] mb-6 leading-relaxed">
          Se nabolaget i ekte 3D — rotér 360° og tilt opp/ned for å utforske
          fra alle vinkler.
        </p>

        {/* Dormant preview — hele flaten er klikkbar */}
        <button
          onClick={handleOpenSheet}
          className="mt-2 md:max-w-4xl h-[320px] md:h-[440px] rounded-2xl overflow-hidden border border-[#eae6e1] relative w-full block cursor-pointer hover:border-[#d4cfc8] transition-colors group"
        >
          <MapView3D
            mapId="report-3d-preview"
            center={mapCenter}
            cameraLock={DEFAULT_CAMERA_LOCK}
            pois={pois}
            opacities={opacities}
            activated={false}
            projectSite={{
              lat: mapCenter.lat,
              lng: mapCenter.lng,
              name: projectName,
              subtitle: "Nybygg 2028",
            }}
          />

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

      {/* Modal — Apple-style slide-up, identisk med ReportThemeSection */}
      <Sheet open={sheetOpen} onOpenChange={handleSheetChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex flex-col p-0 overflow-hidden gap-0 bg-white !border-0
            !inset-x-0 !bottom-0 !top-[4vh]
            md:!inset-x-[4vw] md:!top-[5vh]
            rounded-t-2xl
            data-[state=open]:[animation-name:map-modal-slide-up]
            data-[state=open]:[animation-duration:400ms]
            data-[state=open]:[animation-timing-function:cubic-bezier(0.32,0.72,0,1)]
            data-[state=closed]:[animation-name:map-modal-slide-down]
            data-[state=closed]:[animation-duration:300ms]
            data-[state=closed]:[animation-timing-function:cubic-bezier(0.32,0.72,0,1)]"
        >
          <SheetTitle className="sr-only">
            Alt rundt {projectName} — 3D-kart
          </SheetTitle>

          {/* Drag-håndtak på mobil */}
          <div className="flex justify-center pt-2 pb-0 md:hidden">
            <div className="w-8 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 md:px-5 md:py-3 border-b border-[#eae6e1] bg-white shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <MapIcon className="w-5 h-5 text-[#7a7062] shrink-0" />
              <span className="text-sm md:text-base font-semibold text-[#1a1a1a] truncate">
                Alt rundt {projectName}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleResetView}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-[#eae6e1] text-[#5d5348] hover:border-[#d4cfc8] hover:text-[#1a1a1a] transition-colors"
                aria-label="Tilbake til startpunkt"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tilbake</span>
              </button>
              <button
                onClick={() => handleSheetChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5f3f0] transition-colors"
                aria-label="Lukk"
              >
                <X className="w-4 h-4 text-[#6a6a6a]" />
              </button>
            </div>
          </div>

          {/* Kart + drawer */}
          <div className="relative flex-1 min-h-0 touch-none">
            {/* Deferred mount — én WebGL-kontekst, mountes kun når modalen er åpen */}
            {sheetOpen && (
              <MapView3D
                mapId="report-3d-modal"
                center={mapCenter}
                cameraLock={DEFAULT_CAMERA_LOCK}
                pois={visiblePois}
                opacities={opacities}
                activePOIId={selectedPOIId}
                onPOIClick={handlePOIClick}
                onMapReady={handleMapReady}
                activated
                projectSite={{
                  lat: mapCenter.lat,
                  lng: mapCenter.lng,
                  name: projectName,
                  subtitle: "Nybygg 2028",
                }}
              />
            )}

            {selectedPOI && (
              <ReportMapDrawer
                poi={selectedPOI}
                onClose={() => setSelectedPOIId(null)}
                areaSlug={areaSlug}
              />
            )}
          </div>

          {/* Tab-filter — bottom bar, lett å nå med tommelen */}
          <div className="shrink-0 border-t border-[#eae6e1] bg-white px-4 py-3 safe-area-bottom">
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
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
