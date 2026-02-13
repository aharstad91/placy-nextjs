"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { PublicPOI } from "@/lib/public-queries";
import { getIcon } from "@/lib/utils/map-icons";
import { MarkerTooltip } from "@/components/map/marker-tooltip";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";
import MapPopupCard from "@/components/variants/report/MapPopupCard";

interface GuideStickyMapProps {
  pois: PublicPOI[];
  activePOIId: string | null;
  activePOISource?: "card" | "marker";
  onMarkerClick: (poiId: string) => void;
  onMapClick?: () => void;
  /** Fired when Mapbox map is fully loaded (tiles + style) */
  onLoad?: () => void;
}

export default function GuideStickyMap({
  pois,
  activePOIId,
  activePOISource,
  onMarkerClick,
  onMapClick,
  onLoad,
}: GuideStickyMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredPOI, setHoveredPOI] = useState<string | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Compute bounds using IQR to exclude outlier POIs (e.g. Tiller, Stjørdal)
  const computeRobustBounds = (items: PublicPOI[]) => {
    if (items.length === 0) return { minLng: 10.4, maxLng: 10.4, minLat: 63.43, maxLat: 63.43 };

    const lats = items.map((p) => p.coordinates.lat).sort((a, b) => a - b);
    const lngs = items.map((p) => p.coordinates.lng).sort((a, b) => a - b);

    const q1 = (arr: number[]) => arr[Math.floor(arr.length * 0.25)];
    const q3 = (arr: number[]) => arr[Math.floor(arr.length * 0.75)];

    const latIQR = q3(lats) - q1(lats);
    const lngIQR = q3(lngs) - q1(lngs);
    const latLo = q1(lats) - 1.5 * latIQR;
    const latHi = q3(lats) + 1.5 * latIQR;
    const lngLo = q1(lngs) - 1.5 * lngIQR;
    const lngHi = q3(lngs) + 1.5 * lngIQR;

    const inliers = items.filter(
      (p) =>
        p.coordinates.lat >= latLo &&
        p.coordinates.lat <= latHi &&
        p.coordinates.lng >= lngLo &&
        p.coordinates.lng <= lngHi
    );

    const src = inliers.length > 0 ? inliers : items;
    return src.reduce(
      (acc, poi) => ({
        minLng: Math.min(acc.minLng, poi.coordinates.lng),
        maxLng: Math.max(acc.maxLng, poi.coordinates.lng),
        minLat: Math.min(acc.minLat, poi.coordinates.lat),
        maxLat: Math.max(acc.maxLat, poi.coordinates.lat),
      }),
      { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }
    );
  };

  const bounds = computeRobustBounds(pois);
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    onLoad?.();
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    applyIllustratedTheme(map);

    // fitBounds to show all markers
    mapRef.current.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      { padding: 50, duration: 0, maxZoom: 16 }
    );
  }, [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat, onLoad]);

  // O(1) POI lookup for flyTo + popup
  const poiById = useMemo(() => {
    const lookup: Record<string, PublicPOI> = {};
    for (const poi of pois) lookup[poi.id] = poi;
    return lookup;
  }, [pois]);

  // Fly to active POI when selected from card
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !activePOIId) return;
    if (activePOISource !== "card") return;

    const poi = poiById[activePOIId];
    if (!poi) return;

    const map = mapRef.current;
    map.getMap().stop();
    map.flyTo({
      center: [poi.coordinates.lng, poi.coordinates.lat],
      duration: 400,
    });
  }, [activePOIId, activePOISource, mapLoaded, poiById]);

  const handleMarkerClick = useCallback(
    (e: { originalEvent: MouseEvent }, poiId: string) => {
      e.originalEvent.stopPropagation();
      onMarkerClick(poiId);
    },
    [onMarkerClick]
  );

  // Popup card data
  const popupPOI = activePOIId ? poiById[activePOIId] ?? null : null;

  const handlePopupClose = useCallback(() => {
    if (onMapClick) onMapClick();
  }, [onMapClick]);

  if (!token) return null;

  return (
    <div className="relative w-full h-full" aria-hidden="true">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{
          longitude: centerLng,
          latitude: centerLat,
          zoom: 13,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE_STANDARD}
        onLoad={handleMapLoad}
        onClick={onMapClick}
        scrollZoom={true}
      >
        {pois.map((poi) => {
          const isHighlighted = activePOIId === poi.id;
          const isHovered = hoveredPOI === poi.id && !isHighlighted;
          const Icon = getIcon(poi.category.icon);

          const tier = poi.poiTier ?? 2;
          const tierSize =
            tier === 1 ? "w-9 h-9" : tier === 3 ? "w-7 h-7" : "w-8 h-8";
          const tierBorder =
            tier === 1
              ? "border-2 border-white shadow-lg"
              : tier === 3
                ? "border-[1.5px] border-white/70 shadow-md"
                : "border-2 border-white shadow-md";
          const tierIconSize =
            tier === 1
              ? "w-[18px] h-[18px]"
              : tier === 3
                ? "w-3.5 h-3.5"
                : "w-4 h-4";
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
                {/* Pulsing ring for highlighted marker */}
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
                    style={{
                      backgroundColor: poi.category.color,
                      opacity: 0.2,
                    }}
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
                      isHighlighted
                        ? "w-5 h-5"
                        : isHovered
                          ? "w-4 h-4"
                          : tierIconSize
                    }`}
                  />
                </div>

                {/* Tooltip */}
                {(isHovered || isHighlighted) && (
                  <MarkerTooltip
                    name={poi.name}
                    categoryName={poi.category.name}
                    categoryId={poi.category.id}
                    googleRating={poi.googleRating}
                    googleReviewCount={poi.googleReviewCount}
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
            />
          </Marker>
        )}
      </Map>

      {/* Loading skeleton */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-[#f5f3f0] animate-pulse flex items-center justify-center">
          <span className="text-sm text-[#a0937d]">Laster kart...</span>
        </div>
      )}
    </div>
  );
}
