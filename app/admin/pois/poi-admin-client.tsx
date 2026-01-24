"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import { MapPin, Trash2, Edit2, Plus, Search, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import type { DbCategory, DbPoi } from "@/lib/supabase/types";

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

// Default center: Trondheim sentrum
const DEFAULT_CENTER = { lat: 63.4305, lng: 10.3951 };

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

  // Map click handler
  const handleMapClick = useCallback(async (event: mapboxgl.MapLayerMouseEvent) => {
    const { lng, lat } = event.lngLat;
    setCoordinates({ lat, lng });

    // Reverse geocode to get address (client-side)
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
  }, []);

  // Address search - use client-side Mapbox API directly
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
      // Use Mapbox Geocoding API directly from client (avoids server-side token restrictions)
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${token}&country=NO&limit=5&language=no&proximity=${DEFAULT_CENTER.lng},${DEFAULT_CENTER.lat}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.message) {
        // Mapbox error
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

    // Fly to location
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
  const resetForm = () => {
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

    // Fly to POI
    mapRef.current?.flyTo({
      center: [poi.lng, poi.lat],
      zoom: 16,
      duration: 1000,
    });
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

      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete POI
  const handleDelete = async (poi: DbPoi) => {
    if (!confirm(`Er du sikker på at du vil slette "${poi.name}"?`)) {
      return;
    }

    try {
      const formData = new FormData();
      formData.set("id", poi.id);
      await deletePOI(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke slette POI");
    }
  };

  // Get category by ID
  const getCategoryById = (id: string | null) => categories.find((c) => c.id === id);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">POI Admin</h1>
          <p className="text-gray-600">Administrer alle points of interest (native og Google)</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Map and Form */}
          <div className="space-y-4">
            {/* Address Search */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Søk etter adresse..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-auto">
                      {searchResults.map((result, i) => (
                        <button
                          key={i}
                          onClick={() => selectSearchResult(result)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Map */}
            <div className="bg-white rounded-lg shadow overflow-hidden" style={{ height: "400px" }}>
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
              >
                <NavigationControl position="top-right" />

                {/* Selected position marker */}
                {coordinates && (
                  <Marker longitude={coordinates.lng} latitude={coordinates.lat} anchor="center">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg ring-4 ring-blue-200">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                  </Marker>
                )}

                {/* Filtered POI markers */}
                {filteredPois.map((poi) => {
                  const category = getCategoryById(poi.category_id);
                  const isGooglePoi = poi.google_place_id != null;
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
                        className="w-6 h-6 rounded-full flex items-center justify-center shadow cursor-pointer hover:scale-110 transition-transform relative"
                        style={{ backgroundColor: category?.color || "#6b7280" }}
                        title={poi.name}
                      >
                        <MapPin className="w-3 h-3 text-white" />
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {editingPoi ? "Rediger POI" : "Ny POI"}
                </h2>
                {editingPoi && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Google POI Info (read-only) */}
              {editingPoi?.google_place_id && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                      Google Places
                    </span>
                    <span className="text-xs text-gray-500">
                      Noen felt er read-only
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {editingPoi.google_rating && (
                      <div>
                        <span className="text-gray-500">Rating:</span>{" "}
                        <span className="font-medium">⭐ {editingPoi.google_rating}</span>
                      </div>
                    )}
                    {editingPoi.google_review_count && (
                      <div>
                        <span className="text-gray-500">Reviews:</span>{" "}
                        <span className="font-medium">{editingPoi.google_review_count}</span>
                      </div>
                    )}
                  </div>
                  {editingPoi.google_place_id && (
                    <div className="text-xs text-gray-400 truncate">
                      Place ID: {editingPoi.google_place_id}
                    </div>
                  )}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Navn *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="F.eks. Kaffebrenneriet Grünerløkka"
                />
              </div>

              {/* Coordinates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Koordinater * (klikk på kartet)
                </label>
                <div className="px-3 py-2 border rounded-lg bg-gray-50 text-sm">
                  {coordinates ? (
                    <span>
                      {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                    </span>
                  ) : (
                    <span className="text-gray-400">Ikke valgt</span>
                  )}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Autofylles fra kart/søk"
                />
              </div>

              {/* Show more fields toggle */}
              <button
                type="button"
                onClick={() => setShowMoreFields(!showMoreFields)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
              >
                {showMoreFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showMoreFields ? "Skjul ekstra felt" : "Vis ekstra felt"}
              </button>

              {showMoreFields && (
                <div className="space-y-4 pt-2 border-t">
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Beskrivelse
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Kort beskrivelse av stedet..."
                    />
                  </div>

                  {/* Editorial Hook */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Editorial Hook
                    </label>
                    <input
                      type="text"
                      value={editorialHook}
                      onChange={(e) => setEditorialHook(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="En setning som fanger oppmerksomheten..."
                    />
                  </div>

                  {/* Local Insight */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Local Insight
                    </label>
                    <input
                      type="text"
                      value={localInsight}
                      onChange={(e) => setLocalInsight(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Insider-tips fra lokalbefolkningen..."
                    />
                  </div>

                  {/* Story Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Story Prioritet
                    </label>
                    <select
                      value={storyPriority}
                      onChange={(e) => setStoryPriority(e.target.value as typeof storyPriority)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Ikke angitt</option>
                      <option value="must_have">Must Have</option>
                      <option value="nice_to_have">Nice to Have</option>
                      <option value="filler">Filler</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  "Lagrer..."
                ) : editingPoi ? (
                  <>
                    <Edit2 className="w-4 h-4" /> Oppdater POI
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Opprett POI
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Filter + POI List */}
          <div className="space-y-4">
            {/* Category Filter Panel */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Filtrer etter kategori</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateCategories(new Set(categories.map((c) => c.id)))}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Alle
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => updateCategories(new Set())}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Ingen
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {categories.map((category) => {
                  const isSelected = selectedCategories.has(category.id);
                  return (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded -mx-2"
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300 bg-white"
                        }`}
                        onClick={() => {
                          const newSet = new Set(selectedCategories);
                          if (isSelected) {
                            newSet.delete(category.id);
                          } else {
                            newSet.add(category.id);
                          }
                          updateCategories(newSet);
                        }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm text-gray-700 flex-1">{category.name}</span>
                      <span className="text-xs text-gray-400">{poiCountByCategory[category.id] || 0}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* POI List */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">
                  POIs ({filteredPois.length} av {pois.length})
                </h2>
              </div>
              <div className="divide-y max-h-[600px] overflow-auto">
                {pois.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Ingen POIs funnet i databasen.
                    <br />
                    Klikk på kartet for å opprette en ny!
                  </div>
                ) : filteredPois.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Ingen POIs matcher filteret.
                    <br />
                    <button
                      onClick={() => updateCategories(new Set(categories.map((c) => c.id)))}
                      className="text-blue-600 hover:text-blue-800 mt-2"
                    >
                      Vis alle kategorier
                    </button>
                  </div>
                ) : (
                  filteredPois.map((poi) => {
                    const category = getCategoryById(poi.category_id);
                    const isGooglePoi = poi.google_place_id != null;
                    return (
                      <div key={poi.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative"
                              style={{ backgroundColor: category?.color || "#6b7280" }}
                            >
                              <MapPin className="w-4 h-4 text-white" />
                              {isGooglePoi && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                  G
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{poi.name}</h3>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    isGooglePoi
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {isGooglePoi ? "Google" : "Native"}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">
                                {category?.name || "Ukjent kategori"}
                              </p>
                              {poi.address && (
                                <p className="text-sm text-gray-400 mt-1">{poi.address}</p>
                              )}
                              {poi.editorial_hook && (
                                <p className="text-sm text-blue-600 mt-1 italic">
                                  &ldquo;{poi.editorial_hook}&rdquo;
                                </p>
                              )}
                              {isGooglePoi && poi.google_rating && (
                                <p className="text-sm text-gray-400 mt-1">
                                  ⭐ {poi.google_rating} ({poi.google_review_count} reviews)
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditing(poi)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Rediger"
                            >
                              <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(poi)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Slett"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
