"use client";

import {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import Map, {
  NavigationControl,
  Marker,
  type MapRef,
} from "react-map-gl/mapbox";
import type { Coordinates, POI, TravelMode, TimeBudget } from "@/lib/types";
import { cn, isWithinTimeBudget } from "@/lib/utils";
import { RouteLayer } from "@/components/map/route-layer";
import { MapPin, Sparkles } from "lucide-react";
import * as LucideIcons from "lucide-react";

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

interface ExplorerMapProps {
  center: Coordinates;
  pois: POI[];
  allPOIs: POI[];
  activePOI: string | null;
  activeCategories: Set<string>;
  onPOIClick: (poiId: string) => void;
  onViewportPOIs: (poiIds: Set<string>, clusterCount: number) => void;
  onZoomChange: (zoom: number) => void;
  projectName: string;
  routeData?: {
    coordinates: [number, number][];
    travelTime: number;
  } | null;
  travelMode?: TravelMode;
  timeBudget?: TimeBudget;
}

export default function ExplorerMap({
  center,
  pois,
  allPOIs,
  activePOI,
  activeCategories,
  onPOIClick,
  onViewportPOIs,
  onZoomChange,
  projectName,
  routeData,
  travelMode = "walk",
  timeBudget = 15,
}: ExplorerMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Get Lucide icon component by name
  const getIcon = useCallback((iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  }, []);

  // Fly to active POI
  useEffect(() => {
    if (!mapRef.current || !activePOI || !mapLoaded) return;
    const poi = pois.find((p) => p.id === activePOI);
    if (poi) {
      mapRef.current.flyTo({
        center: [poi.coordinates.lng, poi.coordinates.lat],
        zoom: Math.max(mapRef.current.getZoom(), 15),
        duration: 800,
      });
    }
  }, [activePOI, pois, mapLoaded]);

  // Update visible POIs when map moves
  const updateVisiblePOIs = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const visibleIds = new Set<string>();

    for (const poi of pois) {
      if (bounds.contains([poi.coordinates.lng, poi.coordinates.lat])) {
        visibleIds.add(poi.id);
      }
    }

    onViewportPOIs(visibleIds, 0);
    onZoomChange(map.getZoom());
  }, [pois, mapLoaded, onViewportPOIs, onZoomChange]);

  // Handle map load
  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      // Hide default POI labels for cleaner look
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

      // Add 3D building extrusions
      const buildingLayer = map.getLayer("3d-buildings");
      if (!buildingLayer) {
        map.addLayer({
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#d4d4d8",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.5,
          },
        });
      }
    }
    setMapLoaded(true);
  }, []);

  // Update visible POIs after load
  useEffect(() => {
    if (mapLoaded) {
      const timer = setTimeout(updateVisiblePOIs, 200);
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, updateVisiblePOIs]);

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 15,
          pitch: 45,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onLoad={onLoad}
        onMoveEnd={updateVisiblePOIs}
        onZoomEnd={updateVisiblePOIs}
      >
        <NavigationControl position="top-right" visualizePitch={true} />

        {/* Route overlay */}
        {routeData && (
          <RouteLayer
            coordinates={routeData.coordinates}
            travelTime={routeData.travelTime}
            travelMode={travelMode}
          />
        )}

        {/* Project center marker */}
        <Marker
          longitude={center.lng}
          latitude={center.lat}
          anchor="center"
        >
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 bg-sky-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-medium text-gray-500 mt-1 bg-white/80 px-1.5 py-0.5 rounded">
              Du er her
            </span>
          </div>
        </Marker>

        {/* All POI markers — no clustering */}
        {pois.map((poi) => {
          const withinBudget = isWithinTimeBudget(poi.travelTime?.[travelMode], timeBudget);
          const Icon = getIcon(poi.category.icon);
          const isThisActive = activePOI === poi.id;

          return (
            <Marker
              key={poi.id}
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onPOIClick(poi.id);
              }}
            >
              <div className="relative cursor-pointer">
                {/* Pulsing ring for active marker */}
                {isThisActive && (
                  <div
                    className="absolute rounded-full animate-ping opacity-50"
                    style={{
                      backgroundColor: poi.category.color,
                      width: 32,
                      height: 32,
                      top: -4,
                      left: -4,
                    }}
                  />
                )}

                {/* Icon circle */}
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 border-white shadow-md transition-all",
                    isThisActive ? "w-10 h-10" : "w-8 h-8 hover:scale-110",
                    !withinBudget && !isThisActive && "opacity-30"
                  )}
                  style={{ backgroundColor: poi.category.color }}
                >
                  <Icon className={cn("text-white", isThisActive ? "w-5 h-5" : "w-4 h-4")} />
                </div>

                {/* Editorial sparkle badge */}
                {poi.editorialHook && !isThisActive && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border border-white flex items-center justify-center">
                    <Sparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                )}

                {/* Active marker name label */}
                {isThisActive && (
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
      </Map>
    </div>
  );
}
