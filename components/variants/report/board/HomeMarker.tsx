"use client";

import { Marker } from "react-map-gl/mapbox";
import { Home } from "lucide-react";

interface Props {
  coordinates: { lat: number; lng: number };
  name: string;
  onClick: () => void;
}

export function HomeMarker({ coordinates, name, onClick }: Props) {
  return (
    <Marker
      longitude={coordinates.lng}
      latitude={coordinates.lat}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick();
      }}
      style={{ cursor: "pointer", zIndex: 10 }}
    >
      <div className="flex flex-col items-center">
        {/* Permanent label */}
        <div className="mb-1.5 px-2.5 py-1 bg-white rounded-lg shadow-md border border-stone-200 whitespace-nowrap">
          <span className="text-xs font-semibold text-stone-900">{name}</span>
        </div>
        <div className="relative">
          <div className="absolute -inset-2 rounded-full bg-[#1a2952] opacity-20 animate-pulse" />
          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-[#1a2952] border-[2.5px] border-white shadow-lg">
            <Home className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    </Marker>
  );
}
