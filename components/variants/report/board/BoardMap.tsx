"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { type MapRef } from "react-map-gl/mapbox";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";
import { useBoard, useActiveCategory, useActivePOI } from "./board-state";
import { BoardMarker } from "./BoardMarker";
import { HomeMarker } from "./HomeMarker";
import { BoardPathLayer } from "./BoardPathLayer";
import { BoardPOILabel } from "./BoardPOILabel";
import { BoardTravelChip } from "./BoardTravelChip";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function BoardMap() {
  const { state, data, dispatch } = useBoard();
  const activeCategory = useActiveCategory();
  const activePOI = useActivePOI();
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Markører som vises avhenger av phase:
  // - default: alle kategorier, alle POI-er (oversiktsmodus)
  // - active|reading|poi: kun aktiv kategoris POI-er
  const visiblePOIs = useMemo(() => {
    if (state.phase === "default") {
      return data.categories.flatMap((c) =>
        c.pois.map((p) => ({ poi: p, color: c.color, icon: c.icon })),
      );
    }
    if (!activeCategory) return [];
    return activeCategory.pois.map((p) => ({
      poi: p,
      color: activeCategory.color,
      icon: activeCategory.icon,
    }));
  }, [state.phase, data.categories, activeCategory]);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (!mapRef.current) return;
    applyIllustratedTheme(mapRef.current.getMap());
  }, []);

  // FitBounds når kategori endres eller phase går default→active.
  // Phase=poi håndteres i egen effekt nedenfor (fly-to-POI).
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    if (state.phase === "default") {
      // Bredt overview: senter på prosjektet med default-zoom
      map.flyTo({
        center: [data.home.coordinates.lng, data.home.coordinates.lat],
        zoom: 13.5,
        duration: 800,
      });
      return;
    }

    // I phase=poi flytter vi til POI'en — ikke fitBounds av kategorien
    if (state.phase === "poi") return;

    if (!activeCategory || activeCategory.pois.length === 0) return;

    // Beregn bounds av home + aktiv kategoris POI-er
    const lats = [data.home.coordinates.lat, ...activeCategory.pois.map((p) => p.coordinates.lat)];
    const lngs = [data.home.coordinates.lng, ...activeCategory.pois.map((p) => p.coordinates.lng)];
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    map.fitBounds(bounds, { padding: { top: 100, bottom: 280, left: 60, right: 60 }, maxZoom: 15.5, duration: 800 });
  }, [mapLoaded, state.phase, activeCategory, data.home.coordinates]);

  // Fly-to-POI når phase=poi eller aktiv POI endres
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (state.phase !== "poi" || !activePOI) return;

    mapRef.current.flyTo({
      center: [activePOI.coordinates.lng, activePOI.coordinates.lat],
      zoom: 15.5,
      duration: 800,
    });
  }, [mapLoaded, state.phase, activePOI]);

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground p-8 text-center text-sm">
        Mapbox-token mangler — sett NEXT_PUBLIC_MAPBOX_TOKEN i .env.local.
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {!mapLoaded && <div className="absolute inset-0 z-20 bg-[#f0ece6] animate-pulse" />}
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        initialViewState={{
          longitude: data.home.coordinates.lng,
          latitude: data.home.coordinates.lat,
          zoom: 13.5,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE_STANDARD}
        onLoad={handleMapLoad}
      >
        <HomeMarker
          coordinates={data.home.coordinates}
          name={data.home.name}
          onClick={() => dispatch({ type: "RESET_TO_DEFAULT" })}
        />

        {visiblePOIs.map(({ poi, color, icon }) => (
          <BoardMarker
            key={poi.id}
            poi={poi}
            color={color}
            icon={icon}
            isActive={state.activePOIId === poi.id}
            isDimmed={state.phase === "default"}
            onClick={() =>
              dispatch({
                type: "OPEN_POI",
                id: poi.id,
                categoryId: poi.categoryId,
              })
            }
          />
        ))}

        {/* Path Home → aktiv POI (kun phase=poi) */}
        <BoardPathLayer />

        {/* Tekst-label over aktiv POI-markør */}
        <BoardPOILabel />
      </Map>

      {/* HTML-overlay (utenfor Map): travel-chip plassert over POI-sheet */}
      <BoardTravelChip />
    </div>
  );
}
