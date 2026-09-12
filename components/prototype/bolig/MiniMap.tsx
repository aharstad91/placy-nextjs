"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import { Home, Maximize2 } from "lucide-react";
import { applyIllustratedTheme, MAP_STYLE_STANDARD } from "@/lib/themes/map-styles";
import type { House, Place } from "@/lib/prototype/bolig/contract";
import styles from "@/components/prototype/bolig/bolig.module.css";
import "mapbox-gl/dist/mapbox-gl.css";

/**
 * Liten, ikke-interaktiv kartforhåndsvisning under et sett stedskort.
 * Trykk (klikk/Enter/Space) åpner FullscreenMap for samme steder.
 */
export default function MiniMap({ house, places, onExpand }: { house: House; places: Place[]; onExpand: () => void }) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const lngs = [house.lng, ...places.map((p) => p.lng)];
    const lats = [house.lat, ...places.map((p) => p.lat)];
    const spread = Math.max(...lngs) - Math.min(...lngs) + (Math.max(...lats) - Math.min(...lats));
    if (spread < 0.0005) { map.flyTo({ center: [lngs[0], lats[0]], zoom: 15, duration: 0 }); return; }
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 32, maxZoom: 15.5, duration: 0 });
  }, [house, places, loaded]);

  useEffect(() => { fit(); }, [fit]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onExpand(); }
  }, [onExpand]);

  if (!token) return <div className={styles.mapLoading}>Kartet mangler Mapbox-oppsett. Stedene er tilgjengelige i kortene over.</div>;

  return (
    <div className={styles.miniMap} role="button" tabIndex={0} aria-label="Åpne stort kart" onClick={onExpand} onKeyDown={handleKeyDown}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{ longitude: house.lng, latitude: house.lat, zoom: 14 }}
        mapStyle={MAP_STYLE_STANDARD}
        style={{ width: "100%", height: "100%" }}
        interactive={false}
        attributionControl={false}
        onLoad={() => { if (mapRef.current) applyIllustratedTheme(mapRef.current.getMap()); setLoaded(true); }}
      >
        {loaded && (
          <Marker longitude={house.lng} latitude={house.lat} anchor="bottom">
            <span className={styles.houseMarker} aria-label="Bolig"><Home size={13} /></span>
          </Marker>
        )}
        {loaded && places.map((place) => (
          <Marker key={place.id} longitude={place.lng} latitude={place.lat} anchor="bottom">
            <span className={styles.miniMarker} aria-hidden="true" />
          </Marker>
        ))}
      </Map>
      <span className={styles.miniMapExpand}><Maximize2 size={12} /> Åpne kart</span>
    </div>
  );
}
