"use client";

import { cn } from "@/lib/utils";
import { formatEventDay } from "@/lib/hooks/useEventDayFilter";
import { Calendar } from "lucide-react";

interface ExplorerDayFilterProps {
  days: string[];
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  dayLabels?: Record<string, string>;
  variant?: "desktop" | "mobile";
}

export default function ExplorerDayFilter({
  days,
  selectedDay,
  onSelectDay,
  dayLabels,
  variant = "desktop",
}: ExplorerDayFilterProps) {
  if (days.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Filtrer etter dag"
      className={cn(
        "flex gap-1.5 overflow-x-auto scrollbar-hide",
        variant === "desktop" ? "px-4 py-2" : "px-3 py-1.5"
      )}
    >
      {/* "Alle dager" chip */}
      <button
        role="tab"
        aria-selected={selectedDay === null}
        onClick={() => onSelectDay(null)}
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0",
          selectedDay === null
            ? "bg-gray-900 text-white"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        )}
      >
        <Calendar className="h-3 w-3" />
        Alle dager
      </button>

      {/* Per-day chips */}
      {days.map((day) => (
        <button
          key={day}
          role="tab"
          aria-selected={selectedDay === day}
          onClick={() => onSelectDay(selectedDay === day ? null : day)}
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0",
            selectedDay === day
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {formatEventDay(day, dayLabels)}
        </button>
      ))}
    </div>
  );
}
