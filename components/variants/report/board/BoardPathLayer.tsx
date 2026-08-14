"use client";

import { useEffect, useMemo, useState } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import { useBoardRoute } from "./board-route";
import { useBoard, useActivePOI, useActivePOICategory } from "./board-state";

/**
 * Tegner ruta fra Home til aktiv POI når phase === "poi", i aktiv reisemodus.
 *
 * Leser `BoardRouteProvider` (board-route.tsx) — den delte rutekilden begge
 * kart-motorene og tids-chipen bruker. Formen er
 * `{ coordinates: {lat,lng}[], travelMinutes }`; vi reshaper til `[lng, lat][]`
 * på layer-boundary.
 *
 * Path-fade ved POI-bytte: `line-opacity-transition: { duration: 300 }` på paint-laget
 * gir gratis fade-in/fade-out fra Mapbox når GeoJSON-data byttes ut. Vi styrer opacity
 * via en "visible"-state som settes til false ved POI-bytte og true når ny data ankommer.
 */
export function BoardPathLayer() {
  const { state } = useBoard();
  const activePOI = useActivePOI();
  // Fargen tas fra POI-ens EGEN kategori, ikke fra `activeCategoryId`: et
  // markørklikk setter ikke lenger kategorien (2026-08-13), og den gamle
  // `useActiveCategory()`-gaten under gjorde da at ruta aldri ble tegnet.
  const poiCategory = useActivePOICategory();

  // Delt rutekilde (BoardRouteProvider) — samme svar som chipen og 3D-ruten
  // leser, i aktiv reisemodus.
  const { data: routeData } = useBoardRoute();

  // Fade-styring: når activePOIId endrer, dimm gammel path før ny data ankommer.
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Ved POI-bytte, modusbytte eller phase-bytte fra poi → annet: fade ut først.
    // Modusen hører med fordi ruta får en NY form, ikke bare et nytt tall — en
    // sykkelrute som poppet inn uten fade ville lest som en glitch.
    setOpacity(0);
  }, [state.activePOIId, state.phase, state.travelMode]);

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

  if (state.phase !== "poi" || !activePOI || geojson.features.length === 0) {
    return null;
  }

  // Kategorien finnes alltid for en POI som ligger på boardet; fallbacken er en
  // ren defensiv verdi så en manglende kategori gir en synlig linje i stedet for
  // en usynlig `undefined`-farge.
  const color = poiCategory?.color ?? "#57534e";

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
