"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Map as MapIcon, X, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapView3D, type Map3DInstance } from "@/components/map/map-view-3d";
import ReportMapDrawer from "../ReportMapDrawer";
import {
  WESSELSLOKKA_CENTER,
  WESSELSLOKKA_CAMERA_LOCK,
  WESSELSLOKKA_POIS,
  WESSELSLOKKA_TAB_IDS,
  WESSELSLOKKA_TAB_LABELS,
  filterPoisByTab,
  type WesselslokkaTabId,
} from "./wesselslokka-3d-config";

/**
 * Report3DMap — blokk for "Alt rundt [område]"-seksjonen.
 *
 * Dormant preview i rapporten → klikk åpner modal med full 3D-interaksjon.
 * Matcher mønstret fra ReportThemeSection (per-kategori-kart).
 */
interface Report3DMapProps {
  areaSlug?: string | null;
  projectName?: string;
  /** Faktisk senter for prosjektet. Faller tilbake til config-default hvis utelatt. */
  center?: { lat: number; lng: number };
}

export default function Report3DMap({
  areaSlug = null,
  projectName = "Wesselsløkka",
  center,
}: Report3DMapProps) {
  const mapCenter = center
    ? { lat: center.lat, lng: center.lng, altitude: 0 }
    : WESSELSLOKKA_CENTER;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WesselslokkaTabId>("alle");
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
          altitude: mapCenter.altitude ?? 0,
        },
        range: WESSELSLOKKA_CAMERA_LOCK.range,
        tilt: WESSELSLOKKA_CAMERA_LOCK.tilt,
        heading: 0,
      },
      durationMillis: 1500,
    });
  }, [mapCenter]);

  const visiblePois = useMemo(
    () => filterPoisByTab(WESSELSLOKKA_POIS, activeTab),
    [activeTab],
  );

  const selectedPOI = useMemo(
    () => WESSELSLOKKA_POIS.find((p) => p.id === selectedPOIId) ?? null,
    [selectedPOIId],
  );

  const handleTabChange = (tabId: WesselslokkaTabId) => {
    setActiveTab(tabId);
    setSelectedPOIId(null);
  };

  const handlePOIClick = (poiId: string) => {
    setSelectedPOIId((prev) => (prev === poiId ? null : poiId));
  };

  const handleOpenDialog = () => {
    setSelectedPOIId(null);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
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
          onClick={handleOpenDialog}
          className="mt-2 md:max-w-4xl h-[320px] md:h-[440px] rounded-2xl overflow-hidden border border-[#eae6e1] relative w-full block cursor-pointer hover:border-[#d4cfc8] transition-colors group"
        >
          <MapView3D
            mapId="wesselslokka-3d-preview"
            center={mapCenter}
            cameraLock={WESSELSLOKKA_CAMERA_LOCK}
            pois={WESSELSLOKKA_POIS}
            activated={false}
          />

          {/* Gradient-overlay som skiller CTA fra kartet */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f5f1ec]/90 via-[#f5f1ec]/10 to-transparent pointer-events-none z-10" />

          {/* CTA sentralt */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center translate-y-[25%] pointer-events-none">
            <p className="text-sm text-[#2a2a2a] font-semibold mb-3">
              {WESSELSLOKKA_POIS.length} steder i 3D
            </p>
            <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-full shadow-lg border border-[#eae6e1] text-sm font-medium text-[#1a1a1a] group-hover:shadow-xl group-hover:border-[#d4cfc8] transition-all">
              <MapIcon className="w-4 h-4 text-[#7a7062]" />
              Utforsk i 3D
            </div>
          </div>
        </button>
      </div>

      {/* Modal — bottom sheet på mobil, sentert dialog på desktop */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col !max-w-none p-0 overflow-hidden gap-0 bg-white fixed bottom-0 left-0 right-0 h-[90vh] rounded-t-2xl rounded-b-none md:static md:w-[90vw] md:h-[88vh] md:rounded-2xl"
        >
          <DialogTitle className="sr-only">
            Alt rundt {projectName} — 3D-kart
          </DialogTitle>

          {/* Drag-håndtak på mobil */}
          <div className="flex justify-center pt-2 pb-0 md:hidden">
            <div className="w-8 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Header med tabs */}
          <div className="flex flex-col gap-3 px-4 py-3 md:px-5 md:py-4 border-b border-[#eae6e1] bg-white shrink-0">
            <div className="flex items-center justify-between gap-2">
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
                  onClick={() => handleDialogChange(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5f3f0] transition-colors"
                  aria-label="Lukk"
                >
                  <X className="w-4 h-4 text-[#6a6a6a]" />
                </button>
              </div>
            </div>

            {/* Tab-filter */}
            <div
              role="tablist"
              aria-label="Filtrer kategorier"
              className="flex flex-wrap gap-2"
            >
              {WESSELSLOKKA_TAB_IDS.map((tabId) => {
                const isActive = tabId === activeTab;
                return (
                  <button
                    key={tabId}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTabChange(tabId)}
                    className={`px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#1a1a1a] text-white"
                        : "bg-white text-[#5d5348] border border-[#eae6e1] hover:border-[#d4cfc8]"
                    }`}
                  >
                    {WESSELSLOKKA_TAB_LABELS[tabId]}
                  </button>
                );
              })}
            </div>

            {/* Hint om interaksjon */}
            <p className="text-xs text-[#8b8275]">
              Dra horisontalt for å rotere · Dra vertikalt for å tilte · Klikk pins
              for detaljer
            </p>
          </div>

          {/* Kart + drawer */}
          <div className="relative flex-1 min-h-0">
            <MapView3D
              mapId="wesselslokka-3d-modal"
              center={mapCenter}
              cameraLock={WESSELSLOKKA_CAMERA_LOCK}
              pois={visiblePois}
              activePOIId={selectedPOIId}
              onPOIClick={handlePOIClick}
              onMapReady={handleMapReady}
              activated
            />

            {selectedPOI && (
              <ReportMapDrawer
                poi={selectedPOI}
                onClose={() => setSelectedPOIId(null)}
                areaSlug={areaSlug}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
