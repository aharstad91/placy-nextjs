"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import Map, { Source, Layer, type MapRef } from "react-map-gl/mapbox";
import type { POI, Coordinates } from "@/lib/types";
import { MAP_STYLE_DEFAULT, hideDefaultPOILabels } from "@/lib/themes/map-styles";
import { AdaptiveMarker } from "@/components/map/adaptive-marker";
import { useMapZoomState } from "@/lib/hooks/useMapZoomState";

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const useSymbolLayers = pois.length > USE_SYMBOL_LAYER_THRESHOLD;

  // CSS-driven zoom state (only used for DOM markers path)
  useMapZoomState(mapRef, mapContainerRef, { mapLoaded });

  // Cleanup on unmount - critical for WebGL context management
  useEffect(() => {
    return () => {
      mapRef.current?.getMap().remove();
      onMapUnmount?.();
    };
  }, [onMapUnmount]);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (mapRef.current) {
      onMapMount?.(mapRef.current);

      // Hide default POI labels for cleaner look
      const map = mapRef.current.getMap();
      hideDefaultPOILabels(map);

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
    (e: { originalEvent: MouseEvent | undefined }, poiId: string) => {
      e.originalEvent?.stopPropagation();
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
    <div ref={mapContainerRef} className="w-full h-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 14,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE_DEFAULT}
        onLoad={handleMapLoad}
        cooperativeGestures={true}
        interactiveLayerIds={useSymbolLayers ? ["poi-circles"] : undefined}
        onClick={useSymbolLayers ? handleSymbolClick : undefined}
      >
        {/* Use adaptive DOM markers for small POI counts */}
        {!useSymbolLayers &&
          pois.map((poi) => {
            const isActive = activePOI === poi.id;

            return (
              <AdaptiveMarker
                key={poi.id}
                poi={poi}
                isActive={isActive}
                zIndex={isActive ? 10 : 1}
                onClick={(e) => handleMarkerClick(e, poi.id)}
              />
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
    </div>
  );
}
