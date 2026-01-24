"use client";

import { ChevronRight, MapPin } from "lucide-react";
import type { ThemeStory } from "@/lib/types";

interface ThemeStoryCTAProps {
  themeStory: ThemeStory;
  poiCount: number;
  onClick?: () => void;
}

export function ThemeStoryCTA({ themeStory, poiCount, onClick }: ThemeStoryCTAProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-gradient-to-r from-primary-50 to-primary-100 hover:from-primary-100 hover:to-primary-150 border border-primary-200 rounded-xl p-6 text-left transition-colors group"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {/* Tittel */}
          <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-700 transition-colors">
            {themeStory.title}
          </h3>

          {/* Bridge-tekst */}
          {themeStory.bridgeText && (
            <p className="text-gray-600 mb-3">{themeStory.bridgeText}</p>
          )}

          {/* POI-teller */}
          <div className="flex items-center gap-2 text-sm text-primary-600">
            <MapPin className="w-4 h-4" />
            <span>{poiCount} steder å utforske</span>
          </div>
        </div>

        {/* Pil */}
        <ChevronRight className="w-6 h-6 text-primary-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
      </div>
    </button>
  );
}
