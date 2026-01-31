"use client";

import { useCallback, useMemo } from "react";
import type { TravelMode, Category } from "@/lib/types";
import type { CategoryPackage } from "./explorer-packages";
import { cn } from "@/lib/utils";
import { Footprints, Bike, Car, Bookmark } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface ExplorerNavbarProps {
  travelMode: TravelMode;
  onSetTravelMode: (mode: TravelMode) => void;
  packages: CategoryPackage[];
  activePackage: string | null;
  activeCategories: Set<string>;
  categories: Category[];
  onSelectPackage: (id: string) => void;
  collectionCount: number;
  onOpenCollection: () => void;
}

const travelModeConfig: { mode: TravelMode; label: string; Icon: LucideIcons.LucideIcon }[] = [
  { mode: "walk", label: "Til fots", Icon: Footprints },
  { mode: "bike", label: "Sykkel", Icon: Bike },
  { mode: "car", label: "Bil", Icon: Car },
];

export default function ExplorerNavbar({
  travelMode,
  onSetTravelMode,
  packages,
  activePackage,
  activeCategories,
  categories,
  onSelectPackage,
  collectionCount,
  onOpenCollection,
}: ExplorerNavbarProps) {
  const getIcon = useCallback((iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  }, []);

  // Build a map of package id -> categories that exist in the project
  const packageCategories = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const result = new Map<string, Category[]>();
    for (const pkg of packages) {
      if (pkg.id === "all") continue;
      const cats = pkg.categoryIds
        .map((id) => catMap.get(id))
        .filter((c): c is Category => !!c);
      result.set(pkg.id, cats);
    }
    return result;
  }, [packages, categories]);

  const allIsActive = activePackage === "all" || activeCategories.size === categories.length;

  // Determine visual state per package.
  // When "alle" is active, don't highlight individual packages even if technically all their categories are on.
  const getPackageState = useCallback(
    (pkg: CategoryPackage): "full" | "partial" | "none" => {
      if (pkg.id === "all") {
        return allIsActive ? "full" : "none";
      }
      // When "alle" is selected, individual packages show no active state
      if (allIsActive) return "none";

      const cats = packageCategories.get(pkg.id) || [];
      if (cats.length === 0) return "none";
      const activeCount = cats.filter((c) => activeCategories.has(c.id)).length;
      if (activeCount === cats.length) return "full";
      if (activeCount > 0) return "partial";
      return "none";
    },
    [activeCategories, allIsActive, packageCategories]
  );

  // Render "alle" first, then the rest
  const sortedPackages = useMemo(() => {
    const allPkg = packages.find((p) => p.id === "all");
    const rest = packages.filter((p) => p.id !== "all");
    return allPkg ? [allPkg, ...rest] : rest;
  }, [packages]);

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-[60px] bg-white border-r border-gray-200 z-40 flex flex-col items-center py-3 gap-1">
      {/* Collection (top) */}
      <button
        onClick={onOpenCollection}
        className="group relative w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
      >
        <Bookmark className="w-5 h-5" />

        {/* Badge */}
        {collectionCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center">
            {collectionCount}
          </span>
        )}

        {/* Tooltip */}
        <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
          {collectionCount > 0 ? `Min samling (${collectionCount})` : "Min samling"}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
        </div>
      </button>

      {/* Separator */}
      <div className="w-6 h-px bg-gray-200 my-1" />

      {/* Package categories — "Alle" first */}
      {sortedPackages.map((pkg) => {
        const Icon = getIcon(pkg.icon);
        const state = getPackageState(pkg);
        const cats = packageCategories.get(pkg.id) || [];

        // Hide packages with no categories in the project (except "all")
        if (pkg.id !== "all" && cats.length === 0) return null;

        return (
          <button
            key={pkg.id}
            onClick={() => onSelectPackage(pkg.id)}
            className={cn(
              "group relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              state === "full"
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100"
            )}
          >
            <Icon className="w-5 h-5" />

            {/* Partial active dot */}
            {state === "partial" && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-500" />
            )}

            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
              {pkg.name}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
            </div>
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Separator */}
      <div className="w-6 h-px bg-gray-200 my-1" />

      {/* Travel Mode (bottom) */}
      {travelModeConfig.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          onClick={() => onSetTravelMode(mode)}
          className={cn(
            "group relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
            travelMode === mode
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:bg-gray-100"
          )}
        >
          <Icon className="w-5 h-5" />
          <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
          </div>
        </button>
      ))}
    </nav>
  );
}
