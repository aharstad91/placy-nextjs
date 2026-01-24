"use client";

import { useState, useMemo } from "react";
import type { Project, POI, Category } from "@/lib/types";
import { MapView } from "./map-view";
import * as LucideIcons from "lucide-react";

interface MasterMapProps {
  project: Project;
  onPOIClick?: (poiId: string) => void;
  className?: string;
}

export function MasterMap({ project, onPOIClick, className = "" }: MasterMapProps) {
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(project.categories.map((c) => c.id))
  );
  const [activePOI, setActivePOI] = useState<string | null>(null);

  // Filter POIs based on active categories
  const filteredPOIs = useMemo(() => {
    return project.pois.filter((poi) => activeCategories.has(poi.category.id));
  }, [project.pois, activeCategories]);

  // Toggle a category
  const toggleCategory = (categoryId: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Select/deselect all categories
  const toggleAll = () => {
    if (activeCategories.size === project.categories.length) {
      setActiveCategories(new Set());
    } else {
      setActiveCategories(new Set(project.categories.map((c) => c.id)));
    }
  };

  const handlePOIClick = (poiId: string) => {
    setActivePOI(poiId === activePOI ? null : poiId);
    onPOIClick?.(poiId);
  };

  // Get Lucide icon component
  const getIcon = (iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  };

  return (
    <div className={`relative flex flex-col h-full ${className}`}>
      {/* Category filter bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap gap-2 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        {/* Toggle all button */}
        <button
          onClick={toggleAll}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeCategories.size === project.categories.length
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {activeCategories.size === project.categories.length ? "Fjern alle" : "Vis alle"}
        </button>

        {/* Category toggles */}
        {project.categories.map((category) => {
          const Icon = getIcon(category.icon);
          const isActive = activeCategories.has(category.id);
          const count = project.pois.filter((p) => p.category.id === category.id).length;

          return (
            <button
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? "text-white shadow-sm"
                  : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              }`}
              style={{
                backgroundColor: isActive ? category.color : undefined,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{category.name}</span>
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive ? "bg-white/20" : "bg-gray-200"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapView
          center={project.centerCoordinates}
          pois={filteredPOIs}
          activePOI={activePOI}
          onPOIClick={handlePOIClick}
          showRoute={false}
        />
      </div>

      {/* POI count indicator */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
        <span className="text-sm text-gray-600">
          Viser <span className="font-semibold text-gray-900">{filteredPOIs.length}</span> av{" "}
          <span className="font-semibold text-gray-900">{project.pois.length}</span> steder
        </span>
      </div>
    </div>
  );
}
