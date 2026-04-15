"use client";

import { useState, useMemo } from "react";
import { MapView3D } from "@/components/map/map-view-3d";
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
 * Rendrer et Google Maps 3D-kart sentrert over Wesselsløkka med
 * tab-filtrerte pins. Kamera er låst; kun heading (360° rotasjon) er fri.
 */
interface Report3DMapProps {
  areaSlug?: string | null;
  projectName?: string;
}

export default function Report3DMap({
  areaSlug = null,
  projectName = "Wesselsløkka",
}: Report3DMapProps) {
  const [activeTab, setActiveTab] = useState<WesselslokkaTabId>("alle");
  const [selectedPOIId, setSelectedPOIId] = useState<string | null>(null);

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
    // Lukk drawer når tab byttes — matcher dagens TabbedAerialMap-adferd
    setSelectedPOIId(null);
  };

  const handlePOIClick = (poiId: string) => {
    // Klikk på aktiv pin → lukk drawer (toggle)
    setSelectedPOIId((prev) => (prev === poiId ? null : poiId));
  };

  return (
    <section className="py-12 md:py-16">
      <div className="md:max-w-4xl">
        <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] mb-2">
          Alt rundt {projectName}
        </h2>
        <p className="text-[#5d5348] mb-6 leading-relaxed">
          Rotér kartet 360° for å se nabolaget fra alle vinkler. Klikk på en pin
          for detaljer om stedet.
        </p>

        {/* Tab-filter */}
        <div
          role="tablist"
          aria-label="Filtrer kategorier"
          className="flex flex-wrap gap-2 mb-4"
        >
          {WESSELSLOKKA_TAB_IDS.map((tabId) => {
            const isActive = tabId === activeTab;
            return (
              <button
                key={tabId}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tabId)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
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

        {/* Kart-container med fast aspect-ratio */}
        <div className="relative md:max-w-4xl aspect-[4/3] rounded-2xl overflow-hidden border border-[#eae6e1] bg-[#f5f1ec]">
          <MapView3D
            center={WESSELSLOKKA_CENTER}
            cameraLock={WESSELSLOKKA_CAMERA_LOCK}
            pois={visiblePois}
            activePOIId={selectedPOIId}
            onPOIClick={handlePOIClick}
          />

          {selectedPOI && (
            <ReportMapDrawer
              poi={selectedPOI}
              onClose={() => setSelectedPOIId(null)}
              areaSlug={areaSlug}
            />
          )}
        </div>
      </div>
    </section>
  );
}
