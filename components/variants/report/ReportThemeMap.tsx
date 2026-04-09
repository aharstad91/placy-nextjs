"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import type { Coordinates, POI } from "@/lib/types";
import type { ActivePOIState } from "./ReportPage";
import { getIcon } from "@/lib/utils/map-icons";
import { Building2 } from "lucide-react";
import { MarkerTooltip } from "@/components/map/marker-tooltip";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";
import MapPopupCard from "./MapPopupCard";

interface ReportThemeMapProps {
  pois: POI[];
  center: Coordinates;
  activePOI: ActivePOIState | null;
  onMarkerClick: (poiId: string) => void;
  onMapClick?: () => void;
  mapStyle?: string;
  areaSlug?: string | null;
}

export default function ReportThemeMap({
  pois,
  center,
  activePOI,
  onMarkerClick,
  onMapClick,
  mapStyle,
  areaSlug,
}: ReportThemeMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredPOI, setHoveredPOI] = useState<string | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // O(1) POI lookup for flyTo + popup
  const poiById = useMemo(() => {
    const lookup: Record<string, POI> = {};
    for (const poi of pois) lookup[poi.id] = poi;
    return lookup;
  }, [pois]);

  // fitBounds on map load — show all POIs + project center
  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    applyIllustratedTheme(map);

    if (pois.length > 0) {
      const allCoords = [...pois.map((p) => p.coordinates), center];
      const bounds = allCoords.reduce(
        (acc, coord) => ({
          minLng: Math.min(acc.minLng, coord.lng),
          maxLng: Math.max(acc.maxLng, coord.lng),
          minLat: Math.min(acc.minLat, coord.lat),
          maxLat: Math.max(acc.maxLat, coord.lat),
        }),
        { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }
      );
      mapRef.current.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        { padding: 60, duration: 0, maxZoom: 16 }
      );
    }
  }, [pois, center]);

  // FlyTo when activePOI changes (from inline-POI click)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !activePOI) return;
    if (activePOI.source !== "card") return;

    const poi = poiById[activePOI.poiId];
    if (!poi) return;

    const map = mapRef.current;
    map.getMap().stop();
    map.flyTo({
      center: [poi.coordinates.lng, poi.coordinates.lat],
      duration: 400,
    });
  }, [activePOI, mapLoaded, poiById]);

  // Handle marker click
  const handleMarkerClick = useCallback(
    (e: { originalEvent: MouseEvent }, poiId: string) => {
      e.originalEvent.stopPropagation();
      onMarkerClick(poiId);
    },
    [onMarkerClick]
  );

  // Popup POI
  const popupPOI = activePOI ? poiById[activePOI.poiId] ?? null : null;

  const handlePopupClose = useCallback(() => {
    if (activePOI) onMarkerClick(activePOI.poiId);
  }, [activePOI, onMarkerClick]);

  if (!token) return null;

  return (
    <div className="relative w-full h-full" aria-hidden="true">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 14,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle || MAP_STYLE_STANDARD}
        onLoad={handleMapLoad}
        onClick={onMapClick}
        cooperativeGestures={true}
      >
        {/* Project/hotel marker — always visible */}
        <Marker
          longitude={center.lng}
          latitude={center.lat}
          anchor="center"
          style={{ zIndex: 10 }}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#b45309] border-2 border-white shadow-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
        </Marker>

        {/* POI markers — tier-aware styling */}
        {pois.map((poi) => {
          const isHighlighted = activePOI?.poiId === poi.id;
          const isHovered = hoveredPOI === poi.id && !isHighlighted;
          const Icon = getIcon(poi.category.icon);
          const walkMinutes = poi.travelTime?.walk
            ? Math.round(poi.travelTime.walk / 60)
            : null;

          const tier = poi.poiTier ?? 2;
          const tierSize = tier === 1 ? "w-9 h-9" : tier === 3 ? "w-7 h-7" : "w-8 h-8";
          const tierBorder = tier === 1 ? "border-2 border-white shadow-lg" : tier === 3 ? "border-[1.5px] border-white/70 shadow-md" : "border-2 border-white shadow-md";
          const tierIconSize = tier === 1 ? "w-[18px] h-[18px]" : tier === 3 ? "w-3.5 h-3.5" : "w-4 h-4";
          const zIndex = isHighlighted ? 5 : isHovered ? 4 : tier === 1 ? 3 : 2;

          return (
            <Marker
              key={poi.id}
              longitude={poi.coordinates.lng}
              latitude={poi.coordinates.lat}
              anchor="center"
              onClick={(e) => handleMarkerClick(e, poi.id)}
              style={{ zIndex }}
            >
              <div className="relative">
                {/* Pulsing ring for highlighted */}
                {isHighlighted && (
                  <div
                    className="absolute inset-0 rounded-full animate-ping opacity-75"
                    style={{ backgroundColor: poi.category.color }}
                  />
                )}

                {/* Glow ring for Tier 1 */}
                {tier === 1 && !isHighlighted && !isHovered && (
                  <div
                    className="absolute -inset-1 rounded-full"
                    style={{ backgroundColor: poi.category.color, opacity: 0.2 }}
                  />
                )}

                {/* Icon circle */}
                <div
                  className={`relative flex items-center justify-center rounded-full cursor-pointer transition-transform ${
                    isHighlighted
                      ? "w-10 h-10 border-2 border-white shadow-lg scale-110"
                      : isHovered
                      ? "w-8 h-8 border-2 border-white shadow-md scale-110"
                      : `${tierSize} ${tierBorder} hover:scale-110`
                  }`}
                  style={{ backgroundColor: poi.category.color }}
                  onMouseEnter={() => setHoveredPOI(poi.id)}
                  onMouseLeave={() => setHoveredPOI(null)}
                >
                  <Icon
                    className={`text-white ${
                      isHighlighted ? "w-5 h-5" : isHovered ? "w-4 h-4" : tierIconSize
                    }`}
                  />
                </div>

                {/* Tooltip on hover/highlight */}
                {(isHovered || isHighlighted) && (
                  <MarkerTooltip
                    name={poi.name}
                    categoryName={poi.category.name}
                    categoryId={poi.category.id}
                    googleRating={poi.googleRating}
                    googleReviewCount={poi.googleReviewCount}
                    travelTimeMinutes={walkMinutes}
                    travelMode="walk"
                    poiTier={poi.poiTier}
                    isLocalGem={poi.isLocalGem}
                  />
                )}
              </div>
            </Marker>
          );
        })}

        {/* Popup card for active POI */}
        {popupPOI && (
          <Marker
            key={`popup-${popupPOI.id}`}
            longitude={popupPOI.coordinates.lng}
            latitude={popupPOI.coordinates.lat}
            anchor="bottom"
            style={{ zIndex: 20 }}
            offset={[0, -20]}
          >
            <MapPopupCard
              poi={popupPOI}
              onClose={handlePopupClose}
              areaSlug={areaSlug}
            />
          </Marker>
        )}
      </Map>
    </div>
  );
}
