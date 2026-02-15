// @ts-nocheck — 3D hook preserved for future use
"use client";

import { useRef, useCallback, useMemo } from "react";
import type { Coordinates } from "@/lib/types";

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface FlyToOptions {
  range?: number;   // Distance from camera to target in meters
  tilt?: number;    // Camera tilt in degrees (0 = top-down, 90 = horizontal)
  heading?: number; // Camera heading in degrees (0 = north)
  duration?: number; // Animation duration in ms (set to 0 for instant)
}

interface FitBoundsOptions {
  padding?: number;
  duration?: number;
  maxRange?: number;
}

export function useMap3DCamera() {
  const mapRef = useRef<google.maps.maps3d.Map3DElement | null>(null);

  // Check reduced motion preference (memoized to avoid re-checking)
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  /**
   * Fly camera to a specific location with smooth animation
   * Respects prefers-reduced-motion preference
   */
  const flyTo = useCallback((
    target: Coordinates,
    options: FlyToOptions = {}
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const {
      range = 800,
      tilt = 55,
      heading = 0,
      duration = 2000
    } = options;

    // Use instant camera change if user prefers reduced motion
    const actualDuration = reducedMotion ? 0 : duration;

    map.flyCameraTo({
      endCamera: {
        center: { lat: target.lat, lng: target.lng, altitude: 0 },
        range,
        tilt,
        heading
      },
      durationMillis: actualDuration
    });
  }, [reducedMotion]);

  /**
   * Fly camera around a point (360° orbit)
   * Skipped entirely if user prefers reduced motion
   */
  const flyAround = useCallback((
    target: Coordinates,
    options: { rounds?: number; duration?: number; range?: number; tilt?: number } = {}
  ) => {
    const map = mapRef.current;
    if (!map) return;

    // Skip orbit animation entirely if user prefers reduced motion
    if (reducedMotion) {
      return;
    }

    const {
      rounds = 1,
      duration = 8000,
      range = 800,
      tilt = 55
    } = options;

    map.flyCameraAround({
      camera: {
        center: { lat: target.lat, lng: target.lng, altitude: 0 },
        range,
        tilt
      },
      durationMillis: duration,
      repeatCount: rounds // 'rounds' deprecated, use 'repeatCount'
    });
  }, [reducedMotion]);

  /**
   * Fit camera to show all provided bounds
   * Respects prefers-reduced-motion preference
   */
  const fitBounds = useCallback((
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    options: FitBoundsOptions = {}
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const { duration = 1500, maxRange = 3000, padding = 0.2 } = options;

    // Calculate center of bounds
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLng = (bounds.minLng + bounds.maxLng) / 2;

    // Calculate distance to determine camera range
    // Rough estimation: 1 degree lat ≈ 111km
    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;
    const maxSpan = Math.max(latSpan, lngSpan);

    // Add padding and convert to approximate meters
    const spanWithPadding = maxSpan * (1 + padding);
    const rangeEstimate = spanWithPadding * 111000 / 2; // Half the span as range
    const range = Math.min(Math.max(rangeEstimate, 500), maxRange);

    // Use instant camera change if user prefers reduced motion
    const actualDuration = reducedMotion ? 0 : duration;

    map.flyCameraTo({
      endCamera: {
        center: { lat: centerLat, lng: centerLng, altitude: 0 },
        range,
        tilt: 45, // Moderate tilt for overview
        heading: 0
      },
      durationMillis: actualDuration
    });
  }, [reducedMotion]);

  /**
   * Calculate bounds from an array of coordinates
   */
  const calculateBounds = useCallback((coordinates: Coordinates[]) => {
    if (coordinates.length === 0) {
      return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const coord of coordinates) {
      if (coord.lat < minLat) minLat = coord.lat;
      if (coord.lat > maxLat) maxLat = coord.lat;
      if (coord.lng < minLng) minLng = coord.lng;
      if (coord.lng > maxLng) maxLng = coord.lng;
    }

    return { minLat, maxLat, minLng, maxLng };
  }, []);

  /**
   * Get current camera position
   */
  const getCamera = useCallback(() => {
    const map = mapRef.current;
    if (!map) return null;

    return {
      center: map.center,
      range: map.range,
      tilt: map.tilt,
      heading: map.heading
    };
  }, []);

  /**
   * Set camera position without animation
   */
  const setCamera = useCallback((options: {
    center?: { lat: number; lng: number; altitude?: number };
    range?: number;
    tilt?: number;
    heading?: number;
  }) => {
    const map = mapRef.current;
    if (!map) return;

    if (options.center) {
      map.center = { ...options.center, altitude: options.center.altitude ?? 0 };
    }
    if (options.range !== undefined) {
      map.range = options.range;
    }
    if (options.tilt !== undefined) {
      map.tilt = options.tilt;
    }
    if (options.heading !== undefined) {
      map.heading = options.heading;
    }
  }, []);

  return {
    mapRef,
    flyTo,
    flyAround,
    fitBounds,
    calculateBounds,
    getCamera,
    setCamera
  };
}
