"use client";

import { useState, useRef, useCallback } from "react";
import { createCircleCoordinates } from "@/lib/utils/geo";
import Map, {
  Marker,
  Source,
  Layer,
  NavigationControl,
  type MapRef,
} from "react-map-gl/mapbox";
import {
  MapPin,
  Upload,
  Check,
  ChevronRight,
  ChevronDown,
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
import {
  AdminSecondaryNav,
  SecondaryNavTrigger,
} from "@/components/admin/admin-secondary-nav";

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";
const DEFAULT_CENTER = { lat: 63.4305, lng: 10.3951 }; // Trondheim

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
  .animate-fadeInUp { animation: fadeInUp 0.2s ease-out forwards; }
  .animate-pulseGlow { animation: pulseGlow 2s ease-in-out infinite; }
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

interface Project {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  customers: { name: string } | null;
}

interface ImportClientProps {
  projects: Project[];
}

export default function ImportClient({ projects }: ImportClientProps) {
  const mapRef = useRef<MapRef>(null);

  // Secondary nav state (mobile)
  const [secondaryNavOpen, setSecondaryNavOpen] = useState(false);

  // Form state
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(1000);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(DEFAULT_CATEGORIES);
  const [includeEntur, setIncludeEntur] = useState(true);
  const [includeBysykkel, setIncludeBysykkel] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Import state
  const [step, setStep] = useState<ImportStep>("idle");
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSelection =
    center &&
    (selectedCategories.size > 0 || includeEntur || includeBysykkel);

  const handleMapClick = useCallback(
    (event: mapboxgl.MapLayerMouseEvent) => {
      if (step !== "idle" && step !== "preview") return;
      const { lng, lat } = event.lngLat;
      setCenter({ lat, lng });
      // Reset to idle if we were in preview
      if (step === "preview") {
        setStep("idle");
        setStats(null);
      }
    },
    [step]
  );

  const handleProjectSelect = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      if (projectId) {
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          setCenter({ lat: project.center_lat, lng: project.center_lng });
          // Pan map to project center
          mapRef.current?.flyTo({
            center: [project.center_lng, project.center_lat],
            zoom: 14,
            duration: 1000,
          });
        }
      }
      // Reset preview state
      if (step === "preview") {
        setStep("idle");
        setStats(null);
      }
    },
    [projects, step]
  );

  const toggleCategory = (id: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCategories(newSet);
    // Reset preview if we're in that state
    if (step === "preview") {
      setStep("idle");
      setStats(null);
    }
  };

  const handlePreview = async () => {
    if (!hasSelection || !center) return;

    setStep("discovering");
    setError(null);

    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          center,
          radiusMeters: radius,
          categories: Array.from(selectedCategories),
          includeEntur,
          includeBysykkel,
          projectId: selectedProjectId || undefined,
          preview: true,
        }),
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
    if (!hasSelection || !center) return;

    setStep("importing");
    setError(null);

    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          center,
          radiusMeters: radius,
          categories: Array.from(selectedCategories),
          includeEntur,
          includeBysykkel,
          projectId: selectedProjectId || undefined,
          preview: false,
        }),
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
    setCenter(null);
    setSelectedCategories(DEFAULT_CATEGORIES);
    setIncludeEntur(true);
    setIncludeBysykkel(true);
    setSelectedProjectId("");
  };

  // Create circle polygon for radius visualization
  const radiusCircle = center
    ? {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [createCircleCoordinates(center.lng, center.lat, radius)],
        },
        properties: {},
      }
    : null;

  const isProcessing = step === "discovering" || step === "importing";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />

      <div className="flex h-screen bg-gray-100 overflow-hidden">
        {/* Mobile trigger */}
        <SecondaryNavTrigger
          onClick={() => setSecondaryNavOpen(true)}
          label="Åpne import-panel"
        />

        {/* Secondary Navigation */}
        <AdminSecondaryNav
          isOpen={secondaryNavOpen}
          onClose={() => setSecondaryNavOpen(false)}
          title="POI Import"
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 hidden lg:block">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                  }}
                >
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900 tracking-tight">
                    POI Import
                  </h1>
                  <p className="text-xs text-gray-500">
                    Importer fra Google, Entur, Bysykkel
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
                        background:
                          "linear-gradient(135deg, #10b981 0%, #059669 100%)",
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
                          <div
                            key={catId}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center"
                                style={{
                                  backgroundColor: `${cat?.color || "#6b7280"}20`,
                                }}
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

                  <button
                    onClick={handleReset}
                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Ny import
                  </button>
                </div>
              ) : step === "error" ? (
                // Error state
                <div className="p-4 space-y-4 animate-fadeInUp">
                  <div className="text-center py-6">
                    <div
                      className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
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
                        background:
                          "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
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
                          <div
                            key={catId}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center"
                                style={{
                                  backgroundColor: `${cat?.color || "#6b7280"}20`,
                                }}
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

                  {selectedProjectId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="text-sm text-blue-700">
                        POI-ene vil kobles til valgt prosjekt
                      </p>
                    </div>
                  )}

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
                // Idle state - form
                <div className="p-4 space-y-4">
                  {/* Project Select */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Prosjekt (valgfritt)
                    </label>
                    <div className="relative">
                      <select
                        value={selectedProjectId}
                        onChange={(e) => handleProjectSelect(e.target.value)}
                        className="w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Ingen prosjekt...</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.customers?.name ? ` (${p.customers.name})` : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    {selectedProjectId && (
                      <p className="text-xs text-blue-600">
                        POI-er kobles automatisk til dette prosjektet
                      </p>
                    )}
                  </div>

                  {/* Center + Radius */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Senter
                      </label>
                      {center ? (
                        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                          <span className="text-xs text-blue-700 font-mono truncate">
                            {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                          </span>
                          <button
                            onClick={() => setCenter(null)}
                            className="ml-auto text-blue-600 hover:text-blue-800 text-xs font-medium flex-shrink-0"
                          >
                            Endre
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                          <MapPin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span className="text-xs text-amber-700">
                            Klikk på kartet
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Søkeradius
                      </label>
                      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          300m
                        </span>
                        <input
                          type="range"
                          min={300}
                          max={2000}
                          step={100}
                          value={radius}
                          onChange={(e) => setRadius(Number(e.target.value))}
                          className="flex-1 min-w-0 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
                        />
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          2km
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        {radius}m
                      </p>
                    </div>
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

            {/* Footer - Preview Button */}
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
            cursor={
              step === "idle" || step === "preview" ? "crosshair" : "default"
            }
          >
            <NavigationControl position="bottom-right" />

            {radiusCircle && (
              <Source id="radius" type="geojson" data={radiusCircle}>
                <Layer
                  id="radius-fill"
                  type="fill"
                  paint={{
                    "fill-color": isProcessing ? "#10b981" : "#3b82f6",
                    "fill-opacity": isProcessing ? 0.2 : 0.1,
                  }}
                />
                <Layer
                  id="radius-stroke"
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

            {center && (
              <Marker longitude={center.lng} latitude={center.lat}>
                <div className="relative">
                  {isProcessing && (
                    <div
                      className="absolute inset-0 -m-4 w-12 h-12 rounded-full animate-pulseGlow"
                      style={{ backgroundColor: "rgba(16, 185, 129, 0.3)" }}
                    />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isProcessing
                        ? "bg-gradient-to-br from-emerald-400 to-emerald-600 scale-110"
                        : "bg-gradient-to-br from-blue-500 to-blue-700"
                    }`}
                    style={{
                      boxShadow: isProcessing
                        ? "0 4px 20px rgba(16, 185, 129, 0.5)"
                        : "0 4px 12px rgba(59, 130, 246, 0.4)",
                    }}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
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
                Klikk på kartet eller velg et prosjekt for å sette senter
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

