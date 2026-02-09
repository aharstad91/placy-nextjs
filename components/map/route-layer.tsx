"use client";

import { Source, Layer, Marker } from "react-map-gl/mapbox";
import { useMemo } from "react";
import type { Expression } from "mapbox-gl";

export interface RouteSegment {
  coordinates: [number, number][];
  active: boolean;
}

interface RouteLayerProps {
  coordinates?: [number, number][];
  segments?: RouteSegment[];
  travelTime?: number;
  travelMode?: "walk" | "bike" | "car";
}

export function RouteLayer({ coordinates, segments, travelTime, travelMode = "walk" }: RouteLayerProps) {
  // Build GeoJSON — segments mode (active/inactive) or single-line mode
  const routeGeoJSON: GeoJSON.FeatureCollection = useMemo(() => {
    if (segments && segments.length > 0) {
      return {
        type: "FeatureCollection",
        features: segments
          .filter((s) => s.coordinates.length >= 2)
          .map((segment) => ({
            type: "Feature" as const,
            properties: { active: segment.active },
            geometry: {
              type: "LineString" as const,
              coordinates: segment.coordinates,
            },
          })),
      };
    }

    return {
      type: "FeatureCollection",
      features: coordinates && coordinates.length >= 2
        ? [{
            type: "Feature" as const,
            properties: { active: true },
            geometry: {
              type: "LineString" as const,
              coordinates: coordinates,
            },
          }]
        : [],
    };
  }, [coordinates, segments]);

  const hasSegments = segments && segments.length > 0;

  // Travel-time badge position
  const allCoords = segments
    ? segments.flatMap((s) => s.coordinates)
    : coordinates ?? [];
  const endpoint = useMemo(() => {
    if (allCoords.length < 2) return null;
    const last = allCoords[allCoords.length - 1];
    return { lng: last[0], lat: last[1] };
  }, [allCoords]);

  const modeIcon = travelMode === "walk" ? "🚶" : travelMode === "bike" ? "🚴" : "🚗";

  if (routeGeoJSON.features.length === 0) return null;

  // Data-driven paint expressions for active/inactive segments
  const activeExpr = (active: string | number, inactive: string | number): Expression =>
    ["case", ["get", "active"], active, inactive] as Expression;

  return (
    <>
      <Source id="route-source" type="geojson" data={routeGeoJSON}>
        {/* Glow layer */}
        <Layer
          id="route-glow"
          type="line"
          source="route-source"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{
            "line-color": "#3b82f6",
            "line-width": hasSegments ? (activeExpr(14, 8) as unknown as number) : 14,
            "line-opacity": hasSegments ? (activeExpr(0.25, 0.08) as unknown as number) : 0.25,
            "line-blur": 3,
          }}
        />
        {/* Casing layer */}
        <Layer
          id="route-casing"
          type="line"
          source="route-source"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{
            "line-color": "#ffffff",
            "line-width": hasSegments ? (activeExpr(8, 5) as unknown as number) : 8,
            "line-opacity": hasSegments ? (activeExpr(1, 0.5) as unknown as number) : 1,
          }}
        />
        {/* Main line */}
        <Layer
          id="route-line"
          type="line"
          source="route-source"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{
            "line-color": hasSegments
              ? (activeExpr("#3b82f6", "#93c5fd") as unknown as string)
              : "#3b82f6",
            "line-width": hasSegments ? (activeExpr(5, 3) as unknown as number) : 5,
            "line-opacity": hasSegments ? (activeExpr(1, 0.4) as unknown as number) : 1,
          }}
        />
      </Source>

      {/* Travel-time badge */}
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
