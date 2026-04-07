"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { getIcon } from "@/lib/utils/map-icons";

interface StoryMapStripeProps {
  staticMapUrl: string | null;
  themeColor: string;
  poiCount: number;
  themeName: string;
  staggerDelay?: number;
}

export default memo(function StoryMapStripe({
  staticMapUrl,
  themeColor,
  poiCount,
  themeName,
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
      <div className="w-full rounded-xl overflow-hidden border border-[#eae6e1]">
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

          {/* Theme label overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/30 to-transparent pt-8 pb-2.5 px-3">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-white" />
              <span className="text-xs font-medium text-white">
                {poiCount} {themeName.toLowerCase()}-steder
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
