"use client";

import { Marker } from "react-map-gl/mapbox";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import type { BoardPOI } from "./board-data";
import { markerCircleStyle } from "./marker-style";

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
  const circle = markerCircleStyle(color);

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
        className={`relative flex items-center justify-center rounded-full shadow-md transition-all duration-200 ${
          isActive
            ? "w-11 h-11 scale-110 border-[3px]"
            : "w-8 h-8 border-2"
        } ${isDimmed && !isActive ? "opacity-60" : "opacity-100"}`}
        style={{
          borderColor: circle.borderColor,
          backgroundColor: circle.backgroundColor,
          color: circle.borderColor,
        }}
      >
        <Icon className={isActive ? "w-5 h-5" : "w-4 h-4"} weight="fill" />
      </div>
    </Marker>
  );
}
