"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { MapPin, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";

interface StoryMapStripeProps {
  staticMapUrl: string | null;
  themeColor: string;
  poiCount: number;
  themeName: string;
  onExpand?: () => void;
  staggerDelay?: number;
}

export default memo(function StoryMapStripe({
  staticMapUrl,
  themeColor,
  poiCount,
  themeName,
  onExpand,
  staggerDelay = 0,
}: StoryMapStripeProps) {
  const revealRef = useScrollReveal();
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!staticMapUrl) return null;

  return (
    <div
      ref={revealRef}
      className="w-full"
      style={{ "--story-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onExpand}
        className="w-full rounded-xl overflow-hidden border border-[#eae6e1] hover:border-[#cdc8c0] transition-colors cursor-pointer group"
      >
        <div className="relative w-full h-[150px] bg-[#eae6e1]">
          <Image
            src={staticMapUrl}
            alt={`${poiCount} ${themeName.toLowerCase()}-steder i nærheten`}
            fill
            sizes="(min-width: 640px) 576px, 100vw"
            className={cn(
              "object-cover transition-opacity duration-500",
              imageLoaded ? "opacity-100" : "opacity-0",
            )}
            unoptimized
            onLoad={() => setImageLoaded(true)}
          />

          {/* Theme label + expand hint */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent pt-10 pb-2.5 px-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-white" />
                <span className="text-xs font-medium text-white">
                  {poiCount} {themeName.toLowerCase()}-steder
                </span>
              </div>
              <div className="flex items-center gap-1 text-white/80 group-hover:text-white transition-colors">
                <span className="text-[10px] font-medium">Vis kart</span>
                <Maximize2 className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
});
