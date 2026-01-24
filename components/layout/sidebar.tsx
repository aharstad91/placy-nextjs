"use client";

import { useState } from "react";
import { Footprints, Bike, Car, MapIcon, Menu, X } from "lucide-react";
import { useTravelSettings } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Story, TravelMode, TimeBudget } from "@/lib/types";

interface SidebarProps {
  story: Story;
  onOpenMap?: () => void;
}

// Reisemodus-knapper
const travelModes: { mode: TravelMode; label: string; icon: React.ReactNode }[] = [
  { mode: "walk", label: "Til fots", icon: <Footprints className="w-4 h-4" /> },
  { mode: "bike", label: "Sykkel", icon: <Bike className="w-4 h-4" /> },
  { mode: "car", label: "Bil", icon: <Car className="w-4 h-4" /> },
];

// Tidsbudsjett-alternativer
const timeBudgets: TimeBudget[] = [5, 10, 15];

export function Sidebar({ story, onOpenMap }: SidebarProps) {
  const { travelMode, timeBudget, setTravelMode, setTimeBudget } = useTravelSettings();
  const [isOpen, setIsOpen] = useState(false);

  // Hent kapitler fra story sections
  const chapters = story.sections
    .filter((section) => section.title)
    .map((section) => ({
      id: section.id,
      title: section.title!,
    }));

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "w-64 h-screen bg-white border-r border-gray-200 flex flex-col z-50",
          // Mobile: fixed drawer with transform
          "fixed md:sticky top-0 left-0",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
      {/* Story Index header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-lg">📖</span>
              <span className="font-medium">Story Index</span>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden p-1 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

      {/* Chapters liste */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Chapters
        </h3>
        <nav className="space-y-1">
            {chapters.map((chapter) => (
              <a
                key={chapter.id}
                href={`#${chapter.id}`}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {chapter.title}
              </a>
            ))}
          </nav>
      </div>

      {/* Global Settings */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Global Settings
        </h3>

        {/* Travel Mode */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-2 block flex items-center gap-1">
            Travel Mode
            <span className="text-gray-400 cursor-help" title="Velg hvordan du vil reise">
              ⓘ
            </span>
          </label>
          <div className="flex gap-1">
            {travelModes.map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => setTravelMode(mode)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  travelMode === mode
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                )}
              >
                {icon}
                <span className="hidden xl:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Budget */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-2 block flex items-center gap-1">
            Time Budget
            <span className="text-gray-400 cursor-help" title="Maks reisetid">
              ⓘ
            </span>
          </label>
          <div className="flex gap-1">
            {timeBudgets.map((budget) => (
              <button
                key={budget}
                onClick={() => setTimeBudget(budget)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  timeBudget === budget
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                )}
              >
                ≤{budget} min
              </button>
            ))}
          </div>
        </div>

        {/* Open Map button */}
        <button
          onClick={onOpenMap}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
        >
          <MapIcon className="w-4 h-4" />
          Open full map
        </button>
      </div>
      </aside>
    </>
  );
}
