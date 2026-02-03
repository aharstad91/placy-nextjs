"use client";

import { useEffect, useRef } from "react";
import type { POI } from "@/lib/types";

interface POIMarker3DProps {
  poi: POI;
  isActive: boolean;
  onClick?: (poiId: string) => void;
  map3d: google.maps.maps3d.Map3DElement | null;
}

/**
 * 3D POI marker using Google Maps Marker3DInteractiveElement
 * Uses PinElement for styling with category colors
 */
export function POIMarker3D({ poi, isActive, onClick, map3d }: POIMarker3DProps) {
  const markerRef = useRef<google.maps.maps3d.Marker3DInteractiveElement | null>(null);
  const pinRef = useRef<google.maps.marker.PinElement | null>(null);

  useEffect(() => {
    if (!map3d) return;

    const initMarker = async () => {
      try {
        // Load required libraries
        const { Marker3DInteractiveElement, AltitudeMode } = await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;
        const { PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

        // Clean up existing marker
        if (markerRef.current) {
          markerRef.current.remove();
        }

        // Create pin with category color
        const pin = new PinElement({
          background: poi.category.color,
          borderColor: isActive ? "#ffffff" : "#00000033",
          glyphColor: "#ffffff",
          scale: isActive ? 1.3 : 1.0
        });
        pinRef.current = pin;

        // Create 3D marker
        const marker = new Marker3DInteractiveElement({
          position: {
            lat: poi.coordinates.lat,
            lng: poi.coordinates.lng,
            altitude: isActive ? 20 : 0 // Lift active marker slightly
          },
          altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
          extruded: true
        });

        // Add pin as content
        marker.append(pin);

        // Add click handler
        marker.addEventListener("gmp-click", () => {
          onClick?.(poi.id);
        });

        markerRef.current = marker;
        map3d.append(marker);

      } catch (err) {
        console.error("Failed to create 3D marker:", err);
      }
    };

    initMarker();

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map3d, poi.id, poi.coordinates.lat, poi.coordinates.lng, poi.category.color, isActive, onClick]);

  // Update marker appearance when active state changes
  useEffect(() => {
    if (!pinRef.current || !markerRef.current) return;

    pinRef.current.scale = isActive ? 1.3 : 1.0;
    pinRef.current.borderColor = isActive ? "#ffffff" : "#00000033";

    // Update altitude for active state
    markerRef.current.position = {
      lat: poi.coordinates.lat,
      lng: poi.coordinates.lng,
      altitude: isActive ? 20 : 0
    };
  }, [isActive, poi.coordinates.lat, poi.coordinates.lng]);

  // This component renders nothing itself - the marker is added directly to the map
  return null;
}

interface POIMarkers3DProps {
  pois: POI[];
  activePOI: string | null;
  onPOIClick?: (poiId: string) => void;
  map3d: google.maps.maps3d.Map3DElement | null;
}

/**
 * Container component for multiple 3D POI markers
 */
export function POIMarkers3D({ pois, activePOI, onPOIClick, map3d }: POIMarkers3DProps) {
  return (
    <>
      {pois.map((poi) => (
        <POIMarker3D
          key={poi.id}
          poi={poi}
          isActive={activePOI === poi.id}
          onClick={onPOIClick}
          map3d={map3d}
        />
      ))}
    </>
  );
}
