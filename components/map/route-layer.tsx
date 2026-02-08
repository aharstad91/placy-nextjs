"use client";

import { Source, Layer, Marker } from "react-map-gl/mapbox";
import { useMemo } from "react";

interface RouteLayerProps {
  coordinates: [number, number][];
  travelTime?: number;
  travelMode?: "walk" | "bike" | "car";
}

export function RouteLayer({ coordinates, travelTime, travelMode = "walk" }: RouteLayerProps) {
  // GeoJSON for ruten
  const routeGeoJSON: GeoJSON.FeatureCollection = useMemo(() => ({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: coordinates,
      },
    }],
  }), [coordinates]);

  // Plasser reisetid-badge ved destinasjonen (siste koordinat i ruten)
  const endpoint = useMemo(() => {
    if (coordinates.length < 2) return null;
    const last = coordinates[coordinates.length - 1];
    return { lng: last[0], lat: last[1] };
  }, [coordinates]);

  const modeIcon = travelMode === "walk" ? "🚶" : travelMode === "bike" ? "🚴" : "🚗";

  if (coordinates.length < 2) return null;

  return (
    <>
      <Source id="route-source" type="geojson" data={routeGeoJSON}>
        {/* Rute-linje (bakgrunn/glow) */}
        <Layer
          id="route-glow"
          type="line"
          source="route-source"
          layout={{
            "line-join": "round",
            "line-cap": "round",
          }}
          paint={{
            "line-color": "#3b82f6",
            "line-width": 14,
            "line-opacity": 0.25,
            "line-blur": 3,
          }}
        />
        {/* Rute-linje (bakgrunn hvit) */}
        <Layer
          id="route-casing"
          type="line"
          source="route-source"
          layout={{
            "line-join": "round",
            "line-cap": "round",
          }}
          paint={{
            "line-color": "#ffffff",
            "line-width": 8,
            "line-opacity": 1,
          }}
        />
        {/* Rute-linje (forgrunn blå) */}
        <Layer
          id="route-line"
          type="line"
          source="route-source"
          layout={{
            "line-join": "round",
            "line-cap": "round",
          }}
          paint={{
            "line-color": "#3b82f6",
            "line-width": 5,
            "line-opacity": 1,
          }}
        />
      </Source>

      {/* Reisetid-badge ved destinasjonen (den klikkede markøren) */}
      {endpoint && travelTime && (
        <Marker
          longitude={endpoint.lng}
          latitude={endpoint.lat}
          anchor="bottom-left"
        >
          <div className="bg-white text-gray-900 px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg flex items-center gap-1.5 whitespace-nowrap border border-gray-100">
            <span>{modeIcon}</span>
            <span>{travelTime} min</span>
          </div>
        </Marker>
      )}
    </>
  );
}
