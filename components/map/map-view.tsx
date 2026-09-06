"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import Map, { NavigationControl, type MapRef } from "react-map-gl/mapbox";
import type { Coordinates, POI } from "@/lib/types";
import { POIMarker } from "./poi-marker";
import { RouteLayer } from "./route-layer";
import { MAP_STYLE_DEFAULT } from "@/lib/themes/map-styles";

/** Vestlig/sørlig og østlig/nordlig hjørne, samme form som Google 3D-bounds. */
export interface MapViewBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

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
  /**
   * Startutsnitt fra en bounding-boks i stedet for fast zoom 14.
   *
   * Reserven uten WebGL må åpne på SAMME utsnitt som 3D-motoren, og et
   * porteføljekart spenner titalls mil — zoom 14 ville vist én bygård.
   * Usatt (alle eksisterende kall) beholder dagens faste zoom.
   */
  bounds?: MapViewBounds;
  /** Egne markører inne i kartet, f.eks. porteføljens prosjekt-chips. */
  children?: React.ReactNode;
  /**
   * Når false tegnes ikke sentrum-markøren. Den er hardkodet til én adresse og
   * hører ikke hjemme på et kart over en hel kjedes prosjekter. Default true.
   */
  showCenterMarker?: boolean;
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
  bounds,
  children,
  showCenterMarker = true,
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
        initialViewState={
          bounds
            ? {
                bounds: [bounds.west, bounds.south, bounds.east, bounds.north],
                fitBoundsOptions: { padding: 48 },
              }
            : {
                longitude: center.lng,
                latitude: center.lat,
                zoom: 14,
              }
        }
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE_DEFAULT}
        onLoad={onLoad}
      >
      <NavigationControl position="top-right" />

      {/* Prosjekt-sentrum markør */}
      {showCenterMarker && (
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
      )}

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

      {/* Egne markører fra kallstedet (porteføljens prosjekt-chips). */}
      {children}
      </Map>
    </div>
  );
}
