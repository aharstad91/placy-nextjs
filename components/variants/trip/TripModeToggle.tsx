"use client";

import type { TripMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Route, Compass } from "lucide-react";

interface TripModeToggleProps {
  mode: TripMode;
  onModeChange: (mode: TripMode) => void;
  className?: string;
}

export default function TripModeToggle({
  mode,
  onModeChange,
  className,
}: TripModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center bg-stone-100 rounded-lg p-0.5",
        className
      )}
    >
      <button
        onClick={() => onModeChange("guided")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          mode === "guided"
            ? "bg-white text-stone-900 shadow-sm"
            : "text-stone-500 hover:text-stone-700"
        )}
      >
        <Route className="w-3.5 h-3.5" />
        Anbefalt rute
      </button>
      <button
        onClick={() => onModeChange("free")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          mode === "free"
            ? "bg-white text-stone-900 shadow-sm"
            : "text-stone-500 hover:text-stone-700"
        )}
      >
        <Compass className="w-3.5 h-3.5" />
        Utforsk fritt
      </button>
    </div>
  );
}
