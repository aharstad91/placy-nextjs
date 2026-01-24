"use client";

import type { StorySection as StorySectionType, POI, TravelMode } from "@/lib/types";
import { POIList } from "@/components/poi";
import { Bus, UtensilsCrossed, Utensils, Coffee, Bike, Car, MapPin } from "lucide-react";

// Map kategori til ikon
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "DAGLIG LOGISTIKK": Bus,
  "TRANSPORT": Bus,
  "MAT & DRIKKE": UtensilsCrossed,
  "RESTAURANT": Utensils,
  "KAFÉ": Coffee,
  "SYKKEL": Bike,
  "PARKERING": Car,
};

interface StorySectionProps {
  section: StorySectionType;
  pois: POI[];
  travelMode: TravelMode;
  activePOI?: string | null;
  onPOIClick?: (poiId: string) => void;
  onShowAllClick?: () => void;
}

export function StorySection({
  section,
  pois,
  travelMode,
  activePOI,
  onPOIClick,
  onShowAllClick,
}: StorySectionProps) {
  const IconComponent = section.categoryLabel
    ? categoryIcons[section.categoryLabel.toUpperCase()] || MapPin
    : MapPin;

  return (
    <section id={section.id} className="mb-12 scroll-mt-8">
      {/* Kategori-label */}
      {section.categoryLabel && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <IconComponent className="w-4 h-4" />
          <span className="uppercase tracking-wider font-medium">{section.categoryLabel}</span>
        </div>
      )}

      {/* Kapitteltittel */}
      {section.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          {section.title}
        </h2>
      )}

      {/* Bridge-tekst */}
      {section.bridgeText && (
        <p className="text-gray-600 mb-6 max-w-2xl">
          {section.bridgeText}
        </p>
      )}

      {/* POI-liste (hvis type er poi_list) */}
      {section.type === "poi_list" && pois.length > 0 && (
        <POIList
          pois={pois}
          travelMode={travelMode}
          activePOI={activePOI}
          onPOIClick={onPOIClick}
          onShowAll={onShowAllClick}
          showAllLabel="Se alle punkter i denne kategorien"
        />
      )}

      {/* Tekst-innhold */}
      {section.type === "text" && section.content && (
        <div className="prose prose-gray max-w-none">
          <p>{section.content}</p>
        </div>
      )}

      {/* Bildegalleri */}
      {section.type === "image_gallery" && section.images && section.images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {section.images.map((image, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-200">
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                Bilde {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
