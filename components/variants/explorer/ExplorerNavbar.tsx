"use client";

import type { TravelMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Footprints, Bike, Car } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ExplorerNavbarProps {
  travelMode: TravelMode;
  onSetTravelMode: (mode: TravelMode) => void;
}

const travelModeConfig: { mode: TravelMode; label: string; Icon: LucideIcon }[] = [
  { mode: "walk", label: "Til fots", Icon: Footprints },
  { mode: "bike", label: "Sykkel", Icon: Bike },
  { mode: "car", label: "Bil", Icon: Car },
];

export default function ExplorerNavbar({
  travelMode,
  onSetTravelMode,
}: ExplorerNavbarProps) {
  return (
    <nav className="fixed left-0 top-0 bottom-0 w-[180px] bg-white border-r border-gray-200 z-40 flex flex-col justify-end py-4 px-3 gap-1">
      {travelModeConfig.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          onClick={() => onSetTravelMode(mode)}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
            travelMode === mode
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:bg-gray-100"
          )}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
