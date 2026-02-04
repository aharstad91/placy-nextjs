"use client";

import type { ReportTheme } from "./report-data";
import {
  UtensilsCrossed,
  Bus,
  ShoppingCart,
  Dumbbell,
  Landmark,
  TreePine,
  ShoppingBag,
  Wine,
  Mountain,
  Building2,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Bus,
  ShoppingCart,
  Dumbbell,
  Landmark,
  TreePine,
  ShoppingBag,
  Wine,
  Mountain,
  Building2,
};

interface ReportThemeIndexProps {
  themes: ReportTheme[];
}

export default function ReportThemeIndex({ themes }: ReportThemeIndexProps) {
  if (themes.length === 0) return null;

  const handleClick = (themeId: string) => {
    const el = document.getElementById(themeId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="col-span-6 max-w-4xl pb-2">
      <div className="flex flex-wrap gap-2">
        {themes.map((theme) => {
          const Icon = ICON_MAP[theme.icon];
          return (
            <button
              key={theme.id}
              onClick={() => handleClick(theme.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#5a5a5a] bg-white border border-[#eae6e1] rounded-full hover:border-[#c0b9ad] hover:text-[#1a1a1a] transition-colors"
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{theme.name}</span>
              <span className="text-[#a0937d]">({theme.stats.totalPOIs})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
