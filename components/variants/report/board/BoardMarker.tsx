"use client";

import { Marker } from "react-map-gl/mapbox";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import type { BoardPOI } from "./board-data";
import { hexLightTint, markerCircleStyle } from "./marker-style";

interface Props {
  poi: BoardPOI;
  color: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}

export function BoardMarker({ poi, color, icon, isActive, onClick }: Props) {
  const Icon = getFilledIcon(poi.raw.category.icon || icon);
  const circle = markerCircleStyle(color);
  // Lysere border (~50% hvit-blanding) demper rammen så ikonet får primær
  // visuell vekt — mindre detaljer per markør, men hue-identitet bevart.
  // Aktiv markør beholder full farge for tydelig fokus-signal.
  const inactiveBorder = hexLightTint(color, 0.5);

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
        }`}
        style={{
          borderColor: isActive ? circle.borderColor : inactiveBorder,
          backgroundColor: circle.backgroundColor,
          color: circle.borderColor,
        }}
      >
        <Icon className={isActive ? "w-5 h-5" : "w-4 h-4"} weight="fill" />
      </div>
    </Marker>
  );
}
