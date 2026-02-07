"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createCircleCoordinates } from "@/lib/utils/geo";
import MapGL, {
  Source,
  Layer,
  NavigationControl,
  Marker,
  type MapRef,
} from "react-map-gl/mapbox";
import {
  MapPin,
  Upload,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
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
  Sparkles,
  Building2,
  Bus,
  Bike,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProjectWithRelations } from "./page";

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

const customStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes checkPop {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  .animate-fadeInUp { animation: fadeInUp 0.2s ease-out forwards; }
  .animate-checkPop { animation: checkPop 0.3s ease-out forwards; }
`;

interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
}

const PLACE_CATEGORIES: Category[] = [
  { id: "restaurant", name: "Restaurant", icon: Utensils, color: "#ef4444" },
  { id: "cafe", name: "Kafé", icon: Coffee, color: "#f97316" },
  { id: "bar", name: "Bar", icon: Wine, color: "#a855f7" },
  { id: "bakery", name: "Bakeri", icon: Croissant, color: "#f59e0b" },
  { id: "gym", name: "Treningssenter", icon: Dumbbell, color: "#ec4899" },
  { id: "supermarket", name: "Dagligvare", icon: ShoppingCart, color: "#22c55e" },
  { id: "pharmacy", name: "Apotek", icon: Pill, color: "#06b6d4" },
  { id: "bank", name: "Bank", icon: Building, color: "#6366f1" },
  { id: "post_office", name: "Post", icon: Mail, color: "#f43f5e" },
  { id: "shopping_mall", name: "Kjøpesenter", icon: ShoppingBag, color: "#8b5cf6" },
  { id: "museum", name: "Museum", icon: Landmark, color: "#0ea5e9" },
  { id: "library", name: "Bibliotek", icon: BookOpen, color: "#14b8a6" },
  { id: "park", name: "Park", icon: TreePine, color: "#10b981" },
  { id: "movie_theater", name: "Kino", icon: Film, color: "#f472b6" },
  { id: "hospital", name: "Sykehus", icon: Hospital, color: "#ef4444" },
  { id: "doctor", name: "Legesenter", icon: Stethoscope, color: "#3b82f6" },
  { id: "dentist", name: "Tannlege", icon: Smile, color: "#22d3ee" },
  { id: "hair_care", name: "Frisør", icon: Scissors, color: "#d946ef" },
  { id: "spa", name: "Spa", icon: Sparkles, color: "#c084fc" },
  { id: "hotel", name: "Hotell", icon: Building2, color: "#0891b2" },
];

const DEFAULT_CATEGORIES = new Set([
  "restaurant",
  "cafe",
  "supermarket",
]);

type ImportStep =
  | "idle"
  | "discovering"
  | "preview"
  | "importing"
  | "done"
  | "error";

interface ImportStats {
  total: number;
  byCategory: Record<string, number>;
  new: number;
  updated: number;
}

interface ImportTabProps {
  project: ProjectWithRelations;
  onSwitchTab: (tab: string) => void;
}

export function ImportTab({ project, onSwitchTab }: ImportTabProps) {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);

  // Form state
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(DEFAULT_CATEGORIES);
  const [includeEntur, setIncludeEntur] = useState(true);
  const [includeBysykkel, setIncludeBysykkel] = useState(true);

  // Import state
  const [step, setStep] = useState<ImportStep>("idle");
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const discoveryCircles = project.discovery_circles as Array<{
    lat: number;
    lng: number;
    radiusMeters: number;
  }> | null;

  const hasSelection =
    discoveryCircles &&
    discoveryCircles.length > 0 &&
    (selectedCategories.size > 0 || includeEntur || includeBysykkel);

  const toggleCategory = (id: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCategories(newSet);
    if (step === "preview") {
      setStep("idle");
      setStats(null);
    }
  };

  const buildImportBody = useCallback(
    (preview: boolean) => ({
      categories: Array.from(selectedCategories),
      includeEntur,
      includeBysykkel,
      projectId: project.id,
      preview,
      circles: discoveryCircles,
    }),
    [selectedCategories, includeEntur, includeBysykkel, project.id, discoveryCircles]
  );

  const handlePreview = async () => {
    if (!hasSelection) return;

    setStep("discovering");
    setError(null);

    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildImportBody(true)),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Forhåndsvisning feilet");
      }

      setStats(data.stats);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
      setStep("error");
    }
  };

  const handleImport = async () => {
    if (!hasSelection) return;

    setStep("importing");
    setError(null);

    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildImportBody(false)),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Import feilet");
      }

      setStats(data.stats);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
      setStep("error");
    }
  };

  const handleReset = () => {
    setStep("idle");
    setStats(null);
    setError(null);
    setSelectedCategories(DEFAULT_CATEGORIES);
    setIncludeEntur(true);
    setIncludeBysykkel(true);
  };

  // GeoJSON for discovery circles visualization
  const circlesGeoJSON = useMemo(() => {
    if (!discoveryCircles || discoveryCircles.length === 0) return null;
    return {
      type: "FeatureCollection" as const,
      features: discoveryCircles.map((c) => ({
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [createCircleCoordinates(c.lng, c.lat, c.radiusMeters)],
        },
        properties: {},
      })),
    };
  }, [discoveryCircles]);

  // GeoJSON for preview POI markers
  const previewGeoJSON = useMemo(() => {
    if (step !== "preview" || !stats) return null;
    // We show circle markers at discovery circle centers as visual feedback
    // The actual POI positions aren't returned in preview — we show stats instead
    return null;
  }, [step, stats]);

  const isProcessing = step === "discovering" || step === "importing";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />

      {!discoveryCircles || discoveryCircles.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Ingen discovery-sirkler
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Definer discovery-sirkler på Detaljer-fanen for å importere POI-er.
          </p>
          <button
            onClick={() => onSwitchTab("details")}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Gå til Detaljer
          </button>
        </div>
      ) : (
        <div className="h-[calc(100vh-220px)] min-h-[500px] flex rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
          {/* Sidebar */}
          <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                  }}
                >
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 tracking-tight">
                    POI Import
                  </h2>
                  <p className="text-xs text-gray-500">
                    {discoveryCircles.length} discovery-sirkler
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {step === "done" && stats ? (
                // Success state
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
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      Import fullført!
                    </h2>
                    <p className="text-sm text-gray-500">
                      {stats.new} nye, {stats.updated} oppdatert
                    </p>
                  </div>

                  {/* Stats breakdown */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Per kategori
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(stats.byCategory).map(([catId, count]) => {
                        const cat = PLACE_CATEGORIES.find((c) => c.id === catId);
                        const Icon = cat?.icon || MapPin;
                        return (
                          <div key={catId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center"
                                style={{ backgroundColor: `${cat?.color || "#6b7280"}20` }}
                              >
                                <Icon
                                  className="w-3 h-3"
                                  style={{ color: cat?.color || "#6b7280" }}
                                />
                              </div>
                              <span className="text-sm text-gray-700">
                                {cat?.name || catId}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        router.refresh();
                        onSwitchTab("pois");
                      }}
                      className="w-full px-4 py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-200 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Eye className="w-5 h-5" />
                      Se importerte POI-er
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleReset}
                      className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Ny import
                    </button>
                  </div>
                </div>
              ) : step === "error" ? (
                // Error state
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
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      Noe gikk galt
                    </h2>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Prøv igjen
                  </button>
                </div>
              ) : step === "preview" && stats ? (
                // Preview state
                <div className="p-4 space-y-4 animate-fadeInUp">
                  <div className="text-center py-4">
                    <div
                      className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                        boxShadow: "0 6px 20px rgba(59, 130, 246, 0.35)",
                      }}
                    >
                      <Eye className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">
                      Fant {stats.total} POI-er
                    </h2>
                    <p className="text-sm text-gray-500">
                      {stats.new} nye, {stats.updated} finnes allerede
                    </p>
                  </div>

                  {/* Stats breakdown */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Per kategori
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {Object.entries(stats.byCategory).map(([catId, count]) => {
                        const cat = PLACE_CATEGORIES.find((c) => c.id === catId);
                        const Icon = cat?.icon || MapPin;
                        return (
                          <div key={catId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center"
                                style={{ backgroundColor: `${cat?.color || "#6b7280"}20` }}
                              >
                                <Icon
                                  className="w-3 h-3"
                                  style={{ color: cat?.color || "#6b7280" }}
                                />
                              </div>
                              <span className="text-sm text-gray-700">
                                {cat?.name || catId}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={handleImport}
                      className="w-full px-4 py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-200 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Upload className="w-5 h-5" />
                      Importer {stats.total} POI-er
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setStep("idle");
                        setStats(null);
                      }}
                      className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Endre søk
                    </button>
                  </div>
                </div>
              ) : isProcessing ? (
                // Processing state
                <div className="p-4 space-y-5">
                  <div className="text-center py-4">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div
                        className="absolute inset-0 rounded-full animate-spin"
                        style={{
                          background:
                            "conic-gradient(from 0deg, #3b82f6, #10b981, #8b5cf6, #3b82f6)",
                          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))",
                          WebkitMask:
                            "radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))",
                        }}
                      />
                      <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                        <Upload className="w-6 h-6 text-blue-500" />
                      </div>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {step === "discovering"
                        ? "Søker etter POI-er..."
                        : "Importerer..."}
                    </h2>
                  </div>

                  <div className="space-y-3">
                    <ProgressStep
                      label="Google Places"
                      status={
                        selectedCategories.size > 0
                          ? step === "discovering"
                            ? "active"
                            : "done"
                          : "skipped"
                      }
                    />
                    <ProgressStep
                      label="Entur holdeplasser"
                      status={
                        includeEntur
                          ? step === "discovering"
                            ? "active"
                            : "done"
                          : "skipped"
                      }
                    />
                    <ProgressStep
                      label="Bysykkel stasjoner"
                      status={
                        includeBysykkel
                          ? step === "discovering"
                            ? "active"
                            : "done"
                          : "skipped"
                      }
                    />
                    {step === "importing" && (
                      <ProgressStep label="Lagrer til database" status="active" />
                    )}
                  </div>
                </div>
              ) : (
                // Idle state — form
                <div className="p-4 space-y-4">
                  {/* Discovery circles info */}
                  <div className="px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <span className="text-xs text-blue-700 font-medium">
                        {discoveryCircles.length} discovery-sirkler definert
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      Import bruker prosjektets sirkler. Endre på Detaljer-fanen.
                    </p>
                  </div>

                  {/* Categories */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Kategorier ({selectedCategories.size} valgt)
                    </label>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl bg-white">
                      <div className="divide-y divide-gray-100">
                        {PLACE_CATEGORIES.map((cat) => {
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
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                              />
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${cat.color}20` }}
                              >
                                <Icon
                                  className="w-3 h-3"
                                  style={{ color: cat.color }}
                                />
                              </div>
                              <span className="text-sm text-gray-700">
                                {cat.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Transport options */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Transport
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={includeEntur}
                          onChange={(e) => setIncludeEntur(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: "#3b82f620" }}
                        >
                          <Bus className="w-3 h-3" style={{ color: "#3b82f6" }} />
                        </div>
                        <span className="text-sm text-gray-700">
                          Entur (buss, trikk, tog)
                        </span>
                      </label>

                      <label className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={includeBysykkel}
                          onChange={(e) => setIncludeBysykkel(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: "#22c55e20" }}
                        >
                          <Bike className="w-3 h-3" style={{ color: "#22c55e" }} />
                        </div>
                        <span className="text-sm text-gray-700">
                          Trondheim Bysykkel
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer — Preview Button */}
            {step === "idle" && (
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={handlePreview}
                  disabled={!hasSelection}
                  className={`w-full px-4 py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-200 ${
                    hasSelection
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Eye className="w-5 h-5" />
                  Forhåndsvis
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <MapGL
              ref={mapRef}
              mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
              initialViewState={{
                longitude: project.center_lng,
                latitude: project.center_lat,
                zoom: 13,
              }}
              style={{ width: "100%", height: "100%" }}
              mapStyle={MAP_STYLE}
            >
              <NavigationControl position="top-right" />

              {/* Project center marker */}
              <Marker latitude={project.center_lat} longitude={project.center_lng}>
                <MapPin className="w-6 h-6 text-gray-800 fill-gray-800" />
              </Marker>

              {/* Discovery circles */}
              {circlesGeoJSON && (
                <Source id="import-circles" type="geojson" data={circlesGeoJSON}>
                  <Layer
                    id="import-circles-fill"
                    type="fill"
                    paint={{
                      "fill-color": isProcessing ? "#10b981" : "#3b82f6",
                      "fill-opacity": isProcessing ? 0.2 : 0.1,
                    }}
                  />
                  <Layer
                    id="import-circles-stroke"
                    type="line"
                    paint={{
                      "line-color": isProcessing ? "#10b981" : "#3b82f6",
                      "line-width": 2,
                      "line-dasharray": [2, 2],
                      "line-opacity": isProcessing ? 0.8 : 0.5,
                    }}
                  />
                </Source>
              )}
            </MapGL>
          </div>
        </div>
      )}
    </>
  );
}

function ProgressStep({
  label,
  status,
}: {
  label: string;
  status: "pending" | "active" | "done" | "skipped";
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        status === "active"
          ? "bg-blue-50 border border-blue-200"
          : status === "done"
          ? "bg-gray-50"
          : status === "skipped"
          ? "bg-gray-50/50 opacity-50"
          : "bg-gray-50/50"
      }`}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
          status === "active"
            ? "bg-blue-500"
            : status === "done"
            ? "bg-emerald-500"
            : "bg-gray-200"
        }`}
      >
        {status === "active" ? (
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
        ) : status === "done" ? (
          <Check className="w-3.5 h-3.5 text-white animate-checkPop" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        )}
      </div>
      <span
        className={`text-sm font-medium ${
          status === "active"
            ? "text-blue-700"
            : status === "done"
            ? "text-gray-600"
            : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
