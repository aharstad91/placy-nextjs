"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";

interface StoryPhotoGridProps {
  photos: readonly { name: string; imageUrl: string }[];
  themeColor: string;
  staggerDelay?: number;
}

export default memo(function StoryPhotoGrid({
  photos,
  themeColor,
  staggerDelay = 0,
}: StoryPhotoGridProps) {
  const revealRef = useScrollReveal();
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  const handleImgError = (index: number) => {
    setImgErrors((prev) => new Set(prev).add(index));
  };

  if (photos.length === 0) return null;

  return (
    <div
      ref={revealRef}
      className="w-full"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
        {photos.slice(0, 4).map((photo, i) => (
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
      </div>
    </div>
  );
});
