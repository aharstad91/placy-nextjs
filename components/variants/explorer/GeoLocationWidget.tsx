"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Navigation, Loader2, MapPin, X } from "lucide-react";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";

type WidgetState = "collapsed" | "expanded" | "loading" | "active-near" | "active-far";

interface GeoLocationWidgetProps {
  geoMode: GeolocationMode;
  isEnabled: boolean;
  distanceToProject: number | null;
  accuracy: number | null;
  projectName: string;
  onEnable: () => void;
}

export default function GeoLocationWidget({
  geoMode,
  isEnabled,
  distanceToProject,
  accuracy,
  projectName,
  onEnable,
}: GeoLocationWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Derive widget state from geo state
  const widgetState: WidgetState = (() => {
    if (geoMode === "gps-near") return "active-near";
    if (geoMode === "gps-far") return "active-far";
    if (geoMode === "loading" && isEnabled) return "loading";
    if (isExpanded) return "expanded";
    return "collapsed";
  })();

  // Auto-collapse when GPS becomes active
  useEffect(() => {
    if (widgetState === "active-near" || widgetState === "active-far") {
      setIsExpanded(false);
    }
  }, [widgetState]);

  // Don't show widget if originMode is "geolocation" (auto-request) and GPS is working
  // or if originMode is "fixed" (handled by parent not passing the component)

  const handleCollapsedClick = () => {
    if (widgetState === "collapsed") {
      setIsExpanded(true);
    }
  };

  const handleEnable = () => {
    onEnable();
    // Will transition to loading state via geoMode change
  };

  const handleDismiss = () => {
    setIsExpanded(false);
  };

  // Format distance nicely
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // Format accuracy
  const formatAccuracy = (meters: number) => {
    if (meters < 10) return "Nøyaktig";
    if (meters < 50) return `±${Math.round(meters)}m`;
    return "Omtrentlig";
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 lg:left-auto lg:right-4 lg:max-w-72 pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto transition-all duration-300 ease-out",
          // Base styles for all states
          "bg-white rounded-2xl shadow-lg border border-gray-200",
          // Width transitions
          widgetState === "collapsed" && "w-fit",
          widgetState === "expanded" && "w-full",
          widgetState === "loading" && "w-fit",
          (widgetState === "active-near" || widgetState === "active-far") && "w-fit"
        )}
      >
        {/* Collapsed state - small pill */}
        {widgetState === "collapsed" && (
          <button
            onClick={handleCollapsedClick}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-colors"
          >
            <Navigation className="w-4 h-4 text-sky-500" />
            <span>Aktiver posisjon</span>
          </button>
        )}

        {/* Expanded state - full prompt */}
        {widgetState === "expanded" && (
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center flex-shrink-0">
              <Navigation className="w-5 h-5 text-sky-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Aktiver posisjon</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Se avstander fra der du er nå, og få ruter til steder du vil besøke.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleEnable}
                  className="text-sm font-medium text-white bg-sky-500 px-4 py-2 rounded-xl hover:bg-sky-600 transition-colors"
                >
                  Aktiver
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2 transition-colors"
                >
                  Senere
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {widgetState === "loading" && (
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
            <span className="text-sm text-gray-600">Henter posisjon...</span>
          </div>
        )}

        {/* Active near state */}
        {widgetState === "active-near" && (
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
            <span className="text-sm font-medium text-gray-700">Din posisjon</span>
            {accuracy && (
              <span className="text-xs text-gray-400">
                {formatAccuracy(accuracy)}
              </span>
            )}
          </div>
        )}

        {/* Active far state */}
        {widgetState === "active-far" && distanceToProject && (
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-700">
                {formatDistance(distanceToProject)} unna
              </span>
              <span className="text-xs text-gray-400">
                Ruter fra din posisjon
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
