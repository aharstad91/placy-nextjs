"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Star, MapPin } from "lucide-react";
import type { PublicPOI } from "@/lib/public-queries";
import { getIcon } from "@/lib/utils/map-icons";
import SaveButton from "@/components/public/SaveButton";

const GuideStickyMap = dynamic(() => import("./GuideStickyMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#f5f3f0] animate-pulse flex items-center justify-center">
      <span className="text-sm text-[#a0937d]">Laster kart...</span>
    </div>
  ),
});

interface GuideMapLayoutProps {
  pois: PublicPOI[];
  areaSlug: string;
  /** When true, cards interact with map instead of navigating to detail page */
  interactive?: boolean;
}

export default function GuideMapLayout({ pois, areaSlug, interactive = false }: GuideMapLayoutProps) {
  const [activePOIId, setActivePOIId] = useState<string | null>(null);
  const [activePOISource, setActivePOISource] = useState<"card" | "marker">(
    "card"
  );
  const [showMobileMap, setShowMobileMap] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Card click → toggle highlight + fly map to POI
  const handleCardLocate = useCallback((poiId: string) => {
    setActivePOIId((prev) => (prev === poiId ? null : poiId));
    setActivePOISource("card");
  }, []);

  // Marker click → highlight card + scroll to it
  const handleMarkerClick = useCallback((poiId: string) => {
    setActivePOIId((prev) => (prev === poiId ? null : poiId));
    setActivePOISource("marker");

    const card = cardRefs.current.get(poiId);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Link-mode: click on a card → deselect (let Link handle navigation)
  const handleCardClick = useCallback(() => {
    setActivePOIId(null);
  }, []);

  // Click on empty map area → deselect
  const handleMapClick = useCallback(() => {
    setActivePOIId(null);
  }, []);

  return (
    <div className="lg:flex lg:gap-0">
      {/* Mobile map toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setShowMobileMap((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#eae6e1] rounded-lg text-sm font-medium text-[#1a1a1a] hover:border-[#d4cfc8] hover:shadow-sm transition-all w-full justify-center"
        >
          <MapPin className="w-4 h-4 text-[#a0937d]" />
          {showMobileMap ? "Skjul kart" : "Vis kart"}
        </button>

        {showMobileMap && (
          <div className="mt-3 h-[250px] rounded-lg overflow-hidden border border-[#eae6e1]">
            <GuideStickyMap
              pois={pois}
              activePOIId={activePOIId}
              activePOISource={activePOISource}
              onMarkerClick={handleMarkerClick}
              onMapClick={handleMapClick}
            />
          </div>
        )}
      </div>

      {/* Card list — 60% on desktop */}
      <div className="lg:w-[60%] lg:pr-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pois.map((poi) => {
            const imageUrl =
              poi.featuredImage ??
              (poi.photoReference
                ? `/api/places/photo?photoReference=${encodeURIComponent(poi.photoReference)}&maxWidth=400`
                : null);
            const CategoryIcon = getIcon(poi.category.icon);
            const isActive = activePOIId === poi.id;

            return (
              <div
                key={poi.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(poi.id, el);
                  else cardRefs.current.delete(poi.id);
                }}
                data-poi-id={poi.id}
                className={`group relative bg-white rounded-lg overflow-hidden border transition-all ${
                  isActive
                    ? "border-[#b45309] ring-2 ring-[#b45309]/20 shadow-md"
                    : "border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm"
                }`}
              >
                {interactive ? (
                  /* Interactive mode: card click → map interaction */
                  <div
                    className="block cursor-pointer"
                    onClick={() => handleCardLocate(poi.id)}
                  >
                    <CardContent
                      poi={poi}
                      imageUrl={imageUrl}
                      CategoryIcon={CategoryIcon}
                    />
                  </div>
                ) : (
                  /* Link mode: card click → navigate to detail page */
                  <>
                    <Link
                      href={`/${areaSlug}/steder/${poi.slug}`}
                      className="block"
                      onClick={handleCardClick}
                    >
                      <CardContent
                        poi={poi}
                        imageUrl={imageUrl}
                        CategoryIcon={CategoryIcon}
                      />
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardLocate(poi.id);
                      }}
                      className="absolute bottom-3 right-3 p-1.5 rounded-md bg-[#f5f3f0] hover:bg-[#eae6e1] text-[#6a6a6a] hover:text-[#1a1a1a] transition-colors"
                      title="Vis på kart"
                      aria-label={`Vis ${poi.name} på kartet`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky map — 40% on desktop */}
      <div className="hidden lg:block lg:w-[40%]">
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] rounded-lg overflow-hidden border border-[#eae6e1]">
          <GuideStickyMap
            pois={pois}
            activePOIId={activePOIId}
            activePOISource={activePOISource}
            onMarkerClick={handleMarkerClick}
            onMapClick={handleMapClick}
          />
        </div>
      </div>
    </div>
  );
}

function CardContent({
  poi,
  imageUrl,
  CategoryIcon,
}: {
  poi: PublicPOI;
  imageUrl: string | null;
  CategoryIcon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <>
      <div className="relative">
        {imageUrl ? (
          <div className="aspect-[16/9] bg-[#f5f3f0] overflow-hidden relative">
            <Image
              src={imageUrl}
              alt={poi.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className="aspect-[16/9] flex items-center justify-center"
            style={{ backgroundColor: poi.category.color + "18" }}
          >
            <CategoryIcon
              className="w-8 h-8"
              style={{ color: poi.category.color }}
            />
          </div>
        )}
        <SaveButton
          poiId={poi.id}
          poiName={poi.name}
          className="absolute top-2 right-2 bg-white/70 backdrop-blur-sm"
        />
      </div>
      <div className="p-3">
        <span
          className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mb-1"
          style={{
            backgroundColor: poi.category.color + "18",
            color: poi.category.color,
          }}
        >
          {poi.category.name}
        </span>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-[#1a1a1a] group-hover:underline leading-snug">
            {poi.name}
          </h3>
          {poi.googleRating != null && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
              <span className="text-xs font-semibold text-[#1a1a1a]">
                {poi.googleRating.toFixed(1)}
              </span>
            </div>
          )}
        </div>
        {poi.editorialHook && (
          <p className="text-xs text-[#6a6a6a] leading-relaxed line-clamp-2">
            {poi.editorialHook}
          </p>
        )}
      </div>
    </>
  );
}
