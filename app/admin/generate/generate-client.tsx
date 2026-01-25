"use client";

import { useState, useRef, useCallback } from "react";
import Map, { Marker, Source, Layer, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import {
  MapPin,
  Sparkles,
  Check,
  ChevronRight,
  Utensils,
  Coffee,
  Wine,
  Croissant,
  Dumbbell,
  ShoppingCart,
  Pill,
  Bus,
  Loader2,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";
const DEFAULT_CENTER = { lat: 63.4305, lng: 10.3951 };

// Animation keyframes
const customStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseGlow {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
    }
    50% {
      box-shadow: 0 0 0 20px rgba(16, 185, 129, 0);
    }
  }
  @keyframes radiusPulse {
    0%, 100% {
      opacity: 0.15;
    }
    50% {
      opacity: 0.25;
    }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes categoryReveal {
    0% {
      opacity: 0;
      transform: scale(0.8) translateY(4px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
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
  .animate-radiusPulse { animation: radiusPulse 3s ease-in-out infinite; }
  .animate-shimmer {
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  .animate-categoryReveal { animation: categoryReveal 0.3s ease-out forwards; }
  .animate-checkPop { animation: checkPop 0.3s ease-out forwards; }
  .animate-spin { animation: spin 1s linear infinite; }
`;

interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
}

const CATEGORIES: Category[] = [
  { id: "restaurant", name: "Restaurant", icon: Utensils, color: "#ef4444" },
  { id: "cafe", name: "Kafé", icon: Coffee, color: "#8b5cf6" },
  { id: "bar", name: "Bar", icon: Wine, color: "#ec4899" },
  { id: "bakery", name: "Bakeri", icon: Croissant, color: "#f59e0b" },
  { id: "gym", name: "Treningssenter", icon: Dumbbell, color: "#10b981" },
  { id: "supermarket", name: "Dagligvare", icon: ShoppingCart, color: "#3b82f6" },
  { id: "pharmacy", name: "Apotek", icon: Pill, color: "#06b6d4" },
];

type GenerationStep = "idle" | "discovering" | "structuring" | "writing" | "done" | "error";

interface GenerationResult {
  success: boolean;
  path?: string;
  poiCount?: number;
  error?: string;
  projectUrl?: string;
}

export function GenerateClient() {
  const mapRef = useRef<MapRef>(null);

  // Form state
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(1000);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(["restaurant", "cafe", "supermarket"])
  );
  const [includeTransport, setIncludeTransport] = useState(true);

  // Generation state
  const [step, setStep] = useState<GenerationStep>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [discoveredCount, setDiscoveredCount] = useState(0);

  // Validation
  const isValid = name.trim() && customer.trim() && center && selectedCategories.size > 0;

  // Handle map click
  const handleMapClick = useCallback((event: mapboxgl.MapLayerMouseEvent) => {
    if (step !== "idle") return;
    const { lng, lat } = event.lngLat;
    setCenter({ lat, lng });
  }, [step]);

  // Toggle category
  const toggleCategory = (id: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCategories(newSet);
  };

  // Generate story
  const handleGenerate = async () => {
    if (!isValid || !center) return;

    setStep("discovering");
    setDiscoveredCount(0);
    setResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          customer,
          center,
          radius,
          categories: Array.from(selectedCategories),
          includeTransport,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Generering feilet");
      }

      // Simulate progress steps
      setStep("discovering");
      await new Promise(r => setTimeout(r, 800));

      const data = await response.json();
      setDiscoveredCount(data.poiCount || 0);

      setStep("structuring");
      await new Promise(r => setTimeout(r, 600));

      setStep("writing");
      await new Promise(r => setTimeout(r, 400));

      setStep("done");
      setResult({
        success: true,
        path: data.path,
        poiCount: data.poiCount,
        projectUrl: `/${customer}/${data.slug || name.toLowerCase().replace(/\s+/g, "-")}`,
      });
    } catch (error) {
      setStep("error");
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Ukjent feil",
      });
    }
  };

  // Reset
  const handleReset = () => {
    setStep("idle");
    setResult(null);
    setName("");
    setCustomer("");
    setCenter(null);
    setDiscoveredCount(0);
  };

  // Create radius circle GeoJSON
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

      <div className="h-screen w-screen relative bg-gray-100 overflow-hidden">
        {/* Map */}
        <div className="absolute inset-0">
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

            {/* Radius circle */}
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

            {/* Center marker */}
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
        </div>

        {/* Floating Panel */}
        <div
          className="absolute top-4 left-4 z-20 w-96 rounded-2xl flex flex-col overflow-hidden transition-all duration-300"
          style={{
            background: "linear-gradient(to bottom, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.96) 100%)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100/80">
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
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">Story Generator</h1>
                <p className="text-xs text-gray-500">Klikk på kartet for å plassere senter</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-12rem)]">
            {step === "done" && result?.success ? (
              /* Success State */
              <div className="p-5 space-y-4 animate-fadeInUp">
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
                    className="flex items-center justify-between w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
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

                <div className="text-xs text-gray-400 text-center pt-2">
                  Fil: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{result.path}</code>
                </div>
              </div>
            ) : step === "error" ? (
              /* Error State */
              <div className="p-5 space-y-4 animate-fadeInUp">
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
              /* Generating State */
              <div className="p-5 space-y-5">
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

                {/* Progress Steps */}
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
              /* Form State */
              <div className="p-5 space-y-5">
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

                {/* Customer */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Kunde (slug)
                  </label>
                  <input
                    type="text"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="F.eks. klp-eiendom"
                    className="w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all placeholder:text-gray-400 font-mono"
                  />
                </div>

                {/* Coordinates indicator */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Senter
                  </label>
                  {center ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700 font-mono">
                        {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                      </span>
                      <button
                        onClick={() => setCenter(null)}
                        className="ml-auto text-emerald-600 hover:text-emerald-800 text-xs font-medium"
                      >
                        Endre
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <MapPin className="w-4 h-4 text-amber-600" />
                      <span className="text-sm text-amber-700">Klikk på kartet for å velge</span>
                    </div>
                  )}
                </div>

                {/* Radius */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Søkeradius
                    </label>
                    <span className="text-sm font-bold text-gray-900">{radius}m</span>
                  </div>
                  <input
                    type="range"
                    min={300}
                    max={2000}
                    step={100}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>300m</span>
                    <span>2000m</span>
                  </div>
                </div>

                {/* Categories */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Kategorier
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedCategories.has(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            isSelected
                              ? "text-white shadow-md hover:shadow-lg active:scale-95"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100 active:scale-95"
                          }`}
                          style={{
                            backgroundColor: isSelected ? cat.color : undefined,
                            boxShadow: isSelected ? `0 4px 12px ${cat.color}40` : undefined,
                          }}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Transport toggle */}
                <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <div
                    className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
                      includeTransport ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        includeTransport ? "left-5" : "left-1"
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Bus className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Inkluder kollektivtransport</span>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Footer - Generate Button */}
          {step === "idle" && (
            <div className="p-4 border-t border-gray-100/80">
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
    </>
  );
}

// Progress step component
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

// Create circle coordinates for radius visualization
function createCircleCoordinates(lng: number, lat: number, radiusMeters: number): [number, number][] {
  const points = 64;
  const km = radiusMeters / 1000;
  const coords: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = km * Math.cos(angle);
    const dy = km * Math.sin(angle);

    // Approximate degree offset
    const latOffset = dy / 111.32;
    const lngOffset = dx / (111.32 * Math.cos(lat * Math.PI / 180));

    coords.push([lng + lngOffset, lat + latOffset]);
  }

  return coords;
}
