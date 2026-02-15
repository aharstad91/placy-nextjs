"use client";

import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import type { Coordinates, POI } from "@/lib/types";
import { RouteLayer } from "@/components/map/route-layer";
import { MAP_STYLE_STANDARD } from "@/lib/themes/map-styles";

interface TripPreviewMapProps {
  center: Coordinates;
  stops: POI[];
}

export default function TripPreviewMap({ center, stops }: TripPreviewMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<
    [number, number][] | null
  >(null);

  // Compute bounds from all stops
  const bounds = useMemo(() => {
    if (stops.length === 0) return null;
    let minLat = Infinity,
      maxLat = -Infinity;
    let minLng = Infinity,
      maxLng = -Infinity;
    for (const stop of stops) {
      if (stop.coordinates.lat < minLat) minLat = stop.coordinates.lat;
      if (stop.coordinates.lat > maxLat) maxLat = stop.coordinates.lat;
      if (stop.coordinates.lng < minLng) minLng = stop.coordinates.lng;
      if (stop.coordinates.lng > maxLng) maxLng = stop.coordinates.lng;
    }
    const latPad = Math.max((maxLat - minLat) * 0.15, 0.002);
    const lngPad = Math.max((maxLng - minLng) * 0.15, 0.002);
    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLng: minLng - lngPad,
      maxLng: maxLng + lngPad,
    };
  }, [stops]);

  // Fit map to bounds on load
  const onLoad = useCallback(() => {
    setMapLoaded(true);
    if (bounds && mapRef.current) {
      mapRef.current.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        { padding: 40, duration: 0 }
      );
    }
  }, [bounds]);

  // Fetch route on mount
  useEffect(() => {
    if (stops.length < 2) return;
    const waypoints = stops
      .map((s) => `${s.coordinates.lng},${s.coordinates.lat}`)
      .join(";");

    const controller = new AbortController();
    fetch(
      `/api/directions?waypoints=${encodeURIComponent(waypoints)}&mode=walk`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.coordinates) {
          setRouteCoordinates(data.coordinates);
        }
      })
      .catch(() => {
        // Fallback: straight lines between stops
      });
    return () => controller.abort();
  }, [stops]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 14,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE_STANDARD}
        onLoad={onLoad}
        interactive={true}
        scrollZoom={false}
        attributionControl={false}
      >
        {/* Route line */}
        {routeCoordinates && (
          <RouteLayer coordinates={routeCoordinates} />
        )}

        {/* Stop markers */}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            longitude={stop.coordinates.lng}
            latitude={stop.coordinates.lat}
            anchor="center"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1A1A1A] text-white text-xs font-bold shadow-lg border-2 border-white">
              {index + 1}
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
