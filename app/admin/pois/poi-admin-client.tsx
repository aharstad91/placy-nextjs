"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import { MapPin, Trash2, Edit2, Plus, Search, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import type { DbCategory, DbPoi } from "@/lib/supabase/types";

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

// Default center: Trondheim sentrum
const DEFAULT_CENTER = { lat: 63.4305, lng: 10.3951 };

type PanelState = "idle" | "editing" | "creating";

interface GeocodingResult {
  place_name: string;
  center: [number, number]; // [lng, lat]
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map click handler - only sets coordinates when creating
  const handleMapClick = useCallback(
    async (event: mapboxgl.MapLayerMouseEvent) => {
      if (panelState !== "creating") return;

      const { lng, lat } = event.lngLat;
      setCoordinates({ lat, lng });

      // Reverse geocode to get address
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
        setError("Ingen resultater funnet. Prøv en annen adresse.");
        setSearchResults([]);
        return;
      }

      setSearchResults(data.features);
    } catch (e) {
      console.error("Search failed:", e);
      setError("Kunne ikke søke. Sjekk internettforbindelsen.");
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

  // Reset form and close panel
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

    mapRef.current?.flyTo({
      center: [poi.lng, poi.lat],
      zoom: 16,
      duration: 1000,
    });
  };

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
    <div className="relative w-full h-screen">
      {/* Fullscreen Map */}
      <div className="absolute inset-0">
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
          cursor={panelState === "creating" ? "crosshair" : "grab"}
        >
          <NavigationControl position="top-right" />

          {/* Selected position marker (when creating) */}
          {coordinates && panelState === "creating" && (
            <Marker longitude={coordinates.lng} latitude={coordinates.lat} anchor="center">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg ring-4 ring-blue-200 animate-pulse">
                <MapPin className="w-5 h-5 text-white" />
              </div>
            </Marker>
          )}

          {/* Filtered POI markers */}
          {filteredPois.map((poi) => {
            const category = getCategoryById(poi.category_id);
            const isGooglePoi = poi.google_place_id != null;
            const isActive = editingPoi?.id === poi.id;
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
                  className={`rounded-full flex items-center justify-center shadow cursor-pointer transition-transform relative ${
                    isActive ? "w-8 h-8 ring-4 ring-blue-400" : "w-6 h-6 hover:scale-110"
                  }`}
                  style={{ backgroundColor: category?.color || "#6b7280" }}
                  title={poi.name}
                >
                  <MapPin className={isActive ? "w-4 h-4 text-white" : "w-3 h-3 text-white"} />
                  {isGooglePoi && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      G
                    </span>
                  )}
                </div>
              </Marker>
            );
          })}
        </Map>
      </div>

      {/* Floating Panel - Top Left */}
      <div
        className={`absolute top-4 left-4 z-20 w-80 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg flex flex-col overflow-hidden transition-all ${
          isFormVisible ? "max-h-[calc(100vh-2rem)]" : "max-h-fit"
        }`}
      >
        {/* Search Field */}
        <div className="p-3 border-b">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Søk etter adresse..."
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-30 max-h-48 overflow-auto">
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => selectSearchResult(result)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 border-b last:border-b-0"
                    >
                      {result.place_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filter - Compact */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">
              Filter ({filteredPois.length}/{pois.length})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => updateCategories(new Set(categories.map((c) => c.id)))}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Alle
              </button>
              <button
                onClick={() => updateCategories(new Set())}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Ingen
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
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
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                    isSelected
                      ? "text-white"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                  style={{
                    backgroundColor: isSelected ? category.color : undefined,
                  }}
                >
                  <span>{category.name}</span>
                  <span className={`px-1 rounded-full text-[10px] ${isSelected ? "bg-white/20" : "bg-gray-200"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button or Form */}
        {panelState === "idle" ? (
          <div className="p-3">
            <button
              onClick={startCreating}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Ny POI
            </button>
          </div>
        ) : (
          /* Form - Scrollable */
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-3 space-y-3">
              {/* Form Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">
                  {panelState === "editing" ? "Rediger POI" : "Ny POI"}
                </h2>
                <button
                  type="button"
                  onClick={closePanel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Instructions for creating */}
              {panelState === "creating" && !coordinates && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  Klikk på kartet for å velge posisjon
                </div>
              )}

              {error && (
                <div className="p-2 bg-red-100 text-red-700 rounded text-xs">
                  {error}
                </div>
              )}

              {/* Google POI Info */}
              {editingPoi?.google_place_id && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                      Google
                    </span>
                    {editingPoi.google_rating && (
                      <span className="text-xs text-gray-600">
                        ⭐ {editingPoi.google_rating} ({editingPoi.google_review_count})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Navn *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="F.eks. Kaffebrenneriet"
                />
              </div>

              {/* Coordinates */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Koordinater * {panelState === "creating" && "(klikk på kartet)"}
                </label>
                <div className="px-2 py-1.5 border rounded bg-gray-50 text-xs">
                  {coordinates ? (
                    <span className="font-mono">
                      {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                    </span>
                  ) : (
                    <span className="text-gray-400">Ikke valgt</span>
                  )}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Kategori *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Autofylles fra kart"
                />
              </div>

              {/* More fields toggle */}
              <button
                type="button"
                onClick={() => setShowMoreFields(!showMoreFields)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                {showMoreFields ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showMoreFields ? "Skjul ekstra felt" : "Vis ekstra felt"}
              </button>

              {showMoreFields && (
                <div className="space-y-3 pt-2 border-t">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Beskrivelse</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Editorial Hook</label>
                    <input
                      type="text"
                      value={editorialHook}
                      onChange={(e) => setEditorialHook(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Local Insight</label>
                    <input
                      type="text"
                      value={localInsight}
                      onChange={(e) => setLocalInsight(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Story Prioritet</label>
                    <select
                      value={storyPriority}
                      onChange={(e) => setStoryPriority(e.target.value as typeof storyPriority)}
                      className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
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
              <div className="flex gap-2 pt-2">
                {panelState === "editing" && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isSubmitting ? (
                    "Lagrer..."
                  ) : panelState === "editing" ? (
                    <>
                      <Edit2 className="w-3 h-3" /> Oppdater
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" /> Opprett
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* POI Count Indicator - Bottom Left */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
        <span className="text-sm text-gray-600">
          Viser <span className="font-semibold text-gray-900">{filteredPois.length}</span> av{" "}
          <span className="font-semibold text-gray-900">{pois.length}</span> POIs
        </span>
      </div>
    </div>
  );
}
