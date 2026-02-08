"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import MapGL, {
  Source,
  Layer,
  Marker,
  NavigationControl,
  type MapRef,
  type MapMouseEvent,
} from "react-map-gl/mapbox";
import { Plus, Trash2, Save, Loader2, MapPin } from "lucide-react";
import { createCircleCoordinates } from "@/lib/utils/geo";
import type { DiscoveryCircle } from "@/lib/types";
import { MAP_STYLE_LIGHT } from "@/lib/themes/map-styles";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const MAX_CIRCLES = 10;

const CIRCLE_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
];

interface DiscoveryCirclesEditorProps {
  projectId: string;
  centerLat: number;
  centerLng: number;
  initialCircles: DiscoveryCircle[] | null;
  onSaved?: () => void;
}

export function DiscoveryCirclesEditor({
  projectId,
  centerLat,
  centerLng,
  initialCircles,
  onSaved,
}: DiscoveryCirclesEditorProps) {
  const mapRef = useRef<MapRef>(null);
  const [circles, setCircles] = useState<DiscoveryCircle[]>(
    initialCircles ?? []
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track if user has made changes
  const isDirty = useMemo(() => {
    const initial = initialCircles ?? [];
    if (circles.length !== initial.length) return true;
    return circles.some(
      (c, i) =>
        c.lat !== initial[i].lat ||
        c.lng !== initial[i].lng ||
        c.radiusMeters !== initial[i].radiusMeters
    );
  }, [circles, initialCircles]);

  // Generate GeoJSON for all circles
  const circlesGeoJSON = useMemo(() => {
    const features = circles.map((circle, i) => ({
      type: "Feature" as const,
      properties: {
        index: i,
        selected: i === selectedIndex,
        color: CIRCLE_COLORS[i % CIRCLE_COLORS.length],
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          createCircleCoordinates(circle.lng, circle.lat, circle.radiusMeters),
        ],
      },
    }));
    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [circles, selectedIndex]);

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (circles.length >= MAX_CIRCLES) return;

      // Check if click is on an existing circle
      const map = mapRef.current?.getMap();
      if (map) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["discovery-circles-fill"],
        });
        if (features.length > 0) {
          const clickedIndex = features[0].properties?.index;
          if (typeof clickedIndex === "number") {
            setSelectedIndex(clickedIndex);
            return;
          }
        }
      }

      // Add new circle
      const newCircle: DiscoveryCircle = {
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
        radiusMeters: 500,
      };
      setCircles((prev) => [...prev, newCircle]);
      setSelectedIndex(circles.length);
      setSaveStatus("idle");
    },
    [circles.length]
  );

  const handleRadiusChange = useCallback(
    (radius: number) => {
      if (selectedIndex === null) return;
      setCircles((prev) =>
        prev.map((c, i) =>
          i === selectedIndex ? { ...c, radiusMeters: radius } : c
        )
      );
      setSaveStatus("idle");
    },
    [selectedIndex]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedIndex === null) return;
    setCircles((prev) => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
    setSaveStatus("idle");
  }, [selectedIndex]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discovery_circles: circles.length > 0 ? circles : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Feil ${res.status}`);
      }

      setSaveStatus("success");
      onSaved?.();
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      setSaveStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Lagring feilet");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCircle =
    selectedIndex !== null ? circles[selectedIndex] : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Discovery-område
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Klikk på kartet for å legge til sirkler. Import henter POI-er fra
            alle sirkler.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {circles.length} / {MAX_CIRCLES} sirkler
          </span>
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDirty
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Lagre
          </button>
        </div>
      </div>

      {saveStatus === "success" && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-600 rounded-lg text-sm">
          Discovery-sirkler lagret!
        </div>
      )}

      {saveStatus === "error" && errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200">
        <div style={{ height: 400 }}>
          {MAPBOX_TOKEN ? (
            <MapGL
              ref={mapRef}
              initialViewState={{
                latitude: centerLat,
                longitude: centerLng,
                zoom: 13,
              }}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle={MAP_STYLE_LIGHT}
              onClick={handleMapClick}
              cursor={circles.length < MAX_CIRCLES ? "crosshair" : "default"}
              interactiveLayerIds={["discovery-circles-fill"]}
            >
              <NavigationControl position="top-right" />

              {/* Hotel/center marker */}
              <Marker latitude={centerLat} longitude={centerLng}>
                <MapPin className="w-6 h-6 text-gray-800 fill-gray-800" />
              </Marker>

              {/* Discovery circles */}
              <Source
                id="discovery-circles"
                type="geojson"
                data={circlesGeoJSON}
              >
                <Layer
                  id="discovery-circles-fill"
                  type="fill"
                  paint={{
                    "fill-color": ["get", "color"],
                    "fill-opacity": [
                      "case",
                      ["get", "selected"],
                      0.25,
                      0.15,
                    ],
                  }}
                />
                <Layer
                  id="discovery-circles-stroke"
                  type="line"
                  paint={{
                    "line-color": ["get", "color"],
                    "line-width": [
                      "case",
                      ["get", "selected"],
                      3,
                      1.5,
                    ],
                    "line-dasharray": [2, 2],
                  }}
                />
              </Source>

              {/* Center markers for each circle */}
              {circles.map((circle, i) => (
                <Marker
                  key={i}
                  latitude={circle.lat}
                  longitude={circle.lng}
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedIndex(i);
                  }}
                >
                  <div
                    className={`w-3 h-3 rounded-full border-2 border-white shadow-sm cursor-pointer ${
                      i === selectedIndex ? "ring-2 ring-blue-400" : ""
                    }`}
                    style={{
                      backgroundColor: CIRCLE_COLORS[i % CIRCLE_COLORS.length],
                    }}
                  />
                </Marker>
              ))}
            </MapGL>
          ) : (
            <div className="h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
              Mapbox token mangler
            </div>
          )}
        </div>
      </div>

      {/* Selected circle controls */}
      {selectedCircle && selectedIndex !== null && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-sm font-medium"
              style={{
                color: CIRCLE_COLORS[selectedIndex % CIRCLE_COLORS.length],
              }}
            >
              Sirkel {selectedIndex + 1}
            </span>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Slett
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500">Radius</label>
              <span className="text-sm font-medium text-gray-700">
                {selectedCircle.radiusMeters}m
              </span>
            </div>
            <input
              type="range"
              min={300}
              max={2000}
              step={50}
              value={selectedCircle.radiusMeters}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>300m</span>
              <span>2000m</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {circles.length === 0 && (
        <div className="mt-4 text-center text-sm text-gray-400 py-4">
          <Plus className="w-5 h-5 mx-auto mb-1.5 text-gray-300" />
          Klikk på kartet for å definere discovery-området
        </div>
      )}
    </div>
  );
}
