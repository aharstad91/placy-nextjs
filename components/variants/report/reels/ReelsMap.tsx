"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { type MapRef } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import { MAP_STYLE_STANDARD } from "@/lib/themes/map-styles";
import { useReels } from "./reels-state";
import type { CategoryReelCard } from "./reels-data";
import type { BoardHome } from "../board/board-data";
import { BoardMarker } from "../board/BoardMarker";
import { HomeMarker } from "../board/HomeMarker";
import { useBoardZoomTier } from "../board/use-board-zoom-tier";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface Props {
  home: BoardHome;
  /** Når true: kartet er en permanent panel (desktop 2-kolonner). Gestures
   *  alltid på, markører alltid synlige for aktiv kategori, ingen
   *  sheet-relaterte fitBounds-triggers fra phase. */
  desktopMode?: boolean;
}

export function ReelsMap({ home, desktopMode = false }: Props) {
  const { state } = useReels();
  const mapRef = useRef<MapRef | null>(null);
  const cancelTokenRef = useRef(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const zoomTier = useBoardZoomTier(mapRef, mapLoaded);

  const activeCard = state.cards[state.activeIndex];
  const activeCategoryCard: CategoryReelCard | null =
    activeCard?.kind === "category" ? activeCard : null;
  const activeCategoryId = activeCategoryCard?.categoryId ?? null;
  // Mobil-sheet: kart synlig fra reel-peek til map-full. Markører vises fra
  // map-quarter (når VO er ferdig og sheet "våkner"). Gestures kun i map-full.
  // Desktop: alltid alt på — kartet er en permanent panel uten sheet-mekanikk.
  const mapVisible = desktopMode || state.currentPhase !== "intro";
  const markersVisible =
    desktopMode ||
    state.currentPhase === "map-quarter" ||
    state.currentPhase === "map-half" ||
    state.currentPhase === "map-full";
  const gesturesEnabled = desktopMode || state.currentPhase === "map-full";

  // Samle alle category-POIer fra alle kort så markører kan persistere
  // på kartet med fade-in/out i stedet for remount.
  const allMarkers = state.cards.flatMap((card) =>
    card.kind === "category"
      ? card.pois.map((poi) => ({
          poi,
          color: card.color,
          icon: card.icon,
          categoryId: card.categoryId,
        }))
      : [],
  );

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  // ResizeObserver — når CSS-transition endrer container-høyde (15% → 50% → 100%),
  // må Mapbox-canvas re-kalibreres. Uten dette ser man halvrendret canvas-blocks.
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    const container = map?.getContainer();
    if (!container) return;
    const ro = new ResizeObserver(() => {
      map?.resize();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [mapLoaded]);

  // fitBounds når aktiv kategori-kort entrer map-half eller -full (eller
  // bytter mellom dem — annen container-størrelse krever ny resize+fit)
  useEffect(() => {
    if (!markersVisible || !activeCategoryCard || !mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    // Vent en frame så container-resize har skjedd
    const raf = requestAnimationFrame(() => {
      map.resize();

      const pois = activeCategoryCard.pois;
      if (pois.length === 0) return;

      cancelTokenRef.current += 1;
      const myToken = cancelTokenRef.current;

      const bbox = new mapboxgl.LngLatBounds();
      for (const poi of pois) {
        bbox.extend([poi.coordinates.lng, poi.coordinates.lat]);
      }
      bbox.extend([home.coordinates.lng, home.coordinates.lat]);

      map.stop();
      if (cancelTokenRef.current !== myToken) return;

      map.fitBounds(bbox, {
        padding: { top: 60, bottom: 80, left: 40, right: 40 },
        duration: 800,
        maxZoom: 15.5,
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [
    markersVisible,
    activeCategoryCard,
    mapLoaded,
    state.currentPhase,
    home.coordinates.lat,
    home.coordinates.lng,
  ]);

  // I reel-peek (15%): når kartet bare er en bunn-stripe, sentrer på hjem
  // med høy padding så hjem-markøren ligger sentralt i det synlige vinduet.
  // Desktop: kartet er permanent panel, sentrer ikke per phase — fitBounds-
  // effekten over håndterer aktiv kategori.
  useEffect(() => {
    if (desktopMode) return;
    if (state.currentPhase !== "reel" || !mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const raf = requestAnimationFrame(() => {
      map.resize();
      map.easeTo({
        center: [home.coordinates.lng, home.coordinates.lat],
        zoom: 13.5,
        duration: 600,
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [desktopMode, state.currentPhase, mapLoaded, home.coordinates.lng, home.coordinates.lat]);

  // Gestures kontrolleres via react-map-gl-props i Map-elementet under.
  // Imperative `map.dragPan.enable()`-kall fungerer ikke når react-map-gl
  // re-syncher props ved render — props vinner.

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-stone-900 text-white/60 text-sm">
        Mangler NEXT_PUBLIC_MAPBOX_TOKEN
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={TOKEN}
      initialViewState={{
        longitude: home.coordinates.lng,
        latitude: home.coordinates.lat,
        zoom: 13,
      }}
      mapStyle={MAP_STYLE_STANDARD}
      style={{ width: "100%", height: "100%" }}
      onLoad={handleMapLoad}
      dragPan={gesturesEnabled}
      scrollZoom={gesturesEnabled}
      doubleClickZoom={gesturesEnabled}
      touchZoomRotate={gesturesEnabled}
      touchPitch={gesturesEnabled}
      dragRotate={gesturesEnabled}
    >
      <HomeMarker
        coordinates={home.coordinates}
        name={home.name}
        onClick={() => {}}
      />

      {allMarkers.map(({ poi, color, icon, categoryId }) => {
        const isVisible = markersVisible && categoryId === activeCategoryId;
        return (
          <BoardMarker
            key={poi.id}
            poi={poi}
            color={color}
            icon={icon}
            isActive={false}
            isVisible={isVisible}
            zoomTier={zoomTier}
            suppressLabel={false}
            onClick={() => {}}
          />
        );
      })}
    </Map>
  );
}
