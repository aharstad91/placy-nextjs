"use client";

import { useEffect, useRef } from "react";
import type { TravelMode } from "@/lib/types";

// Route colors by travel mode
const ROUTE_COLORS: Record<TravelMode, string> = {
  walk: "#3B82F6",  // blue-500
  bike: "#22C55E",  // green-500
  car: "#8B5CF6"    // violet-500
};

interface RouteLayer3DProps {
  /** Route coordinates as [lng, lat] pairs (Mapbox format) */
  coordinates: [number, number][];
  travelMode?: TravelMode;
  /** Custom color override */
  color?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  map3d: google.maps.maps3d.Map3DElement | null;
}

/**
 * 3D route polyline using Google Maps Polyline3DElement
 * Renders route that follows terrain (bridges, tunnels, etc.)
 */
export function RouteLayer3D({
  coordinates,
  travelMode = "walk",
  color,
  strokeWidth = 6,
  map3d
}: RouteLayer3DProps) {
  const polylineRef = useRef<google.maps.maps3d.Polyline3DElement | null>(null);

  useEffect(() => {
    if (!map3d || coordinates.length === 0) return;

    const initPolyline = async () => {
      try {
        const { Polyline3DElement, AltitudeMode } = await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;

        // Clean up existing polyline
        if (polylineRef.current) {
          polylineRef.current.remove();
        }

        // Convert coordinates from [lng, lat] to {lat, lng, altitude}
        const pathCoords = coordinates.map(([lng, lat]) => ({
          lat,
          lng,
          altitude: 2 // Slight elevation to avoid z-fighting with ground
        }));

        // Create polyline
        const polyline = new Polyline3DElement({
          altitudeMode: AltitudeMode.RELATIVE_TO_MESH, // Follows terrain (bridges, etc.)
          strokeColor: color || ROUTE_COLORS[travelMode],
          strokeWidth,
          drawsOccludedSegments: true // Show segments hidden by buildings
        });

        // Set path (coordinates deprecated)
        (polyline as unknown as { path: typeof pathCoords }).path = pathCoords;

        polylineRef.current = polyline;
        map3d.append(polyline);

      } catch (err) {
        console.error("Failed to create 3D route:", err);
      }
    };

    initPolyline();

    return () => {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
    };
  }, [map3d, coordinates, travelMode, color, strokeWidth]);

  // Update polyline when coordinates change
  useEffect(() => {
    if (!polylineRef.current || coordinates.length === 0) return;

    const pathCoords = coordinates.map(([lng, lat]) => ({
      lat,
      lng,
      altitude: 2
    }));

    (polylineRef.current as unknown as { path: typeof pathCoords }).path = pathCoords;
  }, [coordinates]);

  // Update style when travel mode changes
  useEffect(() => {
    if (!polylineRef.current) return;

    polylineRef.current.strokeColor = color || ROUTE_COLORS[travelMode];
  }, [travelMode, color]);

  return null;
}

interface UserLocationMarker3DProps {
  position: { lat: number; lng: number };
  accuracy?: number;
  map3d: google.maps.maps3d.Map3DElement | null;
}

/**
 * User GPS location marker with pulsing effect
 */
export function UserLocationMarker3D({ position, accuracy, map3d }: UserLocationMarker3DProps) {
  const markerRef = useRef<google.maps.maps3d.Marker3DElement | null>(null);

  useEffect(() => {
    if (!map3d) return;

    const initMarker = async () => {
      try {
        const { Marker3DElement, AltitudeMode } = await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;
        const { PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

        // Clean up existing marker
        if (markerRef.current) {
          markerRef.current.remove();
        }

        // Create blue dot pin
        const pin = new PinElement({
          background: "#2563EB", // blue-600
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
          scale: 0.8
        });

        // Hide default glyph for just a colored dot
        const glyph = pin.querySelector('[slot="glyph"]');
        if (glyph) {
          (glyph as HTMLElement).style.display = "none";
        }

        const marker = new Marker3DElement({
          position: {
            lat: position.lat,
            lng: position.lng,
            altitude: 10
          },
          altitudeMode: AltitudeMode.RELATIVE_TO_GROUND
        });

        marker.append(pin);
        markerRef.current = marker;
        map3d.append(marker);

      } catch (err) {
        console.error("Failed to create user location marker:", err);
      }
    };

    initMarker();

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map3d]);

  // Update position when it changes
  useEffect(() => {
    if (!markerRef.current) return;

    markerRef.current.position = {
      lat: position.lat,
      lng: position.lng,
      altitude: 10
    };
  }, [position.lat, position.lng]);

  return null;
}

interface ProjectCenterMarker3DProps {
  position: { lat: number; lng: number };
  label?: string;
  map3d: google.maps.maps3d.Map3DElement | null;
}

/**
 * Project center marker with sky blue pin and label
 * Shown when GPS is disabled/loading/fallback
 */
export function ProjectCenterMarker3D({ position, label = "Sentrum", map3d }: ProjectCenterMarker3DProps) {
  const markerRef = useRef<google.maps.maps3d.Marker3DElement | null>(null);

  useEffect(() => {
    if (!map3d) return;

    const initMarker = async () => {
      try {
        const { Marker3DElement, AltitudeMode } = await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;
        const { PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

        // Clean up existing marker
        if (markerRef.current) {
          markerRef.current.remove();
        }

        // Create sky blue pin (matching ExplorerMap's project center marker)
        const pin = new PinElement({
          background: "#0EA5E9", // sky-500
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
          scale: 1.2
        });

        const marker = new Marker3DElement({
          position: {
            lat: position.lat,
            lng: position.lng,
            altitude: 15
          },
          altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
          label: label
        });

        marker.append(pin);
        markerRef.current = marker;
        map3d.append(marker);

      } catch (err) {
        console.error("Failed to create project center marker:", err);
      }
    };

    initMarker();

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map3d, position.lat, position.lng, label]);

  return null;
}
