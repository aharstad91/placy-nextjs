"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import { MapPin, Trash2, Plus, Search, ChevronDown, X, Check, Loader2 } from "lucide-react";
import type { DbCategory, DbPoi } from "@/lib/supabase/types";
import { AdminSecondaryNav, SecondaryNavTrigger } from "@/components/admin/admin-secondary-nav";

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

const customStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseRing {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.7; }
  }
  .animate-fadeInUp { animation: fadeInUp 0.15s ease-out forwards; }
  .animate-pulseRing { animation: pulseRing 2s ease-in-out infinite; }
`;

const DEFAULT_CENTER = { lat: 63.4305, lng: 10.3951 };

type PanelState = "idle" | "editing" | "creating";

interface GeocodingResult {
  place_name: string;
  center: [number, number];
}

interface POIAdminClientProps {
  pois: DbPoi[];
  categories: DbCategory[];
  createPOI: (formData: FormData) => Promise<void>;
  deletePOI: (formData: FormData) => Promise<void>;
  updatePOI: (formData: FormData) => Promise<void>;
}

export function POIAdminClient({
  pois,
  categories,
  createPOI,
  deletePOI,
  updatePOI,
}: POIAdminClientProps) {
  const mapRef = useRef<MapRef>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Secondary nav state (mobile)
  const [secondaryNavOpen, setSecondaryNavOpen] = useState(false);

  // Panel state
  const [panelState, setPanelState] = useState<PanelState>("idle");

  // Category filter state with URL sync
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
    const categoriesParam = searchParams.get("categories");
    if (categoriesParam) {
      const validIds = new Set(categories.map((c) => c.id));
      const fromUrl = categoriesParam.split(",").filter((id) => validIds.has(id));
      return new Set(fromUrl.length > 0 ? fromUrl : categories.map((c) => c.id));
    }
    return new Set(categories.map((c) => c.id));
  });

  // Sync categories to URL
  const updateCategories = useCallback(
    (newSet: Set<string>) => {
      setSelectedCategories(newSet);
      const params = new URLSearchParams(searchParams.toString());
      if (newSet.size === categories.length) {
        params.delete("categories");
      } else if (newSet.size > 0) {
        params.set("categories", Array.from(newSet).join(","));
      } else {
        params.set("categories", "none");
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [categories.length, router, searchParams]
  );

  // Filter POIs by selected categories
  const filteredPois = useMemo(
    () => pois.filter((poi) => selectedCategories.has(poi.category_id || "")),
    [pois, selectedCategories]
  );

  // Count POIs per category
  const poiCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const poi of pois) {
      const catId = poi.category_id || "";
      counts[catId] = (counts[catId] || 0) + 1;
    }
    return counts;
  }, [pois]);

  // Form state
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [editorialHook, setEditorialHook] = useState("");
  const [localInsight, setLocalInsight] = useState("");
  const [storyPriority, setStoryPriority] = useState<"must_have" | "nice_to_have" | "filler" | "">("");

  // UI state
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [editingPoi, setEditingPoi] = useState<DbPoi | null>(null);
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map click handler
  const handleMapClick = useCallback(
    async (event: mapboxgl.MapLayerMouseEvent) => {
      if (panelState !== "creating") return;

      const { lng, lat } = event.lngLat;
      setCoordinates({ lat, lng });

      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) return;

      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&language=no`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features?.[0]) {
          setAddress(data.features[0].place_name);
        }
      } catch (e) {
        console.error("Reverse geocoding failed:", e);
      }
    },
    [panelState]
  );

  // Address search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("Mapbox token ikke konfigurert");
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${token}&country=NO&limit=5&language=no&proximity=${DEFAULT_CENTER.lng},${DEFAULT_CENTER.lat}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.message) {
        setError(`Mapbox-feil: ${data.message}`);
        setSearchResults([]);
        return;
      }

      if (!data.features || data.features.length === 0) {
        setError("Ingen resultater funnet.");
        setSearchResults([]);
        return;
      }

      setSearchResults(data.features);
    } catch (e) {
      console.error("Search failed:", e);
      setError("Kunne ikke søke.");
    } finally {
      setIsSearching(false);
    }
  };

  // Select search result
  const selectSearchResult = (result: GeocodingResult) => {
    const [lng, lat] = result.center;
    setCoordinates({ lat, lng });
    setAddress(result.place_name);
    setSearchResults([]);
    setSearchQuery("");

    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 16,
      duration: 1000,
    });
  };

  // Validation
  const validate = () => {
    if (!name.trim()) return "Navn er påkrevd";
    if (!coordinates) return "Velg posisjon på kartet";
    if (!categoryId) return "Velg kategori";
    return null;
  };

  // Reset form
  const closePanel = () => {
    setName("");
    setCoordinates(null);
    setCategoryId(categories[0]?.id || "");
    setAddress("");
    setDescription("");
    setEditorialHook("");
    setLocalInsight("");
    setStoryPriority("");
    setShowMoreFields(false);
    setEditingPoi(null);
    setError(null);
    setPanelState("idle");
  };

  // Start editing
  const startEditing = (poi: DbPoi) => {
    setEditingPoi(poi);
    setName(poi.name);
    setCoordinates({ lat: poi.lat, lng: poi.lng });
    setCategoryId(poi.category_id || "");
    setAddress(poi.address || "");
    setDescription(poi.description || "");
    setEditorialHook(poi.editorial_hook || "");
    setLocalInsight(poi.local_insight || "");
    setStoryPriority(poi.story_priority || "");
    setShowMoreFields(!!(poi.description || poi.editorial_hook || poi.local_insight || poi.story_priority));
    setPanelState("editing");
    // Open secondary nav on mobile when editing
    setSecondaryNavOpen(true);
  };

  // Hide Mapbox labels on load
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      const layersToHide = ["poi-label", "transit-label"];
      for (const layer of layersToHide) {
        if (map.getLayer(layer)) {
          map.setLayoutProperty(layer, "visibility", "none");
        }
      }
    }
  }, []);

  // Start creating
  const startCreating = () => {
    setEditingPoi(null);
    setName("");
    setCoordinates(null);
    setCategoryId(categories[0]?.id || "");
    setAddress("");
    setDescription("");
    setEditorialHook("");
    setLocalInsight("");
    setStoryPriority("");
    setShowMoreFields(false);
    setError(null);
    setPanelState("creating");
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      if (editingPoi) {
        formData.set("id", editingPoi.id);
      }
      formData.set("name", name);
      formData.set("lat", coordinates!.lat.toString());
      formData.set("lng", coordinates!.lng.toString());
      formData.set("categoryId", categoryId);
      formData.set("address", address);
      formData.set("description", description);
      formData.set("editorialHook", editorialHook);
      formData.set("localInsight", localInsight);
      formData.set("storyPriority", storyPriority);

      if (editingPoi) {
        await updatePOI(formData);
      } else {
        await createPOI(formData);
      }

      closePanel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete POI
  const handleDelete = async () => {
    if (!editingPoi) return;
    if (!confirm(`Er du sikker på at du vil slette "${editingPoi.name}"?`)) {
      return;
    }

    try {
      const formData = new FormData();
      formData.set("id", editingPoi.id);
      await deletePOI(formData);
      closePanel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke slette POI");
    }
  };

  // Get category by ID
  const getCategoryById = (id: string | null) => categories.find((c) => c.id === id);

  const isFormVisible = panelState === "editing" || panelState === "creating";

  return (
    <div className="flex h-screen font-[system-ui]">
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />

      {/* Mobile trigger for secondary nav */}
      <SecondaryNavTrigger
        onClick={() => setSecondaryNavOpen(true)}
        label="Åpne POI-panel"
      />

      {/* Secondary Navigation - Filter and Form */}
      <AdminSecondaryNav
        isOpen={secondaryNavOpen}
        onClose={() => setSecondaryNavOpen(false)}
        title="POI-er"
      >
        <div className="flex flex-col h-full">
          {/* Search Field */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Søk etter adresse..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all placeholder:text-gray-400"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-48 overflow-auto animate-fadeInUp">
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => selectSearchResult(result)}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="text-gray-700">{result.place_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category Filter */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Filter
                <span className="ml-2 text-gray-400 font-normal normal-case">
                  {filteredPois.length}/{pois.length}
                </span>
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => updateCategories(new Set(categories.map((c) => c.id)))}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Alle
                </button>
                <button
                  onClick={() => updateCategories(new Set())}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Ingen
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const isSelected = selectedCategories.has(category.id);
                const count = poiCountByCategory[category.id] || 0;
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      const newSet = new Set(selectedCategories);
                      if (isSelected) {
                        newSet.delete(category.id);
                      } else {
                        newSet.add(category.id);
                      }
                      updateCategories(newSet);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      isSelected
                        ? "text-white shadow-sm hover:shadow-md active:scale-95"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800 active:scale-95"
                    }`}
                    style={{
                      backgroundColor: isSelected ? category.color : undefined,
                      boxShadow: isSelected ? `0 2px 8px ${category.color}40` : undefined
                    }}
                  >
                    <span>{category.name}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                      isSelected ? "bg-white/25" : "bg-gray-200/80 text-gray-500"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Button or Form */}
          <div className="flex-1 overflow-y-auto">
            {panelState === "idle" ? (
              <div className="p-4">
                <button
                  onClick={startCreating}
                  className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Ny POI
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Form Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">
                    {panelState === "editing" ? "Rediger POI" : "Ny POI"}
                  </h2>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Instructions for creating */}
                {panelState === "creating" && !coordinates && (
                  <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-xl text-xs text-amber-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-500" />
                    <span>Klikk på kartet for å velge posisjon</span>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-medium">
                    {error}
                  </div>
                )}

                {/* Google POI Info */}
                {editingPoi?.google_place_id && (
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-md font-semibold">
                        Google
                      </span>
                      {editingPoi.google_rating && (
                        <span className="text-xs text-gray-600 font-medium">
                          {editingPoi.google_rating} ({editingPoi.google_review_count})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600">Navn *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all placeholder:text-gray-400"
                    placeholder="F.eks. Kaffebrenneriet"
                  />
                </div>

                {/* Coordinates */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600">
                    Koordinater * {panelState === "creating" && <span className="font-normal text-gray-400">(klikk på kartet)</span>}
                  </label>
                  <div className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs">
                    {coordinates ? (
                      <span className="font-mono text-gray-700 font-medium">
                        {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                      </span>
                    ) : (
                      <span className="text-gray-400">Ikke valgt</span>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600">Kategori *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600">Adresse</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all placeholder:text-gray-400"
                    placeholder="Autofylles fra kart"
                  />
                </div>

                {/* More fields toggle */}
                <button
                  type="button"
                  onClick={() => setShowMoreFields(!showMoreFields)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors py-1"
                >
                  <div className={`transition-transform duration-200 ${showMoreFields ? "rotate-180" : ""}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  <span className="font-medium">{showMoreFields ? "Skjul ekstra felt" : "Vis ekstra felt"}</span>
                </button>

                {showMoreFields && (
                  <div className="space-y-4 pt-4 border-t border-gray-100 animate-fadeInUp">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-600">Beskrivelse</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-600">Editorial Hook</label>
                      <textarea
                        value={editorialHook}
                        onChange={(e) => setEditorialHook(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-600">Local Insight</label>
                      <textarea
                        value={localInsight}
                        onChange={(e) => setLocalInsight(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-600">Story Prioritet</label>
                      <select
                        value={storyPriority}
                        onChange={(e) => setStoryPriority(e.target.value as typeof storyPriority)}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all cursor-pointer"
                      >
                        <option value="">Ikke angitt</option>
                        <option value="must_have">Must Have</option>
                        <option value="nice_to_have">Nice to Have</option>
                        <option value="filler">Filler</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  {panelState === "editing" && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 py-2.5 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                      panelState === "editing"
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30"
                        : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Lagrer...
                      </>
                    ) : panelState === "editing" ? (
                      <>
                        <Check className="w-4 h-4" /> Oppdater
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Opprett
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* POI Count Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <span className="text-sm text-gray-500 font-medium">
              Viser <span className="text-gray-900 font-bold">{filteredPois.length}</span> av{" "}
              <span className="text-gray-900 font-bold">{pois.length}</span> POIs
            </span>
          </div>
        </div>
      </AdminSecondaryNav>

      {/* Map - Takes remaining space */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          initialViewState={{
            longitude: DEFAULT_CENTER.lng,
            latitude: DEFAULT_CENTER.lat,
            zoom: 12,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLE}
          onClick={handleMapClick}
          onLoad={handleMapLoad}
          cursor={panelState === "creating" ? "crosshair" : "grab"}
        >
          <NavigationControl position="top-right" />

          {/* Selected position marker (when creating) */}
          {coordinates && panelState === "creating" && (
            <Marker longitude={coordinates.lng} latitude={coordinates.lat} anchor="center">
              <div className="relative">
                <div className="absolute inset-0 w-10 h-10 -m-1 bg-amber-400/30 rounded-full animate-pulseRing" />
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <MapPin className="w-5 h-5 text-white drop-shadow" />
                </div>
              </div>
            </Marker>
          )}

          {/* Filtered POI markers */}
          {filteredPois.map((poi) => {
            const category = getCategoryById(poi.category_id);
            const isGooglePoi = poi.google_place_id != null;
            const isActive = editingPoi?.id === poi.id;
            const isHovered = hoveredPoiId === poi.id;
            return (
              <Marker
                key={poi.id}
                longitude={poi.lng}
                latitude={poi.lat}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  startEditing(poi);
                }}
              >
                <div
                  className="relative flex flex-col items-center"
                  onMouseEnter={() => setHoveredPoiId(poi.id)}
                  onMouseLeave={() => setHoveredPoiId(null)}
                >
                  {/* Hover label */}
                  {(isHovered || isActive) && (
                    <div className="absolute bottom-full mb-2 whitespace-nowrap animate-fadeInUp pointer-events-none z-10">
                      <div className="px-2.5 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg shadow-xl">
                        <span className="font-medium">{poi.name}</span>
                        {isGooglePoi && (
                          <span className="ml-1.5 text-blue-300 text-[10px] font-semibold">G</span>
                        )}
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900/95 rotate-45" />
                    </div>
                  )}
                  {/* Marker */}
                  <div className="w-6 h-6 flex items-center justify-center cursor-pointer">
                    {isActive && (
                      <div className="absolute w-9 h-9 rounded-full bg-blue-400/20 animate-pulseRing" />
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 relative ${
                        isActive ? "scale-110" : "hover:scale-110"
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${category?.color || "#6b7280"} 0%, ${category?.color || "#6b7280"}dd 100%)`,
                        boxShadow: `0 2px 8px ${category?.color || "#6b7280"}40, 0 1px 2px rgba(0,0,0,0.1)`
                      }}
                    >
                      <MapPin className="w-3 h-3 text-white drop-shadow-sm" />
                      {isGooglePoi && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gradient-to-br from-blue-400 to-blue-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow-sm">
                          G
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Marker>
            );
          })}
        </Map>
      </div>
    </div>
  );
}
