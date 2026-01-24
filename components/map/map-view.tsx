"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import Map, { NavigationControl, type MapRef } from "react-map-gl/mapbox";
import type { Coordinates, POI } from "@/lib/types";
import { POIMarker } from "./poi-marker";
import { RouteLayer } from "./route-layer";

// Mapbox stil som skjuler standard POI-labels
const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

interface MapViewProps {
  center: Coordinates;
  pois: POI[];
  activePOI?: string | null;
  onPOIClick?: (poiId: string) => void;
  showRoute?: boolean;
  routeCoordinates?: [number, number][];
  routeTravelTime?: number;
  routeTravelMode?: "walk" | "bike" | "car";
  className?: string;
}

export function MapView({
  center,
  pois,
  activePOI,
  onPOIClick,
  showRoute = false,
  routeCoordinates,
  routeTravelTime,
  routeTravelMode,
  className = "",
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Flytt kart til aktiv POI
  useEffect(() => {
    if (!mapRef.current || !activePOI || !mapLoaded) return;

    const poi = pois.find((p) => p.id === activePOI);
    if (poi) {
      mapRef.current.flyTo({
        center: [poi.coordinates.lng, poi.coordinates.lat],
        zoom: 15,
        duration: 1000,
      });
    }
  }, [activePOI, pois, mapLoaded]);

  // Skjul standard POI-labels når kartet lastes
  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      // Skjul Mapbox POI-labels
      const layers = map.getStyle()?.layers || [];
      layers.forEach((layer) => {
        if (
          layer.id.includes("poi") ||
          layer.id.includes("place-label") ||
          layer.id.includes("transit")
        ) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      });
    }
    setMapLoaded(true);
  }, []);

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 14,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onLoad={onLoad}
      >
      <NavigationControl position="top-right" />

      {/* Prosjekt-sentrum markør */}
      <POIMarker
        poi={{
          id: "center",
          name: "Ferjemannsveien 10",
          coordinates: center,
          category: {
            id: "center",
            name: "Sentrum",
            icon: "MapPin",
            color: "#0ea5e9",
          },
        }}
        isCenter
      />

      {/* POI-markører */}
      {pois.map((poi) => (
        <POIMarker
          key={poi.id}
          poi={poi}
          isActive={activePOI === poi.id}
          onClick={() => onPOIClick?.(poi.id)}
        />
      ))}

      {/* Rute-lag */}
      {showRoute && routeCoordinates && routeCoordinates.length > 0 && (
        <RouteLayer
          coordinates={routeCoordinates}
          travelTime={routeTravelTime}
          travelMode={routeTravelMode}
        />
      )}
      </Map>
    </div>
  );
}
