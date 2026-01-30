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
  Source,
  Layer,
  Marker,
  type MapRef,
  type MapMouseEvent,
} from "react-map-gl/mapbox";
import type { Coordinates, POI } from "@/lib/types";
import { RouteLayer } from "@/components/map/route-layer";
import { MapPin } from "lucide-react";

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
}: ExplorerMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Build GeoJSON for clustering
  const geojsonData = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: pois.map((poi) => ({
        type: "Feature" as const,
        id: poi.id,
        geometry: {
          type: "Point" as const,
          coordinates: [poi.coordinates.lng, poi.coordinates.lat],
        },
        properties: {
          id: poi.id,
          name: poi.name,
          categoryId: poi.category.id,
          categoryColor: poi.category.color,
          categoryIcon: poi.category.icon,
          categoryName: poi.category.name,
          rating: poi.googleRating || 0,
          hasEditorial: poi.editorialHook ? 1 : 0,
          priority: poi.storyPriority || "filler",
        },
      })),
    };
  }, [pois]);

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
    let clusterCount = 0;

    // Check which POIs are in viewport
    for (const poi of pois) {
      if (bounds.contains([poi.coordinates.lng, poi.coordinates.lat])) {
        visibleIds.add(poi.id);
      }
    }

    // Count visible clusters
    try {
      const canvas = map.getCanvas();
      const features = map.queryRenderedFeatures(
        [[0, 0], [canvas.width, canvas.height]] as [mapboxgl.PointLike, mapboxgl.PointLike],
        { layers: ["explorer-clusters"] }
      );
      clusterCount = features?.length || 0;
    } catch {
      // Layer may not exist yet
    }

    onViewportPOIs(visibleIds, clusterCount);
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

  // Handle cluster click — zoom into the cluster
  const onClusterClick = useCallback(
    (e: MapMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const features = map.queryRenderedFeatures(e.point, {
        layers: ["explorer-clusters"],
      });

      if (!features.length) return;

      const feature = features[0];
      const clusterId = feature.properties?.cluster_id;
      const source = map.getSource("explorer-pois") as mapboxgl.GeoJSONSource;

      if (source && clusterId !== undefined) {
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom === undefined || zoom === null) return;
          const coords = (feature.geometry as GeoJSON.Point).coordinates;
          map.flyTo({
            center: [coords[0], coords[1]],
            zoom: zoom + 0.5,
            duration: 500,
          });
        });
      }
    },
    []
  );

  // Handle unclustered point click
  const onPointClick = useCallback(
    (features: mapboxgl.GeoJSONFeature[]) => {
      if (!features.length) return;
      const poiId = features[0].properties?.id;
      if (poiId) {
        onPOIClick(poiId);
      }
    },
    [onPOIClick]
  );

  // Cursor changes
  const onMouseEnterCluster = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "pointer";
  }, []);

  const onMouseLeaveCluster = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "";
  }, []);

  return (
    <div className="w-full h-full relative">
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
        onMoveEnd={updateVisiblePOIs}
        onZoomEnd={updateVisiblePOIs}
        interactiveLayerIds={["explorer-clusters", "explorer-unclustered"]}
        onClick={(e) => {
          const map = mapRef.current?.getMap();
          if (!map) return;
          const clusterFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["explorer-clusters"],
          });
          if (clusterFeatures.length) {
            onClusterClick(e);
            return;
          }
          const pointFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["explorer-unclustered"],
          });
          if (pointFeatures.length) {
            onPointClick(pointFeatures);
            return;
          }
        }}
        onMouseEnter={onMouseEnterCluster}
        onMouseLeave={onMouseLeaveCluster}
      >
        <NavigationControl position="top-right" />

        {/* Walking route overlay */}
        {routeData && (
          <RouteLayer
            coordinates={routeData.coordinates}
            travelTime={routeData.travelTime}
            travelMode="walk"
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

        {/* Clustered POI source */}
        <Source
          id="explorer-pois"
          type="geojson"
          data={geojsonData}
          cluster={true}
          clusterMaxZoom={15}
          clusterRadius={50}
        >
          {/* Cluster circles */}
          <Layer
            id="explorer-clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#94a3b8",
                10,
                "#64748b",
                30,
                "#475569",
              ],
              "circle-radius": [
                "step",
                ["get", "point_count"],
                18,
                10,
                24,
                30,
                30,
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            }}
          />

          {/* Cluster count labels */}
          <Layer
            id="explorer-cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
              "text-size": 13,
              "text-allow-overlap": true,
            }}
            paint={{
              "text-color": "#ffffff",
            }}
          />

          {/* Individual unclustered POI circles */}
          <Layer
            id="explorer-unclustered"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": ["get", "categoryColor"],
              "circle-radius": [
                "case",
                ["==", ["get", "hasEditorial"], 1],
                8,
                6,
              ],
              "circle-stroke-width": [
                "case",
                ["==", ["get", "hasEditorial"], 1],
                2.5,
                1.5,
              ],
              "circle-stroke-color": "#ffffff",
            }}
          />

          {/* Editorial badge ring */}
          <Layer
            id="explorer-editorial-ring"
            type="circle"
            filter={[
              "all",
              ["!", ["has", "point_count"]],
              ["==", ["get", "hasEditorial"], 1],
            ]}
            paint={{
              "circle-color": "transparent",
              "circle-radius": 12,
              "circle-stroke-width": 1.5,
              "circle-stroke-color": ["get", "categoryColor"],
              "circle-opacity": 0.6,
              "circle-stroke-opacity": 0.4,
            }}
          />
        </Source>

        {/* Active POI highlight */}
        {activePOI && (() => {
          const poi = pois.find((p) => p.id === activePOI);
          if (!poi) return null;
          return (
            <Marker
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              anchor="center"
            >
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full animate-ping opacity-50"
                  style={{
                    backgroundColor: poi.category.color,
                    width: 28,
                    height: 28,
                    marginLeft: -4,
                    marginTop: -4,
                  }}
                />
                <div
                  className="w-5 h-5 rounded-full border-[3px] border-white shadow-lg"
                  style={{ backgroundColor: poi.category.color }}
                />
              </div>
            </Marker>
          );
        })()}
      </Map>
    </div>
  );
}
