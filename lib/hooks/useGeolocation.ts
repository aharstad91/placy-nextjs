"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils";

export type GeolocationMode = "loading" | "gps-near" | "gps-far" | "fallback" | "disabled";

export interface GeolocationState {
  userPosition: Coordinates | null;
  accuracy: number | null;
  mode: GeolocationMode;
  effectiveOrigin: Coordinates;
  isNearProject: boolean;
  distanceToProject: number | null;
  error: GeolocationPositionError | null;
  /** Call to enable geolocation on-demand (triggers permission prompt) */
  enable: () => void;
  /** Whether geolocation is currently enabled */
  isEnabled: boolean;
}

export interface UseGeolocationOptions {
  /** Whether to automatically start watching position. Default: true */
  enabled?: boolean;
}

// Hysteresis thresholds to prevent flickering at the boundary
const NEAR_THRESHOLD = 1800; // Switch to gps-near at <1.8km
const FAR_THRESHOLD = 2200; // Switch back to gps-far at >2.2km
const SIGNAL_LOST_TIMEOUT = 120_000; // 120s before falling back

export function useGeolocation(
  projectCenter: Coordinates,
  options: UseGeolocationOptions = {}
): GeolocationState {
  const { enabled: initialEnabled = true } = options;
  const [userPosition, setUserPosition] = useState<Coordinates | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [mode, setMode] = useState<GeolocationMode>(initialEnabled ? "loading" : "disabled");
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [isEnabled, setIsEnabled] = useState(initialEnabled);

  const lastUpdateRef = useRef<number>(0);
  const signalLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  // Track whether we've been in near mode to apply hysteresis correctly
  const wasNearRef = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Enable geolocation on-demand
  const enable = useCallback(() => {
    if (!isEnabled) {
      setIsEnabled(true);
      setMode("loading");
    }
  }, [isEnabled]);

  const clearSignalLostTimer = useCallback(() => {
    if (signalLostTimerRef.current) {
      clearTimeout(signalLostTimerRef.current);
      signalLostTimerRef.current = null;
    }
  }, []);

  const startSignalLostTimer = useCallback(() => {
    clearSignalLostTimer();
    signalLostTimerRef.current = setTimeout(() => {
      setMode("fallback");
    }, SIGNAL_LOST_TIMEOUT);
  }, [clearSignalLostTimer]);

  useEffect(() => {
    // Don't start watching if not enabled
    if (!isEnabled) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setMode("fallback");
      return;
    }

    const onSuccess = (position: GeolocationPosition) => {
      clearSignalLostTimer();
      lastUpdateRef.current = Date.now();

      const coords: Coordinates = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setUserPosition(coords);
      setAccuracy(position.coords.accuracy);
      setError(null);

      const distance = haversineDistance(coords, projectCenter);

      setMode((prevMode) => {
        // Apply hysteresis
        if (prevMode === "gps-near" || wasNearRef.current) {
          // Currently near — only switch to far if beyond far threshold
          if (distance > FAR_THRESHOLD) {
            wasNearRef.current = false;
            return "gps-far";
          }
          wasNearRef.current = true;
          return "gps-near";
        }
        // Currently far or loading — only switch to near if below near threshold
        if (distance < NEAR_THRESHOLD) {
          wasNearRef.current = true;
          return "gps-near";
        }
        return "gps-far";
      });
    };

    const onError = (err: GeolocationPositionError) => {
      setError(err);

      if (err.code === err.PERMISSION_DENIED) {
        setMode("fallback");
        return;
      }

      // POSITION_UNAVAILABLE or TIMEOUT — start signal lost timer
      // Keep last known position for now
      if (modeRef.current !== "fallback") {
        startSignalLostTimer();
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 5_000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      clearSignalLostTimer();
    };
  }, [projectCenter, clearSignalLostTimer, startSignalLostTimer, isEnabled]);

  const distanceToProject =
    userPosition ? haversineDistance(userPosition, projectCenter) : null;

  const isNearProject = mode === "gps-near";

  const effectiveOrigin =
    mode === "gps-near" && userPosition ? userPosition : projectCenter;

  return {
    userPosition,
    accuracy,
    mode,
    effectiveOrigin,
    isNearProject,
    distanceToProject,
    error,
    enable,
    isEnabled,
  };
}
