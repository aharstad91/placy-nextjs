"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import { Home, MapPin, X } from "lucide-react";
import { applyIllustratedTheme, MAP_STYLE_STANDARD } from "@/lib/themes/map-styles";
import type { BoligFixture } from "@/lib/prototype/bolig/contract";
import styles from "@/components/prototype/bolig/bolig.module.css";
import "mapbox-gl/dist/mapbox-gl.css";

/**
 * Fullskjerm, interaktivt kart over boligen og et sett steder. Ligger over
 * samtalefeeden (som forblir montert under), så lukking flytter aldri
 * feedens scrollposisjon. Låser body-scroll mens den er åpen.
 */
export default function FullscreenMap({ fixture, placeIds, selectedPlaceId, onSelect, onClose }: {
  fixture: BoligFixture;
  placeIds: string[];
  selectedPlaceId: string | null;
  onSelect: (placeId: string) => void;
  onClose: () => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const house = fixture.house;
  const places = useMemo(
    () => placeIds.map((id) => fixture.places.find((p) => p.id === id)).filter((p): p is BoligFixture["places"][number] => Boolean(p)),
    [fixture.places, placeIds],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const lngs = [house.lng, ...places.map((p) => p.lng)];
    const lats = [house.lat, ...places.map((p) => p.lat)];
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 16.5, duration: 0 });
  }, [loaded, house, places]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.fullscreenOverlay} role="dialog" aria-modal="true" aria-label="Kart over stedene">
      <button type="button" className={styles.fullscreenClose} onClick={onClose} aria-label="Lukk kart"><X size={18} /></button>
      {token ? (
        <Map
          ref={mapRef}
          mapboxAccessToken={token}
          initialViewState={{ longitude: house.lng, latitude: house.lat, zoom: 14.5 }}
          mapStyle={MAP_STYLE_STANDARD}
          style={{ width: "100%", height: "100%" }}
          attributionControl={true}
          onLoad={() => { if (mapRef.current) applyIllustratedTheme(mapRef.current.getMap()); setLoaded(true); }}
        >
          {loaded && <NavigationControl position="top-right" showCompass={false} />}
          {loaded && (
            <Marker longitude={house.lng} latitude={house.lat} anchor="bottom">
              <span className={styles.houseMarker} aria-label="Bolig"><Home size={15} /></span>
            </Marker>
          )}
          {loaded && places.map((place) => (
            <Marker key={place.id} longitude={place.lng} latitude={place.lat} anchor="bottom">
              <button
                type="button"
                className={`${styles.fullscreenMarker} ${place.id === selectedPlaceId ? styles.fullscreenMarkerSelected : ""}`}
                onClick={() => onSelect(place.id)}
                aria-label={`Vis ${place.name}`}
              >
                <MapPin size={15} fill="currentColor" strokeWidth={1.5} />
              </button>
            </Marker>
          ))}
        </Map>
      ) : (
        <div className={styles.mapMissing}>Kartet mangler Mapbox-oppsett.</div>
      )}
    </div>
  );
}
