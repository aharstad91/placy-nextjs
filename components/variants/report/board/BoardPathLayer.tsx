"use client";

import { useEffect, useMemo, useState } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import { useRouteData } from "@/lib/map/use-route-data";
import { useBoard, useActiveCategory, useActivePOI } from "./board-state";

/**
 * Tegner walking-path fra Home til aktiv POI når phase === "poi".
 *
 * Bruker `useRouteData` fra lib/map (debounce + AbortController + Zod-validert
 * /api/directions-respons). Returshape er `{ coordinates: {lat,lng}[], travelMinutes }`
 * — vi reshape til `[lng, lat][]` på layer-boundary.
 *
 * Path-fade ved POI-bytte: `line-opacity-transition: { duration: 300 }` på paint-laget
 * gir gratis fade-in/fade-out fra Mapbox når GeoJSON-data byttes ut. Vi styrer opacity
 * via en "visible"-state som settes til false ved POI-bytte og true når ny data ankommer.
 */
export function BoardPathLayer() {
  const { state, data } = useBoard();
  const activeCategory = useActiveCategory();
  const activePOI = useActivePOI();

  // useRouteData forventer en POI (lib/types) — bruk BoardPOI.raw
  const poiForRoute = state.phase === "poi" && activePOI ? activePOI.raw : null;
  const { data: routeData } = useRouteData(poiForRoute, data.home.coordinates);

  // Fade-styring: når activePOIId endrer, dimm gammel path før ny data ankommer.
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Ved POI-bytte (eller phase-bytte fra poi → annet): fade ut først.
    setOpacity(0);
  }, [state.activePOIId, state.phase]);

  useEffect(() => {
    // Når ny route-data ankommer for aktiv POI, fade inn.
    if (routeData && state.phase === "poi") {
      // En liten delay sikrer at fade-out er synlig før fade-in starter.
      const t = setTimeout(() => setOpacity(1), 50);
      return () => clearTimeout(t);
    }
  }, [routeData, state.phase]);

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!routeData || routeData.coordinates.length < 2) {
      return { type: "FeatureCollection", features: [] };
    }
    // Reshape {lat,lng}[] → [lng,lat][] (Mapbox GeoJSON-konvensjon)
    const coords = routeData.coordinates.map((c) => [c.lng, c.lat] as [number, number]);
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        },
      ],
    };
  }, [routeData]);

  if (state.phase !== "poi" || !activeCategory || geojson.features.length === 0) {
    return null;
  }

  const color = activeCategory.color;

  return (
    <Source id="board-path-source" type="geojson" data={geojson}>
      {/* Casing — hvit "halo" for kontrast mot kart */}
      <Layer
        id="board-path-casing"
        type="line"
        source="board-path-source"
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{
          "line-color": "#ffffff",
          "line-width": 8,
          "line-opacity": opacity,
          "line-opacity-transition": { duration: 300 },
        }}
      />
      {/* Hovedlinje i kategori-farge */}
      <Layer
        id="board-path-line"
        type="line"
        source="board-path-source"
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{
          "line-color": color,
          "line-width": 5,
          "line-opacity": opacity,
          "line-opacity-transition": { duration: 300 },
        }}
      />
    </Source>
  );
}
