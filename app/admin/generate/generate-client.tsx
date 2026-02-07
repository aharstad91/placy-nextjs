"use client";

import { useState, useRef, useCallback } from "react";
import Map, { Marker, Source, Layer, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import { createCircleCoordinates } from "@/lib/utils/geo";
import {
  MapPin,
  Sparkles,
  Check,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  ExternalLink,
  Utensils,
  Coffee,
  Wine,
  Croissant,
  Dumbbell,
  ShoppingCart,
  Pill,
  Building,
  Mail,
  ShoppingBag,
  Landmark,
  BookOpen,
  TreePine,
  Film,
  Hospital,
  Stethoscope,
  Smile,
  Scissors,
  Building2,
  Bus,
  Bike,
  ParkingCircle,
  TrainFront,
  TramFront,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminSecondaryNav, SecondaryNavTrigger } from "@/components/admin/admin-secondary-nav";

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";
const DEFAULT_CENTER = { lat: 63.4305, lng: 10.3951 };

const customStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    50% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
  }
  @keyframes checkPop {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-fadeInUp { animation: fadeInUp 0.2s ease-out forwards; }
  .animate-pulseGlow { animation: pulseGlow 2s ease-in-out infinite; }
  .animate-checkPop { animation: checkPop 0.3s ease-out forwards; }
  .animate-spin { animation: spin 1s linear infinite; }
`;

interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  group: "place" | "transport";
}

const ALL_CATEGORIES: Category[] = [
  { id: "restaurant", name: "Restaurant", icon: Utensils, color: "#ef4444", group: "place" },
  { id: "cafe", name: "Kafé", icon: Coffee, color: "#f97316", group: "place" },
  { id: "bar", name: "Bar", icon: Wine, color: "#a855f7", group: "place" },
  { id: "bakery", name: "Bakeri", icon: Croissant, color: "#f59e0b", group: "place" },
  { id: "gym", name: "Treningssenter", icon: Dumbbell, color: "#ec4899", group: "place" },
  { id: "supermarket", name: "Dagligvare", icon: ShoppingCart, color: "#22c55e", group: "place" },
  { id: "pharmacy", name: "Apotek", icon: Pill, color: "#06b6d4", group: "place" },
  { id: "bank", name: "Bank", icon: Building, color: "#6366f1", group: "place" },
  { id: "post_office", name: "Post", icon: Mail, color: "#f43f5e", group: "place" },
  { id: "shopping_mall", name: "Kjøpesenter", icon: ShoppingBag, color: "#8b5cf6", group: "place" },
  { id: "museum", name: "Museum", icon: Landmark, color: "#0ea5e9", group: "place" },
  { id: "library", name: "Bibliotek", icon: BookOpen, color: "#14b8a6", group: "place" },
  { id: "park", name: "Park", icon: TreePine, color: "#10b981", group: "place" },
  { id: "movie_theater", name: "Kino", icon: Film, color: "#f472b6", group: "place" },
  { id: "hospital", name: "Sykehus", icon: Hospital, color: "#ef4444", group: "place" },
  { id: "doctor", name: "Legesenter", icon: Stethoscope, color: "#3b82f6", group: "place" },
  { id: "dentist", name: "Tannlege", icon: Smile, color: "#22d3ee", group: "place" },
  { id: "hair_care", name: "Frisør", icon: Scissors, color: "#d946ef", group: "place" },
  { id: "spa", name: "Spa", icon: Sparkles, color: "#c084fc", group: "place" },
  { id: "hotel", name: "Hotell", icon: Building2, color: "#0891b2", group: "place" },
  { id: "bus", name: "Buss", icon: Bus, color: "#3b82f6", group: "transport" },
  { id: "train", name: "Tog", icon: TrainFront, color: "#0ea5e9", group: "transport" },
  { id: "tram", name: "Trikk", icon: TramFront, color: "#f97316", group: "transport" },
  { id: "bike", name: "Bysykkel", icon: Bike, color: "#22c55e", group: "transport" },
];

const DEFAULT_CATEGORIES = new Set(["restaurant", "cafe", "supermarket", "bus", "bike"]);

type GenerationStep = "idle" | "discovering" | "structuring" | "writing" | "done" | "error";

interface GenerationResult {
  success: boolean;
  poiCount?: number;
  error?: string;
  projectUrl?: string;
}

interface GenerateClientProps {
  customers: { id: string; name: string }[];
}

export function GenerateClient({ customers }: GenerateClientProps) {
  const mapRef = useRef<MapRef>(null);

  // Secondary nav state (mobile)
  const [secondaryNavOpen, setSecondaryNavOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(1000);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(DEFAULT_CATEGORIES);

  // Generation state
  const [step, setStep] = useState<GenerationStep>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [discoveredCount, setDiscoveredCount] = useState(0);

  const isValid = name.trim() && customerId && center && selectedCategories.size > 0;

  const handleMapClick = useCallback((event: mapboxgl.MapLayerMouseEvent) => {
    if (step !== "idle") return;
    const { lng, lat } = event.lngLat;
    setCenter({ lat, lng });
  }, [step]);

  const toggleCategory = (id: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCategories(newSet);
  };

  const handleGenerate = async () => {
    if (!isValid || !center) return;

    setStep("discovering");
    setDiscoveredCount(0);
    setResult(null);

    const categoryIds = Array.from(selectedCategories);

    try {
      const response = await fetch("/api/story-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          customerId,
          center,
          radius,
          categoryIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Generering feilet");
      }

      setDiscoveredCount(data.poiCount || 0);

      setStep("structuring");
      await new Promise(r => setTimeout(r, 400));

      setStep("writing");
      await new Promise(r => setTimeout(r, 300));

      setStep("done");
      setResult({
        success: true,
        poiCount: data.poiCount,
        projectUrl: data.projectUrl,
      });
    } catch (error) {
      setStep("error");
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Ukjent feil",
      });
    }
  };

  const handleReset = () => {
    setStep("idle");
    setResult(null);
    setName("");
    setCustomerId("");
    setCenter(null);
    setDiscoveredCount(0);
    setSelectedCategories(DEFAULT_CATEGORIES);
  };

  const radiusCircle = center ? {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [createCircleCoordinates(center.lng, center.lat, radius)],
    },
    properties: {},
  } : null;

  const isGenerating = step !== "idle" && step !== "done" && step !== "error";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />

      <div className="flex h-screen bg-gray-100 overflow-hidden">
        {/* Mobile trigger */}
        <SecondaryNavTrigger
          onClick={() => setSecondaryNavOpen(true)}
          label="Åpne generator-panel"
        />

        {/* Secondary Navigation */}
        <AdminSecondaryNav
          isOpen={secondaryNavOpen}
          onClose={() => setSecondaryNavOpen(false)}
          title="Story Generator"
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 hidden lg:block">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900 tracking-tight">Story Generator</h1>
                  <p className="text-xs text-gray-500">Klikk på kartet for senter</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {step === "done" && result?.success ? (
                <div className="p-4 space-y-4 animate-fadeInUp">
                  <div className="text-center py-6">
                    <div
                      className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center animate-checkPop"
                      style={{
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        boxShadow: "0 8px 24px rgba(16, 185, 129, 0.4)",
                      }}
                    >
                      <Check className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Story generert!</h2>
                    <p className="text-sm text-gray-500">
                      {result.poiCount} POIs funnet og strukturert
                    </p>
                  </div>

                  <div className="space-y-2">
                    <a
                      href={result.projectUrl}
                      className="flex items-center justify-between w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-emerald-500/25"
                    >
                      <span className="font-semibold">Åpne story</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <button
                      onClick={handleReset}
                      className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Generer ny story
                    </button>
                  </div>
                </div>
              ) : step === "error" ? (
                <div className="p-4 space-y-4 animate-fadeInUp">
                  <div className="text-center py-6">
                    <div
                      className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        boxShadow: "0 8px 24px rgba(239, 68, 68, 0.3)",
                      }}
                    >
                      <AlertCircle className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Noe gikk galt</h2>
                    <p className="text-sm text-red-600">{result?.error}</p>
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Prøv igjen
                  </button>
                </div>
              ) : isGenerating ? (
                <div className="p-4 space-y-5">
                  <div className="text-center py-4">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div
                        className="absolute inset-0 rounded-full animate-spin"
                        style={{
                          background: "conic-gradient(from 0deg, #10b981, #3b82f6, #8b5cf6, #10b981)",
                          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))",
                          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))",
                        }}
                      />
                      <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-emerald-500" />
                      </div>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Genererer story...</h2>
                  </div>

                  <div className="space-y-3">
                    <ProgressStep
                      label="Søker POIs"
                      detail={discoveredCount > 0 ? `${discoveredCount} funnet` : undefined}
                      status={step === "discovering" ? "active" : step === "structuring" || step === "writing" ? "done" : "pending"}
                    />
                    <ProgressStep
                      label="Bygger struktur"
                      status={step === "structuring" ? "active" : step === "writing" ? "done" : "pending"}
                    />
                    <ProgressStep
                      label="Skriver fil"
                      status={step === "writing" ? "active" : "pending"}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Project Name */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Prosjektnavn
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="F.eks. Ferjemannsveien 10"
                      className="w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all placeholder:text-gray-400"
                    />
                  </div>

                  {/* Customer Select */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Kunde
                    </label>
                    <div className="relative">
                      <select
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Velg kunde...</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    {customers.length === 0 && (
                      <p className="text-xs text-amber-600">
                        Ingen kunder funnet. <a href="/admin/customers" className="underline hover:text-amber-700">Opprett en kunde først.</a>
                      </p>
                    )}
                  </div>

                  {/* Senter + Radius */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Senter
                      </label>
                      {center ? (
                        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="text-xs text-emerald-700 font-mono truncate">
                            {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                          </span>
                          <button
                            onClick={() => setCenter(null)}
                            className="ml-auto text-emerald-600 hover:text-emerald-800 text-xs font-medium flex-shrink-0"
                          >
                            Endre
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                          <MapPin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span className="text-xs text-amber-700">Klikk på kartet</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Søkeradius
                      </label>
                      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                        <span className="text-[10px] text-gray-400 flex-shrink-0">300m</span>
                        <input
                          type="range"
                          min={300}
                          max={2000}
                          step={100}
                          value={radius}
                          onChange={(e) => setRadius(Number(e.target.value))}
                          className="flex-1 min-w-0 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-[10px] text-gray-400 flex-shrink-0">2km</span>
                      </div>
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Kategorier ({selectedCategories.size} valgt)
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl bg-white">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Steder</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {ALL_CATEGORIES.filter(c => c.group === "place").map((cat) => {
                          const Icon = cat.icon;
                          const isSelected = selectedCategories.has(cat.id);
                          return (
                            <label
                              key={cat.id}
                              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCategory(cat.id)}
                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0"
                              />
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${cat.color}20` }}
                              >
                                <Icon className="w-3 h-3" style={{ color: cat.color }} />
                              </div>
                              <span className="text-sm text-gray-700">{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="px-3 py-2 bg-gray-50 border-y border-gray-200">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Transport</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {ALL_CATEGORIES.filter(c => c.group === "transport").map((cat) => {
                          const Icon = cat.icon;
                          const isSelected = selectedCategories.has(cat.id);
                          return (
                            <label
                              key={cat.id}
                              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCategory(cat.id)}
                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0"
                              />
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${cat.color}20` }}
                              >
                                <Icon className="w-3 h-3" style={{ color: cat.color }} />
                              </div>
                              <span className="text-sm text-gray-700">{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer - Generate Button */}
            {step === "idle" && (
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={handleGenerate}
                  disabled={!isValid}
                  className={`w-full px-4 py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-200 ${
                    isValid
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  Generer Story
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </AdminSecondaryNav>

        {/* Map */}
        <div className="flex-1 relative">
          <Map
            ref={mapRef}
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
            initialViewState={{
              longitude: DEFAULT_CENTER.lng,
              latitude: DEFAULT_CENTER.lat,
              zoom: 14,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={MAP_STYLE}
            onClick={handleMapClick}
            cursor={step === "idle" ? "crosshair" : "default"}
          >
            <NavigationControl position="bottom-right" />

            {radiusCircle && (
              <Source id="radius" type="geojson" data={radiusCircle}>
                <Layer
                  id="radius-fill"
                  type="fill"
                  paint={{
                    "fill-color": isGenerating ? "#10b981" : "#3b82f6",
                    "fill-opacity": isGenerating ? 0.2 : 0.1,
                  }}
                />
                <Layer
                  id="radius-stroke"
                  type="line"
                  paint={{
                    "line-color": isGenerating ? "#10b981" : "#3b82f6",
                    "line-width": 2,
                    "line-dasharray": [2, 2],
                    "line-opacity": isGenerating ? 0.8 : 0.5,
                  }}
                />
              </Source>
            )}

            {center && (
              <Marker longitude={center.lng} latitude={center.lat}>
                <div className="relative">
                  {isGenerating && (
                    <div
                      className="absolute inset-0 -m-4 w-12 h-12 rounded-full animate-pulseGlow"
                      style={{ backgroundColor: "rgba(16, 185, 129, 0.3)" }}
                    />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isGenerating
                        ? "bg-gradient-to-br from-emerald-400 to-emerald-600 scale-110"
                        : "bg-gradient-to-br from-blue-500 to-blue-700"
                    }`}
                    style={{
                      boxShadow: isGenerating
                        ? "0 4px 20px rgba(16, 185, 129, 0.5)"
                        : "0 4px 12px rgba(59, 130, 246, 0.4)",
                    }}
                  >
                    {isGenerating ? (
                      <Sparkles className="w-4 h-4 text-white animate-pulse" />
                    ) : (
                      <MapPin className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </Marker>
            )}
          </Map>

          {/* Keyboard hint */}
          {step === "idle" && !center && (
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full animate-fadeInUp"
              style={{
                background: "rgba(0,0,0,0.75)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span className="text-sm text-white/90">
                Klikk på kartet for å plassere prosjektets senter
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ProgressStep({
  label,
  detail,
  status
}: {
  label: string;
  detail?: string;
  status: "pending" | "active" | "done";
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
      status === "active"
        ? "bg-emerald-50 border border-emerald-200"
        : status === "done"
        ? "bg-gray-50"
        : "bg-gray-50/50"
    }`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
        status === "active"
          ? "bg-emerald-500"
          : status === "done"
          ? "bg-emerald-500"
          : "bg-gray-200"
      }`}>
        {status === "active" ? (
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
        ) : status === "done" ? (
          <Check className="w-3.5 h-3.5 text-white animate-checkPop" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        )}
      </div>
      <div className="flex-1">
        <span className={`text-sm font-medium ${
          status === "active" ? "text-emerald-700" : status === "done" ? "text-gray-600" : "text-gray-400"
        }`}>
          {label}
        </span>
        {detail && (
          <span className="ml-2 text-xs text-emerald-600 font-medium">
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}

