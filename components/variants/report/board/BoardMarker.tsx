"use client";

import { Marker } from "react-map-gl/mapbox";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import type { BoardPOI } from "./board-data";

interface Props {
  poi: BoardPOI;
  color: string;
  icon: string;
  isActive: boolean;
  isDimmed: boolean;
  onClick: () => void;
}

export function BoardMarker({ poi, color, icon, isActive, isDimmed, onClick }: Props) {
  const Icon = getFilledIcon(poi.raw.category.icon || icon);

  return (
    <Marker
      longitude={poi.coordinates.lng}
      latitude={poi.coordinates.lat}
      anchor="bottom"
      offset={[0, 0]}
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick();
      }}
      style={{ cursor: "pointer", zIndex: isActive ? 5 : 1 }}
    >
      <div
        className={`relative flex items-center justify-center rounded-full border-2 border-white shadow-md transition-all duration-200 ${
          isActive ? "w-11 h-11 scale-110" : "w-8 h-8"
        } ${isDimmed && !isActive ? "opacity-60" : "opacity-100"}`}
        style={{ backgroundColor: color }}
      >
        <Icon className="w-4 h-4 text-white" weight="fill" />
      </div>
    </Marker>
  );
}
