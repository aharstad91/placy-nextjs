"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { MapPin, Maximize2 } from "lucide-react";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";

interface StoryPhotoGridProps {
  photos: readonly { name: string; imageUrl: string }[];
  themeColor: string;
  themeName: string;
  poiCount: number;
  onExpandMap?: () => void;
  staggerDelay?: number;
}

export default memo(function StoryPhotoGrid({
  photos,
  themeColor,
  poiCount,
  onExpandMap,
  staggerDelay = 0,
}: StoryPhotoGridProps) {
  const revealRef = useScrollReveal();
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  const handleImgError = (index: number) => {
    setImgErrors((prev) => new Set(prev).add(index));
  };

  return (
    <div
      ref={revealRef}
      className="w-full"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
        {/* Up to 3 POI photo cells */}
        {photos.slice(0, 3).map((photo, i) => (
          <div key={i} className="relative aspect-square bg-[#eae6e1]">
            {!imgErrors.has(i) ? (
              <Image
                src={photo.imageUrl}
                alt={photo.name}
                fill
                sizes="(min-width: 640px) 288px, 50vw"
                className="object-cover"
                onError={() => handleImgError(i)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: themeColor + "18" }}
              >
                <span
                  className="text-xs font-medium px-2 text-center"
                  style={{ color: themeColor }}
                >
                  {photo.name}
                </span>
              </div>
            )}
            {/* Name overlay */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent pt-6 pb-1.5 px-2">
              <span className="text-[11px] font-medium text-white leading-tight line-clamp-1">
                {photo.name}
              </span>
            </div>
          </div>
        ))}

        {/* "Vis kart" cell — always the last cell */}
        <button
          type="button"
          onClick={onExpandMap}
          className="relative aspect-square bg-[#f0eeeb] hover:bg-[#e8e5e0] transition-colors cursor-pointer group flex flex-col items-center justify-center gap-2"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: themeColor + "18" }}
          >
            <MapPin className="w-5 h-5" style={{ color: themeColor }} />
          </div>
          <div className="text-center">
            <span className="text-[11px] font-semibold text-[#1a1a1a] block">
              Vis kart
            </span>
            <span className="text-[10px] text-[#a0937d]">
              {poiCount} steder
            </span>
          </div>
          <Maximize2 className="w-3 h-3 text-[#a0937d] group-hover:text-[#6a6a6a] transition-colors absolute top-2 right-2" />
        </button>
      </div>
    </div>
  );
});
