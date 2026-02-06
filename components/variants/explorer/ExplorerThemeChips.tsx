"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { POI } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface ExplorerThemeChipsProps {
  themes: ThemeDefinition[];
  pois: POI[];
  activeThemes: Set<string>;
  disabledCategories: Set<string>;
  onToggleTheme: (themeId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  variant?: "desktop" | "mobile";
}

export default function ExplorerThemeChips({
  themes,
  pois,
  activeThemes,
  disabledCategories,
  onToggleTheme,
  onToggleCategory,
  variant = "desktop",
}: ExplorerThemeChipsProps) {
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!openPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openPopover]);

  const getIcon = useCallback((iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  }, []);

  // Count POIs per theme and per category
  const { themeCountMap, categoryCountMap } = useMemo(() => {
    const themeMap = new Map<string, number>();
    const catMap = new Map<string, number>();

    for (const poi of pois) {
      catMap.set(poi.category.id, (catMap.get(poi.category.id) || 0) + 1);
    }

    for (const theme of themes) {
      let count = 0;
      for (const catId of theme.categories) {
        count += catMap.get(catId) || 0;
      }
      themeMap.set(theme.id, count);
    }

    return { themeCountMap: themeMap, categoryCountMap: catMap };
  }, [pois, themes]);

  // Get category name from POIs (derive from data)
  const categoryNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const poi of pois) {
      if (!names.has(poi.category.id)) {
        names.set(poi.category.id, poi.category.name);
      }
    }
    return names;
  }, [pois]);

  const isDesktop = variant === "desktop";

  return (
    <div
      className={cn(
        "flex gap-1.5",
        isDesktop ? "px-8 pb-3 flex-wrap" : "px-4 pb-2 overflow-x-auto scrollbar-hide"
      )}
    >
      {themes.map((theme) => {
        const Icon = getIcon(theme.icon);
        const isActive = activeThemes.has(theme.id);
        const count = themeCountMap.get(theme.id) || 0;
        const isPopoverOpen = openPopover === theme.id;

        // Count active categories within this theme
        const activeCatsInTheme = theme.categories.filter(
          (c) => !disabledCategories.has(c)
        ).length;
        const hasPartialFilter = isActive && activeCatsInTheme < theme.categories.length;

        if (count === 0) return null;

        return (
          <div key={theme.id} className="relative flex-shrink-0" ref={isPopoverOpen ? popoverRef : undefined}>
            <div
              className={cn(
                "flex items-center rounded-lg border transition-all duration-150",
                isDesktop ? "h-9" : "h-8",
                isActive
                  ? "border-transparent shadow-sm"
                  : "border-gray-200 bg-white text-gray-400"
              )}
              style={
                isActive
                  ? { backgroundColor: theme.color || "#6b7280", color: "white" }
                  : undefined
              }
            >
              {/* Main chip: toggle theme */}
              <button
                onClick={() => onToggleTheme(theme.id)}
                className={cn(
                  "flex items-center gap-1.5 h-full transition-colors",
                  isDesktop ? "px-3 text-sm" : "px-2.5 text-xs",
                  !isActive && "hover:bg-gray-50",
                  isActive && "hover:brightness-90"
                )}
              >
                <Icon className={cn(isDesktop ? "w-4 h-4" : "w-3.5 h-3.5")} />
                <span className="font-medium whitespace-nowrap">{theme.name}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    isDesktop ? "text-xs" : "text-[10px]",
                    isActive ? "opacity-70" : "text-gray-400"
                  )}
                >
                  ({count})
                </span>
                {hasPartialFilter && (
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isActive ? "bg-white/60" : "bg-gray-400"
                    )}
                  />
                )}
              </button>

              {/* Chevron: open sub-category dropdown */}
              {isActive && theme.categories.length > 1 && (
                <>
                  <div className="w-px h-4 bg-white/30" />
                  <button
                    onClick={() => setOpenPopover(isPopoverOpen ? null : theme.id)}
                    className={cn(
                      "flex items-center justify-center h-full transition-colors",
                      isDesktop ? "px-2" : "px-1.5",
                      "hover:brightness-90"
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform",
                        isPopoverOpen && "rotate-180"
                      )}
                    />
                  </button>
                </>
              )}
            </div>

            {/* Sub-category popover */}
            {isPopoverOpen && (
              <div className="absolute top-full mt-1.5 left-0 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50">
                {theme.categories.map((catId) => {
                  const catCount = categoryCountMap.get(catId) || 0;
                  if (catCount === 0) return null;

                  const catName = categoryNames.get(catId) || catId;
                  const isCatActive = !disabledCategories.has(catId);

                  return (
                    <button
                      key={catId}
                      onClick={() => onToggleCategory(catId)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors",
                          isCatActive
                            ? "border-transparent text-white"
                            : "border-gray-300 bg-white"
                        )}
                        style={
                          isCatActive
                            ? { backgroundColor: theme.color || "#6b7280" }
                            : undefined
                        }
                      >
                        {isCatActive && <Check className="w-3 h-3" />}
                      </div>
                      <span className="flex-1 text-left">{catName}</span>
                      <span className="text-xs text-gray-400 tabular-nums">
                        {catCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
