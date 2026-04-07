"use client";

import { memo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";

interface StoryMapRevealProps {
  staticMapUrl: string | null;
  themeColor: string;
  poiCount: number;
  staggerDelay?: number;
}

export default memo(function StoryMapReveal({
  staticMapUrl,
  themeColor,
  poiCount,
  staggerDelay = 0,
}: StoryMapRevealProps) {
  const revealRef = useScrollReveal();
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!staticMapUrl) return null;

  return (
    <div
      ref={revealRef}
      className="w-full rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#eae6e1]"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <div className="relative aspect-[16/10] bg-[#eae6e1]">
        <Image
          src={staticMapUrl}
          alt={`Kart med ${poiCount} steder`}
          fill
          sizes="(min-width: 640px) 576px, 100vw"
          className={cn(
            "object-cover transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
            imageLoaded ? "opacity-100" : "opacity-0",
          )}
          unoptimized
          onLoad={() => setImageLoaded(true)}
        />

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

        {/* POI count badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
          <MapPin className="w-3.5 h-3.5" style={{ color: themeColor }} />
          <span className="text-xs font-medium text-[#1a1a1a]">
            {poiCount} steder
          </span>
        </div>
      </div>
    </div>
  );
});
