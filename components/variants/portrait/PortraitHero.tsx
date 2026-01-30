"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface PortraitHeroProps {
  title: string;
  subtitle: string;
  heroImages?: string[];
}

export default function PortraitHero({
  title,
  subtitle,
  heroImages,
}: PortraitHeroProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const heroSrc = heroImages?.[0];
  const hasValidImage = heroSrc && imgLoaded && !imgFailed;

  return (
    <section className="relative min-h-screen flex flex-col justify-end overflow-hidden">
      {/* Background: always show gradient, overlay image on top when loaded */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2d2926] via-[#3d3329] to-[#1a1715]" />
      {heroSrc && !imgFailed && (
        <img
          src={heroSrc}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
      )}
      {hasValidImage && (
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/60 to-[#1a1a1a]/20" />
      )}

      {/* Content */}
      <div className="relative z-10 max-w-prose mx-auto px-6 pb-20 md:pb-28 w-full">
        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white leading-[1.05] tracking-tight mb-6"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {title}
        </h1>
        <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-lg">
          {subtitle}
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <ChevronDown className="w-5 h-5 text-white/40" />
      </div>
    </section>
  );
}
