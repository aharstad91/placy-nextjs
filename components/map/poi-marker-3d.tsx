"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { POI } from "@/lib/types";
import { cn } from "@/lib/utils";

// Icon mapping for categories
import {
  UtensilsCrossed,
  Coffee,
  Landmark,
  Building2,
  Mountain,
  TreePine,
  MapPin,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  UtensilsCrossed,
  Coffee,
  Landmark,
  Building2,
  Mountain,
  TreePine,
};

interface POIMarker3DProps {
  poi: POI;
  isActive: boolean;
  onClick?: (poiId: string) => void;
  map3d: google.maps.maps3d.Map3DElement | null;
  onMarkerRef?: (marker: google.maps.maps3d.Marker3DInteractiveElement) => void;
}

/**
 * 3D POI marker using Google Maps Marker3DInteractiveElement
 * Uses custom HTML with circular design for visual consistency
 */
export function POIMarker3D({ poi, isActive, onClick, map3d, onMarkerRef }: POIMarker3DProps) {
  const markerRef = useRef<google.maps.maps3d.Marker3DInteractiveElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map3d) return;

    const initMarker = async () => {
      try {
        // Load required libraries
        const { Marker3DInteractiveElement, AltitudeMode } = await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;

        // Clean up existing marker
        if (markerRef.current) {
          markerRef.current.remove();
        }

        // Create container div for React portal
        const container = document.createElement('div');
        containerRef.current = container;

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

        // Append container to marker
        marker.append(container);

        // Add click handler
        marker.addEventListener("gmp-click", () => {
          onClick?.(poi.id);
        });

        markerRef.current = marker;
        map3d.append(marker);

        // Call callback to expose marker ref (for action buttons)
        if (isActive && onMarkerRef) {
          onMarkerRef(marker);
        }

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
  }, [map3d, poi.id, poi.coordinates.lat, poi.coordinates.lng, isActive, onClick, onMarkerRef]);

  // Update altitude and marker ref when active state changes
  useEffect(() => {
    if (!markerRef.current) return;

    // Update altitude for active state
    markerRef.current.position = {
      lat: poi.coordinates.lat,
      lng: poi.coordinates.lng,
      altitude: isActive ? 20 : 0
    };

    // Call callback to expose marker ref when becoming active
    if (isActive && onMarkerRef) {
      onMarkerRef(markerRef.current);
    }
  }, [isActive, poi.coordinates.lat, poi.coordinates.lng, onMarkerRef]);

  // Render circular marker via portal
  if (!containerRef.current) return null;

  const Icon = CATEGORY_ICONS[poi.category.icon] || MapPin;

  return createPortal(
    <div
      className={cn(
        "flex items-center justify-center rounded-full transition-all duration-200",
        "border-2 border-white shadow-lg cursor-pointer",
        isActive ? "w-10 h-10 scale-125" : "w-8 h-8 hover:scale-110"
      )}
      style={{
        backgroundColor: poi.category.color,
      }}
    >
      <Icon className={cn("text-white", isActive ? "w-5 h-5" : "w-4 h-4")} />

      {/* Pulse effect when active */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ backgroundColor: poi.category.color }}
        />
      )}
    </div>,
    containerRef.current
  );
}

interface POIMarkers3DProps {
  pois: POI[];
  activePOI: string | null;
  onPOIClick?: (poiId: string) => void;
  map3d: google.maps.maps3d.Map3DElement | null;
  onActiveMarkerRef?: (marker: google.maps.maps3d.Marker3DInteractiveElement) => void;
}

/**
 * Container component for multiple 3D POI markers
 */
export function POIMarkers3D({ pois, activePOI, onPOIClick, map3d, onActiveMarkerRef }: POIMarkers3DProps) {
  return (
    <>
      {pois.map((poi) => (
        <POIMarker3D
          key={poi.id}
          poi={poi}
          isActive={activePOI === poi.id}
          onClick={onPOIClick}
          map3d={map3d}
          onMarkerRef={activePOI === poi.id ? onActiveMarkerRef : undefined}
        />
      ))}
    </>
  );
}
