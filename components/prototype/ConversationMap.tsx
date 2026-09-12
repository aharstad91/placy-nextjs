"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import type { BoardPOI } from "@/components/variants/report/board/board-data";
import { applyIllustratedTheme, MAP_STYLE_STANDARD } from "@/lib/themes/map-styles";
import styles from "@/components/prototype/conversation.module.css";
import "mapbox-gl/dist/mapbox-gl.css";

export default function ConversationMap({ places, selectedId, center, revision, onSelect }: { places: BoardPOI[]; selectedId: string | null; center: { lat: number; lng: number }; revision: number; onSelect: (id: string) => void }) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const frame = useCallback(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const selected = places.find((poi) => String(poi.id) === selectedId);
    if (selected) { map.flyTo({ center: [selected.coordinates.lng, selected.coordinates.lat], zoom: 16.1, duration: 1300, essential: false }); return; }
    if (places.length === 0) { map.flyTo({ center: [center.lng, center.lat], zoom: 14, duration: 900 }); return; }
    const lngs = places.map((poi) => poi.coordinates.lng), lats = places.map((poi) => poi.coordinates.lat);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: 95, bottom: 80, left: 65, right: 65 }, maxZoom: 15.2, duration: 1100 });
  }, [places, selectedId, center, loaded]);
  useEffect(() => { frame(); }, [frame, revision]);
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return <div className={styles.mapLoading}>Kartet mangler Mapbox-oppsett. Du kan fortsatt utforske stedskortene.</div>;
  return <><Map ref={mapRef} mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 14.2 }} mapStyle={MAP_STYLE_STANDARD} style={{ width: "100%", height: "100%" }} maxZoom={18} onLoad={() => { if (mapRef.current) applyIllustratedTheme(mapRef.current.getMap()); setLoaded(true); }} onError={() => setMapError(true)} attributionControl={true}>
    {loaded && <NavigationControl position="top-right" showCompass={false} />}
    {loaded && places.map((poi, index) => <Marker key={String(poi.id)} longitude={poi.coordinates.lng} latitude={poi.coordinates.lat} anchor="bottom"><button className={`${styles.marker} ${String(poi.id) === selectedId ? styles.markerSelected : ""}`} style={{ "--pin-color": poi.color } as React.CSSProperties} onClick={(event) => { event.stopPropagation(); onSelect(String(poi.id)); }} aria-label={`Vis ${poi.name}`}><span><MapPin size={15} fill="currentColor" strokeWidth={1.5} /></span>{(places.length < 12 || String(poi.id) === selectedId || index < 3) && <b>{poi.name}</b>}</button></Marker>)}
  </Map>{mapError && !loaded && <div className={styles.mapFailure}>Kartet kunne ikke lastes. Stedene er tilgjengelige i kortene under.</div>}</>;
}
