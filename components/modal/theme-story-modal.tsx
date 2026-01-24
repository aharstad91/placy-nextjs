"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Search, Footprints, Bike, Car } from "lucide-react";
import type { ThemeStory, POI, Coordinates, TravelMode, TimeBudget } from "@/lib/types";
import { useTravelSettings, useActivePOI } from "@/lib/store";
import { cn, formatTravelTime, isWithinTimeBudget } from "@/lib/utils";
import { MapView } from "@/components/map";
import { POICardExpanded } from "@/components/poi";

// Reisemodus-knapper
const travelModes: { mode: TravelMode; label: string; icon: React.ReactNode }[] = [
  { mode: "walk", label: "Til fots", icon: <Footprints className="w-4 h-4" /> },
  { mode: "bike", label: "Sykkel", icon: <Bike className="w-4 h-4" /> },
  { mode: "car", label: "Bil", icon: <Car className="w-4 h-4" /> },
];

// Tidsbudsjett-alternativer
const timeBudgets: TimeBudget[] = [5, 10, 15];

interface ThemeStoryModalProps {
  themeStory: ThemeStory;
  pois: POI[];
  projectCenter: Coordinates;
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeStoryModal({
  themeStory,
  pois,
  projectCenter,
  isOpen,
  onClose,
}: ThemeStoryModalProps) {
  const { travelMode, timeBudget, setTravelMode, setTimeBudget } = useTravelSettings();
  const { activePOI, setActivePOI } = useActivePOI();
  const [searchQuery, setSearchQuery] = useState("");
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [highlightedPOI, setHighlightedPOI] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const poiRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Filtrer POIs basert på søk
  const filteredPOIs = pois.filter((poi) =>
    poi.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Tell POIs innenfor tidsbudsjett
  const poisWithinBudget = filteredPOIs.filter((poi) =>
    isWithinTimeBudget(poi.travelTime?.[travelMode], timeBudget)
  );

  // Hent reisetid for aktiv POI
  const activePOIData = activePOI ? pois.find((p) => p.id === activePOI) : null;
  const activePOITravelTime = activePOIData?.travelTime?.[travelMode];

  // Hent rute fra Mapbox Directions API når aktiv POI endres
  useEffect(() => {
    if (!activePOI) {
      setRouteCoordinates([]);
      return;
    }

    const poi = pois.find((p) => p.id === activePOI);
    if (!poi) return;

    // Map travel mode til Mapbox profile
    const profileMap: Record<TravelMode, string> = {
      walk: "walking",
      bike: "cycling",
      car: "driving",
    };

    const fetchRoute = async () => {
      try {
        const origin = `${projectCenter.lng},${projectCenter.lat}`;
        const destination = `${poi.coordinates.lng},${poi.coordinates.lat}`;
        const profile = profileMap[travelMode];

        const response = await fetch(
          `/api/directions?origin=${origin}&destination=${destination}&profile=${profile}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.geometry?.coordinates) {
            setRouteCoordinates(data.geometry.coordinates);
          }
        } else {
          // Fallback til rett linje hvis API feiler
          setRouteCoordinates([
            [projectCenter.lng, projectCenter.lat],
            [poi.coordinates.lng, poi.coordinates.lat],
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch route:", error);
        // Fallback til rett linje
        setRouteCoordinates([
          [projectCenter.lng, projectCenter.lat],
          [poi.coordinates.lng, poi.coordinates.lat],
        ]);
      }
    };

    fetchRoute();
  }, [activePOI, pois, projectCenter, travelMode]);

  // Scroll til POI-kort når markør klikkes
  const scrollToPOI = useCallback((poiId: string) => {
    const element = poiRefs.current.get(poiId);
    if (element && scrollContainerRef.current) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Håndter POI-klikk fra kart
  const handleMapPOIClick = useCallback(
    (poiId: string) => {
      setActivePOI(poiId);
      scrollToPOI(poiId);

      // Add temporary highlight
      setHighlightedPOI(poiId);
      setTimeout(() => {
        setHighlightedPOI(null);
      }, 2000);
    },
    [setActivePOI, scrollToPOI]
  );

  // Håndter POI-klikk fra liste
  const handleListPOIClick = useCallback(
    (poiId: string) => {
      setActivePOI(poiId);
    },
    [setActivePOI]
  );

  // Lukk ved Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal container - stacked on mobile, side-by-side on desktop */}
      <div className="relative w-full h-full flex flex-col md:flex-row bg-white">
        {/* Kart - øverst på mobil, høyre på desktop */}
        <div className="h-[40vh] md:hidden relative order-1">
          <MapView
            center={projectCenter}
            pois={filteredPOIs}
            activePOI={activePOI}
            onPOIClick={handleMapPOIClick}
            showRoute={!!activePOI}
            routeCoordinates={routeCoordinates}
            routeTravelTime={activePOITravelTime}
            routeTravelMode={travelMode}
          />
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Venstre kolonne - Scrollbar liste */}
        <div className="w-full md:w-1/2 flex flex-col border-r border-gray-200 order-2 flex-1 md:flex-none md:h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gray-900 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Neighborhood Story
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors hidden md:block"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tittel og teller */}
            <h1 className="text-2xl font-bold mb-2">{themeStory.title}</h1>
            <p className="text-sm text-gray-400">
              {filteredPOIs.length} places found
              <br />
              <span className="text-primary-400">
                {poisWithinBudget.length} highlighted within ≤{timeBudget} min
              </span>
            </p>
          </div>

          {/* Controls */}
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex flex-wrap gap-4 mb-4">
              {/* Travel Mode */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Travel Mode</label>
                <div className="flex gap-1">
                  {travelModes.map(({ mode, label, icon }) => (
                    <button
                      key={mode}
                      onClick={() => setTravelMode(mode)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                        travelMode === mode
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Budget */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Time Budget</label>
                <div className="flex gap-1">
                  {timeBudgets.map((budget) => (
                    <button
                      key={budget}
                      onClick={() => setTimeBudget(budget)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        timeBudget === budget
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {budget} min
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Søkefelt */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search places..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* POI-liste (scrollbar) */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-6"
          >
            {themeStory.sections.map((section) => {
              const sectionPOIs = filteredPOIs.filter((poi) =>
                section.pois.includes(poi.id)
              );

              if (sectionPOIs.length === 0) return null;

              return (
                <div key={section.id}>
                  {/* Seksjonstittel */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {section.title}
                  </h3>

                  {/* Seksjons-beskrivelse */}
                  {section.description && (
                    <p className="text-sm text-gray-600 mb-4">{section.description}</p>
                  )}

                  {/* Seksjons-bilder */}
                  {section.images && section.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {section.images.slice(0, 2).map((_, idx) => (
                        <div
                          key={idx}
                          className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center"
                        >
                          <span className="text-2xl">🚲</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* POI-kort */}
                  <div className="space-y-3">
                    {sectionPOIs.map((poi) => (
                      <div
                        key={poi.id}
                        ref={(el) => {
                          if (el) poiRefs.current.set(poi.id, el);
                        }}
                        className={cn(
                          "rounded-xl transition-all duration-300",
                          highlightedPOI === poi.id && "ring-2 ring-blue-500"
                        )}
                      >
                        <POICardExpanded
                          poi={poi}
                          travelMode={travelMode}
                          isActive={activePOI === poi.id}
                          onShowOnMap={() => handleListPOIClick(poi.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Høyre kolonne - Fast kart (kun desktop) */}
        <div className="hidden md:block md:w-1/2 relative order-3">
          <MapView
            center={projectCenter}
            pois={filteredPOIs}
            activePOI={activePOI}
            onPOIClick={handleMapPOIClick}
            showRoute={!!activePOI}
            routeCoordinates={routeCoordinates}
            routeTravelTime={activePOITravelTime}
            routeTravelMode={travelMode}
          />
        </div>
      </div>
    </div>
  );
}
