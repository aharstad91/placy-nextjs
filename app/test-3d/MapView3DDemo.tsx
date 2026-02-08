"use client";

import { useState, useRef, useCallback } from "react";
import MapView3D, { useMap3DCamera } from "@/components/map/map-view-3d";
import type { POI, Category, TravelMode } from "@/lib/types";

// Sample POIs for testing (Trondheim city center)
const SAMPLE_CATEGORIES: Category[] = [
  { id: "restaurant", name: "Restaurant", icon: "Utensils", color: "#EF4444" },
  { id: "cafe", name: "Kafé", icon: "Coffee", color: "#F59E0B" },
  { id: "museum", name: "Museum", icon: "Building", color: "#8B5CF6" },
  { id: "park", name: "Park", icon: "Trees", color: "#22C55E" },
];

const SAMPLE_POIS: POI[] = [
  {
    id: "poi-1",
    name: "Nidarosdomen",
    coordinates: { lat: 63.4269, lng: 10.3969 },
    category: SAMPLE_CATEGORIES[2],
    description: "Norges nasjonalhelligdom og Nordens største middelalderkatedral",
  },
  {
    id: "poi-2",
    name: "Bakklandet",
    coordinates: { lat: 63.4295, lng: 10.4015 },
    category: SAMPLE_CATEGORIES[1],
    description: "Sjarmerende bydel med fargerike trehus og brosteinsbelagte gater",
  },
  {
    id: "poi-3",
    name: "Solsiden",
    coordinates: { lat: 63.4355, lng: 10.4108 },
    category: SAMPLE_CATEGORIES[0],
    description: "Moderne bydel med restauranter, barer og shopping",
  },
  {
    id: "poi-4",
    name: "Kristiansten Festning",
    coordinates: { lat: 63.4262, lng: 10.4121 },
    category: SAMPLE_CATEGORIES[3],
    description: "Historisk festning med panoramautsikt over byen",
  },
  {
    id: "poi-5",
    name: "Torvet",
    coordinates: { lat: 63.4305, lng: 10.3951 },
    category: SAMPLE_CATEGORIES[1],
    description: "Byens hovedtorg med statue av Olav Tryggvason",
  },
];

// Sample route from Torvet to Nidarosdomen
const SAMPLE_ROUTE: [number, number][] = [
  [10.3951, 63.4305], // Torvet
  [10.3955, 63.4298],
  [10.3960, 63.4290],
  [10.3965, 63.4280],
  [10.3969, 63.4269], // Nidarosdomen
];

export default function MapView3DDemo() {
  const [activePOI, setActivePOI] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("walk");
  const cameraRef = useRef<ReturnType<typeof useMap3DCamera> | null>(null);

  const handlePOIClick = useCallback((poiId: string) => {
    setActivePOI(poiId);
    setShowRoute(true);

    // Find the POI and fly to it
    const poi = SAMPLE_POIS.find(p => p.id === poiId);
    if (poi && cameraRef.current) {
      cameraRef.current.flyTo(poi.coordinates, {
        range: 500,
        tilt: 60,
        duration: 1500
      });
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setActivePOI(null);
    setShowRoute(false);
  }, []);

  const handleFlyAround = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.flyAround(
        { lat: 63.4285, lng: 10.4020 },
        { rounds: 1, duration: 10000, range: 1000, tilt: 55 }
      );
    }
  }, []);

  const handleResetView = useCallback(() => {
    if (cameraRef.current) {
      const bounds = cameraRef.current.calculateBounds(SAMPLE_POIS.map(p => p.coordinates));
      cameraRef.current.fitBounds(bounds);
    }
    setActivePOI(null);
    setShowRoute(false);
  }, []);

  const activePOIData = activePOI ? SAMPLE_POIS.find(p => p.id === activePOI) : null;

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Control bar */}
      <div className="bg-white border-b p-3 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-gray-700">Phase 2 Demo:</span>

        {/* Camera controls */}
        <div className="flex gap-2">
          <button
            onClick={handleFlyAround}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Fly Around
          </button>
          <button
            onClick={handleResetView}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Reset View
          </button>
        </div>

        <div className="h-6 w-px bg-gray-300" />

        {/* Travel mode selector */}
        <div className="flex gap-1">
          {(["walk", "bike", "car"] as TravelMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setTravelMode(mode)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                travelMode === mode
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {mode === "walk" ? "🚶" : mode === "bike" ? "🚴" : "🚗"} {mode}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-300" />

        {/* Route toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showRoute}
            onChange={(e) => setShowRoute(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show Route
        </label>
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        <MapView3D
          center={{ lat: 63.4285, lng: 10.4020 }}
          pois={SAMPLE_POIS}
          activePOI={activePOI}
          onPOIClick={handlePOIClick}
          onMapClick={handleDismiss}
          showRoute={showRoute}
          routeCoordinates={showRoute ? SAMPLE_ROUTE : undefined}
          travelMode={travelMode}
          cameraRef={cameraRef}
        />

        {/* Active POI info panel */}
        {activePOIData && (
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
                style={{ backgroundColor: activePOIData.category.color }}
              >
                {activePOIData.name[0]}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{activePOIData.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{activePOIData.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="px-2 py-0.5 text-xs rounded-full text-white"
                    style={{ backgroundColor: activePOIData.category.color }}
                  >
                    {activePOIData.category.name}
                  </span>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Status overlay */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 text-sm">
          <div className="font-medium text-gray-700">Phase 2 Components</div>
          <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
            <li>✓ MapView3D</li>
            <li>✓ POIMarkers3D ({SAMPLE_POIS.length} markers)</li>
            <li>✓ RouteLayer3D</li>
            <li>✓ useMap3DCamera hook</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
