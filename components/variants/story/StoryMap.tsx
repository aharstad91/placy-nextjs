"use client";

import { useRef, useCallback, useState, useMemo, useEffect } from "react";
import Map, { Source, Layer, type MapRef } from "react-map-gl/mapbox";
import type { POI, Coordinates } from "@/lib/types";
import { MAP_STYLE_DEFAULT, hideDefaultPOILabels } from "@/lib/themes/map-styles";
import { AdaptiveMarker } from "@/components/map/adaptive-marker";
import { useMapZoomState } from "@/lib/hooks/useMapZoomState";
import { MapPin } from "lucide-react";

const SYMBOL_LAYER_THRESHOLD = 20;

interface StoryMapProps {
  pois: POI[];
  center: Coordinates;
  themeColor: string;
  activated: boolean;
  onActivate: () => void;
  onPOIClick: (poi: POI) => void;
}

export default function StoryMap({ pois, center, themeColor, activated, onActivate, onPOIClick }: StoryMapProps) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const useSymbolLayers = pois.length > SYMBOL_LAYER_THRESHOLD;

  useMapZoomState(mapRef, containerRef, { mapLoaded });

  const handleLoad = useCallback(() => {
    setMapLoaded(true);
    const map = mapRef.current;
    if (!map) return;

    hideDefaultPOILabels(map.getMap());

    if (pois.length > 0) {
      const bounds = pois.reduce(
        (acc, poi) => ({
          minLng: Math.min(acc.minLng, poi.coordinates.lng),
          maxLng: Math.max(acc.maxLng, poi.coordinates.lng),
          minLat: Math.min(acc.minLat, poi.coordinates.lat),
          maxLat: Math.max(acc.maxLat, poi.coordinates.lat),
        }),
        { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity },
      );
      map.fitBounds(
        [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
        { padding: 50, duration: 0 },
      );
    }
  }, [pois]);

  // Enable/disable map interactions based on activated prop
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;
    if (activated) {
      map.scrollZoom.enable();
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
    } else {
      map.scrollZoom.disable();
      map.dragPan.disable();
      map.touchZoomRotate.disable();
      map.doubleClickZoom.disable();
    }
  }, [activated, mapLoaded]);

  const handleMarkerClick = useCallback(
    (e: { originalEvent: MouseEvent | undefined }, poi: POI) => {
      e.originalEvent?.stopPropagation();
      onPOIClick(poi);
    },
    [onPOIClick],
  );

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
          color: poi.category.color || themeColor,
        },
      })),
    };
  }, [pois, themeColor, useSymbolLayers]);

  const handleSymbolClick = useCallback(
    (e: mapboxgl.MapLayerMouseEvent) => {
      const poiId = e.features?.[0]?.properties?.id;
      if (poiId) {
        const poi = pois.find((p) => p.id === poiId);
        if (poi) onPOIClick(poi);
      }
    },
    [pois, onPOIClick],
  );

  return (
    <div ref={containerRef} className="relative w-full h-[360px] md:h-[420px] rounded-xl overflow-hidden border border-[#eae6e1]">
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
        onLoad={handleLoad}
        scrollZoom={false}
        dragPan={false}
        touchZoomRotate={false}
        doubleClickZoom={false}
        interactiveLayerIds={activated && useSymbolLayers ? ["story-poi-circles"] : undefined}
        onClick={activated && useSymbolLayers ? handleSymbolClick : undefined}
      >
        {!useSymbolLayers &&
          pois.map((poi) => (
            <AdaptiveMarker
              key={poi.id}
              poi={poi}
              onClick={(e) => handleMarkerClick(e, poi)}
            />
          ))}

        {useSymbolLayers && geojsonData && (
          <Source id="story-pois" type="geojson" data={geojsonData}>
            <Layer
              id="story-poi-circles"
              type="circle"
              paint={{
                "circle-radius": 10,
                "circle-color": ["get", "color"],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}
      </Map>

      {/* Activation overlay — pointer-events:none lets page scroll pass through */}
      {!activated && (
        <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-5">
          <button
            onClick={onActivate}
            className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/95 border border-[#d4cfc8] shadow-md text-sm font-medium text-[#1a1a1a] hover:bg-white hover:shadow-lg transition-all backdrop-blur-sm"
          >
            <MapPin className="w-4 h-4 text-[#6a6a6a]" />
            Utforsk kartet
          </button>
        </div>
      )}
    </div>
  );
}
