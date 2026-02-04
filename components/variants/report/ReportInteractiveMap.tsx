"use client";

import { useRef, useCallback, useEffect, useMemo } from "react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl/mapbox";
import type { POI, Coordinates } from "@/lib/types";
import * as LucideIcons from "lucide-react";

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";
const USE_SYMBOL_LAYER_THRESHOLD = 15;

interface ReportInteractiveMapProps {
  pois: POI[];
  center: Coordinates;
  activePOI: string | null;
  onPOIClick: (poiId: string) => void;
  onMapMount?: (mapRef: MapRef) => void;
  onMapUnmount?: () => void;
}

export default function ReportInteractiveMap({
  pois,
  center,
  activePOI,
  onPOIClick,
  onMapMount,
  onMapUnmount,
}: ReportInteractiveMapProps) {
  const mapRef = useRef<MapRef>(null);
  const useSymbolLayers = pois.length > USE_SYMBOL_LAYER_THRESHOLD;

  // Get Lucide icon component by name
  const getIcon = useCallback((iconName: string): LucideIcons.LucideIcon => {
    const Icon = (
      LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>
    )[iconName];
    return Icon || LucideIcons.MapPin;
  }, []);

  // Cleanup on unmount - critical for WebGL context management
  useEffect(() => {
    return () => {
      mapRef.current?.getMap().remove();
      onMapUnmount?.();
    };
  }, [onMapUnmount]);

  const handleMapLoad = useCallback(() => {
    if (mapRef.current) {
      onMapMount?.(mapRef.current);

      // Hide default POI labels for cleaner look
      const map = mapRef.current.getMap();
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

      // Initial fitBounds to show all POIs
      if (pois.length > 0) {
        const bounds = pois.reduce(
          (acc, poi) => ({
            minLng: Math.min(acc.minLng, poi.coordinates.lng),
            maxLng: Math.max(acc.maxLng, poi.coordinates.lng),
            minLat: Math.min(acc.minLat, poi.coordinates.lat),
            maxLat: Math.max(acc.maxLat, poi.coordinates.lat),
          }),
          {
            minLng: Infinity,
            maxLng: -Infinity,
            minLat: Infinity,
            maxLat: -Infinity,
          }
        );
        mapRef.current.fitBounds(
          [
            [bounds.minLng, bounds.minLat],
            [bounds.maxLng, bounds.maxLat],
          ],
          { padding: 60, duration: 0 }
        );
      }
    }
  }, [pois, onMapMount]);

  // Pan to POI when activePOI changes (from card click)
  useEffect(() => {
    if (!activePOI || !mapRef.current) return;

    const poi = pois.find((p) => p.id === activePOI);
    if (!poi) return;

    // Use fitBounds with maxZoom to prevent jarring zoom-in (from Explorer learnings)
    const map = mapRef.current;
    map.fitBounds(
      [
        [poi.coordinates.lng - 0.002, poi.coordinates.lat - 0.002],
        [poi.coordinates.lng + 0.002, poi.coordinates.lat + 0.002],
      ],
      { padding: 60, duration: 400, maxZoom: map.getZoom() }
    );
  }, [activePOI, pois]);

  // Handle marker click
  const handleMarkerClick = useCallback(
    (e: { originalEvent: MouseEvent }, poiId: string) => {
      e.originalEvent.stopPropagation();
      onPOIClick(poiId);
    },
    [onPOIClick]
  );

  // GeoJSON for symbol layer (performance optimization for many POIs)
  const geojsonData = useMemo(() => {
    if (!useSymbolLayers) return null;
    return {
      type: "FeatureCollection" as const,
      features: pois.map((poi) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [poi.coordinates.lng, poi.coordinates.lat],
        },
        properties: {
          id: poi.id,
          color: poi.category.color,
          isActive: poi.id === activePOI,
        },
      })),
    };
  }, [pois, activePOI, useSymbolLayers]);

  // Handle symbol layer click
  const handleSymbolClick = useCallback(
    (e: mapboxgl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const poiId = e.features[0].properties?.id;
        if (poiId) {
          onPOIClick(poiId);
        }
      }
    },
    [onPOIClick]
  );

  return (
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
      onLoad={handleMapLoad}
      cooperativeGestures={true}
      interactiveLayerIds={useSymbolLayers ? ["poi-circles"] : undefined}
      onClick={useSymbolLayers ? handleSymbolClick : undefined}
    >
      {/* Use DOM markers for small POI counts */}
      {!useSymbolLayers &&
        pois.map((poi) => {
          const Icon = getIcon(poi.category.icon);
          const isActive = activePOI === poi.id;

          return (
            <Marker
              key={poi.id}
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              anchor="center"
              onClick={(e) => handleMarkerClick(e, poi.id)}
            >
              <div className="relative cursor-pointer">
                {/* Pulsing ring for active marker */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-full animate-ping opacity-75"
                    style={{ backgroundColor: poi.category.color }}
                  />
                )}

                {/* Icon circle */}
                <div
                  className={`relative flex items-center justify-center rounded-full border-2 border-white shadow-md transition-all ${
                    isActive ? "w-10 h-10 scale-110" : "w-8 h-8 hover:scale-110"
                  }`}
                  style={{ backgroundColor: poi.category.color }}
                >
                  <Icon
                    className={`text-white ${isActive ? "w-5 h-5" : "w-4 h-4"}`}
                  />
                </div>

                {/* Active marker name label */}
                {isActive && (
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span
                      className="px-2 py-0.5 text-[10px] font-medium text-white rounded shadow-lg"
                      style={{ backgroundColor: poi.category.color }}
                    >
                      {poi.name}
                    </span>
                  </div>
                )}
              </div>
            </Marker>
          );
        })}

      {/* Use symbol layer for large POI counts (WebGL-based, better performance) */}
      {useSymbolLayers && geojsonData && (
        <Source id="pois" type="geojson" data={geojsonData}>
          <Layer
            id="poi-circles"
            type="circle"
            paint={{
              "circle-radius": ["case", ["get", "isActive"], 16, 12],
              "circle-color": ["get", "color"],
              "circle-stroke-width": ["case", ["get", "isActive"], 3, 2],
              "circle-stroke-color": "#ffffff",
            }}
          />
        </Source>
      )}
    </Map>
  );
}
